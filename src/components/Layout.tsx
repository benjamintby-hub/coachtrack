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
    <div className="min-h-screen bg-surface text-ink flex flex-col">
      <header className="materiau border-b border-white/10 px-4 py-3 flex items-center gap-6 sticky top-0 z-40">
        <span className="flex items-center gap-2 font-display font-bold tracking-tight text-ink text-lg">
          <svg width="22" height="22" viewBox="0 0 48 48" fill="none" stroke="var(--color-accent)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M36 15.5A13 13 0 1 0 29.5 36.2L46 17" />
          </svg>
          CoachTrack
        </span>
        {import.meta.env.MODE === 'test' && (
          <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded">BASE DE TEST</span>
        )}
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
                    ? 'bg-accent/12 text-accent'
                    : 'text-muted hover:text-ink'
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
      <nav className="materiau md:hidden fixed bottom-0 inset-x-0 border-t border-white/10 grid grid-cols-4 z-40 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-accent' : 'text-muted'
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
