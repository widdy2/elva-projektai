import { useNavigate } from 'react-router-dom'
import { useRole } from '../hooks/useRole'
import { useProjects } from '../hooks/useProjects'
import { useQuotes } from '../hooks/useQuotes'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getEntryCost } from '../hooks/useWorkTimeEntries'

const statusLabels: Record<string, string> = {
  planning: 'Planuojamas',
  in_progress: 'Vykdomas',
  completed: 'Užbaigtas',
  on_hold: 'Pristabdytas',
}

export function Dashboard() {
  const navigate = useNavigate()
  const { data: role } = useRole()
  const { data: projects } = useProjects()
  const { data: quotes } = useQuotes()

  const { data: allWorks } = useQuery({
    queryKey: ['allProjectWorks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_works')
        .select('id, project_id, status, deadline')
      if (error) throw error
      return data
    },
  })

  const { data: allTimeEntries } = useQuery({
    queryKey: ['allTimeEntries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_time_entries')
        .select('*')
      if (error) throw error
      return data
    },
  })

  const { data: allMaterials } = useQuery({
    queryKey: ['allProjectMaterials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_materials')
        .select('*')
      if (error) throw error
      return data
    },
  })

  const isEmployee = role === 'employee'

  const inProgressProjects = projects?.filter(p => p.status === 'in_progress').length || 0
  const pendingQuotes = quotes?.filter(q => q.status === 'sent' || q.status === 'pending').length || 0
  const todayTasks = allWorks?.filter(w => w.status !== 'completed').length || 0

  const sales = projects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0
  const received = projects?.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.budget || 0), 0) || 0
  const pending = sales - received
  const materialsCost = allMaterials?.reduce((sum, m) => sum + m.purchased_quantity * m.unit_price, 0) || 0
  const laborCost = allTimeEntries?.reduce((sum, e) => sum + getEntryCost(e), 0) || 0
  const profit = sales - materialsCost - laborCost

  const activeProjects = projects?.filter(p => p.status === 'in_progress' || p.status === 'planning').slice(0, 5) || []

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Vykdomi objektai</h3>
          <p className="text-3xl font-bold text-blue-600">{inProgressProjects}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Laukiantys pasiūlymai</h3>
          <p className="text-3xl font-bold text-yellow-600">{pendingQuotes}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Neatlikti darbai</h3>
          <p className="text-3xl font-bold text-green-600">{todayTasks}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Greiti veiksmai</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/quotes')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm"
            >
              Naujas pasiūlymas
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
            >
              Naujas objektas
            </button>
          </div>
        </div>
      </div>

      {!isEmployee && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Finansai</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Pardavimai</p>
              <p className="text-2xl font-bold text-gray-900">€{sales.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gauta</p>
              <p className="text-2xl font-bold text-green-600">€{received.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Laukiama</p>
              <p className="text-2xl font-bold text-yellow-600">€{pending.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pelnas</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                €{profit.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Aktyvūs objektai</h3>
        {activeProjects.length > 0 ? (
          <div className="space-y-3">
            {activeProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div>
                  <p className="font-medium text-gray-900">{project.clients?.name || project.name}</p>
                  <p className="text-sm text-gray-600">{project.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{statusLabels[project.status] || project.status}</p>
                  {!isEmployee && (
                    <p className="text-sm font-medium text-gray-900">€{(project.budget || 0).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Aktyvių objektų nėra.</p>
        )}
      </div>
    </div>
  )
}
