import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, Project } from '../hooks/useProjects'
import { useClients } from '../hooks/useClients'

const statusLabels: Record<string, string> = {
  planning: 'Planuojamas',
  in_progress: 'Vykdomas',
  completed: 'Užbaigtas',
  on_hold: 'Pristabdytas',
}

const statusColors: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-gray-100 text-gray-800',
}

export function Projects() {
  const navigate = useNavigate()
  const { data: projects, isLoading, error } = useProjects()
  const { data: clients } = useClients()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [editingProject, setEditingProject] = useState<(Project & { clients?: { name: string } }) | null>(null)
  const [editClientId, setEditClientId] = useState('')
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editStatus, setEditStatus] = useState<Project['status']>('planning')
  const [editBudget, setEditBudget] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [budget, setBudget] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !address) return

    await createProject.mutateAsync({
      client_id: clientId,
      name: name || address,
      address,
      status: 'planning',
      budget: parseFloat(budget) || 0,
      start_date: startDate || null,
      end_date: endDate || null,
    })

    setClientId('')
    setName('')
    setAddress('')
    setBudget('')
    setStartDate('')
    setEndDate('')
    setShowForm(false)
  }

  const openEdit = (project: Project & { clients?: { name: string } }) => {
    setEditingProject(project)
    setEditClientId(project.client_id || '')
    setEditName(project.name || '')
    setEditAddress(project.address || '')
    setEditStatus(project.status)
    setEditBudget(project.budget?.toString() || '')
    setEditStartDate(project.start_date || '')
    setEditEndDate(project.end_date || '')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return
    try {
      await updateProject.mutateAsync({
        id: editingProject.id,
        client_id: editClientId || editingProject.client_id,
        name: editName || editAddress,
        address: editAddress,
        status: editStatus,
        budget: parseFloat(editBudget) || 0,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
      })
      setEditingProject(null)
    } catch (err) {
      alert(`Klaida išsaugant: ${(err as Error).message}`)
    }
  }

  const handleDelete = async (project: Project & { clients?: { name: string } }) => {
    if (!confirm(`Ar tikrai ištrinti objektą „${project.name || project.address}"? Bus ištrinti ir jo darbai, medžiagos, aktai.`)) return
    try {
      await deleteProject.mutateAsync(project.id)
    } catch (err) {
      alert(`Klaida trinant: ${(err as Error).message}`)
    }
  }

  if (isLoading) {
    return <div className="text-gray-600">Kraunama...</div>
  }

  if (error) {
    return <div className="text-red-600">Klaida: {(error as Error).message}</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Objektai</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Atšaukti' : '+ Naujas objektas'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Klientas *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              >
                <option value="">Pasirinkite klientą</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pavadinimas</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Objekto pavadinimas"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresas *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Objekto adresas"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Biudžetas (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pradžios data</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pabaigos data</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={createProject.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {createProject.isPending ? 'Saugoma...' : 'Išsaugoti objektą'}
            </button>
          </div>
        </form>
      )}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Klientas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Adresas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statusas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Biudžetas (€)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pradžia
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pabaiga
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Veiksmai
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects?.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{project.clients?.name || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{project.address}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.budget?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{project.start_date || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{project.end_date || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(project)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Redaguoti
                  </button>
                  <button
                    onClick={() => handleDelete(project)}
                    disabled={deleteProject.isPending}
                    className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                  >
                    Ištrinti
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Redagavimo modalas */}
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Redaguoti objektą</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klientas</label>
                  <select
                    value={editClientId}
                    onChange={(e) => setEditClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Pasirinkite klientą</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pavadinimas</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresas *</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statusas</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Project['status'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="planning">Planuojamas</option>
                    <option value="in_progress">Vykdomas</option>
                    <option value="completed">Užbaigtas</option>
                    <option value="on_hold">Pristabdytas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Biudžetas (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pradžios data</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pabaigos data</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={updateProject.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {updateProject.isPending ? 'Saugoma...' : 'Išsaugoti'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                >
                  Atšaukti
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
