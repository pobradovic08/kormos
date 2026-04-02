package db

import "embed"

// MigrationFS contains all embedded SQL migration files.
//
//go:embed migrations/*.sql
var MigrationFS embed.FS
