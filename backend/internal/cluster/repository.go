package cluster

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository provides data access for clusters and their routers.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new cluster Repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// CreateCluster inserts a new cluster row and returns it.
func (r *Repository) CreateCluster(ctx context.Context, tenantID, name string) (*Cluster, error) {
	c := &Cluster{TenantID: tenantID, Name: name}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO clusters (tenant_id, name) VALUES ($1, $2)
		 RETURNING id, created_at, updated_at`,
		tenantID, name,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("cluster: create: %w", err)
	}
	return c, nil
}

// CreateRouter inserts a router linked to a cluster.
func (r *Repository) CreateRouter(ctx context.Context, tenantID, clusterID string, name, hostname, host string, port int, role string, usernameEnc, passwordEnc []byte) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO routers (tenant_id, cluster_id, name, hostname, host, port, role, username_encrypted, password_encrypted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::router_role, $8, $9)
		 RETURNING id`,
		tenantID, clusterID, name, hostname, host, port, role, usernameEnc, passwordEnc,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("cluster: create router: %w", err)
	}
	return id, nil
}

// UpdateClusterName updates a cluster's name.
func (r *Repository) UpdateClusterName(ctx context.Context, tenantID, clusterID, name string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE clusters SET name = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3`,
		name, tenantID, clusterID,
	)
	if err != nil {
		return fmt.Errorf("cluster: update name: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("cluster: update name: not found")
	}
	return nil
}

// UpdateRouter updates a router's fields. If usernameEnc/passwordEnc are nil, credentials are not changed.
func (r *Repository) UpdateRouter(ctx context.Context, tenantID, routerID, name, hostname, host string, port int, role string, usernameEnc, passwordEnc []byte) error {
	var err error
	if usernameEnc != nil && passwordEnc != nil {
		_, err = r.pool.Exec(ctx,
			`UPDATE routers SET name=$1, hostname=$2, host=$3, port=$4, role=$5::router_role,
			 username_encrypted=$6, password_encrypted=$7, updated_at=now()
			 WHERE tenant_id=$8 AND id=$9`,
			name, hostname, host, port, role, usernameEnc, passwordEnc, tenantID, routerID,
		)
	} else {
		_, err = r.pool.Exec(ctx,
			`UPDATE routers SET name=$1, hostname=$2, host=$3, port=$4, role=$5::router_role, updated_at=now()
			 WHERE tenant_id=$6 AND id=$7`,
			name, hostname, host, port, role, tenantID, routerID,
		)
	}
	if err != nil {
		return fmt.Errorf("cluster: update router: %w", err)
	}
	return nil
}

// DeleteRouter removes a router by ID.
func (r *Repository) DeleteRouter(ctx context.Context, tenantID, routerID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM routers WHERE tenant_id = $1 AND id = $2`,
		tenantID, routerID,
	)
	if err != nil {
		return fmt.Errorf("cluster: delete router: %w", err)
	}
	return nil
}

// DeleteCluster removes a cluster and cascades to its routers.
func (r *Repository) DeleteCluster(ctx context.Context, tenantID, clusterID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM clusters WHERE tenant_id = $1 AND id = $2`,
		tenantID, clusterID,
	)
	if err != nil {
		return fmt.Errorf("cluster: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("cluster: delete: not found")
	}
	return nil
}

// GetByID fetches a single cluster by ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, clusterID string) (*Cluster, error) {
	c := &Cluster{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, created_at, updated_at FROM clusters WHERE tenant_id = $1 AND id = $2`,
		tenantID, clusterID,
	).Scan(&c.ID, &c.TenantID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("cluster: get by id: %w", err)
	}
	return c, nil
}

// ListClusters returns all clusters for a tenant.
func (r *Repository) ListClusters(ctx context.Context, tenantID string) ([]Cluster, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, tenant_id, name, created_at, updated_at FROM clusters WHERE tenant_id = $1 ORDER BY name`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("cluster: list: %w", err)
	}
	defer rows.Close()

	var clusters []Cluster
	for rows.Next() {
		var c Cluster
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("cluster: list scan: %w", err)
		}
		clusters = append(clusters, c)
	}
	return clusters, rows.Err()
}

// RouterRow is the raw database representation of a router with cluster fields.
type RouterRow struct {
	ID                string
	ClusterID         string
	Name              string
	Hostname          string
	Host              string
	Port              int
	Role              string
	UsernameEncrypted []byte
	PasswordEncrypted []byte
	IsReachable       bool
	LastSeen          *time.Time
}

// ListRoutersByCluster returns all routers for a given cluster.
func (r *Repository) ListRoutersByCluster(ctx context.Context, clusterID string) ([]RouterRow, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, cluster_id, name, hostname, host, port, role,
		        username_encrypted, password_encrypted, is_reachable, last_seen
		   FROM routers WHERE cluster_id = $1 ORDER BY role`,
		clusterID,
	)
	if err != nil {
		return nil, fmt.Errorf("cluster: list routers: %w", err)
	}
	defer rows.Close()

	var routers []RouterRow
	for rows.Next() {
		var rt RouterRow
		if err := rows.Scan(&rt.ID, &rt.ClusterID, &rt.Name, &rt.Hostname, &rt.Host, &rt.Port, &rt.Role,
			&rt.UsernameEncrypted, &rt.PasswordEncrypted, &rt.IsReachable, &rt.LastSeen); err != nil {
			return nil, fmt.Errorf("cluster: list routers scan: %w", err)
		}
		routers = append(routers, rt)
	}
	return routers, rows.Err()
}

// ListAllRoutersForTenant returns all routers with cluster info for a tenant.
func (r *Repository) ListAllRoutersForTenant(ctx context.Context, tenantID string) ([]RouterRow, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.cluster_id, r.name, r.hostname, r.host, r.port, r.role,
		        r.username_encrypted, r.password_encrypted, r.is_reachable, r.last_seen
		   FROM routers r
		   JOIN clusters c ON c.id = r.cluster_id
		  WHERE c.tenant_id = $1
		  ORDER BY r.name`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("cluster: list all routers: %w", err)
	}
	defer rows.Close()

	var routers []RouterRow
	for rows.Next() {
		var rt RouterRow
		if err := rows.Scan(&rt.ID, &rt.ClusterID, &rt.Name, &rt.Hostname, &rt.Host, &rt.Port, &rt.Role,
			&rt.UsernameEncrypted, &rt.PasswordEncrypted, &rt.IsReachable, &rt.LastSeen); err != nil {
			return nil, fmt.Errorf("cluster: list all routers scan: %w", err)
		}
		routers = append(routers, rt)
	}
	return routers, rows.Err()
}
