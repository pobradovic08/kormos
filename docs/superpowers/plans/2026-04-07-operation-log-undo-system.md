# Operation Log & Undo System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the staged-commit model with direct-apply + undo history, where every router mutation is logged with before/after snapshots and can be undone within 7 days via strict state matching.

**Architecture:** New `operation` package in the Go backend (repository + service + handler) following existing three-layer pattern. All router mutations flow through `POST /api/v1/operations/execute`. Frontend removes commit store/panel and replaces with undo history panel that fetches from `GET /api/v1/operations/history`. Per-router mutex serializes concurrent operations.

**Tech Stack:** Go 1.22+ (pgx, chi, routeros client), PostgreSQL 16+ (new tables), React 19 + Mantine 9 + TanStack Query 5 (frontend)

---

## File Structure

### Backend (new files)

| File | Responsibility |
|------|---------------|
| `backend/internal/db/migrations/009_create_operation_log.sql` | Migration: `operation_groups` + `operations` tables |
| `backend/internal/operation/types.go` | Request/response types, enums, volatile field exclusion lists |
| `backend/internal/operation/repository.go` | PostgreSQL CRUD for operation groups and operations |
| `backend/internal/operation/service.go` | Execute flow (snapshot → apply → log), undo flow (strict match → reverse), per-router mutex |
| `backend/internal/operation/handler.go` | HTTP handlers: execute, undo, history |

### Backend (modified files)

| File | Change |
|------|--------|
| `backend/cmd/server/main.go` | Wire up operation handler, register `/api/v1/operations/*` routes |

### Frontend (new files)

| File | Responsibility |
|------|---------------|
| `frontend/src/api/operationsApi.ts` | TanStack Query hooks: useExecuteOperation, useUndoOperation, useOperationHistory |
| `frontend/src/components/undo/UndoHistoryButton.tsx` | Header button showing recent undo-able count |
| `frontend/src/components/undo/UndoHistoryPanel.tsx` | Drawer listing operation groups with undo buttons |

### Frontend (modified files)

| File | Change |
|------|--------|
| `frontend/src/api/types.ts` | Add OperationGroup, Operation types; remove PendingChange, CommitResponse, OperationResult |
| `frontend/src/components/shell/AppShell.tsx` | Replace CommitButton/CommitPanel with UndoHistoryButton/UndoHistoryPanel |
| `frontend/src/features/firewall/firewallApi.ts` | Rewrite mutations to call operations/execute |
| `frontend/src/features/firewall/FirewallForm.tsx` | Update mutation calls |
| `frontend/src/features/firewall/FirewallTable.tsx` | Update mutation calls (inline edits, delete, reorder) |
| `frontend/src/features/interfaces/InterfaceForm.tsx` | Remove stageChange/buildDiff, use operations/execute |
| Other feature API files | Same pattern as firewallApi.ts |

### Frontend (removed files)

| File | Reason |
|------|--------|
| `frontend/src/stores/useCommitStore.ts` | Replaced by server-side operation log |
| `frontend/src/components/commit/CommitPanel.tsx` | Replaced by UndoHistoryPanel |
| `frontend/src/components/commit/ChangeList.tsx` | No longer needed |
| `frontend/src/components/commit/ChangeDiff.tsx` | No longer needed |
| `frontend/src/components/shell/CommitButton.tsx` | Replaced by UndoHistoryButton |

---

## Task 1: Create branch and database migration

**Files:**
- Create: `backend/internal/db/migrations/009_create_operation_log.sql`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b 012-operation-log-undo master
```

- [ ] **Step 2: Write the migration SQL**

Create `backend/internal/db/migrations/009_create_operation_log.sql`:

```sql
CREATE TYPE operation_group_status AS ENUM ('applied', 'undone', 'failed', 'requires_attention');
CREATE TYPE operation_type AS ENUM ('add', 'modify', 'delete');
CREATE TYPE operation_status AS ENUM ('applied', 'undone', 'failed');

CREATE TABLE operation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status operation_group_status NOT NULL DEFAULT 'applied',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);

CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES operation_groups(id) ON DELETE CASCADE,
    router_id UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    operation_type operation_type NOT NULL,
    resource_path TEXT NOT NULL,
    resource_id TEXT,
    before_state JSONB,
    after_state JSONB,
    sequence INT NOT NULL,
    status operation_status NOT NULL DEFAULT 'applied',
    error TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operation_groups_tenant_created ON operation_groups(tenant_id, created_at DESC);
CREATE INDEX idx_operation_groups_user ON operation_groups(user_id);
CREATE INDEX idx_operations_group ON operations(group_id);
CREATE INDEX idx_operations_router ON operations(router_id);
```

- [ ] **Step 3: Verify migration compiles with embed**

```bash
cd backend && go build ./cmd/migrate/
```

Expected: successful build (the migrate binary embeds all `*.sql` files from the migrations directory).

- [ ] **Step 4: Commit**

```bash
git add backend/internal/db/migrations/009_create_operation_log.sql
git commit -m "Add migration for operation_groups and operations tables"
```

---

## Task 2: Backend types

**Files:**
- Create: `backend/internal/operation/types.go`

- [ ] **Step 1: Create the types file**

Create `backend/internal/operation/types.go`:

```go
package operation

import "time"

// Group status constants.
const (
	StatusApplied           = "applied"
	StatusUndone            = "undone"
	StatusFailed            = "failed"
	StatusRequiresAttention = "requires_attention"
)

// Operation type constants.
const (
	OpAdd    = "add"
	OpModify = "modify"
	OpDelete = "delete"
)

// VolatileFields lists RouterOS fields that change during normal operation
// and must be excluded from strict matching during undo.
var VolatileFields = map[string]bool{
	"bytes":           true,
	"packets":         true,
	"dynamic":         true,
	"running":         true,
	"invalid":         true,
	".nextid":         true,
	"actual-mtu":      true,
	"rx-byte":         true,
	"tx-byte":         true,
	"rx-packet":       true,
	"tx-packet":       true,
	"fp-rx-byte":      true,
	"fp-tx-byte":      true,
	"fp-rx-packet":    true,
	"fp-tx-packet":    true,
	"link-downs":      true,
	"last-link-up-time": true,
}

// Group represents a logical action (one or more operations applied together).
type Group struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	UserID      string    `json:"user_id"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`

	// Populated by JOINs in list queries.
	User       GroupUser    `json:"user"`
	Operations []Operation `json:"operations,omitempty"`
	CanUndo    bool         `json:"can_undo"`
}

// GroupUser holds denormalised user info for list responses.
type GroupUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Operation represents a single router mutation within a group.
type Operation struct {
	ID            string                 `json:"id"`
	GroupID       string                 `json:"group_id"`
	RouterID      string                 `json:"router_id"`
	Module        string                 `json:"module"`
	OperationType string                 `json:"operation_type"`
	ResourcePath  string                 `json:"resource_path"`
	ResourceID    string                 `json:"resource_id,omitempty"`
	BeforeState   map[string]interface{} `json:"before_state,omitempty"`
	AfterState    map[string]interface{} `json:"after_state,omitempty"`
	Sequence      int                    `json:"sequence"`
	Status        string                 `json:"status"`
	Error         string                 `json:"error,omitempty"`
	AppliedAt     time.Time              `json:"applied_at"`
}

// --- Request / Response types ---

// ExecuteRequest is the JSON body for POST /api/v1/operations/execute.
type ExecuteRequest struct {
	Description string             `json:"description"`
	Operations  []ExecuteOperation `json:"operations"`
}

// ExecuteOperation describes a single mutation in an execute request.
type ExecuteOperation struct {
	RouterID      string                 `json:"router_id"`
	Module        string                 `json:"module"`
	OperationType string                 `json:"operation_type"`
	ResourcePath  string                 `json:"resource_path"`
	ResourceID    string                 `json:"resource_id,omitempty"`
	Body          map[string]interface{} `json:"body"`
}

// ExecuteResponse is returned from a successful execute request.
type ExecuteResponse struct {
	GroupID    string              `json:"group_id"`
	Status     string              `json:"status"`
	Operations []OperationResult   `json:"operations"`
}

// OperationResult is the per-operation outcome in an execute response.
type OperationResult struct {
	ID         string                 `json:"id"`
	Status     string                 `json:"status"`
	ResourceID string                 `json:"resource_id,omitempty"`
	AfterState map[string]interface{} `json:"after_state,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

// UndoResponse is returned from an undo request.
type UndoResponse struct {
	GroupID          string          `json:"group_id"`
	Status           string          `json:"status"`
	Reason           string          `json:"reason,omitempty"`
	DriftedOperation *DriftedDetail  `json:"drifted_operation,omitempty"`
}

// DriftedDetail describes which operation blocked an undo due to state drift.
type DriftedDetail struct {
	ID            string                 `json:"id"`
	ResourcePath  string                 `json:"resource_path"`
	ResourceID    string                 `json:"resource_id"`
	ExpectedState map[string]interface{} `json:"expected_state"`
	CurrentState  map[string]interface{} `json:"current_state"`
}

// HistoryResponse is returned from the history list endpoint.
type HistoryResponse struct {
	Groups []Group `json:"groups"`
	Total  int     `json:"total"`
}

// HistoryFilters controls filtering and pagination for the history query.
type HistoryFilters struct {
	RouterID string
	Page     int
	PerPage  int
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/operation/
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/operation/types.go
git commit -m "Add operation log types, request/response structs, and volatile field list"
```

---

## Task 3: Backend repository

**Files:**
- Create: `backend/internal/operation/repository.go`

- [ ] **Step 1: Create the repository**

Create `backend/internal/operation/repository.go`:

```go
package operation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/operation/
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/operation/repository.go
git commit -m "Add operation repository with group and operation CRUD"
```

---

## Task 4: Backend service — execute flow

**Files:**
- Create: `backend/internal/operation/service.go`

- [ ] **Step 1: Create the service with execute flow**

Create `backend/internal/operation/service.go`:

```go
package operation

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Service orchestrates operation execution and undo against RouterOS devices.
type Service struct {
	repo      *Repository
	routerSvc *router.Service

	// Per-router mutexes to serialize operations against the same device.
	muMap   map[string]*sync.Mutex
	muMapMu sync.Mutex
}

// NewService creates a new operation Service.
func NewService(repo *Repository, routerSvc *router.Service) *Service {
	return &Service{
		repo:      repo,
		routerSvc: routerSvc,
		muMap:     make(map[string]*sync.Mutex),
	}
}

// routerMutex returns (or creates) a mutex for the given router ID.
func (s *Service) routerMutex(routerID string) *sync.Mutex {
	s.muMapMu.Lock()
	defer s.muMapMu.Unlock()
	mu, ok := s.muMap[routerID]
	if !ok {
		mu = &sync.Mutex{}
		s.muMap[routerID] = mu
	}
	return mu
}

// lockRouters acquires mutexes for all unique router IDs in the operations.
// Returns a function to unlock them all.
func (s *Service) lockRouters(ops []ExecuteOperation) func() {
	seen := make(map[string]bool)
	var mutexes []*sync.Mutex
	for _, op := range ops {
		if !seen[op.RouterID] {
			seen[op.RouterID] = true
			mu := s.routerMutex(op.RouterID)
			mu.Lock()
			mutexes = append(mutexes, mu)
		}
	}
	return func() {
		for _, mu := range mutexes {
			mu.Unlock()
		}
	}
}

// Execute applies a group of operations to routers, logging before/after state.
func (s *Service) Execute(ctx context.Context, tenantID, userID string, req ExecuteRequest) (*ExecuteResponse, error) {
	if len(req.Operations) == 0 {
		return nil, fmt.Errorf("operation: at least one operation is required")
	}

	// Lock all involved routers.
	unlock := s.lockRouters(req.Operations)
	defer unlock()

	// Create the group.
	group, err := s.repo.CreateGroup(ctx, tenantID, userID, req.Description)
	if err != nil {
		return nil, err
	}

	// Get RouterOS clients for each unique router.
	clients := make(map[string]*routeros.Client)
	for _, op := range req.Operations {
		if _, ok := clients[op.RouterID]; !ok {
			client, err := s.routerSvc.GetClientForRouter(ctx, tenantID, op.RouterID)
			if err != nil {
				_ = s.repo.UpdateGroupStatus(ctx, group.ID, StatusFailed)
				return nil, fmt.Errorf("operation: get client for router %s: %w", op.RouterID, err)
			}
			clients[op.RouterID] = client
		}
	}

	results := make([]OperationResult, 0, len(req.Operations))
	var appliedOps []Operation

	for i, execOp := range req.Operations {
		client := clients[execOp.RouterID]

		op := Operation{
			GroupID:       group.ID,
			RouterID:      execOp.RouterID,
			Module:        execOp.Module,
			OperationType: execOp.OperationType,
			ResourcePath:  execOp.ResourcePath,
			ResourceID:    execOp.ResourceID,
			Sequence:      i,
			Status:        StatusApplied,
		}

		// 1. Capture before state (for modify/delete).
		if execOp.OperationType == OpModify || execOp.OperationType == OpDelete {
			resourcePath := execOp.ResourcePath
			if execOp.ResourceID != "" {
				resourcePath = resourcePath + "/" + execOp.ResourceID
			}
			beforeState, err := fetchResourceState(ctx, client, resourcePath)
			if err != nil {
				// Mark this and remaining as failed, rollback applied.
				op.Status = StatusFailed
				op.Error = fmt.Sprintf("failed to read before state: %v", err)
				_ = s.repo.InsertOperation(ctx, &op)
				s.markRemainingFailed(ctx, group.ID, req.Operations, i+1)
				s.rollbackApplied(ctx, tenantID, group.ID, appliedOps, clients)
				return s.buildFailureResponse(ctx, group, results, i, op.Error)
			}
			op.BeforeState = beforeState
		}

		// 2. Apply the mutation.
		resourceID, err := applyOperation(ctx, client, execOp)
		if err != nil {
			op.Status = StatusFailed
			op.Error = err.Error()
			_ = s.repo.InsertOperation(ctx, &op)
			s.markRemainingFailed(ctx, group.ID, req.Operations, i+1)
			s.rollbackApplied(ctx, tenantID, group.ID, appliedOps, clients)
			return s.buildFailureResponse(ctx, group, results, i, op.Error)
		}

		// For add operations, capture the new resource ID.
		if execOp.OperationType == OpAdd && resourceID != "" {
			op.ResourceID = resourceID
		}

		// 3. Capture after state (for add/modify).
		if execOp.OperationType == OpAdd || execOp.OperationType == OpModify {
			afterPath := execOp.ResourcePath
			rid := op.ResourceID
			if rid == "" {
				rid = execOp.ResourceID
			}
			if rid != "" {
				afterPath = afterPath + "/" + rid
			}
			afterState, err := fetchResourceState(ctx, client, afterPath)
			if err != nil {
				// Apply succeeded but we can't read state — log warning but continue.
				op.AfterState = execOp.Body // Fall back to the request body.
			} else {
				op.AfterState = afterState
			}
		}

		// 4. Persist the operation.
		if err := s.repo.InsertOperation(ctx, &op); err != nil {
			// DB write failed — rollback the applied router change.
			op.Status = StatusFailed
			op.Error = fmt.Sprintf("failed to persist operation: %v", err)
			s.rollbackApplied(ctx, tenantID, group.ID, append(appliedOps, op), clients)
			return s.buildFailureResponse(ctx, group, results, i, op.Error)
		}

		appliedOps = append(appliedOps, op)
		results = append(results, OperationResult{
			ID:         op.ID,
			Status:     StatusApplied,
			ResourceID: op.ResourceID,
			AfterState: op.AfterState,
		})
	}

	resp := &ExecuteResponse{
		GroupID:    group.ID,
		Status:     StatusApplied,
		Operations: results,
	}
	return resp, nil
}

// markRemainingFailed inserts failed operation rows for operations that were never attempted.
func (s *Service) markRemainingFailed(ctx context.Context, groupID string, ops []ExecuteOperation, startIdx int) {
	for i := startIdx; i < len(ops); i++ {
		op := Operation{
			GroupID:       groupID,
			RouterID:      ops[i].RouterID,
			Module:        ops[i].Module,
			OperationType: ops[i].OperationType,
			ResourcePath:  ops[i].ResourcePath,
			ResourceID:    ops[i].ResourceID,
			Sequence:      i,
			Status:        StatusFailed,
			Error:         "not attempted: previous operation failed",
		}
		_ = s.repo.InsertOperation(ctx, &op)
	}
}

// rollbackApplied reverses already-applied operations in reverse order.
func (s *Service) rollbackApplied(ctx context.Context, tenantID, groupID string, applied []Operation, clients map[string]*routeros.Client) {
	allRolledBack := true
	for i := len(applied) - 1; i >= 0; i-- {
		op := applied[i]
		if op.Status != StatusApplied {
			continue
		}

		client := clients[op.RouterID]
		err := reverseOperation(ctx, client, op)
		if err != nil {
			allRolledBack = false
			_ = s.repo.UpdateOperationStatus(ctx, op.ID, StatusFailed, fmt.Sprintf("rollback failed: %v", err))
		} else {
			_ = s.repo.UpdateOperationStatus(ctx, op.ID, StatusUndone, "")
		}
	}

	if allRolledBack {
		_ = s.repo.UpdateGroupStatus(ctx, groupID, StatusFailed)
	} else {
		_ = s.repo.UpdateGroupStatus(ctx, groupID, StatusRequiresAttention)
	}
}

// buildFailureResponse constructs the response when execution fails.
func (s *Service) buildFailureResponse(ctx context.Context, group *Group, results []OperationResult, failedIdx int, errMsg string) (*ExecuteResponse, error) {
	// Reload the group to get current statuses.
	updated, err := s.repo.GetGroupByID(ctx, group.ID)
	if err != nil {
		// Return what we have.
		return &ExecuteResponse{
			GroupID: group.ID,
			Status:  StatusFailed,
		}, nil
	}

	opResults := make([]OperationResult, len(updated.Operations))
	for i, op := range updated.Operations {
		opResults[i] = OperationResult{
			ID:         op.ID,
			Status:     op.Status,
			ResourceID: op.ResourceID,
			Error:      op.Error,
		}
	}

	return &ExecuteResponse{
		GroupID:    group.ID,
		Status:     updated.Status,
		Operations: opResults,
	}, nil
}

// --- RouterOS interaction helpers ---

// fetchResourceState reads the current state of a resource from the router.
func fetchResourceState(ctx context.Context, client *routeros.Client, path string) (map[string]interface{}, error) {
	body, err := client.Get(ctx, path)
	if err != nil {
		return nil, err
	}
	var state map[string]interface{}
	if err := json.Unmarshal(body, &state); err != nil {
		return nil, fmt.Errorf("unmarshal resource state: %w", err)
	}
	return state, nil
}

// applyOperation sends the mutation to the router and returns the new resource ID (for adds).
func applyOperation(ctx context.Context, client *routeros.Client, op ExecuteOperation) (string, error) {
	switch op.OperationType {
	case OpAdd:
		respBody, err := client.Put(ctx, op.ResourcePath, op.Body)
		if err != nil {
			return "", err
		}
		// Extract .id from response.
		var parsed map[string]interface{}
		if err := json.Unmarshal(respBody, &parsed); err == nil {
			if id, ok := parsed[".id"].(string); ok {
				return id, nil
			}
		}
		return "", nil

	case OpModify:
		path := op.ResourcePath
		if op.ResourceID != "" {
			path = path + "/" + op.ResourceID
		}
		_, err := client.Patch(ctx, path, op.Body)
		return "", err

	case OpDelete:
		path := op.ResourcePath
		if op.ResourceID != "" {
			path = path + "/" + op.ResourceID
		}
		return "", client.Delete(ctx, path)

	default:
		return "", fmt.Errorf("unsupported operation type: %s", op.OperationType)
	}
}

// reverseOperation applies the inverse of a previously applied operation.
func reverseOperation(ctx context.Context, client *routeros.Client, op Operation) error {
	switch op.OperationType {
	case OpAdd:
		// Reverse of add = delete.
		path := op.ResourcePath
		if op.ResourceID != "" {
			path = path + "/" + op.ResourceID
		}
		return client.Delete(ctx, path)

	case OpModify:
		// Reverse of modify = patch back to before_state.
		path := op.ResourcePath
		if op.ResourceID != "" {
			path = path + "/" + op.ResourceID
		}
		_, err := client.Patch(ctx, path, op.BeforeState)
		return err

	case OpDelete:
		// Reverse of delete = re-create from before_state.
		_, err := client.Put(ctx, op.ResourcePath, op.BeforeState)
		return err

	default:
		return fmt.Errorf("unsupported operation type for reverse: %s", op.OperationType)
	}
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/operation/
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/operation/service.go
git commit -m "Add operation service with execute flow, rollback, and per-router locking"
```

---

## Task 5: Backend service — undo flow

**Files:**
- Modify: `backend/internal/operation/service.go`

- [ ] **Step 1: Add the Undo method and strict matching to service.go**

Append to `backend/internal/operation/service.go`, before the `// --- RouterOS interaction helpers ---` section:

```go
// Undo reverses all operations in a group using strict state matching.
func (s *Service) Undo(ctx context.Context, tenantID, userID, role, groupID string) (*UndoResponse, error) {
	group, err := s.repo.GetGroupByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("operation: get group for undo: %w", err)
	}
	if group == nil {
		return nil, fmt.Errorf("operation: group not found")
	}

	// Tenant check.
	if group.TenantID != tenantID {
		return nil, fmt.Errorf("operation: group not found")
	}

	// Permission check: owner or admin can undo anyone's; others only their own.
	if group.UserID != userID && role != "owner" && role != "admin" {
		return nil, fmt.Errorf("operation: permission denied: can only undo your own operations")
	}

	// Status check.
	if group.Status != StatusApplied {
		return &UndoResponse{
			GroupID: groupID,
			Status:  "undo_blocked",
			Reason:  fmt.Sprintf("group status is '%s', not 'applied'", group.Status),
		}, nil
	}

	// Expiry check.
	if time.Now().After(group.ExpiresAt) {
		return &UndoResponse{
			GroupID: groupID,
			Status:  "undo_blocked",
			Reason:  "operation group has expired (older than 7 days)",
		}, nil
	}

	// Lock all involved routers.
	routerIDs := make(map[string]bool)
	for _, op := range group.Operations {
		routerIDs[op.RouterID] = true
	}
	for rid := range routerIDs {
		mu := s.routerMutex(rid)
		mu.Lock()
		defer mu.Unlock()
	}

	// Get RouterOS clients.
	clients := make(map[string]*routeros.Client)
	for rid := range routerIDs {
		client, err := s.routerSvc.GetClientForRouter(ctx, tenantID, rid)
		if err != nil {
			return nil, fmt.Errorf("operation: get client for undo router %s: %w", rid, err)
		}
		clients[rid] = client
	}

	// Phase 1: Strict match validation (all operations, reverse order).
	for i := len(group.Operations) - 1; i >= 0; i-- {
		op := group.Operations[i]
		if op.Status != StatusApplied {
			continue
		}

		client := clients[op.RouterID]
		drifted, detail := s.checkStrictMatch(ctx, client, op)
		if drifted {
			return &UndoResponse{
				GroupID:          groupID,
				Status:           "undo_blocked",
				Reason:           "Resource modified since original operation",
				DriftedOperation: detail,
			}, nil
		}
	}

	// Phase 2: Apply reversals (all passed strict match).
	for i := len(group.Operations) - 1; i >= 0; i-- {
		op := group.Operations[i]
		if op.Status != StatusApplied {
			continue
		}

		client := clients[op.RouterID]
		err := reverseOperation(ctx, client, op)
		if err != nil {
			// This should be rare since we just validated, but handle it.
			_ = s.repo.UpdateGroupStatus(ctx, groupID, StatusRequiresAttention)
			return &UndoResponse{
				GroupID: groupID,
				Status:  "undo_blocked",
				Reason:  fmt.Sprintf("reversal failed for operation %s: %v", op.ID, err),
			}, nil
		}
		_ = s.repo.UpdateOperationStatus(ctx, op.ID, StatusUndone, "")
	}

	_ = s.repo.UpdateGroupStatus(ctx, groupID, StatusUndone)

	return &UndoResponse{
		GroupID: groupID,
		Status:  StatusUndone,
	}, nil
}

// checkStrictMatch verifies the resource's current state matches the logged after_state.
func (s *Service) checkStrictMatch(ctx context.Context, client *routeros.Client, op Operation) (bool, *DriftedDetail) {
	var currentState map[string]interface{}

	switch op.OperationType {
	case OpAdd, OpModify:
		// Resource should exist with after_state.
		path := op.ResourcePath
		if op.ResourceID != "" {
			path = path + "/" + op.ResourceID
		}
		state, err := fetchResourceState(ctx, client, path)
		if err != nil {
			return true, &DriftedDetail{
				ID:           op.ID,
				ResourcePath: op.ResourcePath,
				ResourceID:   op.ResourceID,
				ExpectedState: op.AfterState,
				CurrentState:  map[string]interface{}{"error": "resource not found or unreachable"},
			}
		}
		currentState = state

		if !configFieldsMatch(op.AfterState, currentState) {
			return true, &DriftedDetail{
				ID:            op.ID,
				ResourcePath:  op.ResourcePath,
				ResourceID:    op.ResourceID,
				ExpectedState: op.AfterState,
				CurrentState:  currentState,
			}
		}

	case OpDelete:
		// Resource should NOT exist (it was deleted).
		path := op.ResourcePath
		if op.ResourceID != "" {
			path = path + "/" + op.ResourceID
		}
		_, err := fetchResourceState(ctx, client, path)
		if err == nil {
			// Resource exists — someone re-created it.
			return true, &DriftedDetail{
				ID:            op.ID,
				ResourcePath:  op.ResourcePath,
				ResourceID:    op.ResourceID,
				ExpectedState: nil,
				CurrentState:  map[string]interface{}{"error": "resource exists but should have been deleted"},
			}
		}
		// Error means resource doesn't exist — that's expected.
	}

	return false, nil
}

// configFieldsMatch compares two states, excluding volatile fields.
func configFieldsMatch(expected, current map[string]interface{}) bool {
	for key, expectedVal := range expected {
		if VolatileFields[key] {
			continue
		}
		currentVal, exists := current[key]
		if !exists {
			return false
		}
		// Compare as JSON strings for deep equality.
		e, _ := json.Marshal(expectedVal)
		c, _ := json.Marshal(currentVal)
		if string(e) != string(c) {
			return false
		}
	}
	return true
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/operation/
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/operation/service.go
git commit -m "Add undo flow with strict state matching and config field comparison"
```

---

## Task 6: Backend HTTP handler

**Files:**
- Create: `backend/internal/operation/handler.go`

- [ ] **Step 1: Create the handler**

Create `backend/internal/operation/handler.go`:

```go
package operation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for operation endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new operation Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Execute handles POST /api/v1/operations/execute.
func (h *Handler) Execute(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	var req ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if len(req.Operations) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "At least one operation is required")
		return
	}
	if req.Description == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Description is required")
		return
	}

	resp, err := h.service.Execute(r.Context(), tenantID, claims.UserID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "execution_error", err.Error())
		return
	}

	status := http.StatusOK
	if resp.Status == StatusFailed || resp.Status == StatusRequiresAttention {
		status = http.StatusMultiStatus
	}
	writeJSON(w, status, resp)
}

// Undo handles POST /api/v1/operations/undo/{groupID}.
func (h *Handler) Undo(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	groupID := chi.URLParam(r, "groupID")
	if groupID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Group ID is required")
		return
	}

	resp, err := h.service.Undo(r.Context(), tenantID, claims.UserID, claims.Role, groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "undo_error", err.Error())
		return
	}

	if resp.Status == "undo_blocked" {
		writeJSON(w, http.StatusConflict, resp)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// History handles GET /api/v1/operations/history.
func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	filters := HistoryFilters{
		RouterID: r.URL.Query().Get("router_id"),
	}
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filters.Page = n
		}
	}
	if v := r.URL.Query().Get("per_page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filters.PerPage = n
		}
	}

	groups, total, err := h.service.repo.ListGroups(r.Context(), tenantID, filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list operation history")
		return
	}

	// Compute can_undo for each group.
	for i := range groups {
		g := &groups[i]
		g.CanUndo = g.Status == StatusApplied &&
			!isExpired(g) &&
			(g.UserID == claims.UserID || claims.Role == "owner" || claims.Role == "admin")
	}

	writeJSON(w, http.StatusOK, HistoryResponse{
		Groups: groups,
		Total:  total,
	})
}

func isExpired(g *Group) bool {
	return g.ExpiresAt.Before(now())
}

// now is a package-level function for testability.
var now = func() time.Time { return time.Now() }

// writeJSON serialises data as JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// writeError writes a standardised JSON error response.
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"error":   code,
		"message": message,
	})
}
```

- [ ] **Step 2: Add missing import**

The handler uses `time` package in `isExpired` and the `now` variable. Make sure the import block includes:

```go
import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && go build ./internal/operation/
```

Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/operation/handler.go
git commit -m "Add operation HTTP handlers for execute, undo, and history"
```

---

## Task 7: Wire up routes in main.go

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Add operation service and handler initialization**

In `backend/cmd/server/main.go`, after the `configureHandler` initialization (around line 61), add:

```go
	operationRepo := operation.NewRepository(pool)
	operationService := operation.NewService(operationRepo, routerService)
	operationHandler := operation.NewHandler(operationService)
```

- [ ] **Step 2: Add import for the operation package**

Add to the import block:

```go
	"github.com/pobradovic08/kormos/backend/internal/operation"
```

- [ ] **Step 3: Add operation routes**

Inside the protected `/api` route group (after the audit-log route, around line 133), add:

```go
		r.Route("/v1/operations", func(r chi.Router) {
			r.With(middleware.RequireRole("owner", "admin", "operator")).Post("/execute", operationHandler.Execute)
			r.With(middleware.RequireRole("owner", "admin", "operator")).Post("/undo/{groupID}", operationHandler.Undo)
			r.Get("/history", operationHandler.History)
		})
```

- [ ] **Step 4: Verify it compiles**

```bash
cd backend && go build ./cmd/server/
```

Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "Wire up operation routes in main server"
```

---

## Task 8: Frontend types

**Files:**
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Read the current types file to identify what to change**

Read `frontend/src/api/types.ts` and locate the `PendingChange`, `CommitResponse`, and `OperationResult` interfaces.

- [ ] **Step 2: Remove old commit types**

Remove these interfaces from `frontend/src/api/types.ts`:
- `PendingChange`
- `CommitResponse`
- `OperationResult`

- [ ] **Step 3: Add new operation types**

Add to `frontend/src/api/types.ts`:

```typescript
// --- Operation Log & Undo ---

export interface OperationGroup {
  id: string;
  tenant_id: string;
  user_id: string;
  description: string;
  status: 'applied' | 'undone' | 'failed' | 'requires_attention';
  created_at: string;
  expires_at: string;
  user: { id: string; name: string; email: string };
  operations: OperationEntry[];
  can_undo: boolean;
}

export interface OperationEntry {
  id: string;
  group_id: string;
  router_id: string;
  module: string;
  operation_type: 'add' | 'modify' | 'delete';
  resource_path: string;
  resource_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  sequence: number;
  status: 'applied' | 'undone' | 'failed';
  error?: string;
  applied_at: string;
}

export interface ExecuteOperationRequest {
  description: string;
  operations: {
    router_id: string;
    module: string;
    operation_type: 'add' | 'modify' | 'delete';
    resource_path: string;
    resource_id?: string;
    body: Record<string, unknown>;
  }[];
}

export interface ExecuteOperationResponse {
  group_id: string;
  status: string;
  operations: {
    id: string;
    status: string;
    resource_id?: string;
    after_state?: Record<string, unknown>;
    error?: string;
  }[];
}

export interface UndoResponse {
  group_id: string;
  status: string;
  reason?: string;
  drifted_operation?: {
    id: string;
    resource_path: string;
    resource_id: string;
    expected_state: Record<string, unknown>;
    current_state: Record<string, unknown>;
  };
}

export interface OperationHistoryResponse {
  groups: OperationGroup[];
  total: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types.ts
git commit -m "Replace commit types with operation log types"
```

---

## Task 9: Frontend API hooks

**Files:**
- Create: `frontend/src/api/operationsApi.ts`

- [ ] **Step 1: Create the operations API file**

Create `frontend/src/api/operationsApi.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  ExecuteOperationRequest,
  ExecuteOperationResponse,
  UndoResponse,
  OperationHistoryResponse,
} from './types';

export function useExecuteOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: ExecuteOperationRequest) => {
      const response = await apiClient.post<ExecuteOperationResponse>(
        '/v1/operations/execute',
        req,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-history'] });
    },
  });
}

export function useUndoOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await apiClient.post<UndoResponse>(
        `/v1/operations/undo/${groupId}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-history'] });
    },
  });
}

export function useOperationHistory(routerId: string | null, page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['operation-history', routerId, page, perPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (routerId) params.set('router_id', routerId);
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      const response = await apiClient.get<OperationHistoryResponse>(
        `/v1/operations/history?${params.toString()}`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/operationsApi.ts
git commit -m "Add frontend API hooks for operations execute, undo, and history"
```

---

## Task 10: Undo History Button

**Files:**
- Create: `frontend/src/components/undo/UndoHistoryButton.tsx`

- [ ] **Step 1: Create the button component**

Create `frontend/src/components/undo/UndoHistoryButton.tsx`:

```tsx
import { UnstyledButton, Group, Text, Badge } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import { useOperationHistory } from '../../api/operationsApi';
import { useRouterStore } from '../../stores/useRouterStore';

interface UndoHistoryButtonProps {
  onClick: () => void;
}

export default function UndoHistoryButton({ onClick }: UndoHistoryButtonProps) {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data } = useOperationHistory(selectedRouterId, 1, 50);

  const undoableCount =
    data?.groups.filter((g) => g.can_undo).length ?? 0;

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--mantine-radius-sm)',
        color: 'var(--mantine-color-dark-1)',
        backgroundColor: undoableCount > 0
          ? 'var(--mantine-color-blue-9)'
          : 'transparent',
        fontSize: 'var(--mantine-font-size-sm)',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      <IconHistory size={16} />
      <Text size="sm" fw="inherit" c="inherit">
        History
      </Text>
      {undoableCount > 0 && (
        <Badge size="sm" variant="filled" color="blue" circle>
          {undoableCount}
        </Badge>
      )}
    </UnstyledButton>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/undo/UndoHistoryButton.tsx
git commit -m "Add UndoHistoryButton component"
```

---

## Task 11: Undo History Panel

**Files:**
- Create: `frontend/src/components/undo/UndoHistoryPanel.tsx`

- [ ] **Step 1: Create the panel component**

Create `frontend/src/components/undo/UndoHistoryPanel.tsx`:

```tsx
import { useState } from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Collapse,
  UnstyledButton,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconArrowBackUp,
  IconAlertCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useOperationHistory, useUndoOperation } from '../../api/operationsApi';
import { useRouterStore } from '../../stores/useRouterStore';
import type { OperationGroup } from '../../api/types';

interface UndoHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusColor: Record<string, string> = {
  applied: 'green',
  undone: 'gray',
  failed: 'red',
  requires_attention: 'orange',
};

const opTypeColor: Record<string, string> = {
  add: 'green',
  modify: 'blue',
  delete: 'red',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function GroupEntry({ group }: { group: OperationGroup }) {
  const [expanded, setExpanded] = useState(false);
  const undoMutation = useUndoOperation();
  const [confirmUndo, setConfirmUndo] = useState(false);

  const isExpired = new Date(group.expires_at) < new Date();
  const routerCount = new Set(group.operations.map((o) => o.router_id)).size;

  const handleUndo = async () => {
    try {
      const result = await undoMutation.mutateAsync(group.id);
      if (result.status === 'undone') {
        notifications.show({
          title: 'Undone',
          message: group.description,
          color: 'green',
        });
      } else if (result.status === 'undo_blocked') {
        notifications.show({
          title: 'Undo blocked',
          message: result.reason ?? 'Resource has been modified since this operation',
          color: 'orange',
        });
      }
    } catch {
      notifications.show({
        title: 'Undo failed',
        message: 'An error occurred while undoing this operation',
        color: 'red',
      });
    }
    setConfirmUndo(false);
  };

  return (
    <Stack gap={0}>
      <UnstyledButton
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--mantine-radius-sm)',
          opacity: isExpired && group.status === 'applied' ? 0.5 : 1,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            <div>
              <Text size="sm" fw={500} lineClamp={1}>
                {group.description}
              </Text>
              <Text size="xs" c="dimmed">
                {group.user.name} &middot; {timeAgo(group.created_at)}
                {routerCount > 1 && ` · ${routerCount} routers`}
              </Text>
            </div>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Badge size="sm" color={statusColor[group.status] ?? 'gray'}>
              {group.status}
            </Badge>
            {isExpired && group.status === 'applied' && (
              <Badge size="sm" color="gray" variant="outline">
                Expired
              </Badge>
            )}
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse in={expanded}>
        <Stack gap="xs" pl={28} pr={12} pb={8}>
          {group.operations.map((op) => (
            <Group key={op.id} gap="xs">
              <Badge size="xs" color={opTypeColor[op.operation_type] ?? 'gray'}>
                {op.operation_type}
              </Badge>
              <Text size="xs" c="dimmed">
                {op.module} &middot; {op.resource_path}
                {op.resource_id && ` / ${op.resource_id}`}
              </Text>
              {op.error && (
                <Text size="xs" c="red">
                  {op.error}
                </Text>
              )}
            </Group>
          ))}

          {group.can_undo && !confirmUndo && (
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconArrowBackUp size={14} />}
              onClick={() => setConfirmUndo(true)}
            >
              Undo
            </Button>
          )}

          {confirmUndo && (
            <Alert
              color="orange"
              icon={<IconAlertCircle size={16} />}
              title={`Undo "${group.description}"?`}
            >
              <Text size="xs" mb="xs">
                This will reverse {group.operations.length} operation
                {group.operations.length > 1 ? 's' : ''}
                {routerCount > 1 && ` across ${routerCount} routers`}.
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  color="orange"
                  loading={undoMutation.isPending}
                  onClick={handleUndo}
                >
                  Confirm undo
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setConfirmUndo(false)}
                >
                  Cancel
                </Button>
              </Group>
            </Alert>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}

export default function UndoHistoryPanel({ isOpen, onClose }: UndoHistoryPanelProps) {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data, isLoading } = useOperationHistory(selectedRouterId, 1, 50);

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title="Operation History"
      position="right"
      size="md"
    >
      <Stack gap="xs">
        {isLoading && (
          <Text size="sm" c="dimmed">
            Loading history...
          </Text>
        )}

        {!isLoading && (!data?.groups || data.groups.length === 0) && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No operations recorded yet.
          </Text>
        )}

        {data?.groups.map((group, i) => (
          <div key={group.id}>
            {i > 0 && <Divider />}
            <GroupEntry group={group} />
          </div>
        ))}
      </Stack>
    </Drawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/undo/UndoHistoryPanel.tsx
git commit -m "Add UndoHistoryPanel drawer component"
```

---

## Task 12: Replace commit system in AppShell

**Files:**
- Modify: `frontend/src/components/shell/AppShell.tsx`
- Remove: `frontend/src/components/shell/CommitButton.tsx`
- Remove: `frontend/src/stores/useCommitStore.ts`
- Remove: `frontend/src/components/commit/CommitPanel.tsx`
- Remove: `frontend/src/components/commit/ChangeList.tsx`
- Remove: `frontend/src/components/commit/ChangeDiff.tsx`

- [ ] **Step 1: Update AppShell imports and components**

In `frontend/src/components/shell/AppShell.tsx`:

Replace the import lines:
```typescript
import CommitPanel from '../commit/CommitPanel';
import CommitButton from './CommitButton';
```

With:
```typescript
import UndoHistoryPanel from '../undo/UndoHistoryPanel';
import UndoHistoryButton from '../undo/UndoHistoryButton';
```

Replace the state variable:
```typescript
const [commitPanelOpen, setCommitPanelOpen] = useState(false);
```

With:
```typescript
const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
```

Replace the CommitButton usage (around line 218):
```tsx
<CommitButton onClick={() => setCommitPanelOpen(true)} />
```

With:
```tsx
<UndoHistoryButton onClick={() => setHistoryPanelOpen(true)} />
```

Replace the CommitPanel at the bottom (around line 229-232):
```tsx
<CommitPanel
  isOpen={commitPanelOpen}
  onClose={() => setCommitPanelOpen(false)}
/>
```

With:
```tsx
<UndoHistoryPanel
  isOpen={historyPanelOpen}
  onClose={() => setHistoryPanelOpen(false)}
/>
```

- [ ] **Step 2: Delete old commit system files**

```bash
rm frontend/src/components/shell/CommitButton.tsx
rm frontend/src/stores/useCommitStore.ts
rm frontend/src/components/commit/CommitPanel.tsx
rm frontend/src/components/commit/ChangeList.tsx
rm frontend/src/components/commit/ChangeDiff.tsx
```

- [ ] **Step 3: Remove PendingChange import from any remaining files**

Search for any remaining imports of `useCommitStore` or `PendingChange` and remove them. The main one is in `frontend/src/features/interfaces/InterfaceForm.tsx` — this will be handled in Task 13.

- [ ] **Step 4: Verify the frontend builds**

```bash
cd frontend && npx tsc --noEmit
```

Expected: may have errors from InterfaceForm.tsx still referencing commit store — that's fixed in Task 13.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/components/shell/AppShell.tsx
git rm frontend/src/components/shell/CommitButton.tsx
git rm frontend/src/stores/useCommitStore.ts
git rm frontend/src/components/commit/CommitPanel.tsx
git rm frontend/src/components/commit/ChangeList.tsx
git rm frontend/src/components/commit/ChangeDiff.tsx
git commit -m "Replace commit system with undo history panel in AppShell"
```

---

## Task 13: Migrate firewall mutations to operations API

**Files:**
- Modify: `frontend/src/features/firewall/firewallApi.ts`
- Modify: `frontend/src/features/firewall/FirewallForm.tsx`
- Modify: `frontend/src/features/firewall/FirewallTable.tsx`

- [ ] **Step 1: Read current firewall files**

Read `firewallApi.ts`, `FirewallForm.tsx`, and `FirewallTable.tsx` to understand current mutation usage.

- [ ] **Step 2: Add operation-based mutations to firewallApi.ts**

Keep the existing `useFirewallRules` query hook. Replace the mutation hooks with operation-based versions.

Replace `useAddFirewallRule`, `useUpdateFirewallRule`, `useDeleteFirewallRule`, and `useMoveFirewallRule` with versions that call `useExecuteOperation` internally:

```typescript
import { useExecuteOperation } from '../../api/operationsApi';

export function useAddFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async (rule: Omit<FirewallRule, 'id'>) => {
      if (isMock) return addFirewallRule(routerId!, rule);
      const result = await executeOp.mutateAsync({
        description: `Add firewall rule to ${rule.chain} chain`,
        operations: [{
          router_id: routerId!,
          module: 'firewall',
          operation_type: 'add',
          resource_path: '/ip/firewall/filter',
          body: rule as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useUpdateFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FirewallRule> }) => {
      if (isMock) return updateFirewallRule(routerId!, id, updates);
      const result = await executeOp.mutateAsync({
        description: `Update firewall rule ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'firewall',
          operation_type: 'modify',
          resource_path: '/ip/firewall/filter',
          resource_id: id,
          body: updates as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useDeleteFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteFirewallRule(routerId!, id);
      await executeOp.mutateAsync({
        description: `Delete firewall rule ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'firewall',
          operation_type: 'delete',
          resource_path: '/ip/firewall/filter',
          resource_id: id,
          body: {},
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useMoveFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moveData: { id: string; destination: string }) => {
      if (isMock) return moveFirewallRule(routerId!, moveData.id, moveData.destination);
      // Move is a special RouterOS operation — use direct API call since it's
      // not a standard CRUD operation and doesn't need undo tracking.
      const response = await apiClient.post(
        `/routers/${routerId}/firewall/filter/move`,
        moveData,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}
```

- [ ] **Step 3: Update FirewallForm.tsx if needed**

The form should continue to call the same mutation hooks (`useAddFirewallRule`, `useUpdateFirewallRule`). Since the hooks' external API hasn't changed, the form should work without modifications. Verify by reading the form and confirming it uses `addMutation.mutateAsync()` / `updateMutation.mutateAsync()`.

- [ ] **Step 4: Update FirewallTable.tsx if needed**

Same as the form — verify inline edit and delete still call the same hooks.

- [ ] **Step 5: Verify the frontend builds**

```bash
cd frontend && npx tsc --noEmit
```

Expected: successful (or only errors from other feature files not yet migrated).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/firewall/firewallApi.ts
git commit -m "Migrate firewall mutations to operations API"
```

---

## Task 14: Migrate interfaces to operations API

**Files:**
- Modify: `frontend/src/features/interfaces/InterfaceForm.tsx`

- [ ] **Step 1: Read InterfaceForm.tsx**

Read the file to understand the current `stageChange` and `buildDiff` usage.

- [ ] **Step 2: Replace stageChange with direct execute**

Remove the `useCommitStore` import and `stageChange` usage. Replace with `useExecuteOperation` from `operationsApi.ts`.

In the submit handler, instead of:
```typescript
stageChange(selectedRouterId, { ... });
```

Use:
```typescript
await executeOp.mutateAsync({
  description: isNew
    ? `Add ${interfaceType} interface`
    : `Update interface ${iface.name}`,
  operations: [{
    router_id: selectedRouterId,
    module: 'interfaces',
    operation_type: isNew ? 'add' : 'modify',
    resource_path: isNew
      ? `/interface/${interfaceType}`
      : `/interface/${iface.name}`,
    resource_id: isNew ? undefined : iface.id,
    body: cleanedValues as unknown as Record<string, unknown>,
  }],
});
```

Remove the `buildDiff` function — the backend now captures before/after state itself.

- [ ] **Step 3: Verify the frontend builds**

```bash
cd frontend && npx tsc --noEmit
```

Expected: successful.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/interfaces/InterfaceForm.tsx
git commit -m "Migrate interfaces from staged commits to direct operations API"
```

---

## Task 15: Migrate remaining features

**Files:**
- Modify: Other feature API files that have mutations (tunnels, address-lists, wireguard)

- [ ] **Step 1: Identify all feature API files with mutations**

Check these files for mutation hooks:
- `frontend/src/features/tunnels/` — tunnel API/form files
- `frontend/src/features/address-lists/` — address list API files
- `frontend/src/features/wireguard/` — wireguard API files

- [ ] **Step 2: Apply the same pattern as Task 13**

For each feature's mutation hooks, wrap the real API calls with `useExecuteOperation` while keeping mock mode branching. The pattern is the same as firewallApi.ts:

```typescript
if (isMock) return mockFunction(...);
const result = await executeOp.mutateAsync({
  description: '...',
  operations: [{ router_id, module, operation_type, resource_path, resource_id, body }],
});
return result;
```

- [ ] **Step 3: Verify the frontend builds**

```bash
cd frontend && npx tsc --noEmit
```

Expected: successful — no remaining references to `useCommitStore` or old commit types.

- [ ] **Step 4: Final grep to ensure no references remain**

```bash
grep -r "useCommitStore\|PendingChange\|CommitPanel\|CommitButton\|stageChange" frontend/src/
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/
git commit -m "Migrate tunnels, address-lists, and wireguard to operations API"
```

---

## Task 16: Remove .gitkeep and clean up

**Files:**
- Remove: `frontend/src/components/commit/.gitkeep`

- [ ] **Step 1: Remove the empty commit directory**

```bash
rm -rf frontend/src/components/commit/
```

- [ ] **Step 2: Verify full build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: successful build.

- [ ] **Step 3: Verify backend build**

```bash
cd backend && go build ./...
```

Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git rm -r frontend/src/components/commit/
git commit -m "Remove empty commit component directory"
```
