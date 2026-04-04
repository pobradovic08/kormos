package config

import (
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds the application configuration loaded from environment variables.
type Config struct {
	DatabaseURL   string
	EncryptionKey string
	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration
	ListenAddr    string
	CORSOrigins   []string
	TLSCert       string
	TLSKey        string
}

// Load reads configuration from environment variables and returns a validated
// Config. Required fields (DATABASE_URL, ENCRYPTION_KEY, JWT_SECRET) must be
// set or an error is returned. Duration fields fall back to sensible defaults
// when unset, and CORS_ORIGINS is split on commas.
func Load() (*Config, error) {
	// Load .env file if present (does not override existing env vars)
	_ = godotenv.Load()

	cfg := &Config{
		JWTAccessTTL:  15 * time.Minute,
		JWTRefreshTTL: 168 * time.Hour,
		ListenAddr:    ":8080",
	}

	// --- required fields ---

	cfg.DatabaseURL = os.Getenv("DATABASE_URL")
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config: DATABASE_URL is required")
	}

	cfg.EncryptionKey = os.Getenv("ENCRYPTION_KEY")
	if cfg.EncryptionKey == "" {
		return nil, fmt.Errorf("config: ENCRYPTION_KEY is required")
	}
	if err := validateHexKey(cfg.EncryptionKey, 32); err != nil {
		return nil, fmt.Errorf("config: ENCRYPTION_KEY: %w", err)
	}

	cfg.JWTSecret = os.Getenv("JWT_SECRET")
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config: JWT_SECRET is required")
	}

	// --- optional durations ---

	if v := os.Getenv("JWT_ACCESS_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("config: JWT_ACCESS_TTL: %w", err)
		}
		cfg.JWTAccessTTL = d
	}

	if v := os.Getenv("JWT_REFRESH_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("config: JWT_REFRESH_TTL: %w", err)
		}
		cfg.JWTRefreshTTL = d
	}

	// --- optional strings ---

	if v := os.Getenv("LISTEN_ADDR"); v != "" {
		cfg.ListenAddr = v
	}

	if v := os.Getenv("CORS_ORIGINS"); v != "" {
		parts := strings.Split(v, ",")
		origins := make([]string, 0, len(parts))
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				origins = append(origins, trimmed)
			}
		}
		cfg.CORSOrigins = origins
	}

	cfg.TLSCert = os.Getenv("TLS_CERT")
	cfg.TLSKey = os.Getenv("TLS_KEY")

	return cfg, nil
}

// validateHexKey checks that s is valid hex encoding of exactly byteLen bytes.
func validateHexKey(s string, byteLen int) error {
	b, err := hex.DecodeString(s)
	if err != nil {
		return fmt.Errorf("invalid hex encoding: %w", err)
	}
	if len(b) != byteLen {
		return fmt.Errorf("expected %d bytes, got %d", byteLen, len(b))
	}
	return nil
}
