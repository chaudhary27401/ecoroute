import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MapView from '../components/Map/MapView'
import { getDriverOrders, getDrivers, markOrderDelivered } from '../api/client'

function DriverSelector({ drivers, loading, onSelect, onBack }) {
  return (
    <div className="role-selector">
      <h1>EcoRoute Driver</h1>
      <p>Select your driver profile</p>

      {loading ? (
        <div className="loading">Loading drivers...</div>
      ) : (
        <div className="role-cards" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {drivers.map((driver) => (
            <div key={driver.id} className="role-card" onClick={() => onSelect(driver)}>
              <div style={{ fontSize: '2rem' }}>🚚</div>
              <h3>{driver.name}</h3>
              <p>{driver.phone}</p>
              <p style={{ marginTop: 4 }}>
                <span className={`badge badge-${String(driver.status || '').toLowerCase()}`}>
                  {driver.status}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      <button className="btn" onClick={onBack} style={{ marginTop: 20, background: '#edf2f7' }}>
        Back
      </button>
    </div>
  )
}

function DriverView() {
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [orders, setOrders] = useState([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
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
      const res = await getDrivers()
      setDrivers(res.data)
      setError(null)
    } catch {
      setError('Failed to load drivers.')
    } finally {
      setLoadingDrivers(false)
    }
  }

  useEffect(() => { loadDrivers() }, [])

  const selectDriver = async (driver) => {
    setSelectedDriver(driver)
    setAllDelivered(false)
    setLoadingOrders(true)
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
      setLoadingOrders(false)
    }
  }

  // ── FIXED deliver ─────────────────────────────────────────────────────────
  // Root cause: the backend used db.flush() before counting remaining orders,
  // but flush doesn't update SQLAlchemy's own session cache — the COUNT query
  // still saw the order as non-DELIVERED, so `remaining` was always ≥ 1 and
  // PATCH /drivers/{id}/free was never called. Driver stayed ASSIGNED forever.
  //
  // The backend fix (commit before count) is the real solution. This frontend
  // fix adds:
  //   1. Always re-fetch orders after delivery so UI matches DB truth.
  //   2. Show a "All done!" banner when driver_freed=true comes back.
  //   3. Re-fetch the drivers list so the selector reflects updated status.
  const deliver = async (orderId) => {
    setActionLoading(orderId)
    setError(null)
    try {
      const res = await markOrderDelivered(orderId)

      // Re-fetch this driver's orders from the server (source of truth)
      if (selectedDriver) {
        const ordersRes = await getDriverOrders(selectedDriver.id)
        setOrders(ordersRes.data)
      }

      // Backend now returns { driver_freed: true } when all stops are done
      if (res?.data?.driver_freed) {
        setAllDelivered(true)
        // Refresh drivers list so selector shows AVAILABLE status immediately
        loadDrivers()
      }
    } catch {
      setError('Failed to mark delivered.')
    } finally {
      setActionLoading(null)
    }
  }

  const selectedLocation =
    activeTab === 'drivers' && driverFormData.latitude && driverFormData.longitude
      ? { latitude: Number(driverFormData.latitude), longitude: Number(driverFormData.longitude) }
      : activeTab === 'orders' && orderFormData.latitude && orderFormData.longitude
        ? { latitude: Number(orderFormData.latitude), longitude: Number(orderFormData.longitude) }
        : null

  return (
    <div className="driver-view">
      <div className="driver-header">
        <div>
          <h2>{selectedDriver.name}</h2>
          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
            {selectedDriver.phone} | {remainingOrders.length} pending stop{remainingOrders.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn"
            onClick={() => { setSelectedDriver(null); setOrders([]); setError(null); setAllDelivered(false) }}
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Switch Driver
          </button>
          <button
            className="btn"
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Home
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: 12, background: '#fef3c7', color: '#92400e', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* ── "All done!" completion banner ────────────────────────────────── */}
      {allDelivered && (
        <div style={{
          padding: '14px 20px',
          background: '#d1fae5',
          color: '#065f46',
          fontSize: '0.95rem',
          fontWeight: 600,
          borderTop: '1px solid #6ee7b7',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.4rem' }}>✅</span>
          All deliveries complete! You are now marked as available.
        </div>
      )}

      <div style={{ flex: 1 }}>
        {loadingOrders ? (
          <div className="loading">Loading assigned orders...</div>
        ) : (
          <MapView orders={orders} drivers={[selectedDriver]} />
        )}
      </div>

      {/* ── Next stop action bar (hidden when all done) ───────────────────── */}
      {remainingOrders.length > 0 && !allDelivered && (
        <>
          <div style={{
            padding: '12px 20px',
            background: '#ebf8ff',
            borderTop: '1px solid #bee3f8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#2b6cb0', fontWeight: 600 }}>NEXT STOP</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{remainingOrders[0].address}</div>
              <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                Sequence: {remainingOrders[0].sequence_order ?? 'N/A'}
                {remainingOrders[0].eta != null && ` | ETA: ${remainingOrders[0].eta} min`}
              </div>
            </div>

            <button
              className="btn btn-success"
              onClick={() => deliver(remainingOrders[0].id)}
              disabled={actionLoading === remainingOrders[0].id}
            >
              {actionLoading === remainingOrders[0].id ? 'Updating...' : 'Mark Delivered'}
            </button>
          </div>

          <div className="map-container">
            {!loading && (
              <MapView
                orders={orders}
                drivers={drivers}
                onMapClick={showOrderForm || showDriverForm ? handleMapClick : null}
                selectedLocation={selectedLocation}
                geometries={geometries}
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
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AdminDashboard