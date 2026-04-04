package setup

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PortalSettings represents the single-row portal configuration stored in the
// portal_settings table.
type PortalSettings struct {
	ID              int       `json:"id"`
	PortalName      string    `json:"portal_name"`
	DefaultTimezone string    `json:"default_timezone"`
	SupportEmail    string    `json:"support_email"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Repository provides data-access methods for the portal_settings table.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new setup Repository backed by the given pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// IsSetupComplete returns true if the portal_settings row exists, meaning
// initial setup has been completed.
func (r *Repository) IsSetupComplete(ctx context.Context) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM portal_settings)`,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("setup: check complete: %w", err)
	}
	return exists, nil
}

// Create inserts a new portal_settings row. Because the table has a CHECK
// constraint (id = 1), only one row can ever exist. ON CONFLICT DO NOTHING
// is used as a concurrency guard — if another request already inserted the
// row, this call returns false (no insert happened) instead of an error.
func (r *Repository) Create(ctx context.Context, settings *PortalSettings) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		`INSERT INTO portal_settings (portal_name, default_timezone, support_email)
		 VALUES ($1, $2, $3)
		 ON CONFLICT DO NOTHING`,
		settings.PortalName, settings.DefaultTimezone, settings.SupportEmail,
	)
	if err != nil {
		return false, fmt.Errorf("setup: create settings: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

// Get returns the portal settings row (id = 1).
func (r *Repository) Get(ctx context.Context) (*PortalSettings, error) {
	var s PortalSettings
	err := r.pool.QueryRow(ctx,
		`SELECT id, portal_name, default_timezone, support_email, created_at, updated_at
		   FROM portal_settings
		  WHERE id = 1`,
	).Scan(&s.ID, &s.PortalName, &s.DefaultTimezone, &s.SupportEmail, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("setup: get settings: %w", err)
	}
	return &s, nil
}

// Update modifies the portal settings row (id = 1).
func (r *Repository) Update(ctx context.Context, settings *PortalSettings) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE portal_settings
		    SET portal_name = $1, default_timezone = $2, support_email = $3, updated_at = now()
		  WHERE id = 1`,
		settings.PortalName, settings.DefaultTimezone, settings.SupportEmail,
	)
	if err != nil {
		return fmt.Errorf("setup: update settings: %w", err)
	}
	return nil
}
