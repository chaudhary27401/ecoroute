-- 1. Create the connecting table with foreign keys
CREATE TABLE assignments (
    assignment_id SERIAL PRIMARY KEY,
    driver_id INT REFERENCES drivers(driver_id) ON DELETE CASCADE,
    order_id INT REFERENCES orders(order_id) ON DELETE CASCADE,
    route_sequence INT NOT NULL, 
    estimated_arrival_time TIMESTAMP,
    completed_at TIMESTAMP,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create standard composite indexes for faster coordinate lookups
CREATE INDEX idx_drivers_lat_lng ON drivers (latitude, longitude);
CREATE INDEX idx_orders_lat_lng ON orders (latitude, longitude);
