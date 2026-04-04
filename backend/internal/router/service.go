package router

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pobradovic08/kormos/backend/internal/crypto"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// CreateRouterRequest holds the fields required to create a new router.
type CreateRouterRequest struct {
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// UpdateRouterRequest holds optional fields for updating a router.
// Pointer fields are used so that callers can distinguish between "not
// provided" (nil) and "set to a value".
type UpdateRouterRequest struct {
	Name     *string `json:"name"`
	Hostname *string `json:"hostname"`
	Host     *string `json:"host"`
	Port     *int    `json:"port"`
	Username *string `json:"username"`
	Password *string `json:"password"`
}

// RouterResponse is the public representation of a router, excluding
// encrypted credential fields.
type RouterResponse struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Hostname    string     `json:"hostname"`
	Host        string     `json:"host"`
	Port        int        `json:"port"`
	IsReachable bool       `json:"is_reachable"`
	LastSeen    *time.Time `json:"last_seen"`
	CreatedAt   time.Time  `json:"created_at"`
}

// RouterStatusResponse contains the result of a reachability check against a
// RouterOS device.
type RouterStatusResponse struct {
	IsReachable    bool      `json:"is_reachable"`
	RouterOSVersion string   `json:"routeros_version,omitempty"`
	BoardName      string    `json:"board_name,omitempty"`
	Uptime         string    `json:"uptime,omitempty"`
	CPULoad        int       `json:"cpu_load,omitempty"`
	FreeMemory     int64     `json:"free_memory,omitempty"`
	TotalMemory    int64     `json:"total_memory,omitempty"`
	CheckedAt      time.Time `json:"checked_at"`
	Error          string    `json:"error,omitempty"`
}

// Service provides business logic for router management, including encryption
// of credentials.
type Service struct {
	repo          *Repository
	encryptionKey string
	pool          *pgxpool.Pool
}

// NewService creates a new router Service.
func NewService(repo *Repository, encryptionKey string, pool *pgxpool.Pool) *Service {
	return &Service{
		repo:          repo,
		encryptionKey: encryptionKey,
		pool:          pool,
	}
}

// Create encrypts credentials and stores a new router, returning the public
// response without credential data.
func (s *Service) Create(ctx context.Context, tenantID string, req CreateRouterRequest) (*RouterResponse, error) {
	usernameEnc, err := crypto.Encrypt([]byte(req.Username), s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("router service: encrypt username: %w", err)
	}
	passwordEnc, err := crypto.Encrypt([]byte(req.Password), s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("router service: encrypt password: %w", err)
	}

	rt := &Router{
		Name:              req.Name,
		Hostname:          req.Hostname,
		Host:              req.Host,
		Port:              req.Port,
		UsernameEncrypted: usernameEnc,
		PasswordEncrypted: passwordEnc,
	}

	if err := s.repo.Create(ctx, tenantID, rt); err != nil {
		return nil, err
	}

	return toResponse(rt), nil
}

// List returns all routers for the given tenant without credential data.
func (s *Service) List(ctx context.Context, tenantID string) ([]RouterResponse, error) {
	routers, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	resp := make([]RouterResponse, len(routers))
	for i := range routers {
		resp[i] = *toResponse(&routers[i])
	}
	return resp, nil
}

// GetByID returns a single router by ID without credential data.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*RouterResponse, error) {
	rt, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, nil
	}
	return toResponse(rt), nil
}

// Update applies partial updates to an existing router. Credentials are
// re-encrypted when provided.
func (s *Service) Update(ctx context.Context, tenantID, id string, req UpdateRouterRequest) (*RouterResponse, error) {
	rt, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, nil
	}

	if req.Name != nil {
		rt.Name = *req.Name
	}
	if req.Hostname != nil {
		rt.Hostname = *req.Hostname
	}
	if req.Host != nil {
		rt.Host = *req.Host
	}
	if req.Port != nil {
		rt.Port = *req.Port
	}
	if req.Username != nil {
		enc, err := crypto.Encrypt([]byte(*req.Username), s.encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("router service: encrypt username: %w", err)
		}
		rt.UsernameEncrypted = enc
	}
	if req.Password != nil {
		enc, err := crypto.Encrypt([]byte(*req.Password), s.encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("router service: encrypt password: %w", err)
		}
		rt.PasswordEncrypted = enc
	}

	if err := s.repo.Update(ctx, tenantID, rt); err != nil {
		return nil, err
	}

	// Re-fetch to get the updated_at timestamp from the database.
	updated, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return toResponse(updated), nil
}

// Delete removes a router by ID.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// CheckReachability decrypts the router's credentials, connects to the
// RouterOS REST API, and reports device health information. The router's
// reachability status is updated in the database regardless of the outcome.
func (s *Service) CheckReachability(ctx context.Context, tenantID, id string) (*RouterStatusResponse, error) {
	rt, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, nil
	}

	username, err := crypto.Decrypt(rt.UsernameEncrypted, s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("router service: decrypt username: %w", err)
	}
	password, err := crypto.Decrypt(rt.PasswordEncrypted, s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("router service: decrypt password: %w", err)
	}

	client := routeros.NewClient(rt.Host, rt.Port, string(username), string(password))
	info, healthErr := client.CheckHealth(ctx)

	resp := &RouterStatusResponse{
		CheckedAt: time.Now(),
	}

	if healthErr != nil {
		resp.IsReachable = false
		resp.Error = healthErr.Error()
		_ = s.repo.UpdateReachability(ctx, id, false)
		return resp, nil
	}

	resp.IsReachable = true
	_ = s.repo.UpdateReachability(ctx, id, true)

	// Extract fields from the RouterOS system/resource response.
	if v, ok := info["version"].(string); ok {
		resp.RouterOSVersion = v
	}
	if v, ok := info["board-name"].(string); ok {
		resp.BoardName = v
	}
	if v, ok := info["uptime"].(string); ok {
		resp.Uptime = v
	}
	if v, ok := info["cpu-load"].(float64); ok {
		resp.CPULoad = int(v)
	}
	if v, ok := info["free-memory"].(float64); ok {
		resp.FreeMemory = int64(v)
	}
	if v, ok := info["total-memory"].(float64); ok {
		resp.TotalMemory = int64(v)
	}

	return resp, nil
}

// GetClientForRouter looks up a router by ID within the given tenant, decrypts
// its stored credentials, and returns a new routeros.Client ready for API calls.
func (s *Service) GetClientForRouter(ctx context.Context, tenantID, routerID string) (*routeros.Client, error) {
	rt, err := s.repo.GetByID(ctx, tenantID, routerID)
	if err != nil {
		return nil, fmt.Errorf("router service: get router: %w", err)
	}
	if rt == nil {
		return nil, fmt.Errorf("router service: router not found")
	}

	username, err := crypto.Decrypt(rt.UsernameEncrypted, s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("router service: decrypt username: %w", err)
	}
	password, err := crypto.Decrypt(rt.PasswordEncrypted, s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("router service: decrypt password: %w", err)
	}

	return routeros.NewClient(rt.Host, rt.Port, string(username), string(password)), nil
}

// toResponse converts an internal Router model to the public RouterResponse,
// stripping credential fields.
func toResponse(rt *Router) *RouterResponse {
	return &RouterResponse{
		ID:          rt.ID,
		Name:        rt.Name,
		Hostname:    rt.Hostname,
		Host:        rt.Host,
		Port:        rt.Port,
		IsReachable: rt.IsReachable,
		LastSeen:    rt.LastSeen,
		CreatedAt:   rt.CreatedAt,
	}
}
