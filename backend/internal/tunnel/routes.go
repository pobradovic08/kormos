package tunnel

import (
	"context"
	"fmt"
	"strconv"

	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ─── Routes Request Types ─────────────────────────────────────────────────────

// CreateClusterRouteRequest is the payload for creating a route on all cluster routers.
type CreateClusterRouteRequest struct {
	Destination string `json:"destination"`
	Gateway     string `json:"gateway"`
	Distance    int    `json:"distance"`
	Comment     string `json:"comment,omitempty"`
}

func (r CreateClusterRouteRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{
		"dst-address": r.Destination,
		"gateway":     r.Gateway,
		"distance":    strconv.Itoa(r.Distance),
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	return m
}

// UpdateClusterRouteRequest is the payload for updating a route on all cluster routers.
type UpdateClusterRouteRequest struct {
	Gateway  *string `json:"gateway,omitempty"`
	Distance *int    `json:"distance,omitempty"`
	Disabled *bool   `json:"disabled,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

func (r UpdateClusterRouteRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{}
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

// ─── Routes Service Methods ───────────────────────────────────────────────────

// ListRoutes fetches routes from the master router.
func (s *Service) ListRoutes(ctx context.Context, tenantID, clusterID string) ([]proxy.Route, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchRoutes(ctx, client)
}

// GetRoute fetches a single route by ID from the master router.
func (s *Service) GetRoute(ctx context.Context, tenantID, clusterID, routeID string) (*proxy.Route, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchRoute(ctx, client, routeID)
}

// CreateRoute creates a route on all routers in the cluster.
func (s *Service) CreateRoute(ctx context.Context, tenantID, userID, clusterID string, req CreateClusterRouteRequest) ([]proxy.Route, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "routes",
			OperationType: operation.OpAdd,
			ResourcePath:  "/ip/route",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create route %s via %s", req.Destination, req.Gateway),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("routes: create route: %w", err)
	}

	return s.ListRoutes(ctx, tenantID, clusterID)
}

// findRouteByID finds a route by its RouterOS ID in a slice.
func findRouteByID(routes []proxy.Route, id string) *proxy.Route {
	for i := range routes {
		if routes[i].ID == id {
			return &routes[i]
		}
	}
	return nil
}

// findMatchingRoute finds a route on a target router that matches the reference route by content.
// Matches on destination + gateway + distance + comment.
func findMatchingRoute(routes []proxy.Route, ref proxy.Route) *proxy.Route {
	for i := range routes {
		r := &routes[i]
		if r.Destination == ref.Destination &&
			r.Gateway == ref.Gateway &&
			r.Distance == ref.Distance &&
			r.Comment == ref.Comment {
			return r
		}
	}
	return nil
}

// UpdateRoute updates a route on all routers in the cluster.
// The routeID is the master router's RouterOS ID; the matching route is found by content on other routers.
func (s *Service) UpdateRoute(ctx context.Context, tenantID, userID, clusterID, routeID string, req UpdateClusterRouteRequest) ([]proxy.Route, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical route for content matching.
	var refRoute *proxy.Route
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRoutes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("routes: fetch routes from master: %w", err)
			}
			refRoute = findRouteByID(masterRoutes, routeID)
			break
		}
	}
	if refRoute == nil {
		return nil, fmt.Errorf("routes: route %s not found on master router", routeID)
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = routeID
		} else {
			routes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("routes: fetch routes from router %s: %w", ri.Name, err)
			}
			match := findMatchingRoute(routes, *refRoute)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "routes",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/route",
			ResourceID:    targetID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("routes: route not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update route %s", routeID),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("routes: update route: %w", err)
	}

	return s.ListRoutes(ctx, tenantID, clusterID)
}

// DeleteRoute deletes a route from all routers in the cluster.
func (s *Service) DeleteRoute(ctx context.Context, tenantID, userID, clusterID, routeID string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	// Fetch from master to get the canonical route for content matching.
	var refRoute *proxy.Route
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRoutes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("routes: fetch routes from master: %w", err)
			}
			refRoute = findRouteByID(masterRoutes, routeID)
			break
		}
	}
	if refRoute == nil {
		return fmt.Errorf("routes: route %s not found on master router", routeID)
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = routeID
		} else {
			routes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("routes: fetch routes from router %s: %w", ri.Name, err)
			}
			match := findMatchingRoute(routes, *refRoute)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "routes",
			OperationType: operation.OpDelete,
			ResourcePath:  "/ip/route",
			ResourceID:    targetID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("routes: route not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete route %s", routeID),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("routes: delete route: %w", err)
	}

	return nil
}
