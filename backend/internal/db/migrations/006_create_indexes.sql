CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_routers_tenant_id ON routers(tenant_id);
CREATE INDEX idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_tenant_router ON audit_log(tenant_id, router_id);
CREATE INDEX idx_audit_log_tenant_user ON audit_log(tenant_id, user_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
