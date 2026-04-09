//go:build integration

package testutil

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// FindResourceByField fetches all resources at path and returns the first
// where field == value. Returns nil if not found.
func FindResourceByField(t *testing.T, ctx context.Context, client *routeros.Client, path, field, value string) map[string]interface{} {
	t.Helper()
	body, err := client.Get(ctx, path)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		t.Fatalf("unmarshal %s: %v\nbody: %s", path, err, string(body))
	}
	for _, item := range items {
		if fmt.Sprint(item[field]) == value {
			return item
		}
	}
	return nil
}

// AssertResourceExists fails if no resource at path has field == value.
func AssertResourceExists(t *testing.T, ctx context.Context, client *routeros.Client, path, field, value string) map[string]interface{} {
	t.Helper()
	res := FindResourceByField(t, ctx, client, path, field, value)
	if res == nil {
		t.Fatalf("expected resource at %s with %s=%s, not found", path, field, value)
	}
	return res
}

// AssertResourceNotExists fails if any resource at path has field == value.
func AssertResourceNotExists(t *testing.T, ctx context.Context, client *routeros.Client, path, field, value string) {
	t.Helper()
	res := FindResourceByField(t, ctx, client, path, field, value)
	if res != nil {
		t.Fatalf("expected no resource at %s with %s=%s, but found: %v", path, field, value, res)
	}
}

// AssertResourceField finds a resource by field match and asserts another field has the expected value.
func AssertResourceField(t *testing.T, ctx context.Context, client *routeros.Client, path, findField, findValue, checkField, expectedValue string) {
	t.Helper()
	res := AssertResourceExists(t, ctx, client, path, findField, findValue)
	actual := fmt.Sprint(res[checkField])
	if actual != expectedValue {
		t.Fatalf("resource at %s (%s=%s): expected %s=%s, got %s", path, findField, findValue, checkField, expectedValue, actual)
	}
}
