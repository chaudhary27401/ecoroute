
-- Insert Mock Drivers
INSERT INTO drivers (name, phone, address, status, latitude, longitude) VALUES
('Ravi Kumar', '+919876543210', 'Kalyanpur, Kanpur', 'AVAILABLE', 26.493200, 80.257000),
('Amit Singh', '+919812345678', 'Kakadeo, Kanpur', 'AVAILABLE', 26.476700, 80.296500),
('Neha Verma', '+919901234567', 'Rawatpur, Kanpur', 'AVAILABLE', 26.491400, 80.309200);

-- Insert Mock Orders
INSERT INTO orders (order_name, order_size, address, latitude, longitude, status, driver_id) VALUES
('Order 1', 'small', 'Swaroop Nagar, Kanpur', 26.483500, 80.325000, 'UNASSIGNED', NULL),
('Order 2', 'medium', 'Govind Nagar, Kanpur', 26.449900, 80.331900, 'UNASSIGNED', NULL),
('Order 3', 'large', 'Kidwai Nagar, Kanpur', 26.433300, 80.334700, 'UNASSIGNED', NULL),
('Order 4', 'small', 'Arya Nagar, Kanpur', 26.471600, 80.319600, 'UNASSIGNED', NULL);
