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
	"bytes":              true,
	"packets":            true,
	"dynamic":            true,
	"running":            true,
	"invalid":            true,
	".nextid":            true,
	"actual-mtu":         true,
	"rx-byte":            true,
	"tx-byte":            true,
	"rx-packet":          true,
	"tx-packet":          true,
	"fp-rx-byte":         true,
	"fp-tx-byte":         true,
	"fp-rx-packet":       true,
	"fp-tx-packet":       true,
	"link-downs":         true,
	"last-link-up-time":  true,
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
	User       GroupUser   `json:"user"`
	Operations []Operation `json:"operations,omitempty"`
	CanUndo    bool        `json:"can_undo"`
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
	GroupID    string            `json:"group_id"`
	Status     string            `json:"status"`
	Operations []OperationResult `json:"operations"`
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
	GroupID          string         `json:"group_id"`
	Status           string         `json:"status"`
	Reason           string         `json:"reason,omitempty"`
	DriftedOperation *DriftedDetail `json:"drifted_operation,omitempty"`
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
