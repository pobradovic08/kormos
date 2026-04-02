package user

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// validRoles is the set of allowed user roles.
var validRoles = map[string]struct{}{
	"owner":    {},
	"admin":    {},
	"operator": {},
	"viewer":   {},
}

// Service provides business logic for user management.
type Service struct {
	repo *Repository
}

// NewService creates a new user Service.
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// CreateUserRequest holds the fields required to create a new user.
type CreateUserRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// UpdateUserRequest holds optional fields for updating a user.
type UpdateUserRequest struct {
	Name *string `json:"name"`
	Role *string `json:"role"`
}

// UserResponse is the public representation of a user, excluding sensitive
// fields like password_hash.
type UserResponse struct {
	ID        string     `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name"`
	Role      string     `json:"role"`
	IsActive  bool       `json:"is_active"`
	LastLogin *time.Time `json:"last_login"`
	CreatedAt time.Time  `json:"created_at"`
}

// Create hashes the password, validates the role, and creates a new user.
func (s *Service) Create(ctx context.Context, tenantID string, req CreateUserRequest) (*UserResponse, error) {
	if req.Email == "" || req.Name == "" || req.Password == "" || req.Role == "" {
		return nil, fmt.Errorf("email, name, password, and role are required")
	}

	if _, ok := validRoles[req.Role]; !ok {
		return nil, fmt.Errorf("invalid role: %s", req.Role)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("user service: hash password: %w", err)
	}

	u := &User{
		TenantID:     tenantID,
		Email:        req.Email,
		PasswordHash: string(hash),
		Name:         req.Name,
		Role:         req.Role,
		IsActive:     true,
	}

	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}

	return toResponse(u), nil
}

// List returns all users for the given tenant as UserResponse values.
func (s *Service) List(ctx context.Context, tenantID string) ([]UserResponse, error) {
	users, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	resp := make([]UserResponse, len(users))
	for i := range users {
		resp[i] = *toResponse(&users[i])
	}
	return resp, nil
}

// Update applies partial updates to a user. If changing a role away from owner,
// it verifies that at least one other owner would remain.
func (s *Service) Update(ctx context.Context, tenantID, id string, req UpdateUserRequest) (*UserResponse, error) {
	// Validate role if provided.
	if req.Role != nil {
		if _, ok := validRoles[*req.Role]; !ok {
			return nil, fmt.Errorf("invalid role: %s", *req.Role)
		}
	}

	// If changing role, check if we're demoting an owner.
	if req.Role != nil {
		existing, err := s.repo.GetByID(ctx, tenantID, id)
		if err != nil {
			return nil, err
		}
		if existing == nil {
			return nil, fmt.Errorf("user not found")
		}

		// If the user is currently an owner and we're changing them to something else,
		// ensure at least one owner remains.
		if existing.Role == "owner" && *req.Role != "owner" {
			count, err := s.repo.CountOwners(ctx, tenantID)
			if err != nil {
				return nil, err
			}
			if count <= 1 {
				return nil, fmt.Errorf("cannot demote the last owner")
			}
		}
	}

	if err := s.repo.Update(ctx, tenantID, id, req.Name, req.Role); err != nil {
		return nil, err
	}

	// Re-fetch to return the updated user.
	updated, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if updated == nil {
		return nil, fmt.Errorf("user not found after update")
	}

	return toResponse(updated), nil
}

// Delete removes a user. It rejects deletion of the last owner.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("user not found")
	}

	if existing.Role == "owner" {
		count, err := s.repo.CountOwners(ctx, tenantID)
		if err != nil {
			return err
		}
		if count <= 1 {
			return fmt.Errorf("cannot delete the last owner")
		}
	}

	return s.repo.Delete(ctx, tenantID, id)
}

// toResponse converts an internal User model to the public UserResponse.
func toResponse(u *User) *UserResponse {
	return &UserResponse{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Role:      u.Role,
		IsActive:  u.IsActive,
		LastLogin: u.LastLogin,
		CreatedAt: u.CreatedAt,
	}
}
