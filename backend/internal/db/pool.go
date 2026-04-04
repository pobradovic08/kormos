package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool creates a new PostgreSQL connection pool using the provided
// database URL (e.g. "postgres://user:pass@host:5432/dbname?sslmode=disable").
func NewPool(databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		return nil, err
	}
	return pool, nil
}
