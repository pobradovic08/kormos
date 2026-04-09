package tunnel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ListFirewallRules handles GET /api/clusters/{clusterID}/firewall/filter.
func (h *Handler) ListFirewallRules(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	rules, err := h.service.ListFirewallRules(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if rules == nil {
		rules = []proxy.FirewallRule{}
	}
	writeJSON(w, http.StatusOK, rules)
}

// CreateFirewallRule handles POST /api/clusters/{clusterID}/firewall/filter.
func (h *Handler) CreateFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateFirewallRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.Chain == "" || req.Action == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Chain and action are required")
		return
	}

	rules, err := h.service.CreateFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, rules)
}

// UpdateFirewallRule handles PATCH /api/clusters/{clusterID}/firewall/filter/{ruleID}.
func (h *Handler) UpdateFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	ruleID := chi.URLParam(r, "ruleID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateFirewallRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	rules, err := h.service.UpdateFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, ruleID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rules)
}

// MoveFirewallRule handles POST /api/clusters/{clusterID}/firewall/filter/move.
func (h *Handler) MoveFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req MoveFirewallRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.ID == "" || req.Destination == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "id and destination are required")
		return
	}

	rules, err := h.service.MoveFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if rules == nil {
		rules = []proxy.FirewallRule{}
	}
	writeJSON(w, http.StatusOK, rules)
}

// DeleteFirewallRule handles DELETE /api/clusters/{clusterID}/firewall/filter/{ruleID}.
func (h *Handler) DeleteFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	ruleID := chi.URLParam(r, "ruleID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, ruleID); err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
