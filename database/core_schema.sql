-- 1. Define ENUM types
CREATE TYPE order_status AS ENUM ('pending', 'assigned', 'in_transit', 'delivered');
CREATE TYPE driver_status AS ENUM ('active', 'offline', 'on_delivery');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- 2. Create tables 
CREATE TABLE drivers (
    driver_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    status driver_status DEFAULT 'offline',
    latitude DECIMAL(10, 8), 
    longitude DECIMAL(11, 8),
    total_deliveries INT DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    delivery_address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL, 
    longitude DECIMAL(11, 8) NOT NULL,
    delivery_date DATE NOT NULL,
    priority priority_level DEFAULT 'medium',
    status order_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);