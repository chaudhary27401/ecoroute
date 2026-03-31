
-- 1. Insert Mock Drivers 
INSERT INTO drivers (name, email, phone, status, latitude, longitude) VALUES 
('Mike Johnson', 'mike@ecoroute.com', '+15551234567', 'active', 40.7128, -74.0060),
('Emily Davis', 'emily@ecoroute.com', '+15552345678', 'active', 40.7306, -73.9965),
('James Lee', 'james@ecoroute.com', '+15553456789', 'active', 40.7580, -73.9851);

-- 2. Insert Mock Orders
INSERT INTO orders (customer_name, delivery_address, latitude, longitude, delivery_date, status) VALUES 
('John Smith', '123 Main St, Downtown', 40.7110, -74.0080, CURRENT_DATE, 'pending'),
('Sarah Wilson', '456 Oak Ave, Uptown', 40.7829, -73.9654, CURRENT_DATE, 'pending'),
('Robert Brown', '789 Pine Rd, Suburbs', 40.8090, -73.9352, CURRENT_DATE, 'pending'),
('Lisa Anderson', '321 Elm St, Midtown', 40.7484, -73.9840, CURRENT_DATE, 'pending');

-- 2. Insert Mock Assignments
INSERT INTO assignments (driver_id, order_id, route_sequence) VALUES 
(1, 1, 1), 
(1, 4, 2);