package operation

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
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

// lockRouterIDs acquires mutexes for the given router IDs in sorted order
// to prevent deadlocks. Returns a function to unlock them all.
func (s *Service) lockRouterIDs(ids []string) func() {
	sort.Strings(ids)
	var mutexes []*sync.Mutex
	for _, id := range ids {
		mu := s.routerMutex(id)
		mu.Lock()
		mutexes = append(mutexes, mu)
	}
	return func() {
		for _, mu := range mutexes {
			mu.Unlock()
		}
	}
}

// uniqueRouterIDs returns deduplicated router IDs extracted by the given function.
func uniqueRouterIDs[T any](items []T, getID func(T) string) []string {
	seen := make(map[string]bool)
	var ids []string
	for _, item := range items {
		id := getID(item)
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

// Execute applies a group of operations to routers, logging before/after state.
func (s *Service) Execute(ctx context.Context, tenantID, userID string, req ExecuteRequest) (*ExecuteResponse, error) {
	if len(req.Operations) == 0 {
		return nil, fmt.Errorf("operation: at least one operation is required")
	}

	// Lock all involved routers in sorted order to prevent deadlocks.
	unlock := s.lockRouterIDs(uniqueRouterIDs(req.Operations, func(o ExecuteOperation) string { return o.RouterID }))
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
			beforeState, err := fetchResourceState(ctx, client, buildResourcePath(execOp.ResourcePath, execOp.ResourceID))
			if err != nil {
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
			rid := op.ResourceID
			if rid == "" {
				rid = execOp.ResourceID
			}
			afterState, err := fetchResourceState(ctx, client, buildResourcePath(execOp.ResourcePath, rid))
			if err != nil {
				// Apply succeeded but we can't read state — fall back to the request body.
				op.AfterState = execOp.Body
			} else {
				op.AfterState = afterState
			}
		}

		// 4. Persist the operation.
		if err := s.repo.InsertOperation(ctx, &op); err != nil {
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
	updated, err := s.repo.GetGroupByID(ctx, group.ID)
	if err != nil {
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
			Status:  StatusUndoBlocked,
			Reason:  fmt.Sprintf("group status is '%s', not 'applied'", group.Status),
		}, nil
	}

	// Expiry check.
	if time.Now().After(group.ExpiresAt) {
		return &UndoResponse{
			GroupID: groupID,
			Status:  StatusUndoBlocked,
			Reason:  "operation group has expired (older than 7 days)",
		}, nil
	}

	// Lock all involved routers in sorted order to prevent deadlocks.
	routerIDs := uniqueRouterIDs(group.Operations, func(o Operation) string { return o.RouterID })
	unlock := s.lockRouterIDs(routerIDs)
	defer unlock()

	// Get RouterOS clients.
	clients := make(map[string]*routeros.Client)
	for _, rid := range routerIDs {
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
			_ = s.repo.UpdateGroupStatus(ctx, groupID, StatusRequiresAttention)
			return &UndoResponse{
				GroupID: groupID,
				Status:  StatusUndoBlocked,
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
	switch op.OperationType {
	case OpAdd, OpModify:
		path := buildResourcePath(op.ResourcePath, op.ResourceID)
		state, err := fetchResourceState(ctx, client, path)
		if err != nil {
			return true, &DriftedDetail{
				ID:            op.ID,
				ResourcePath:  op.ResourcePath,
				ResourceID:    op.ResourceID,
				ExpectedState: op.AfterState,
				CurrentState:  map[string]interface{}{"error": "resource not found or unreachable"},
			}
		}

		if !configFieldsMatch(op.AfterState, state) {
			return true, &DriftedDetail{
				ID:            op.ID,
				ResourcePath:  op.ResourcePath,
				ResourceID:    op.ResourceID,
				ExpectedState: op.AfterState,
				CurrentState:  state,
			}
		}

	case OpDelete:
		_, err := fetchResourceState(ctx, client, buildResourcePath(op.ResourcePath, op.ResourceID))
		if err == nil {
			return true, &DriftedDetail{
				ID:            op.ID,
				ResourcePath:  op.ResourcePath,
				ResourceID:    op.ResourceID,
				ExpectedState: nil,
				CurrentState:  map[string]interface{}{"error": "resource exists but should have been deleted"},
			}
		}
	}

	return false, nil
}

// configFieldsMatch compares two states symmetrically, excluding volatile fields.
// Returns false if any non-volatile field differs or if either side has fields
// the other lacks.
func configFieldsMatch(expected, current map[string]interface{}) bool {
	// Check all expected keys exist in current with matching values.
	for key, expectedVal := range expected {
		if VolatileFields[key] {
			continue
		}
		currentVal, exists := current[key]
		if !exists {
			return false
		}
		e, _ := json.Marshal(expectedVal)
		c, _ := json.Marshal(currentVal)
		if string(e) != string(c) {
			return false
		}
	}
	// Check for keys in current that are absent from expected (new fields added).
	for key := range current {
		if VolatileFields[key] {
			continue
		}
		if _, exists := expected[key]; !exists {
			return false
		}
	}
	return true
}

// ListHistory returns paginated operation groups for a tenant.
func (s *Service) ListHistory(ctx context.Context, tenantID string, filters HistoryFilters) ([]Group, int, error) {
	return s.repo.ListGroups(ctx, tenantID, filters)
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
		var parsed map[string]interface{}
		if err := json.Unmarshal(respBody, &parsed); err == nil {
			if id, ok := parsed[".id"].(string); ok {
				return id, nil
			}
		}
		return "", nil

	case OpModify:
		_, err := client.Patch(ctx, buildResourcePath(op.ResourcePath, op.ResourceID), op.Body)
		return "", err

	case OpDelete:
		return "", client.Delete(ctx, buildResourcePath(op.ResourcePath, op.ResourceID))

	default:
		return "", fmt.Errorf("unsupported operation type: %s", op.OperationType)
	}
}

// stripVolatileFields returns a copy of state with volatile/read-only fields removed.
// RouterOS rejects PATCH/PUT requests that include read-only fields like "dynamic".
func stripVolatileFields(state map[string]interface{}) map[string]interface{} {
	clean := make(map[string]interface{}, len(state))
	for k, v := range state {
		if VolatileFields[k] {
			continue
		}
		// Also skip the .id field — it's read-only on RouterOS.
		if k == ".id" {
			continue
		}
		clean[k] = v
	}
	return clean
}

// reverseOperation applies the inverse of a previously applied operation.
func reverseOperation(ctx context.Context, client *routeros.Client, op Operation) error {
	switch op.OperationType {
	case OpAdd:
		return client.Delete(ctx, buildResourcePath(op.ResourcePath, op.ResourceID))

	case OpModify:
		_, err := client.Patch(ctx, buildResourcePath(op.ResourcePath, op.ResourceID), stripVolatileFields(op.BeforeState))
		return err

	case OpDelete:
		_, err := client.Put(ctx, op.ResourcePath, stripVolatileFields(op.BeforeState))
		return err

	default:
		return fmt.Errorf("unsupported operation type for reverse: %s", op.OperationType)
	}
}
