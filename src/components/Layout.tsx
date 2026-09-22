import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, ReceiptEuro, ChartColumn } from 'lucide-react'
import { useAutoCalendarSync } from '@/hooks/useCalendarSync'

const navItems = [
  { to: '/', label: 'Dashboard', shortLabel: 'Accueil', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', shortLabel: 'Clients', icon: Users },
  { to: '/compta', label: 'Comptabilité', shortLabel: 'Compta', icon: ReceiptEuro },
  { to: '/stats', label: 'Statistiques', shortLabel: 'Stats', icon: ChartColumn },
]

export default function Layout() {
  useAutoCalendarSync()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-6 sticky top-0 z-40">
        <span className="font-bold text-blue-600 text-lg">CoachTrack</span>
        {/* Menu du haut : ordinateur / tablette */}
        <nav className="hidden md:flex gap-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={16} strokeWidth={2} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
      {/* Barre d'onglets du bas : téléphone */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 grid grid-cols-4 z-40 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`
            }
          >
            <item.icon size={22} strokeWidth={1.75} aria-hidden="true" />
            {item.shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
