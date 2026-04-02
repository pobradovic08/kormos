package audit

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Entry represents a single audit log record. The Router and User sub-structs
// carry denormalised names for list responses (populated via JOINs).
type Entry struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	RouterID      string    `json:"router_id"`
	UserID        string    `json:"user_id"`
	Module        string    `json:"module"`
	Action        string    `json:"action"`
	Operations    string    `json:"operations"`
	CommitMessage string    `json:"commit_message"`
	Status        string    `json:"status"`
	ErrorDetails  string    `json:"error_details,omitempty"`
	CreatedAt     time.Time `json:"created_at"`

	Router EntryRouter `json:"router"`
	User   EntryUser   `json:"user"`
}

// EntryRouter holds denormalised router information for audit list responses.
type EntryRouter struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// EntryUser holds denormalised user information for audit list responses.
type EntryUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// ListFilters controls the optional filtering and pagination for the List query.
type ListFilters struct {
	RouterID string
	UserID   string
	Module   string
	FromDate *time.Time
	ToDate   *time.Time
	Page     int
	PerPage  int
}

// Repository provides data access for the audit_log table.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new audit Repository backed by the given pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Create inserts a new audit log entry and populates entry.ID and entry.CreatedAt
// from the database defaults.
func (r *Repository) Create(ctx context.Context, entry *Entry) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO audit_log (tenant_id, router_id, user_id, module, action, operations, commit_message, status, error_details)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
		 RETURNING id, created_at`,
		entry.TenantID,
		entry.RouterID,
		entry.UserID,
		entry.Module,
		entry.Action,
		entry.Operations,
		entry.CommitMessage,
		entry.Status,
		entry.ErrorDetails,
	).Scan(&entry.ID, &entry.CreatedAt)
	if err != nil {
		return fmt.Errorf("audit: create: %w", err)
	}
	return nil
}

// List returns audit log entries for the given tenant, applying optional
// filters and pagination. It returns the matching entries, the total count
// (for pagination metadata), and any error.
func (r *Repository) List(ctx context.Context, tenantID string, filters ListFilters) ([]Entry, int, error) {
	// Normalise pagination defaults.
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PerPage < 1 {
		filters.PerPage = 20
	}

	// Build dynamic WHERE clause.
	conditions := []string{"a.tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.RouterID != "" {
		conditions = append(conditions, fmt.Sprintf("a.router_id = $%d", argIdx))
		args = append(args, filters.RouterID)
		argIdx++
	}
	if filters.UserID != "" {
		conditions = append(conditions, fmt.Sprintf("a.user_id = $%d", argIdx))
		args = append(args, filters.UserID)
		argIdx++
	}
	if filters.Module != "" {
		conditions = append(conditions, fmt.Sprintf("a.module = $%d", argIdx))
		args = append(args, filters.Module)
		argIdx++
	}
	if filters.FromDate != nil {
		conditions = append(conditions, fmt.Sprintf("a.created_at >= $%d", argIdx))
		args = append(args, *filters.FromDate)
		argIdx++
	}
	if filters.ToDate != nil {
		conditions = append(conditions, fmt.Sprintf("a.created_at <= $%d", argIdx))
		args = append(args, *filters.ToDate)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Count total matching rows.
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM audit_log a WHERE %s", where)
	var total int
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("audit: list count: %w", err)
	}

	// Fetch paginated results with JOINs for router and user names.
	offset := (filters.Page - 1) * filters.PerPage
	dataSQL := fmt.Sprintf(
		`SELECT a.id, a.tenant_id, a.router_id, a.user_id, a.module, a.action,
		        a.operations::text, a.commit_message, a.status, COALESCE(a.error_details, ''),
		        a.created_at,
		        r.name,
		        u.name, u.email
		   FROM audit_log a
		   JOIN routers r ON r.id = a.router_id
		   JOIN users u ON u.id = a.user_id
		  WHERE %s
		  ORDER BY a.created_at DESC
		  LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1,
	)
	args = append(args, filters.PerPage, offset)

	rows, err := r.pool.Query(ctx, dataSQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("audit: list query: %w", err)
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(
			&e.ID, &e.TenantID, &e.RouterID, &e.UserID, &e.Module, &e.Action,
			&e.Operations, &e.CommitMessage, &e.Status, &e.ErrorDetails,
			&e.CreatedAt,
			&e.Router.Name,
			&e.User.Name, &e.User.Email,
		); err != nil {
			return nil, 0, fmt.Errorf("audit: list scan: %w", err)
		}
		e.Router.ID = e.RouterID
		e.User.ID = e.UserID
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("audit: list rows: %w", err)
	}

	return entries, total, nil
}
