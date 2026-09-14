import { useState } from 'react'
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, Client } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useNavigate } from 'react-router-dom'

export function Clients() {
  const { data: clients, isLoading, error } = useClients()
  const { data: projects } = useProjects()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()
  const createClient = useCreateClient()
  const navigate = useNavigate()

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newVatCode, setNewVatCode] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editVatCode, setEditVatCode] = useState('')

  const clientProjects = projects?.filter(p => p.client_id === selectedClient?.id) || []

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client)
    setIsEditing(false)
    setEditName(client.name)
    setEditEmail(client.email || '')
    setEditPhone(client.phone || '')
    setEditAddress(client.address || '')
    setEditCode(client.code || '')
    setEditVatCode(client.vat_code || '')
  }

  const handleSave = async () => {
    if (!selectedClient || !editName.trim()) return
    try {
      await updateClient.mutateAsync({
        id: selectedClient.id,
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        code: editCode.trim() || null,
        vat_code: editVatCode.trim() || null,
      })
      setSelectedClient({ ...selectedClient, name: editName.trim(), email: editEmail.trim() || null, phone: editPhone.trim() || null, address: editAddress.trim() || null, code: editCode.trim() || null, vat_code: editVatCode.trim() || null })
      setIsEditing(false)
    } catch (err) {
      alert(`Klaida atnaujinant klientą: ${(err as Error).message}`)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createClient.mutateAsync({
        name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        address: newAddress.trim() || null,
        code: newCode.trim() || null,
        vat_code: newVatCode.trim() || null,
      })
      setIsCreating(false)
      setNewName('')
      setNewEmail('')
      setNewPhone('')
      setNewAddress('')
      setNewCode('')
      setNewVatCode('')
    } catch (err) {
      alert(`Klaida kuriant klientą: ${(err as Error).message}`)
    }
  }

  const handleDelete = async () => {
    if (!selectedClient) return
    if (!confirm(`Ar tikrai ištrinti klientą "${selectedClient.name}"?`)) return
    try {
      await deleteClient.mutateAsync(selectedClient.id)
      setSelectedClient(null)
    } catch (err) {
      alert(`Klaida trinant klientą: ${(err as Error).message}`)
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
        <h2 className="text-2xl font-bold text-gray-900">Klientai</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          + Naujas klientas
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vardas / Pavadinimas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                El. paštas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telefonas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Adresas
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients?.map((client) => (
              <tr
                key={client.id}
                className={`hover:bg-gray-50 cursor-pointer ${selectedClient?.id === client.id ? 'bg-blue-50' : ''}`}
                onClick={() => handleSelectClient(client)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{client.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{client.email || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{client.phone || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{client.address || '-'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Naujo kliento modalas */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsCreating(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">Naujas klientas</h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Vardas / Pavadinimas *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">El. paštas</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Telefonas</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Adresas</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Įmonės kodas</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">PVM mokėtojo kodas</label>
                  <input
                    type="text"
                    value={newVatCode}
                    onChange={(e) => setNewVatCode(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCreate}
                  disabled={createClient.isPending || !newName.trim()}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {createClient.isPending ? 'Kuriama...' : 'Sukurti'}
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Atšaukti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kliento detalių modalas */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedClient(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">{selectedClient.name}</h3>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>

              {!isEditing ? (
                <>
                  <div className="space-y-3 mb-6">
                    <div>
                      <span className="text-xs text-gray-500 uppercase">El. paštas</span>
                      <p className="text-sm text-gray-900">{selectedClient.email || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Telefonas</span>
                      <p className="text-sm text-gray-900">{selectedClient.phone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Adresas</span>
                      <p className="text-sm text-gray-900">{selectedClient.address || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Įmonės kodas</span>
                      <p className="text-sm text-gray-900">{selectedClient.code || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">PVM mokėtojo kodas</span>
                      <p className="text-sm text-gray-900">{selectedClient.vat_code || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Sukurtas</span>
                      <p className="text-sm text-gray-900">{new Date(selectedClient.created_at).toLocaleDateString('lt-LT')}</p>
                    </div>
                  </div>

                  {/* Kliento objektai */}
                  {clientProjects.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Objektai ({clientProjects.length})</h4>
                      <div className="space-y-1">
                        {clientProjects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                          >
                            {p.name} — {p.address}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                    >
                      Redaguoti
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteClient.isPending}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteClient.isPending ? 'Trinama...' : 'Ištrinti'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Vardas / Pavadinimas</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">El. paštas</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Telefonas</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Adresas</label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Įmonės kodas</label>
                      <input
                        type="text"
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">PVM mokėtojo kodas</label>
                      <input
                        type="text"
                        value={editVatCode}
                        onChange={(e) => setEditVatCode(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleSave}
                      disabled={updateClient.isPending || !editName.trim()}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {updateClient.isPending ? 'Saugoma...' : 'Išsaugoti'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                    >
                      Atšaukti
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
