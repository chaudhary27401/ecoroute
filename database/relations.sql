-- Indexes for faster coordinate lookups
CREATE INDEX idx_drivers_lat_lng ON drivers (latitude, longitude);
CREATE INDEX idx_orders_lat_lng ON orders (latitude, longitude);
