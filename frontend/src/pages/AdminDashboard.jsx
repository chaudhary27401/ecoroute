import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MapView from '../components/Map/MapView'
import { createDriver, createOrder, getDrivers, getOrders, optimizeRoutes } from '../api/client'

function OrderCard({ order }) {
  return (
    <div className="card">
      <div className="card-title">{order.order_name || `Order #${order.id}`}</div>
      <div className="card-meta">{order.address}</div>
      <div className="card-meta" style={{ marginTop: 4 }}>
        Size: {order.order_size || 'N/A'} &nbsp;|&nbsp; Driver: {order.driver_id ?? 'Unassigned'}
      </div>
      {/* BUG FIX: show ETA if available */}
      {order.eta != null && (
        <div className="card-meta" style={{ marginTop: 4 }}>
          ETA: <strong>{order.eta} min</strong> &nbsp;|&nbsp; Stop #{order.sequence_order}
        </div>
      )}
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
      <div className="card-meta" style={{ marginTop: 4 }}>
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
  const [geometries, setGeometries] = useState({})  // driver_id → [[lat,lon],...]
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [orderFormData, setOrderFormData] = useState({
    order_name: '', order_size: '', address: '', latitude: '', longitude: '',
  })
  const [driverFormData, setDriverFormData] = useState({
    name: '', phone: '', address: '', latitude: '', longitude: '',
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ordersRes, driversRes] = await Promise.all([getOrders(), getDrivers()])
      setOrders(ordersRes.data)
      setDrivers(driversRes.data)
      setError(null)
    } catch (err) {
      setError('Failed to fetch data. Make sure order-service (5001) and driver-service (5002) are running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const metrics = useMemo(() => ({
    totalOrders: orders.length,
    assignedOrders: orders.filter((o) => o.status === 'ASSIGNED').length,
    deliveredOrders: orders.filter((o) => o.status === 'DELIVERED').length,
    totalDrivers: drivers.length,
    availableDrivers: drivers.filter((d) => d.status === 'AVAILABLE').length,
  }), [orders, drivers])

  const onOptimize = async () => {
    setOptimizing(true)
    setError(null)
    try {
      const res = await optimizeRoutes()
      const msg = res?.data?.message || 'Done'
      if (msg !== 'Optimization complete' && msg !== 'Done') {
        setError(`ℹ️ ${msg}`)
      }
      // Extract road geometries keyed by real driver ID.
      // The optimizer returns clusters by cluster-index (0, 1, 2…) but
      // order.py maps them to real driver IDs. We store both to handle either.
      const geoMap = {}
      if (res?.data?.geometries) {
        Object.assign(geoMap, res.data.geometries)
      }
      setGeometries(geoMap)
      await fetchData()
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'unknown'
      setError(`Optimize failed: ${detail}`)
    } finally {
      setOptimizing(false)
    }
  }

  const handleOrderFormChange = (e) => {
    const { name, value } = e.target
    setOrderFormData((cur) => ({ ...cur, [name]: value }))
  }

  const handleDriverFormChange = (e) => {
    const { name, value } = e.target
    setDriverFormData((cur) => ({ ...cur, [name]: value }))
  }

  const handleMapClick = ({ lat, lng }) => {
    const loc = { latitude: lat.toFixed(6), longitude: lng.toFixed(6) }
    if (activeTab === 'drivers' && showDriverForm) {
      setDriverFormData((cur) => ({ ...cur, ...loc }))
    } else if (activeTab === 'orders' && showOrderForm) {
      setOrderFormData((cur) => ({ ...cur, ...loc }))
    }
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await createOrder({
        ...orderFormData,
        latitude: Number(orderFormData.latitude),
        longitude: Number(orderFormData.longitude),
      })
      setOrderFormData({ order_name: '', order_size: '', address: '', latitude: '', longitude: '' })
      setShowOrderForm(false)
      await fetchData()
    } catch (err) {
      setError('Create order failed: ' + (err?.response?.data?.detail || err?.message))
    }
  }

  const handleCreateDriver = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await createDriver({
        ...driverFormData,
        latitude: Number(driverFormData.latitude),
        longitude: Number(driverFormData.longitude),
      })
      setDriverFormData({ name: '', phone: '', address: '', latitude: '', longitude: '' })
      setShowDriverForm(false)
      await fetchData()
    } catch (err) {
      setError('Create driver failed: ' + (err?.response?.data?.detail || err?.message))
    }
  }

  const selectedLocation =
    activeTab === 'drivers' && driverFormData.latitude && driverFormData.longitude
      ? { latitude: Number(driverFormData.latitude), longitude: Number(driverFormData.longitude) }
      : activeTab === 'orders' && orderFormData.latitude && orderFormData.longitude
      ? { latitude: Number(orderFormData.latitude), longitude: Number(orderFormData.longitude) }
      : null

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>EcoRoute Admin</h1>
          <p>Orders, drivers, and route optimization</p>
        </div>

        <div className="sidebar-nav">
          <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
            Orders
          </button>
          <button className={activeTab === 'drivers' ? 'active' : ''} onClick={() => setActiveTab('drivers')}>
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
                <button className="btn btn-primary btn-sm" onClick={() => setShowOrderForm((o) => !o)}>
                  {showOrderForm ? 'Cancel' : '+ New Order'}
                </button>
              </div>

              {showOrderForm && (
                <form className="card" onSubmit={handleCreateOrder}>
                  <div className="form-group">
                    <label>Order Name</label>
                    <input name="order_name" value={orderFormData.order_name} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="form-group">
                    <label>Order Size</label>
                    <input name="order_size" value={orderFormData.order_size} onChange={handleOrderFormChange} required />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input name="address" value={orderFormData.address} onChange={handleOrderFormChange} required />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Latitude</label>
                      <input name="latitude" type="number" step="any" value={orderFormData.latitude} onChange={handleOrderFormChange} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Longitude</label>
                      <input name="longitude" type="number" step="any" value={orderFormData.longitude} onChange={handleOrderFormChange} required />
                    </div>
                  </div>
                  <div className="card-meta" style={{ marginBottom: 10 }}>
                    💡 Click the map to auto-fill coordinates.
                  </div>
                  <button className="btn btn-primary" type="submit">Create Order</button>
                </form>
              )}

              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{drivers.length} Drivers</span>
                <button className="btn btn-primary btn-sm" onClick={() => setShowDriverForm((o) => !o)}>
                  {showDriverForm ? 'Cancel' : '+ New Driver'}
                </button>
              </div>

              {showDriverForm && (
                <form className="card" onSubmit={handleCreateDriver}>
                  <div className="form-group">
                    <label>Driver Name</label>
                    <input name="name" value={driverFormData.name} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" value={driverFormData.phone} onChange={handleDriverFormChange} required />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input name="address" value={driverFormData.address} onChange={handleDriverFormChange} required />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Latitude</label>
                      <input name="latitude" type="number" step="any" value={driverFormData.latitude} onChange={handleDriverFormChange} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Longitude</label>
                      <input name="longitude" type="number" step="any" value={driverFormData.longitude} onChange={handleDriverFormChange} required />
                    </div>
                  </div>
                  <div className="card-meta" style={{ marginBottom: 10 }}>
                    💡 Click the map to auto-fill coordinates.
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
            {/* Added Refresh button so admin can poll without full page reload */}
            <button className="btn" onClick={fetchData} disabled={loading} style={{ background: '#edf2f7' }}>
              {loading ? '...' : '↻ Refresh'}
            </button>
            <button className="btn btn-primary" onClick={onOptimize} disabled={optimizing || loading}>
              {optimizing ? 'Optimizing…' : '⚡ Optimize Routes'}
            </button>
          </div>
        </div>

        <div className="map-container">
          {!loading && (
            <MapView
              orders={orders}
              drivers={drivers}
              onMapClick={showOrderForm || showDriverForm ? handleMapClick : null}
              selectedLocation={selectedLocation}
              geometries={geometries}
              enableOsrmRoutes={!(showOrderForm || showDriverForm)}
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