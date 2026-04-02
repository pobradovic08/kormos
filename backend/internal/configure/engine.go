package configure

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// OperationResult captures the outcome of a single operation applied to a
// RouterOS device.
type OperationResult struct {
	Index      int    `json:"index"`
	Status     string `json:"status"`
	ResourceID string `json:"resource_id,omitempty"`
	Error      string `json:"error,omitempty"`
}

// CommitResult aggregates the results of all operations in a configure request.
type CommitResult struct {
	Status  string            `json:"status"`
	Results []OperationResult `json:"results"`
}

// Engine orchestrates the execution of sorted configuration operations against
// a RouterOS device.
type Engine struct {
	routerSvc *router.Service
}

// NewEngine creates a new configure Engine backed by the given router service.
func NewEngine(routerSvc *router.Service) *Engine {
	return &Engine{routerSvc: routerSvc}
}

// Execute applies each operation in ops to the RouterOS device via client.
// Operations are expected to be pre-sorted by SortOperations. Execution
// continues on failure so that independent changes are still applied.
func (e *Engine) Execute(ctx context.Context, client *routeros.Client, ops []Operation) *CommitResult {
	results := make([]OperationResult, 0, len(ops))
	successCount := 0
	failCount := 0

	for _, op := range ops {
		result := OperationResult{Index: op.Index}

		var err error
		var respBody []byte

		switch op.Method {
		case "PUT":
			respBody, err = client.Put(ctx, op.ResourcePath, op.Body)
		case "PATCH":
			respBody, err = client.Patch(ctx, op.ResourcePath, op.Body)
		case "DELETE":
			err = client.Delete(ctx, op.ResourcePath)
		default:
			err = fmt.Errorf("unsupported method: %s", op.Method)
		}

		if err != nil {
			result.Status = "failure"
			result.Error = err.Error()
			failCount++
		} else {
			result.Status = "success"
			successCount++

			// For PUT (create) operations, extract the .id from the response.
			if op.Method == "PUT" && len(respBody) > 0 {
				var parsed map[string]interface{}
				if jsonErr := json.Unmarshal(respBody, &parsed); jsonErr == nil {
					if id, ok := parsed[".id"].(string); ok {
						result.ResourceID = id
					}
				}
			}
		}

		results = append(results, result)
	}

	cr := &CommitResult{Results: results}
	switch {
	case failCount == 0:
		cr.Status = "success"
	case successCount == 0:
		cr.Status = "failure"
	default:
		cr.Status = "partial"
	}

	return cr
}
