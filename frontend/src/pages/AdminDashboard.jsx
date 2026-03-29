import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MapView from '../components/Map/MapView'
import { createDriver, createOrder, getDrivers, getOrders, optimizeRoutes } from '../api/client'

function OrderCard({ order }) {
  return (
    <div className="card">
      <div className="card-title">{order.order_name || `Order #${order.id}`}</div>
      <div className="card-meta">{order.address}</div>
      <div className="card-meta" style={{ marginTop: 6 }}>
        Size: {order.order_size || 'N/A'}
      </div>
      <div className="card-meta" style={{ marginTop: 6 }}>
        Driver: {order.driver_id ?? 'Unassigned'}
      </div>
      <div style={{ marginTop: 8 }}>
        <span className={`badge badge-${String(order.status || '').toLowerCase()}`}>
          {order.status || 'UNKNOWN'}
        </span>
      </div>
    </div>
  )
}

function DriverCard({ driver }) {
  return (
    <div className="card">
      <div className="card-title">{driver.name}</div>
      <div className="card-meta">{driver.phone}</div>
      <div className="card-meta" style={{ marginTop: 6 }}>
        Address: {driver.address || 'N/A'}
      </div>
      <div style={{ marginTop: 8 }}>
        <span className={`badge badge-${String(driver.status || '').toLowerCase()}`}>
          {driver.status || 'UNKNOWN'}
        </span>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [optimizing, setOptimizing] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [orderFormData, setOrderFormData] = useState({
    order_name: '',
    order_size: '',
    address: '',
    latitude: '',
    longitude: '',
  })
  const [driverFormData, setDriverFormData] = useState({
    name: '',
    phone: '',
    address: '',
    latitude: '',
    longitude: '',
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ordersRes, driversRes] = await Promise.all([getOrders(), getDrivers()])
      setOrders(ordersRes.data)
      setDrivers(driversRes.data)
      setError(null)
    } catch (err) {
      setError('Failed to fetch data. Start services first and check ports 5001 and 5002.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const metrics = useMemo(() => {
    const assignedOrders = orders.filter((order) => order.status === 'ASSIGNED').length
    const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED').length
    const availableDrivers = drivers.filter((driver) => driver.status === 'AVAILABLE').length

    return {
      totalOrders: orders.length,
      assignedOrders,
      deliveredOrders,
      totalDrivers: drivers.length,
      availableDrivers,
    }
  }, [drivers, orders])

  const onOptimize = async () => {
    setOptimizing(true)
    setError(null)
    try {
      await optimizeRoutes()
      await fetchData()
    } catch (err) {
      setError('Optimize failed: ' + (err?.response?.data?.error || err?.message || 'unknown'))
    } finally {
      setOptimizing(false)
    }
  }

  const handleOrderFormChange = (event) => {
    const { name, value } = event.target
    setOrderFormData((current) => ({ ...current, [name]: value }))
  }

  const handleDriverFormChange = (event) => {
    const { name, value } = event.target
    setDriverFormData((current) => ({ ...current, [name]: value }))
  }

  const handleMapClick = ({ lat, lng }) => {
    const locationUpdate = {
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }

    if (activeTab === 'drivers' && showDriverForm) {
      setDriverFormData((current) => ({ ...current, ...locationUpdate }))
      return
    }

    if (activeTab === 'orders' && showOrderForm) {
      setOrderFormData((current) => ({ ...current, ...locationUpdate }))
    }
  }

  const handleCreateOrder = async (event) => {
    event.preventDefault()
    setError(null)

    try {
      await createOrder({
        ...orderFormData,
        latitude: Number(orderFormData.latitude),
        longitude: Number(orderFormData.longitude),
      })
      setOrderFormData({
        order_name: '',
        order_size: '',
        address: '',
        latitude: '',
        longitude: '',
      })
      setShowOrderForm(false)
      await fetchData()
    } catch (err) {
      setError('Create order failed: ' + (err?.response?.data?.error || err?.message || 'unknown'))
    }
  }

  const handleCreateDriver = async (event) => {
    event.preventDefault()
    setError(null)

    try {
      await createDriver({
        ...driverFormData,
        latitude: Number(driverFormData.latitude),
        longitude: Number(driverFormData.longitude),
      })
      setDriverFormData({
        name: '',
        phone: '',
        address: '',
        latitude: '',
        longitude: '',
      })
      setShowDriverForm(false)
      await fetchData()
    } catch (err) {
      setError('Create driver failed: ' + (err?.response?.data?.error || err?.message || 'unknown'))
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>EcoRoute Admin</h1>
          <p>Orders, drivers, and route optimization</p>
        </div>

        <div className="sidebar-nav">
          <button
            className={activeTab === 'orders' ? 'active' : ''}
            onClick={() => setActiveTab('orders')}
          >
            Orders
          </button>
          <button
            className={activeTab === 'drivers' ? 'active' : ''}
            onClick={() => setActiveTab('drivers')}
          >
            Drivers
          </button>
        </div>

        <div className="sidebar-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : activeTab === 'orders' ? (
            <>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{orders.length} Orders</span>
                <button className="btn btn-primary btn-sm" onClick={() => setShowOrderForm((open) => !open)}>
                  {showOrderForm ? 'Cancel' : '+ New Order'}
                </button>
              </div>

              {showOrderForm && (
                <form className="card" onSubmit={handleCreateOrder}>
                  <div className="form-group">
                    <label htmlFor="order_name">Order Name</label>
                    <input id="order_name" name="order_name" value={orderFormData.order_name} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="order_size">Order Size</label>
                    <input id="order_size" name="order_size" value={orderFormData.order_size} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address">Address</label>
                    <input id="address" name="address" value={orderFormData.address} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude</label>
                    <input id="latitude" name="latitude" type="number" step="any" value={orderFormData.latitude} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="longitude">Longitude</label>
                    <input id="longitude" name="longitude" type="number" step="any" value={orderFormData.longitude} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="card-meta" style={{ marginBottom: 12 }}>
                    Tip: click on the map to auto-fill latitude and longitude.
                  </div>
                  <button className="btn btn-primary" type="submit">Create Order</button>
                </form>
              )}

              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{drivers.length} Drivers</span>
                <button className="btn btn-primary btn-sm" onClick={() => setShowDriverForm((open) => !open)}>
                  {showDriverForm ? 'Cancel' : '+ New Driver'}
                </button>
              </div>

              {showDriverForm && (
                <form className="card" onSubmit={handleCreateDriver}>
                  <div className="form-group">
                    <label htmlFor="driver_name">Driver Name</label>
                    <input id="driver_name" name="name" value={driverFormData.name} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="driver_phone">Phone</label>
                    <input id="driver_phone" name="phone" value={driverFormData.phone} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="driver_address">Address</label>
                    <input id="driver_address" name="address" value={driverFormData.address} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="driver_latitude">Latitude</label>
                    <input id="driver_latitude" name="latitude" type="number" step="any" value={driverFormData.latitude} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="driver_longitude">Longitude</label>
                    <input id="driver_longitude" name="longitude" type="number" step="any" value={driverFormData.longitude} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="card-meta" style={{ marginBottom: 12 }}>
                    Tip: click on the map to auto-fill driver latitude and longitude.
                  </div>
                  <button className="btn btn-primary" type="submit">Create Driver</button>
                </form>
              )}

              {drivers.map((driver) => <DriverCard key={driver.id} driver={driver} />)}
            </>
          )}
        </div>
      </div>

      <div className="main-area">
        <div className="toolbar">
          <div>
            {error && <span style={{ color: '#e53e3e', fontSize: '0.85rem' }}>{error}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => navigate('/')} style={{ background: '#edf2f7' }}>
              Switch Role
            </button>
            <button className="btn btn-primary" onClick={onOptimize} disabled={optimizing}>
              {optimizing ? 'Optimizing...' : 'Optimize Routes'}
            </button>
          </div>
        </div>

        <div className="map-container">
          {!loading && (
            <MapView
              orders={orders}
              drivers={drivers}
              onMapClick={showOrderForm || showDriverForm ? handleMapClick : null}
              selectedLocation={
                activeTab === 'drivers'
                  ? driverFormData.latitude && driverFormData.longitude
                    ? {
                        latitude: Number(driverFormData.latitude),
                        longitude: Number(driverFormData.longitude),
                      }
                    : null
                  : orderFormData.latitude && orderFormData.longitude
                  ? {
                      latitude: Number(orderFormData.latitude),
                      longitude: Number(orderFormData.longitude),
                    }
                  : null
              }
            />
          )}
        </div>

        <div className="metrics-panel">
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-value">{metrics.totalOrders}</div>
              <div className="metric-label">Orders</div>
            </div>
            <div className="metric-item">
              <div className="metric-value">{metrics.assignedOrders}</div>
              <div className="metric-label">Assigned</div>
            </div>
            <div className="metric-item">
              <div className="metric-value">{metrics.deliveredOrders}</div>
              <div className="metric-label">Delivered</div>
            </div>
            <div className="metric-item">
              <div className="metric-value">{metrics.totalDrivers}</div>
              <div className="metric-label">Drivers</div>
            </div>
            <div className="metric-item">
              <div className="metric-value">{metrics.availableDrivers}</div>
              <div className="metric-label">Available</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
