package proxy

import (
	"strconv"
	"strings"
)

// parseBool converts RouterOS string booleans ("true"/"false") to Go bools.
func parseBool(s string) bool {
	return s == "true"
}

// parseInt converts a RouterOS string number to int, returning 0 on failure.
func parseInt(s string) int {
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}

// parseInt64 converts a RouterOS string number to int64, returning 0 on failure.
func parseInt64(s string) int64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// splitCSV splits a comma-separated string into a slice, trimming whitespace.
// Returns an empty slice (not nil) for empty input.
func splitCSV(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
