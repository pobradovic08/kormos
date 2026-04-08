package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// CreateRouteRequest is the frontend's payload for creating a static route.
type CreateRouteRequest struct {
	Destination string `json:"destination"`
	Gateway     string `json:"gateway"`
	Distance    int    `json:"distance"`
	Comment     string `json:"comment,omitempty"`
}

// toRouterOS converts the create request to RouterOS REST API format.
func (r CreateRouteRequest) toRouterOS() map[string]string {
	m := map[string]string{
		"dst-address": r.Destination,
		"gateway":     r.Gateway,
		"distance":    strconv.Itoa(r.Distance),
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	return m
}

// UpdateRouteRequest is the frontend's payload for updating a static route.
type UpdateRouteRequest struct {
	Gateway  *string `json:"gateway,omitempty"`
	Distance *int    `json:"distance,omitempty"`
	Disabled *bool   `json:"disabled,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

// toRouterOS converts the update request to RouterOS REST API format.
func (r UpdateRouteRequest) toRouterOS() map[string]string {
	m := map[string]string{}
	if r.Gateway != nil {
		m["gateway"] = *r.Gateway
	}
	if r.Distance != nil {
		m["distance"] = strconv.Itoa(*r.Distance)
	}
	if r.Disabled != nil {
		if *r.Disabled {
			m["disabled"] = "true"
		} else {
			m["disabled"] = "false"
		}
	}
	if r.Comment != nil {
		m["comment"] = *r.Comment
	}
	return m
}

// CreateRoute creates a static route on a RouterOS device and returns it normalized.
func CreateRoute(ctx context.Context, client *routeros.Client, req CreateRouteRequest) (*Route, error) {
	body, err := client.Put(ctx, "/ip/route", req.toRouterOS())
	if err != nil {
		return nil, fmt.Errorf("proxy: create route: %w", err)
	}

	var r rawRoute
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("proxy: parse created route: %w", err)
	}

	route := normalizeRoute(r)
	return &route, nil
}

// UpdateRoute updates a static route on a RouterOS device.
func UpdateRoute(ctx context.Context, client *routeros.Client, id string, req UpdateRouteRequest) error {
	_, err := client.Patch(ctx, "/ip/route/"+id, req.toRouterOS())
	if err != nil {
		return fmt.Errorf("proxy: update route %s: %w", id, err)
	}
	return nil
}

// DeleteRoute deletes a static route from a RouterOS device.
func DeleteRoute(ctx context.Context, client *routeros.Client, id string) error {
	err := client.Delete(ctx, "/ip/route/"+id)
	if err != nil {
		return fmt.Errorf("proxy: delete route %s: %w", id, err)
	}
	return nil
}

// Route is the normalized representation of a RouterOS IP route.
type Route struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
	Gateway     string `json:"gateway"`
	Interface   string `json:"interface,omitempty"`
	Distance    int    `json:"distance"`
	RouteType   string `json:"routeType"`
	RoutingMark string `json:"routingMark,omitempty"`
	Disabled    bool   `json:"disabled"`
	Active      bool   `json:"active"`
	Comment     string `json:"comment,omitempty"`
}

type rawRoute struct {
	ID           string `json:".id"`
	DstAddress   string `json:"dst-address"`
	Gateway      string `json:"gateway"`
	Interface    string `json:"interface"`
	Distance     string `json:"distance"`
	RoutingMark  string `json:"routing-mark"`
	Disabled     string `json:"disabled"`
	Active       string `json:"active"`
	Static       string `json:"static"`
	Connect      string `json:"connect"`
	Comment      string `json:"comment"`
	BlackholeStr string `json:"blackhole"`
}

// deriveRouteType determines the route type from RouterOS flags.
func deriveRouteType(r rawRoute) string {
	if parseBool(r.BlackholeStr) {
		return "blackhole"
	}
	if parseBool(r.Connect) {
		return "connected"
	}
	return "static"
}

func normalizeRoute(r rawRoute) Route {
	return Route{
		ID:          r.ID,
		Destination: r.DstAddress,
		Gateway:     r.Gateway,
		Interface:   r.Interface,
		Distance:    parseInt(r.Distance),
		RouteType:   deriveRouteType(r),
		RoutingMark: r.RoutingMark,
		Disabled:    parseBool(r.Disabled),
		Active:      parseBool(r.Active),
		Comment:     r.Comment,
	}
}

// FetchRoutes fetches and normalizes all routes from a RouterOS device.
func FetchRoutes(ctx context.Context, client *routeros.Client) ([]Route, error) {
	body, err := client.Get(ctx, "/ip/route")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch routes: %w", err)
	}

	var raw []rawRoute
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse routes: %w", err)
	}

	routes := make([]Route, len(raw))
	for i, r := range raw {
		routes[i] = normalizeRoute(r)
	}
	return routes, nil
}

// FetchRoute fetches a single route by ID from a RouterOS device.
func FetchRoute(ctx context.Context, client *routeros.Client, id string) (*Route, error) {
	body, err := client.Get(ctx, "/ip/route/"+id)
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch route %s: %w", id, err)
	}

	var r rawRoute
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("proxy: parse route: %w", err)
	}

	route := normalizeRoute(r)
	return &route, nil
}
