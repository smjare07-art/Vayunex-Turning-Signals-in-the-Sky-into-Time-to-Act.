CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin', 'rescue')),
    token TEXT
);

ALTER TABLE users
ADD COLUMN reset_password_token TEXT,
ADD COLUMN reset_password_expires TIMESTAMP;

ALTER TABLE users
ADD COLUMN phone VARCHAR(20),
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN whatsapp_opt_in BOOLEAN DEFAULT FALSE;