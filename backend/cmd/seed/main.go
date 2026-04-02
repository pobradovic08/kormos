package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	superadmin := flag.Bool("superadmin", false, "Create superadmin tenant and user")
	tenant := flag.Bool("tenant", false, "Create a new tenant with an initial owner")
	name := flag.String("name", "", "Tenant name (used with --tenant)")
	slug := flag.String("slug", "", "Tenant slug (used with --tenant)")
	ownerEmail := flag.String("owner-email", "", "Owner email (used with --tenant)")
	ownerName := flag.String("owner-name", "", "Owner display name (used with --tenant, defaults to email)")
	ownerPassword := flag.String("owner-password", "", "Owner password (used with --tenant)")
	flag.Parse()

	if !*superadmin && !*tenant {
		fmt.Fprintln(os.Stderr, "Usage:")
		fmt.Fprintln(os.Stderr, "  seed --superadmin")
		fmt.Fprintln(os.Stderr, "  seed --tenant --name \"Acme Corp\" --slug acme --owner-email admin@acme.com --owner-password secret")
		os.Exit(1)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	encryptionKey := os.Getenv("ENCRYPTION_KEY")
	if encryptionKey == "" {
		log.Fatal("ENCRYPTION_KEY environment variable is not set")
	}

	ctx := context.Background()

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	if *superadmin {
		seedSuperadmin(ctx, conn)
	}

	if *tenant {
		if *name == "" || *slug == "" || *ownerEmail == "" || *ownerPassword == "" {
			fmt.Fprintln(os.Stderr, "Error: --name, --slug, --owner-email, and --owner-password are required with --tenant")
			os.Exit(1)
		}
		displayName := *ownerName
		if displayName == "" {
			displayName = *ownerEmail
		}
		seedTenant(ctx, conn, *name, *slug, *ownerEmail, displayName, *ownerPassword)
	}
}

func seedSuperadmin(ctx context.Context, conn *pgx.Conn) {
	// Hash the default password.
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		log.Fatalf("Failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Create the "System" tenant.
	var tenantID string
	err = tx.QueryRow(ctx,
		`INSERT INTO tenants (name, slug)
		 VALUES ($1, $2)
		 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id`,
		"System", "system",
	).Scan(&tenantID)
	if err != nil {
		log.Fatalf("Failed to create system tenant: %v", err)
	}

	// Create the superadmin user.
	var userID string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (email) DO UPDATE
		    SET password_hash = EXCLUDED.password_hash,
		        name = EXCLUDED.name,
		        role = EXCLUDED.role
		 RETURNING id`,
		tenantID, "admin@localhost", string(passwordHash), "Super Admin", "owner",
	).Scan(&userID)
	if err != nil {
		log.Fatalf("Failed to create superadmin user: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}

	fmt.Println("Superadmin seed completed successfully.")
	fmt.Println()
	fmt.Printf("  Tenant: System (slug: system, id: %s)\n", tenantID)
	fmt.Printf("  User:   Super Admin <admin@localhost> (id: %s)\n", userID)
	fmt.Printf("  Role:   owner\n")
	fmt.Printf("  Password: admin\n")
	fmt.Println()
	fmt.Println("Please change the default password after first login.")
}

func seedTenant(ctx context.Context, conn *pgx.Conn, name, slug, ownerEmail, ownerName, ownerPassword string) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(ownerPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		log.Fatalf("Failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Create the tenant.
	var tenantID string
	err = tx.QueryRow(ctx,
		`INSERT INTO tenants (name, slug)
		 VALUES ($1, $2)
		 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id`,
		name, slug,
	).Scan(&tenantID)
	if err != nil {
		log.Fatalf("Failed to create tenant: %v", err)
	}

	// Create the owner user.
	var userID string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (email) DO UPDATE
		    SET password_hash = EXCLUDED.password_hash,
		        name = EXCLUDED.name,
		        role = EXCLUDED.role,
		        tenant_id = EXCLUDED.tenant_id
		 RETURNING id`,
		tenantID, ownerEmail, string(passwordHash), ownerName, "owner",
	).Scan(&userID)
	if err != nil {
		log.Fatalf("Failed to create owner user: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}

	fmt.Println("Tenant seed completed successfully.")
	fmt.Println()
	fmt.Printf("  Tenant: %s (slug: %s, id: %s)\n", name, slug, tenantID)
	fmt.Printf("  User:   %s <%s> (id: %s)\n", ownerName, ownerEmail, userID)
	fmt.Printf("  Role:   owner\n")
	fmt.Println()
}
