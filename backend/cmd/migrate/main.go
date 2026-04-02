package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/pobradovic08/kormos/backend/internal/db"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "up" {
		fmt.Fprintf(os.Stderr, "Usage: %s up\n", os.Args[0])
		os.Exit(1)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	ctx := context.Background()

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	// Create schema_migrations tracking table if it does not exist.
	_, err = conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create schema_migrations table: %v", err)
	}

	// Read all .sql files from the embedded migrations directory.
	entries, err := fs.ReadDir(db.MigrationFS, "migrations")
	if err != nil {
		log.Fatalf("Failed to read migrations directory: %v", err)
	}

	// Sort entries by filename to ensure correct ordering.
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	applied := 0
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".sql") {
			continue
		}

		// Check if this migration has already been applied.
		var exists bool
		err = conn.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename = $1)",
			name,
		).Scan(&exists)
		if err != nil {
			log.Fatalf("Failed to check migration status for %s: %v", name, err)
		}
		if exists {
			log.Printf("Skipping (already applied): %s", name)
			continue
		}

		// Read the migration SQL.
		content, err := fs.ReadFile(db.MigrationFS, "migrations/"+name)
		if err != nil {
			log.Fatalf("Failed to read migration file %s: %v", name, err)
		}

		// Apply the migration inside a transaction.
		tx, err := conn.Begin(ctx)
		if err != nil {
			log.Fatalf("Failed to begin transaction for %s: %v", name, err)
		}

		_, err = tx.Exec(ctx, string(content))
		if err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("Failed to apply migration %s: %v", name, err)
		}

		_, err = tx.Exec(ctx,
			"INSERT INTO schema_migrations (filename) VALUES ($1)",
			name,
		)
		if err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("Failed to record migration %s: %v", name, err)
		}

		if err = tx.Commit(ctx); err != nil {
			log.Fatalf("Failed to commit migration %s: %v", name, err)
		}

		log.Printf("Applied: %s", name)
		applied++
	}

	if applied == 0 {
		log.Println("No new migrations to apply.")
	} else {
		log.Printf("Successfully applied %d migration(s).", applied)
	}
}
