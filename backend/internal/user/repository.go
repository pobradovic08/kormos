package user

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// User represents a user record in the database.
type User struct {
	ID           string
	TenantID     string
	Email        string
	PasswordHash string
	Name         string
	Role         string
	IsActive     bool
	CreatedAt    time.Time
	LastLogin    *time.Time
}

// Repository provides CRUD operations for users scoped by tenant.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new user Repository backed by the given pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// List returns all users belonging to the given tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]User, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, tenant_id, email, password_hash, name, role, is_active, created_at, last_login
		   FROM users
		  WHERE tenant_id = $1
		  ORDER BY created_at`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("user: list: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(
			&u.ID, &u.TenantID, &u.Email, &u.PasswordHash, &u.Name,
			&u.Role, &u.IsActive, &u.CreatedAt, &u.LastLogin,
		); err != nil {
			return nil, fmt.Errorf("user: list scan: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("user: list rows: %w", err)
	}

	return users, nil
}

// Create inserts a new user into the database. The user's ID and timestamps
// are populated by the database and written back to the struct.
func (r *Repository) Create(ctx context.Context, u *User) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, name, role, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, created_at`,
		u.TenantID, u.Email, u.PasswordHash, u.Name, u.Role, u.IsActive,
	).Scan(&u.ID, &u.CreatedAt)
	if err != nil {
		return fmt.Errorf("user: create: %w", err)
	}
	return nil
}

// Update applies a partial update to a user's name and/or role. Only non-nil
// fields are updated.
func (r *Repository) Update(ctx context.Context, tenantID, id string, name *string, role *string) error {
	// Build the update dynamically based on which fields are provided.
	if name == nil && role == nil {
		return nil // nothing to update
	}

	query := "UPDATE users SET "
	args := []interface{}{}
	argIdx := 1
	first := true

	if name != nil {
		if !first {
			query += ", "
		}
		query += fmt.Sprintf("name = $%d", argIdx)
		args = append(args, *name)
		argIdx++
		first = false
	}

	if role != nil {
		if !first {
			query += ", "
		}
		query += fmt.Sprintf("role = $%d", argIdx)
		args = append(args, *role)
		argIdx++
		first = false
	}

	query += fmt.Sprintf(" WHERE tenant_id = $%d AND id = $%d", argIdx, argIdx+1)
	args = append(args, tenantID, id)

	tag, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("user: update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user: update: not found")
	}
	return nil
}

// Delete removes a user by ID scoped to the given tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM users WHERE tenant_id = $1 AND id = $2`,
		tenantID, id,
	)
	if err != nil {
		return fmt.Errorf("user: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user: delete: not found")
	}
	return nil
}

// CountOwners returns the number of users with role='owner' in the given tenant.
func (r *Repository) CountOwners(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND role = 'owner'`,
		tenantID,
	).Scan(&count)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, nil
		}
		return 0, fmt.Errorf("user: count owners: %w", err)
	}
	return count, nil
}

// GetByID returns a single user by ID scoped to the given tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, name, role, is_active, created_at, last_login
		   FROM users
		  WHERE tenant_id = $1 AND id = $2`,
		tenantID, id,
	).Scan(
		&u.ID, &u.TenantID, &u.Email, &u.PasswordHash, &u.Name,
		&u.Role, &u.IsActive, &u.CreatedAt, &u.LastLogin,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("user: get by id: %w", err)
	}
	return &u, nil
}
