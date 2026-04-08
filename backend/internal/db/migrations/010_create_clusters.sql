CREATE TYPE router_role AS ENUM ('master', 'backup');

CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE routers
    ADD COLUMN cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    ADD COLUMN role router_role NOT NULL DEFAULT 'master';

CREATE INDEX idx_clusters_tenant ON clusters(tenant_id);
CREATE INDEX idx_routers_cluster ON routers(cluster_id);
