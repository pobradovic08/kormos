package operation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository provides data access for operation_groups and operations tables.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new operation Repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// CreateGroup inserts a new operation group and returns the populated struct.
func (r *Repository) CreateGroup(ctx context.Context, tenantID, userID, description string) (*Group, error) {
	g := &Group{
		TenantID:    tenantID,
		UserID:      userID,
		Description: description,
	}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO operation_groups (tenant_id, user_id, description)
		 VALUES ($1, $2, $3)
		 RETURNING id, status, created_at, expires_at`,
		tenantID, userID, description,
	).Scan(&g.ID, &g.Status, &g.CreatedAt, &g.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("operation: create group: %w", err)
	}
	return g, nil
}

// InsertOperation inserts a single operation row within a group.
func (r *Repository) InsertOperation(ctx context.Context, op *Operation) error {
	beforeJSON, err := marshalNullable(op.BeforeState)
	if err != nil {
		return fmt.Errorf("operation: marshal before_state: %w", err)
	}
	afterJSON, err := marshalNullable(op.AfterState)
	if err != nil {
		return fmt.Errorf("operation: marshal after_state: %w", err)
	}

	err = r.pool.QueryRow(ctx,
		`INSERT INTO operations (group_id, router_id, module, operation_type, resource_path, resource_id, before_state, after_state, sequence, status, error)
		 VALUES ($1, $2, $3, $4::operation_type, $5, $6, $7::jsonb, $8::jsonb, $9, $10::operation_status, $11)
		 RETURNING id, applied_at`,
		op.GroupID, op.RouterID, op.Module, op.OperationType,
		op.ResourcePath, nullIfEmpty(op.ResourceID),
		beforeJSON, afterJSON,
		op.Sequence, op.Status, nullIfEmpty(op.Error),
	).Scan(&op.ID, &op.AppliedAt)
	if err != nil {
		return fmt.Errorf("operation: insert operation: %w", err)
	}
	return nil
}

// UpdateOperationStatus updates the status (and optional error) of a single operation.
func (r *Repository) UpdateOperationStatus(ctx context.Context, operationID, status, errMsg string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE operations SET status = $1::operation_status, error = $2 WHERE id = $3`,
		status, nullIfEmpty(errMsg), operationID,
	)
	if err != nil {
		return fmt.Errorf("operation: update operation status: %w", err)
	}
	return nil
}

// UpdateOperationResourceID sets the resource_id after a successful add.
func (r *Repository) UpdateOperationResourceID(ctx context.Context, operationID, resourceID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE operations SET resource_id = $1 WHERE id = $2`,
		resourceID, operationID,
	)
	if err != nil {
		return fmt.Errorf("operation: update resource_id: %w", err)
	}
	return nil
}

// UpdateGroupStatus updates the status of an operation group.
func (r *Repository) UpdateGroupStatus(ctx context.Context, groupID, status string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE operation_groups SET status = $1::operation_group_status WHERE id = $2`,
		status, groupID,
	)
	if err != nil {
		return fmt.Errorf("operation: update group status: %w", err)
	}
	return nil
}

// GetGroupByID fetches a single group with its operations.
func (r *Repository) GetGroupByID(ctx context.Context, groupID string) (*Group, error) {
	g := &Group{}
	err := r.pool.QueryRow(ctx,
		`SELECT g.id, g.tenant_id, g.user_id, g.description, g.status, g.created_at, g.expires_at,
		        u.name, u.email
		   FROM operation_groups g
		   JOIN users u ON u.id = g.user_id
		  WHERE g.id = $1`,
		groupID,
	).Scan(
		&g.ID, &g.TenantID, &g.UserID, &g.Description, &g.Status, &g.CreatedAt, &g.ExpiresAt,
		&g.User.Name, &g.User.Email,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("operation: get group: %w", err)
	}
	g.User.ID = g.UserID

	ops, err := r.getOperationsForGroup(ctx, groupID)
	if err != nil {
		return nil, err
	}
	g.Operations = ops
	return g, nil
}

// ListGroups returns paginated operation groups for a tenant, optionally filtered by router.
func (r *Repository) ListGroups(ctx context.Context, tenantID string, filters HistoryFilters) ([]Group, int, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PerPage < 1 {
		filters.PerPage = 20
	}

	conditions := []string{"g.tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if filters.RouterID != "" {
		conditions = append(conditions, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM operations o WHERE o.group_id = g.id AND o.router_id = $%d)", argIdx))
		args = append(args, filters.RouterID)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Count.
	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM operation_groups g WHERE %s", where)
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("operation: list count: %w", err)
	}

	// Fetch groups.
	offset := (filters.Page - 1) * filters.PerPage
	dataSQL := fmt.Sprintf(
		`SELECT g.id, g.tenant_id, g.user_id, g.description, g.status, g.created_at, g.expires_at,
		        u.name, u.email
		   FROM operation_groups g
		   JOIN users u ON u.id = g.user_id
		  WHERE %s
		  ORDER BY g.created_at DESC
		  LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1,
	)
	args = append(args, filters.PerPage, offset)

	rows, err := r.pool.Query(ctx, dataSQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("operation: list query: %w", err)
	}
	defer rows.Close()

	var groups []Group
	for rows.Next() {
		var g Group
		if err := rows.Scan(
			&g.ID, &g.TenantID, &g.UserID, &g.Description, &g.Status, &g.CreatedAt, &g.ExpiresAt,
			&g.User.Name, &g.User.Email,
		); err != nil {
			return nil, 0, fmt.Errorf("operation: list scan: %w", err)
		}
		g.User.ID = g.UserID
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("operation: list rows: %w", err)
	}

	// Fetch operations for each group.
	for i := range groups {
		ops, err := r.getOperationsForGroup(ctx, groups[i].ID)
		if err != nil {
			return nil, 0, err
		}
		groups[i].Operations = ops
	}

	return groups, total, nil
}

// getOperationsForGroup loads all operations for a group, ordered by sequence.
func (r *Repository) getOperationsForGroup(ctx context.Context, groupID string) ([]Operation, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, group_id, router_id, module, operation_type, resource_path,
		        COALESCE(resource_id, ''), before_state, after_state,
		        sequence, status, COALESCE(error, ''), applied_at
		   FROM operations
		  WHERE group_id = $1
		  ORDER BY sequence ASC`,
		groupID,
	)
	if err != nil {
		return nil, fmt.Errorf("operation: get operations: %w", err)
	}
	defer rows.Close()

	var ops []Operation
	for rows.Next() {
		var op Operation
		var beforeRaw, afterRaw []byte
		if err := rows.Scan(
			&op.ID, &op.GroupID, &op.RouterID, &op.Module, &op.OperationType,
			&op.ResourcePath, &op.ResourceID, &beforeRaw, &afterRaw,
			&op.Sequence, &op.Status, &op.Error, &op.AppliedAt,
		); err != nil {
			return nil, fmt.Errorf("operation: scan operation: %w", err)
		}
		if beforeRaw != nil {
			_ = json.Unmarshal(beforeRaw, &op.BeforeState)
		}
		if afterRaw != nil {
			_ = json.Unmarshal(afterRaw, &op.AfterState)
		}
		ops = append(ops, op)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("operation: operations rows: %w", err)
	}
	return ops, nil
}

// --- helpers ---

func marshalNullable(m map[string]interface{}) ([]byte, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
