import React from 'react'
import { useNavigate } from 'react-router-dom'

function RoleSelector() {
  const navigate = useNavigate()

  return (
    <div className="role-selector">
      <h1>EcoRoute</h1>
      <p>Intelligent Delivery Optimizer</p>

      <div className="role-cards">
        <div className="role-card" onClick={() => navigate('/admin')}>
          <div style={{ fontSize: '2.5rem' }}>⚙</div>
          <h3>Admin</h3>
          <p>Manage orders, check drivers, and run route optimization.</p>
        </div>

        <div className="role-card" onClick={() => navigate('/driver')}>
          <div style={{ fontSize: '2.5rem' }}>🚚</div>
          <h3>Driver</h3>
          <p>View assigned deliveries, route order, and mark stops delivered.</p>
        </div>
      </div>
    </div>
  )
}

export default RoleSelector
