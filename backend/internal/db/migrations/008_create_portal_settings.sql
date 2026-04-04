CREATE TABLE portal_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    portal_name VARCHAR(255) NOT NULL,
    default_timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    support_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
