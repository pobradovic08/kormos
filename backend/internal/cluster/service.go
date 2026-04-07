package cluster

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pobradovic08/kormos/backend/internal/crypto"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Service provides business logic for cluster management.
type Service struct {
	repo          *Repository
	encryptionKey string
	pool          *pgxpool.Pool
}

// NewService creates a new cluster Service.
func NewService(repo *Repository, encryptionKey string, pool *pgxpool.Pool) *Service {
	return &Service{repo: repo, encryptionKey: encryptionKey, pool: pool}
}

// List returns all clusters with their routers for a tenant.
func (s *Service) List(ctx context.Context, tenantID string) ([]ClusterResponse, error) {
	clusters, err := s.repo.ListClusters(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	responses := make([]ClusterResponse, 0, len(clusters))
	for _, c := range clusters {
		routers, err := s.repo.ListRoutersByCluster(ctx, c.ID)
		if err != nil {
			return nil, err
		}
		responses = append(responses, buildClusterResponse(c, routers))
	}
	return responses, nil
}

// GetByID returns a single cluster with its routers.
func (s *Service) GetByID(ctx context.Context, tenantID, clusterID string) (*ClusterResponse, error) {
	c, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, nil
	}

	routers, err := s.repo.ListRoutersByCluster(ctx, c.ID)
	if err != nil {
		return nil, err
	}

	resp := buildClusterResponse(*c, routers)
	return &resp, nil
}

// Create validates the request, creates the cluster and its routers, and returns the response.
func (s *Service) Create(ctx context.Context, tenantID string, req CreateClusterRequest) (*ClusterResponse, error) {
	if err := validateClusterRequest(req.Name, req.Routers); err != nil {
		return nil, err
	}

	c, err := s.repo.CreateCluster(ctx, tenantID, req.Name)
	if err != nil {
		return nil, err
	}

	for _, ri := range req.Routers {
		usernameEnc, err := crypto.Encrypt([]byte(ri.Username), s.encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("cluster: encrypt username: %w", err)
		}
		passwordEnc, err := crypto.Encrypt([]byte(ri.Password), s.encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("cluster: encrypt password: %w", err)
		}

		_, err = s.repo.CreateRouter(ctx, tenantID, c.ID, ri.Name, ri.Hostname, ri.Host, ri.Port, ri.Role, usernameEnc, passwordEnc)
		if err != nil {
			return nil, err
		}
	}

	return s.GetByID(ctx, tenantID, c.ID)
}

// Update validates the request, updates the cluster name if changed, and diffs routers
// (deletes missing, creates new, updates existing).
func (s *Service) Update(ctx context.Context, tenantID, clusterID string, req UpdateClusterRequest) (*ClusterResponse, error) {
	if err := validateUpdateRequest(req.Name, req.Routers); err != nil {
		return nil, err
	}

	c, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("cluster: not found")
	}

	// Update name if changed.
	if c.Name != req.Name {
		if err := s.repo.UpdateClusterName(ctx, tenantID, clusterID, req.Name); err != nil {
			return nil, err
		}
	}

	// Get existing routers for diff.
	existingRouters, err := s.repo.ListRoutersByCluster(ctx, clusterID)
	if err != nil {
		return nil, err
	}

	// Build a set of incoming router IDs.
	incomingIDs := make(map[string]struct{})
	for _, ri := range req.Routers {
		if ri.ID != "" {
			incomingIDs[ri.ID] = struct{}{}
		}
	}

	// Delete routers that are no longer present.
	for _, existing := range existingRouters {
		if _, ok := incomingIDs[existing.ID]; !ok {
			if err := s.repo.DeleteRouter(ctx, tenantID, existing.ID); err != nil {
				return nil, err
			}
		}
	}

	// Create new or update existing routers.
	for _, ri := range req.Routers {
		if ri.ID == "" {
			// New router — encrypt credentials and create.
			usernameEnc, err := crypto.Encrypt([]byte(ri.Username), s.encryptionKey)
			if err != nil {
				return nil, fmt.Errorf("cluster: encrypt username: %w", err)
			}
			passwordEnc, err := crypto.Encrypt([]byte(ri.Password), s.encryptionKey)
			if err != nil {
				return nil, fmt.Errorf("cluster: encrypt password: %w", err)
			}
			_, err = s.repo.CreateRouter(ctx, tenantID, clusterID, ri.Name, ri.Hostname, ri.Host, ri.Port, ri.Role, usernameEnc, passwordEnc)
			if err != nil {
				return nil, err
			}
		} else {
			// Existing router — only re-encrypt credentials if password is non-empty.
			var usernameEnc, passwordEnc []byte
			if ri.Password != "" {
				usernameEnc, err = crypto.Encrypt([]byte(ri.Username), s.encryptionKey)
				if err != nil {
					return nil, fmt.Errorf("cluster: encrypt username: %w", err)
				}
				passwordEnc, err = crypto.Encrypt([]byte(ri.Password), s.encryptionKey)
				if err != nil {
					return nil, fmt.Errorf("cluster: encrypt password: %w", err)
				}
			}
			if err := s.repo.UpdateRouter(ctx, tenantID, ri.ID, ri.Name, ri.Hostname, ri.Host, ri.Port, ri.Role, usernameEnc, passwordEnc); err != nil {
				return nil, err
			}
		}
	}

	return s.GetByID(ctx, tenantID, clusterID)
}

// Delete removes a cluster and its routers.
func (s *Service) Delete(ctx context.Context, tenantID, clusterID string) error {
	return s.repo.DeleteCluster(ctx, tenantID, clusterID)
}

// TestConnection attempts to connect to a RouterOS device and returns health info.
func (s *Service) TestConnection(ctx context.Context, req TestConnectionRequest) (*TestConnectionResponse, error) {
	client := routeros.NewClient(req.Host, req.Port, req.Username, req.Password)
	health, err := client.CheckHealth(ctx)
	if err != nil {
		return &TestConnectionResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	resp := &TestConnectionResponse{Success: true}
	if v, ok := health["version"].(string); ok {
		resp.RouterOSVersion = v
	}
	if b, ok := health["board-name"].(string); ok {
		resp.BoardName = b
	}
	return resp, nil
}

// buildClusterResponse constructs a ClusterResponse from a Cluster and its RouterRows.
func buildClusterResponse(c Cluster, routers []RouterRow) ClusterResponse {
	mode := "standalone"
	if len(routers) == 2 {
		mode = "ha"
	}

	routerResponses := make([]RouterResponse, 0, len(routers))
	for _, r := range routers {
		routerResponses = append(routerResponses, RouterResponse{
			ID:          r.ID,
			Name:        r.Name,
			Hostname:    r.Hostname,
			Host:        r.Host,
			Port:        r.Port,
			Role:        r.Role,
			IsReachable: r.IsReachable,
			LastSeen:    r.LastSeen,
		})
	}

	return ClusterResponse{
		ID:        c.ID,
		Name:      c.Name,
		Mode:      mode,
		CreatedAt: c.CreatedAt,
		Routers:   routerResponses,
	}
}

// validateClusterRequest checks that a cluster request has valid data.
func validateClusterRequest(name string, routers []CreateRouterInput) error {
	if name == "" {
		return fmt.Errorf("cluster: name is required")
	}
	if len(routers) < 1 || len(routers) > 2 {
		return fmt.Errorf("cluster: must have 1 or 2 routers")
	}

	hasMaster := false
	hasBackup := false
	for _, r := range routers {
		if r.Name == "" {
			return fmt.Errorf("cluster: router name is required")
		}
		if r.Host == "" {
			return fmt.Errorf("cluster: router host is required")
		}
		if r.Port == 0 {
			return fmt.Errorf("cluster: router port is required")
		}
		if r.Username == "" {
			return fmt.Errorf("cluster: router username is required")
		}
		if r.Password == "" {
			return fmt.Errorf("cluster: router password is required")
		}
		switch r.Role {
		case "master":
			hasMaster = true
		case "backup":
			hasBackup = true
		default:
			return fmt.Errorf("cluster: invalid router role %q, must be master or backup", r.Role)
		}
	}

	if !hasMaster {
		return fmt.Errorf("cluster: at least one router must have the master role")
	}
	if len(routers) == 2 && !hasBackup {
		return fmt.Errorf("cluster: second router must have the backup role")
	}

	return nil
}

// validateUpdateRequest validates an update cluster request. Existing routers (those with
// a non-empty ID) are allowed to have empty username/password since credentials are only
// re-encrypted when a new password is provided.
func validateUpdateRequest(name string, routers []UpdateRouterInput) error {
	if name == "" {
		return fmt.Errorf("cluster: name is required")
	}
	if len(routers) < 1 || len(routers) > 2 {
		return fmt.Errorf("cluster: must have 1 or 2 routers")
	}

	hasMaster := false
	hasBackup := false
	for _, r := range routers {
		if r.Name == "" {
			return fmt.Errorf("cluster: router name is required")
		}
		if r.Host == "" {
			return fmt.Errorf("cluster: router host is required")
		}
		if r.Port == 0 {
			return fmt.Errorf("cluster: router port is required")
		}
		// New routers (no ID) require credentials; existing routers allow empty password.
		if r.ID == "" {
			if r.Username == "" {
				return fmt.Errorf("cluster: router username is required")
			}
			if r.Password == "" {
				return fmt.Errorf("cluster: router password is required")
			}
		}
		switch r.Role {
		case "master":
			hasMaster = true
		case "backup":
			hasBackup = true
		default:
			return fmt.Errorf("cluster: invalid router role %q, must be master or backup", r.Role)
		}
	}

	if !hasMaster {
		return fmt.Errorf("cluster: at least one router must have the master role")
	}
	if len(routers) == 2 && !hasBackup {
		return fmt.Errorf("cluster: second router must have the backup role")
	}

	return nil
}

// toCreateInputs converts UpdateRouterInputs to CreateRouterInputs for validation reuse.
func toCreateInputs(inputs []UpdateRouterInput) []CreateRouterInput {
	result := make([]CreateRouterInput, len(inputs))
	for i, in := range inputs {
		result[i] = CreateRouterInput{
			Name:     in.Name,
			Hostname: in.Hostname,
			Host:     in.Host,
			Port:     in.Port,
			Username: in.Username,
			Password: in.Password,
			Role:     in.Role,
		}
	}
	return result
}
