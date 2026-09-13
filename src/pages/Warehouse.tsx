import { useState } from 'react'
import { useWarehouseItems, useCreateWarehouseItem, useUpdateWarehouseItem, useDeleteWarehouseItem, WarehouseItem } from '../hooks/useMaterials'
import { useOrganization } from '../hooks/useOrganization'
import { PdfImport, ParsedItem, ImportResult } from '../components/PdfImport'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export function Warehouse() {
  const { data: items, isLoading, error } = useWarehouseItems()
  const { data: organizationId } = useOrganization()
  const queryClient = useQueryClient()
  const createItem = useCreateWarehouseItem()
  const updateItem = useUpdateWarehouseItem()
  const deleteItem = useDeleteWarehouseItem()

  const handlePdfImport = async (parsed: ParsedItem[]): Promise<ImportResult> => {
    const existing = items || []
    const byKey = new Map(existing.map(i => [`${i.name.trim().toLowerCase()}|${i.unit.trim().toLowerCase()}`, i]))

    const toInsert: object[] = []
    const toUpdate: { id: string; quantity: number; unit_price: number; note: string | null }[] = []

    for (const p of parsed) {
      const key = `${p.name.trim().toLowerCase()}|${p.unit.trim().toLowerCase()}`
      const found = byKey.get(key)
      if (found) {
        // Ta pati prekė — sumuojame kiekį, atnaujiname kainą, pastabą prijungiame jei nauja
        const mergedNote = found.note
          ? (p.note && !found.note.includes(p.note) ? `${found.note}; ${p.note}` : found.note)
          : (p.note ?? null)
        toUpdate.push({
          id: found.id,
          quantity: found.quantity + p.quantity,
          unit_price: p.unit_price,
          note: mergedNote,
        })
        // Atnaujiname map'ą, kad kelios eilutės toje pačioje sąskaitoje irgi susumuotų
        byKey.set(key, { ...found, quantity: found.quantity + p.quantity, note: mergedNote })
      } else {
        const newItem = {
          organization_id: organizationId,
          name: p.name,
          unit: p.unit,
          quantity: p.quantity,
          unit_price: p.unit_price,
          note: p.note ?? null,
        }
        toInsert.push(newItem)
        byKey.set(key, { ...newItem, id: '', created_at: '', updated_at: '' } as WarehouseItem)
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('warehouse_items').insert(toInsert)
      if (error) throw error
    }
    for (const u of toUpdate) {
      const { error } = await supabase
        .from('warehouse_items')
        .update({ quantity: u.quantity, unit_price: u.unit_price, note: u.note })
        .eq('id', u.id)
      if (error) throw error
    }

    queryClient.invalidateQueries({ queryKey: ['warehouseItems'] })
    return { inserted: toInsert.length, merged: toUpdate.length }
  }

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('vnt')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await createItem.mutateAsync({
      name: name.trim(),
      unit,
      quantity: parseFloat(quantity) || 0,
      unit_price: parseFloat(unitPrice) || 0,
      note: null,
    })

    setName('')
    setUnit('vnt')
    setQuantity('')
    setUnitPrice('')
  }

  if (isLoading) {
    return <div className="text-gray-600">Kraunama...</div>
  }

  if (error) {
    return <div className="text-red-600">Klaida: {(error as Error).message}</div>
  }

  const totalValue = items?.reduce((sum, i) => sum + i.quantity * i.unit_price, 0) || 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sandėlis</h2>
        <div className="flex items-center gap-4">
          <PdfImport onImport={handlePdfImport} />
          <span className="text-sm text-gray-600">
            Bendra vertė: <strong>€{totalValue.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-2 flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Medžiagos pavadinimas..."
          className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Mato vnt."
          className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Kiekis"
          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          placeholder="€/vnt"
          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <button
          type="submit"
          disabled={createItem.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
        >
          + Pridėti
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pavadinimas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiekis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">€/vnt</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vertė</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pastaba</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items?.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  <input
                    type="text"
                    defaultValue={item.name}
                    onBlur={(e) => {
                      const val = e.target.value.trim()
                      if (val && val !== item.name) {
                        updateItem.mutate({ id: item.id, name: val })
                      }
                    }}
                    className="w-full px-1 py-0.5 border border-transparent hover:border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={item.quantity}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (val !== item.quantity) {
                        updateItem.mutate({ id: item.id, quantity: val })
                      }
                    }}
                    className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                  />
                  <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={item.unit_price}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (val !== item.unit_price) {
                        updateItem.mutate({ id: item.id, unit_price: val })
                      }
                    }}
                    className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                  />
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  €{(item.quantity * item.unit_price).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <input
                    type="text"
                    defaultValue={item.note || ''}
                    placeholder="—"
                    onBlur={(e) => {
                      const val = e.target.value.trim() || null
                      if (val !== item.note) {
                        updateItem.mutate({ id: item.id, note: val })
                      }
                    }}
                    className="w-full px-1 py-0.5 border border-transparent hover:border-gray-300 rounded text-xs"
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => deleteItem.mutate(item.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Ištrinti
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!items || items.length === 0) && (
          <p className="text-gray-500 text-sm p-6">Sandėlyje nėra medžiagų. Pridėkite pirmą.</p>
        )}
      </div>
    </div>
  )
}
