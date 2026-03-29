import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RoleSelector from './pages/RoleSelector'
import AdminDashboard from './pages/AdminDashboard'
import DriverView from './pages/DriverView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelector />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/driver" element={<DriverView />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
