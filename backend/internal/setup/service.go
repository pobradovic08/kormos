package setup

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/pobradovic08/kormos/backend/internal/auth"
)

// Service encapsulates the business logic for the initial setup wizard.
type Service struct {
	repo          *Repository
	pool          *pgxpool.Pool
	jwtSecret     string
	accessTTL     time.Duration
	refreshTTL    time.Duration
	encryptionKey string
}

// NewService creates a new setup Service with the given dependencies.
func NewService(repo *Repository, pool *pgxpool.Pool, jwtSecret string, accessTTL, refreshTTL time.Duration, encryptionKey string) *Service {
	return &Service{
		repo:          repo,
		pool:          pool,
		jwtSecret:     jwtSecret,
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
		encryptionKey: encryptionKey,
	}
}

// CompleteSetupRequest contains all data required to complete the initial setup.
type CompleteSetupRequest struct {
	Admin  AdminRequest  `json:"admin"`
	Portal PortalRequest `json:"portal"`
}

// AdminRequest is the admin account portion of the setup request.
type AdminRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// PortalRequest is the portal settings portion of the setup request.
type PortalRequest struct {
	PortalName      string `json:"portal_name"`
	DefaultTimezone string `json:"default_timezone"`
	SupportEmail    string `json:"support_email"`
}

// SetupResponse is returned on successful setup completion.
type SetupResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	User         UserInfo `json:"user"`
}

// UserInfo represents basic user details in the setup response.
type UserInfo struct {
	ID     string     `json:"id"`
	Email  string     `json:"email"`
	Name   string     `json:"name"`
	Role   string     `json:"role"`
	Tenant TenantInfo `json:"tenant"`
}

// TenantInfo represents basic tenant details in the setup response.
type TenantInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// ValidationErrors maps field names to validation error messages.
type ValidationErrors map[string]string

// Error implements the error interface so ValidationErrors can be returned as an error.
func (e ValidationErrors) Error() string {
	parts := make([]string, 0, len(e))
	for field, msg := range e {
		parts = append(parts, field+": "+msg)
	}
	return "validation failed: " + strings.Join(parts, "; ")
}

var emailRegexp = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// IsSetupComplete delegates to the repository to check whether initial setup
// has been performed.
func (s *Service) IsSetupComplete(ctx context.Context) (bool, error) {
	return s.repo.IsSetupComplete(ctx)
}

// CompleteSetup performs the full initial setup: validates inputs, creates the
// portal settings row, a "System" tenant, and the first admin user inside a
// single transaction. It returns authentication tokens for the new admin.
func (s *Service) CompleteSetup(ctx context.Context, req CompleteSetupRequest) (*SetupResponse, error) {
	// 1. Validate inputs.
	if errs := validateSetupRequest(req); len(errs) > 0 {
		return nil, errs
	}

	// 2. Start a transaction.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("setup: begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 3. Insert portal settings — concurrency guard via ON CONFLICT DO NOTHING.
	tag, err := tx.Exec(ctx,
		`INSERT INTO portal_settings (portal_name, default_timezone, support_email)
		 VALUES ($1, $2, $3)
		 ON CONFLICT DO NOTHING`,
		req.Portal.PortalName, req.Portal.DefaultTimezone, req.Portal.SupportEmail,
	)
	if err != nil {
		return nil, fmt.Errorf("setup: insert portal settings: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("setup already complete")
	}

	// 4. Create the "System" tenant.
	var tenantID, tenantName, tenantSlug string
	err = tx.QueryRow(ctx,
		`INSERT INTO tenants (name, slug) VALUES ('System', 'system')
		 RETURNING id, name, slug`,
	).Scan(&tenantID, &tenantName, &tenantSlug)
	if err != nil {
		return nil, fmt.Errorf("setup: create system tenant: %w", err)
	}

	// 5. Create the admin user.
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Admin.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("setup: hash password: %w", err)
	}

	var userID, userEmail, userName, userRole string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, 'owner')
		 RETURNING id, email, name, role`,
		tenantID, req.Admin.Email, string(passwordHash), req.Admin.Name,
	).Scan(&userID, &userEmail, &userName, &userRole)
	if err != nil {
		return nil, fmt.Errorf("setup: create admin user: %w", err)
	}

	// 6. Commit transaction.
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("setup: commit: %w", err)
	}

	// 7. Generate access token.
	accessToken, err := auth.GenerateAccessToken(userID, tenantID, userRole, userEmail, s.jwtSecret, s.accessTTL)
	if err != nil {
		return nil, fmt.Errorf("setup: generate access token: %w", err)
	}

	// 8. Create refresh token.
	rawRefreshToken, err := generateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("setup: generate refresh token: %w", err)
	}

	tokenHash := hashToken(rawRefreshToken)
	expiresAt := time.Now().Add(s.refreshTTL)

	_, err = s.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("setup: store refresh token: %w", err)
	}

	// 9. Return response.
	return &SetupResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefreshToken,
		User: UserInfo{
			ID:    userID,
			Email: userEmail,
			Name:  userName,
			Role:  userRole,
			Tenant: TenantInfo{
				ID:   tenantID,
				Name: tenantName,
				Slug: tenantSlug,
			},
		},
	}, nil
}

// validateSetupRequest checks all fields and returns a ValidationErrors map.
// An empty map means the request is valid.
func validateSetupRequest(req CompleteSetupRequest) ValidationErrors {
	errs := make(ValidationErrors)

	// Admin email.
	if !emailRegexp.MatchString(req.Admin.Email) {
		errs["admin.email"] = "Invalid email format"
	}

	// Admin password: 8+ chars, at least one upper, one lower, one digit.
	if len(req.Admin.Password) < 8 {
		errs["admin.password"] = "Password must be at least 8 characters"
	} else {
		var hasUpper, hasLower, hasDigit bool
		for _, ch := range req.Admin.Password {
			switch {
			case unicode.IsUpper(ch):
				hasUpper = true
			case unicode.IsLower(ch):
				hasLower = true
			case unicode.IsDigit(ch):
				hasDigit = true
			}
		}
		if !hasUpper || !hasLower || !hasDigit {
			errs["admin.password"] = "Password must contain uppercase, lowercase, and a digit"
		}
	}

	// Portal name required.
	if strings.TrimSpace(req.Portal.PortalName) == "" {
		errs["portal.portal_name"] = "Portal name is required"
	}

	// Support email format.
	if !emailRegexp.MatchString(req.Portal.SupportEmail) {
		errs["portal.support_email"] = "Invalid email format"
	}

	return errs
}

// generateRefreshToken produces a cryptographically random 32-byte token
// encoded as a URL-safe base64 string (no padding).
func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("setup: generate refresh token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// hashToken returns the hex-encoded SHA-256 hash of a token string.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}
