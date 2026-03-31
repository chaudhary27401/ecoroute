import axios from 'axios'

const ordersApi = axios.create({
  baseURL: '/api/orders',
  headers: { 'Content-Type': 'application/json' },
})

const driversApi = axios.create({
  baseURL: '/api/drivers',
  headers: { 'Content-Type': 'application/json' },
})

// Orders
export const createOrder = (data) => ordersApi.post('/', data)
export const getOrders = () => ordersApi.get('/')
export const optimizeRoutes = () => ordersApi.post('/optimize')
export const getUnassignedOrders = () => ordersApi.get('/unassigned')
export const getDriverOrders = (driverId) => ordersApi.get(`/driver/${driverId}`)
export const getDriverRouteGeometry = (driverId) => ordersApi.get(`/driver/${driverId}/route-geometry`)
export const markOrderDelivered = (orderId) => ordersApi.patch(`/${orderId}/deliver`)

// Drivers
export const createDriver = (data) => driversApi.post('/', data)
export const getDrivers = () => driversApi.get('/')
export const getDriverByPhone = (phone) => driversApi.get(`/login?phone=${encodeURIComponent(phone)}`)

export default { ordersApi, driversApi }
