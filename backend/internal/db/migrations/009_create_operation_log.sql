CREATE TYPE operation_group_status AS ENUM ('applied', 'undone', 'failed', 'requires_attention');
CREATE TYPE operation_type AS ENUM ('add', 'modify', 'delete');
CREATE TYPE operation_status AS ENUM ('applied', 'undone', 'failed');

CREATE TABLE operation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status operation_group_status NOT NULL DEFAULT 'applied',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);

CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES operation_groups(id) ON DELETE CASCADE,
    router_id UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    operation_type operation_type NOT NULL,
    resource_path TEXT NOT NULL,
    resource_id TEXT,
    before_state JSONB,
    after_state JSONB,
    sequence INT NOT NULL,
    status operation_status NOT NULL DEFAULT 'applied',
    error TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operation_groups_tenant_created ON operation_groups(tenant_id, created_at DESC);
CREATE INDEX idx_operation_groups_user ON operation_groups(user_id);
CREATE INDEX idx_operations_group ON operations(group_id);
CREATE INDEX idx_operations_router ON operations(router_id);
