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
  const [drivers, setDrivers]               = useState([])
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [orders, setOrders]                 = useState([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [loadingOrders, setLoadingOrders]   = useState(false)
  const [actionLoading, setActionLoading]   = useState(null)
  const [error, setError]                   = useState(null)
  const [allDelivered, setAllDelivered]     = useState(false)
  const [geometries, setGeometries]         = useState({})

  const loadDrivers = async () => {
    setLoadingDrivers(true)
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
    setGeometries({})
    setLoadingOrders(true)
    setError(null)
    try {
      const ordersRes = await getDriverOrders(driver.id)
      setOrders(ordersRes.data)
    } catch {
      setOrders([])
      setError('No assigned orders found for this driver yet.')
    } finally {
      setLoadingOrders(false)
    }
  }

  const deliver = async (orderId) => {
    setActionLoading(orderId)
    setError(null)
    try {
      // Step 1: tell backend to mark delivered, move driver, rebuild geometry
      const res  = await markOrderDelivered(orderId)
      const data = res?.data || {}

      // Step 2: fetch fresh orders (source of truth for statuses)
      let freshOrders = orders
      if (selectedDriver) {
        const ordersRes = await getDriverOrders(selectedDriver.id)
        freshOrders = ordersRes.data
        setOrders(freshOrders)
      }

      // Step 3: move driver pin to the delivered stop's coordinates.
      // BUG FIX — stale closure: the old code did `orders.find(...)` which
      // reads the pre-fetch snapshot still held in the closure. We instead
      // search `freshOrders` which is guaranteed to be the server response
      // we just received, so coordinates are always current and accurate.
      const deliveredOrder = freshOrders.find((o) => o.id === orderId)
      if (deliveredOrder?.latitude != null && deliveredOrder?.longitude != null) {
        setSelectedDriver((prev) => ({
          ...prev,
          latitude:  deliveredOrder.latitude,
          longitude: deliveredOrder.longitude,
        }))
      }

      // Step 4: update route polyline with backend-computed OSRM geometry.
      // new_geometry goes from the driver's new position to remaining stops.
      if (data.new_geometry?.length && data.driver_id != null) {
        setGeometries((prev) => ({
          ...prev,
          [data.driver_id]:         data.new_geometry,
          [String(data.driver_id)]: data.new_geometry,
        }))
      }

      // Step 5: all stops done → show completion banner, clear route, refresh list
      if (data.driver_freed) {
        setAllDelivered(true)
        setGeometries({})
        loadDrivers()
      }
    } catch {
      setError('Failed to mark delivered.')
    } finally {
      setActionLoading(null)
    }
  }

  const remainingOrders = useMemo(
    () => orders.filter((o) => o.status !== 'DELIVERED'),
    [orders]
  )

  if (!selectedDriver) {
    return (
      <DriverSelector
        drivers={drivers}
        loading={loadingDrivers}
        onSelect={selectDriver}
        onBack={() => navigate('/')}
      />
    )
  }

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
            onClick={() => {
              setSelectedDriver(null); setOrders([]); setError(null)
              setAllDelivered(false); setGeometries({})
            }}
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

      {error && (
        <div style={{ padding: 12, background: '#fef3c7', color: '#92400e', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {allDelivered && (
        <div style={{
          padding: '14px 20px', background: '#d1fae5', color: '#065f46',
          fontSize: '0.95rem', fontWeight: 600, borderTop: '1px solid #6ee7b7',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.4rem' }}>✅</span>
          All deliveries complete! You are now marked as available.
        </div>
      )}

      <div style={{ flex: 1 }}>
        {loadingOrders ? (
          <div className="loading">Loading assigned orders...</div>
        ) : (
          <MapView orders={orders} drivers={[selectedDriver]} geometries={geometries} />
        )}
      </div>

      {remainingOrders.length > 0 && !allDelivered && (
        <div style={{
          padding: '12px 20px', background: '#ebf8ff',
          borderTop: '1px solid #bee3f8',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#2b6cb0', fontWeight: 600 }}>NEXT STOP</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{remainingOrders[0].address}</div>
            <div style={{ fontSize: '0.75rem', color: '#718096' }}>
              Stop #{remainingOrders[0].sequence_order ?? 'N/A'}
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
      )}

      <div className="stop-list">
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Assigned Orders</div>
        {orders.length === 0 && !loadingOrders && (
          <div className="card-meta">No assigned orders.</div>
        )}
        {orders.map((order, index) => {
          const isDelivered = order.status === 'DELIVERED'
          return (
            <div
              key={order.id}
              className={`stop-item ${!isDelivered && remainingOrders[0]?.id === order.id ? 'active' : ''}`}
              style={{ opacity: isDelivered ? 0.55 : 1 }}
            >
              <div className="stop-number">
                {isDelivered ? '✓' : order.sequence_order ?? index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.8rem', fontWeight: 500,
                  textDecoration: isDelivered ? 'line-through' : 'none',
                }}>
                  {order.order_name || `Order #${order.id}`}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#718096' }}>{order.address}</div>
                {order.eta != null && (
                  <div style={{ fontSize: '0.7rem', color: '#a0aec0' }}>ETA: {order.eta} min</div>
                )}
              </div>
              <div>
                {isDelivered ? (
                  <span className="badge badge-delivered">DELIVERED</span>
                ) : (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => deliver(order.id)}
                    disabled={actionLoading === order.id}
                  >
                    {actionLoading === order.id ? '...' : 'Done'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DriverView