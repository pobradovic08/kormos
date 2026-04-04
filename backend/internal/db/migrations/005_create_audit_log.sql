CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    router_id UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    operations JSONB NOT NULL,
    commit_message TEXT,
    status VARCHAR(20) NOT NULL,
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
