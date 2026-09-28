import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-faint">Chargement...</p>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
