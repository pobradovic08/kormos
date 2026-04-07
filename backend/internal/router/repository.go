package router

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Router represents a managed RouterOS device in the database.
type Router struct {
	ID                string
	TenantID          string
	ClusterID         string
	Role              string
	ClusterName       string
	Name              string
	Hostname          string
	Host              string
	Port              int
	UsernameEncrypted []byte
	PasswordEncrypted []byte
	IsReachable       bool
	LastSeen          *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// Repository provides CRUD operations for routers scoped by tenant.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new router Repository backed by the given pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Create inserts a new router into the database. The router's ID and timestamps
// are populated by the database and written back to the struct.
func (r *Repository) Create(ctx context.Context, tenantID string, router *Router) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO routers (tenant_id, name, hostname, host, port, username_encrypted, password_encrypted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, created_at, updated_at`,
		tenantID,
		router.Name,
		router.Hostname,
		router.Host,
		router.Port,
		router.UsernameEncrypted,
		router.PasswordEncrypted,
	).Scan(&router.ID, &router.CreatedAt, &router.UpdatedAt)
	if err != nil {
		return fmt.Errorf("router: create: %w", err)
	}
	router.TenantID = tenantID
	return nil
}

// List returns all routers belonging to the given tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]Router, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.tenant_id, COALESCE(r.cluster_id::text, ''), COALESCE(r.role::text, 'master'),
		        COALESCE(c.name, ''),
		        r.name, r.hostname, r.host, r.port,
		        r.username_encrypted, r.password_encrypted,
		        r.is_reachable, r.last_seen, r.created_at, r.updated_at
		   FROM routers r
		   LEFT JOIN clusters c ON c.id = r.cluster_id
		  WHERE r.tenant_id = $1
		  ORDER BY r.name`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("router: list: %w", err)
	}
	defer rows.Close()

	var routers []Router
	for rows.Next() {
		var rt Router
		if err := rows.Scan(
			&rt.ID, &rt.TenantID, &rt.ClusterID, &rt.Role,
			&rt.ClusterName,
			&rt.Name, &rt.Hostname, &rt.Host, &rt.Port,
			&rt.UsernameEncrypted, &rt.PasswordEncrypted,
			&rt.IsReachable, &rt.LastSeen, &rt.CreatedAt, &rt.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("router: list scan: %w", err)
		}
		routers = append(routers, rt)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("router: list rows: %w", err)
	}

	return routers, nil
}

// GetByID returns a single router by its ID scoped to the given tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*Router, error) {
	var rt Router
	err := r.pool.QueryRow(ctx,
		`SELECT r.id, r.tenant_id, COALESCE(r.cluster_id::text, ''), COALESCE(r.role::text, 'master'),
		        COALESCE(c.name, ''),
		        r.name, r.hostname, r.host, r.port,
		        r.username_encrypted, r.password_encrypted,
		        r.is_reachable, r.last_seen, r.created_at, r.updated_at
		   FROM routers r
		   LEFT JOIN clusters c ON c.id = r.cluster_id
		  WHERE r.tenant_id = $1 AND r.id = $2`,
		tenantID, id,
	).Scan(
		&rt.ID, &rt.TenantID, &rt.ClusterID, &rt.Role,
		&rt.ClusterName,
		&rt.Name, &rt.Hostname, &rt.Host, &rt.Port,
		&rt.UsernameEncrypted, &rt.PasswordEncrypted,
		&rt.IsReachable, &rt.LastSeen, &rt.CreatedAt, &rt.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("router: get by id: %w", err)
	}
	return &rt, nil
}

// Update modifies an existing router in the database. Only the fields name,
// hostname, host, port, username_encrypted, and password_encrypted are updated.
func (r *Repository) Update(ctx context.Context, tenantID string, router *Router) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE routers
		    SET name = $1, hostname = $2, host = $3, port = $4,
		        username_encrypted = $5, password_encrypted = $6,
		        updated_at = now()
		  WHERE tenant_id = $7 AND id = $8`,
		router.Name,
		router.Hostname,
		router.Host,
		router.Port,
		router.UsernameEncrypted,
		router.PasswordEncrypted,
		tenantID,
		router.ID,
	)
	if err != nil {
		return fmt.Errorf("router: update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("router: update: not found")
	}
	return nil
}

// Delete removes a router by its ID scoped to the given tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM routers WHERE tenant_id = $1 AND id = $2`,
		tenantID, id,
	)
	if err != nil {
		return fmt.Errorf("router: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("router: delete: not found")
	}
	return nil
}

// UpdateReachability sets the is_reachable flag and last_seen timestamp for a
// router identified by its ID (not tenant-scoped, used by background jobs).
func (r *Repository) UpdateReachability(ctx context.Context, id string, reachable bool) error {
	var lastSeen interface{}
	if reachable {
		lastSeen = time.Now()
	}

	tag, err := r.pool.Exec(ctx,
		`UPDATE routers SET is_reachable = $1, last_seen = COALESCE($2, last_seen), updated_at = now() WHERE id = $3`,
		reachable, lastSeen, id,
	)
	if err != nil {
		return fmt.Errorf("router: update reachability: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("router: update reachability: not found")
	}
	return nil
}
