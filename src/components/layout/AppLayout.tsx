import { Outlet, Link, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

const menuItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/clients', label: 'Klientai' },
  { path: '/pricelist', label: 'Kainynas' },
  { path: '/quotes', label: 'Pasiūlymai' },
  { path: '/projects', label: 'Objektai' },
  { path: '/invoices', label: 'Sąskaitos' },
  { path: '/warehouse', label: 'Sandėlis' },
  { path: '/reports', label: 'Ataskaitos' },
  { path: '/settings', label: 'Nustatymai' },
]

export function AppLayout() {
  const location = useLocation()
  const { online, pending, syncing } = useOnlineStatus()

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Šoninis meniu */}
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">Elva projektai</h1>
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
