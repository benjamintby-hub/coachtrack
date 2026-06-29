import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Dashboard from '@/pages/Dashboard'
import Clients from '@/pages/Clients'
import Seances from '@/pages/Seances'
import Compta from '@/pages/Compta'
import Stats from '@/pages/Stats'
import Login from '@/pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/seances" element={<Seances />} />
            <Route path="/compta" element={<Compta />} />
            <Route path="/stats" element={<Stats />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
