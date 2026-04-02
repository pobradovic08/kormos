package interfaces

import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/router"
)

// Fetcher retrieves interface information from RouterOS devices by
// communicating through the router service layer.
type Fetcher struct {
	routerSvc *router.Service
}

// NewFetcher creates a new interface Fetcher backed by the given router service.
func NewFetcher(routerSvc *router.Service) *Fetcher {
	return &Fetcher{routerSvc: routerSvc}
}

// ListInterfaces fetches all interfaces and their IP addresses from the
// RouterOS device identified by routerID, and returns them as normalised
// Interface structs.
func (f *Fetcher) ListInterfaces(ctx context.Context, tenantID, routerID string) ([]Interface, error) {
	client, err := f.routerSvc.GetClientForRouter(ctx, tenantID, routerID)
	if err != nil {
		return nil, fmt.Errorf("interfaces: get client: %w", err)
	}

	rawInterfaces, err := client.Get(ctx, "/interface")
	if err != nil {
		return nil, fmt.Errorf("interfaces: fetch /interface: %w", err)
	}

	rawAddresses, err := client.Get(ctx, "/ip/address")
	if err != nil {
		return nil, fmt.Errorf("interfaces: fetch /ip/address: %w", err)
	}

	return NormalizeInterfaces(rawInterfaces, rawAddresses)
}

// GetInterface fetches a single interface by name from the RouterOS device
// identified by routerID.
func (f *Fetcher) GetInterface(ctx context.Context, tenantID, routerID, name string) (*Interface, error) {
	ifaces, err := f.ListInterfaces(ctx, tenantID, routerID)
	if err != nil {
		return nil, err
	}

	for i := range ifaces {
		if ifaces[i].Name == name {
			return &ifaces[i], nil
		}
	}

	return nil, nil
}
