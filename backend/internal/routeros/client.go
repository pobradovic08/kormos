package routeros

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client communicates with the RouterOS REST API exposed by CHR instances.
type Client struct {
	host       string
	port       int
	username   string
	password   string
	httpClient *http.Client
}

// NewClient creates a new RouterOS REST API client. The HTTP transport skips
// TLS certificate verification because CHR devices typically use self-signed
// certificates.
func NewClient(host string, port int, username, password string) *Client {
	return &Client{
		host:     host,
		port:     port,
		username: username,
		password: password,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: true, //nolint:gosec // self-signed certs on CHR devices
				},
			},
		},
	}
}

// baseURL returns the root URL for the RouterOS REST API.
func (c *Client) baseURL() string {
	return fmt.Sprintf("https://%s:%d/rest", c.host, c.port)
}

// do performs an HTTP request against the RouterOS REST API. It sets Basic Auth
// credentials, marshals body as JSON when non-nil, and returns the response
// body bytes and HTTP status code.
func (c *Client) do(ctx context.Context, method, path string, body interface{}) ([]byte, int, error) {
	url := c.baseURL() + path

	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("routeros: marshal body: %w", err)
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("routeros: create request: %w", err)
	}

	req.SetBasicAuth(c.username, c.password)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("routeros: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("routeros: read response: %w", err)
	}

	return respBody, resp.StatusCode, nil
}

// Get performs a GET request against the given RouterOS REST path.
func (c *Client) Get(ctx context.Context, path string) ([]byte, error) {
	body, status, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("routeros: GET %s returned status %d: %s", path, status, string(body))
	}
	return body, nil
}

// Put performs a PUT request (create in RouterOS) against the given path.
func (c *Client) Put(ctx context.Context, path string, body interface{}) ([]byte, error) {
	respBody, status, err := c.do(ctx, http.MethodPut, path, body)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("routeros: PUT %s returned status %d: %s", path, status, string(respBody))
	}
	return respBody, nil
}

// Patch performs a PATCH request (update in RouterOS) against the given path.
func (c *Client) Patch(ctx context.Context, path string, body interface{}) ([]byte, error) {
	respBody, status, err := c.do(ctx, http.MethodPatch, path, body)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("routeros: PATCH %s returned status %d: %s", path, status, string(respBody))
	}
	return respBody, nil
}

// Delete performs a DELETE request against the given path.
func (c *Client) Delete(ctx context.Context, path string) error {
	body, status, err := c.do(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("routeros: DELETE %s returned status %d: %s", path, status, string(body))
	}
	return nil
}

// CheckHealth queries /system/resource on the RouterOS device and returns the
// parsed JSON response as a map.
func (c *Client) CheckHealth(ctx context.Context) (map[string]interface{}, error) {
	data, err := c.Get(ctx, "/system/resource")
	if err != nil {
		return nil, fmt.Errorf("routeros: check health: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("routeros: parse health response: %w", err)
	}

	return result, nil
}
