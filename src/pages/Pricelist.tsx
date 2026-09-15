import { useState } from 'react'
import { usePriceItems, useUpdatePriceItem, useDeletePriceItem } from '../hooks/usePricelist'
import { useOrganization } from '../hooks/useOrganization'
import { ExcelImport } from '../components/ExcelImport'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export function Pricelist() {
  const { data: priceItems, isLoading, error } = usePriceItems()
  const { data: organizationId } = useOrganization()
  const queryClient = useQueryClient()
  const updateItem = useUpdatePriceItem()
  const deleteItem = useDeletePriceItem()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLaborPrice, setEditLaborPrice] = useState('')
  const [editMaterialPrice, setEditMaterialPrice] = useState('')
  const [editType, setEditType] = useState<'service' | 'product'>('service')
  const [searchTerm, setSearchTerm] = useState('')

  const startEdit = (item: { id: string; name: string; labor_price: number; material_price: number; item_type?: 'service' | 'product' }) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditLaborPrice(item.labor_price?.toString() || '0')
    setEditMaterialPrice(item.material_price?.toString() || '0')
    setEditType(item.item_type || 'service')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return
    try {
      await updateItem.mutateAsync({
        id: editingId,
        name: editName.trim(),
        labor_price: parseFloat(editLaborPrice) || 0,
        material_price: parseFloat(editMaterialPrice) || 0,
        item_type: editType,
      })
      setEditingId(null)
    } catch (err) {
      alert(`Klaida išsaugant: ${(err as Error).message}`)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Ar tikrai ištrinti „${name}"?`)) return
    try {
      await deleteItem.mutateAsync(id)
    } catch (err) {
      alert(`Klaida trinant: ${(err as Error).message}`)
    }
  }

  const handleImport = async (rows: Record<string, string>[]) => {
    const { error } = await supabase
      .from('price_items')
      .insert(rows.map(r => ({
        organization_id: organizationId,
        name: r.name,
        labor_price: parseFloat(r.labor_price) || 0,
        material_price: parseFloat(r.material_price) || 0,
        item_type: (r.item_type === 'product' ? 'product' : 'service') as 'service' | 'product',
        category_id: null,
      })))
    if (error) throw error
    queryClient.invalidateQueries({ queryKey: ['priceItems'] })
  }

  if (isLoading) {
    return <div className="text-gray-600">Kraunama...</div>
  }

  if (error) {
    return <div className="text-red-600">Klaida: {(error as Error).message}</div>
  }

  const filtered = (priceItems || []).filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const products = filtered.filter(i => i.item_type === 'product')
  const services = filtered.filter(i => i.item_type !== 'product')

  const renderRow = (item: NonNullable<typeof priceItems>[number]) => (
    <tr key={item.id} className="hover:bg-gray-50">
      {editingId === item.id ? (
        <>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-400">{item.price_categories?.name || '-'}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <input
              type="number"
              min="0"
              step="0.01"
              value={editLaborPrice}
              onChange={(e) => setEditLaborPrice(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <input
              type="number"
              min="0"
              step="0.01"
              value={editMaterialPrice}
              onChange={(e) => setEditMaterialPrice(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as 'service' | 'product')}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="service">Paslauga</option>
              <option value="product">Prekė</option>
            </select>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
            <button
              onClick={handleSaveEdit}
              disabled={updateItem.isPending}
              className="text-green-600 hover:text-green-800 text-sm font-medium disabled:opacity-50"
            >
              Išsaugoti
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Atšaukti
            </button>
          </td>
        </>
      ) : (
        <>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">{item.price_categories?.name || '-'}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">{item.name}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">{item.labor_price?.toFixed(2) || '0.00'}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">{item.material_price?.toFixed(2) || '0.00'}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-500">
              {item.item_type === 'product' ? 'Prekė' : 'Paslauga'}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
            <button
              onClick={() => startEdit(item)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Redaguoti
            </button>
            <button
              onClick={() => handleDelete(item.id, item.name)}
              disabled={deleteItem.isPending}
              className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
            >
              Ištrinti
            </button>
          </td>
        </>
      )}
    </tr>
  )

  const tableHead = (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Kategorija
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Pavadinimas
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Darbo kaina (€)
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Medžiagos kaina (€)
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Tipas
        </th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Veiksmai
        </th>
      </tr>
    </thead>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Kainynas</h2>
        <ExcelImport
          title="Kainynas"
          columns={[
            { key: 'name', label: 'Pavadinimas', required: true },
            { key: 'labor_price', label: 'Darbo kaina' },
            { key: 'material_price', label: 'Medžiagos kaina' },
            { key: 'item_type', label: 'Tipas' },
          ]}
          templateHeaders={['Pavadinimas', 'Darbo kaina', 'Medžiagos kaina', 'Tipas']}
          onImport={handleImport}
        />
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Ieškoti prekės ar paslaugos..."
        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm mb-6"
      />

      {/* Prekių grupė */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-orange-700 mb-3 border-b-2 border-orange-300 pb-2">
          Prekės ({products.length})
        </h3>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            {tableHead}
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map(renderRow)}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="text-sm text-gray-400 px-6 py-4">
              {searchTerm ? 'Prekių pagal paiešką nerasta' : 'Prekių nėra'}
            </p>
          )}
        </div>
      </div>

      {/* Paslaugų grupė */}
      <div>
        <h3 className="text-lg font-semibold text-blue-700 mb-3 border-b-2 border-blue-300 pb-2">
          Paslaugos ({services.length})
        </h3>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            {tableHead}
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map(renderRow)}
            </tbody>
          </table>
          {services.length === 0 && (
            <p className="text-sm text-gray-400 px-6 py-4">
              {searchTerm ? 'Paslaugų pagal paiešką nerasta' : 'Paslaugų nėra'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
