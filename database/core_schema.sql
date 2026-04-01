-- Schema aligned to current FastAPI services (driver-service + order-service)

CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'AVAILABLE'
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_name VARCHAR(160),
    order_size VARCHAR(60),
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'UNASSIGNED',
    driver_id INT REFERENCES drivers(id) ON DELETE SET NULL,
    cluster_id INT,
    sequence_order INT,
    eta DOUBLE PRECISION
);
