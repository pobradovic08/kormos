package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

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
		routes[i] = Route{
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

	route := Route{
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
	return &route, nil
}
