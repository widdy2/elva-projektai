import { Outlet, Link, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { lt } from '../../i18n/lt'

const menuItems = [
  { path: '/', label: lt.menu.dashboard },
  { path: '/clients', label: lt.menu.clients },
  { path: '/pricelist', label: lt.menu.pricelist },
  { path: '/quotes', label: lt.menu.quotes },
  { path: '/projects', label: lt.menu.projects },
  { path: '/invoices', label: lt.menu.invoices },
  { path: '/warehouse', label: lt.menu.warehouse },
  { path: '/reports', label: lt.menu.reports },
  { path: '/settings', label: lt.menu.settings },
]

export function AppLayout() {
  const location = useLocation()
  const { online, pending, syncing } = useOnlineStatus()

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Šoninis meniu */}
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">{lt.appTitle}</h1>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`block px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Pagrindinė turinio sritis */}
      <main className="flex-1 p-8">
        {(!online || pending > 0 || syncing) && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
              online
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {!online && `Nėra interneto ryšio — pakeitimai bus išsaugoti ir išsiųsti vėliau${pending > 0 ? ` (laukia: ${pending})` : ''}`}
            {online && syncing && 'Sinchronizuojama...'}
            {online && !syncing && pending > 0 && `Laukia sinchronizacijos: ${pending}`}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
