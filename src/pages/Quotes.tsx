import { useState } from 'react'
import { useQuotes, useCreateQuote, useCreateQuoteItem, useUpdateQuote, useQuoteItems, useUpdateQuoteItem, useDeleteQuoteItem, useDeleteQuote, Quote } from '../hooks/useQuotes'
import { usePriceItems, useCreatePriceItem } from '../hooks/usePricelist'
import { useWarehouseItems } from '../hooks/useMaterials'
import { supabase } from '../lib/supabase'

const statusLabels: Record<string, string> = {
  draft: 'Juodraštis',
  sent: 'Išsiųstas',
  pending: 'Laukiama',
  accepted: 'Priimtas',
  rejected: 'Atmestas',
  cancelled: 'Atšauktas',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export function Quotes() {
  const [showForm, setShowForm] = useState(false)
  const [showNewItemForm, setShowNewItemForm] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [address, setAddress] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [newItemName, setNewItemName] = useState('')
  const [newItemType, setNewItemType] = useState<'service' | 'product'>('service')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: quotes } = useQuotes()
  const { data: priceItems } = usePriceItems()
  const { data: warehouseItems } = useWarehouseItems()
  const createQuote = useCreateQuote()
  const createQuoteItem = useCreateQuoteItem()
  const updateQuote = useUpdateQuote()
  const createPriceItem = useCreatePriceItem()

  const [selectedWarehouse, setSelectedWarehouse] = useState<Set<string>>(new Set())
  const [warehouseQuantities, setWarehouseQuantities] = useState<Record<string, number>>({})

  // Detalių modalas
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [editClientName, setEditClientName] = useState('')
  const [editClientEmail, setEditClientEmail] = useState('')
  const [editClientPhone, setEditClientPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [addItemSearch, setAddItemSearch] = useState('')
  const [showModalNewItem, setShowModalNewItem] = useState(false)
  const [modalNewItemName, setModalNewItemName] = useState('')
  const [modalNewItemType, setModalNewItemType] = useState<'service' | 'product'>('service')
  const [modalNewItemPrice, setModalNewItemPrice] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const { data: quoteItems } = useQuoteItems(selectedQuote?.id || '')
  const updateQuoteItem = useUpdateQuoteItem()
  const deleteQuoteItem = useDeleteQuoteItem()
  const deleteQuote = useDeleteQuote()

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: quantity }))
  }

  const handleWarehouseToggle = (itemId: string) => {
    const newSelected = new Set(selectedWarehouse)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedWarehouse(newSelected)
  }

  const handleWarehouseQtyChange = (itemId: string, quantity: number) => {
    setWarehouseQuantities(prev => ({ ...prev, [itemId]: quantity }))
  }

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName || !newItemPrice) return

    console.log('Creating new item:', {
      name: newItemName,
      item_type: newItemType,
      labor_price: newItemType === 'service' ? parseFloat(newItemPrice) : 0,
      material_price: newItemType === 'product' ? parseFloat(newItemPrice) : 0,
      category_id: null,
    })

    try {
      await createPriceItem.mutateAsync({
        name: newItemName,
        item_type: newItemType,
        labor_price: newItemType === 'service' ? parseFloat(newItemPrice) : 0,
        material_price: newItemType === 'product' ? parseFloat(newItemPrice) : 0,
        category_id: null as any,
      })

      setNewItemName('')
      setNewItemType('service')
      setNewItemPrice('')
      setSearchTerm('')
      setShowNewItemForm(false)
    } catch (error) {
      console.error('Error creating item:', error)
    }
  }

  const calculateTotals = () => {
    let totalWork = 0
    let totalMaterial = 0

    for (const itemId of selectedItems) {
      const item = priceItems?.find(i => i.id === itemId)
      if (item) {
        const quantity = quantities[itemId] || 1
        const laborPrice = typeof item.labor_price === 'number' ? item.labor_price : parseFloat(item.labor_price || '0')
        const materialPrice = typeof item.material_price === 'number' ? item.material_price : parseFloat(item.material_price || '0')
        totalWork += laborPrice * quantity
        totalMaterial += materialPrice * quantity
      }
    }

    for (const itemId of selectedWarehouse) {
      const item = warehouseItems?.find(i => i.id === itemId)
      if (item) {
        const quantity = warehouseQuantities[itemId] || 1
        totalMaterial += item.unit_price * quantity
      }
    }

    const totalVat = (totalWork + totalMaterial) * 0.21
    const total = totalWork + totalMaterial + totalVat

    return { totalWork, totalMaterial, totalVat, total }
  }

  const totals = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName || !address) return

    const quote = await createQuote.mutateAsync({
      client_id: null as any, // Bus užpildyta priėmus pasiūlymą
      address,
      status: 'draft',
    })

    // Išsaugoti kliento duomenis pasiūlyme
    await supabase
      .from('quotes')
      .update({
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
      })
      .eq('id', quote.id)

    let totalWork = 0
    let totalMaterial = 0

    for (const itemId of selectedItems) {
      const item = priceItems?.find(i => i.id === itemId)
      if (item) {
        const quantity = quantities[itemId] || 1
        await createQuoteItem.mutateAsync({
          quote_id: quote.id,
          price_item_id: itemId,
          warehouse_item_id: null,
          name: item.name,
          quantity,
          work_price: item.labor_price,
          material_price: item.material_price,
        })
        totalWork += (item.labor_price || 0) * quantity
        totalMaterial += (item.material_price || 0) * quantity
      }
    }

    for (const itemId of selectedWarehouse) {
      const item = warehouseItems?.find(i => i.id === itemId)
      if (item) {
        const quantity = warehouseQuantities[itemId] || 1
        await createQuoteItem.mutateAsync({
          quote_id: quote.id,
          price_item_id: null,
          warehouse_item_id: itemId,
          name: item.name,
          quantity,
          work_price: 0,
          material_price: item.unit_price,
        })
        totalMaterial += item.unit_price * quantity
      }
    }

    const totalVat = (totalWork + totalMaterial) * 0.21
    const total = totalWork + totalMaterial + totalVat

    // Atnaujinti pasiūlymą su sumomis
    await supabase
      .from('quotes')
      .update({
        total_work: totalWork,
        total_material: totalMaterial,
        total_vat: totalVat,
        total,
      })
      .eq('id', quote.id)

    setShowForm(false)
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    setAddress('')
    setSelectedItems(new Set())
    setQuantities({})
    setSelectedWarehouse(new Set())
    setWarehouseQuantities({})
  }

  // --- Detalių modalas ---

  const handleSelectQuote = (quote: Quote) => {
    setSelectedQuote(quote)
    setEditClientName(quote.client_name || quote.clients?.name || '')
    setEditClientEmail(quote.client_email || '')
    setEditClientPhone(quote.client_phone || '')
    setEditAddress(quote.address || '')
    setAddItemSearch('')
  }

  const recalcQuoteTotals = async (quoteId: string) => {
    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)

    let totalWork = 0
    let totalMaterial = 0
    for (const item of items || []) {
      totalWork += (item.work_price || 0) * item.quantity
      totalMaterial += (item.material_price || 0) * item.quantity
    }
    const totalVat = (totalWork + totalMaterial) * 0.21
    const total = totalWork + totalMaterial + totalVat

    await supabase
      .from('quotes')
      .update({ total_work: totalWork, total_material: totalMaterial, total_vat: totalVat, total })
      .eq('id', quoteId)

    setSelectedQuote(prev => prev ? { ...prev, total_work: totalWork, total_material: totalMaterial, total_vat: totalVat, total } : prev)
  }

  const handleSaveClientInfo = async () => {
    if (!selectedQuote || !editClientName.trim() || !editAddress.trim()) return
    try {
      await updateQuote.mutateAsync({
        id: selectedQuote.id,
        client_name: editClientName.trim(),
        client_email: editClientEmail.trim() || null,
        client_phone: editClientPhone.trim() || null,
        address: editAddress.trim(),
      })
      setSelectedQuote({
        ...selectedQuote,
        client_name: editClientName.trim(),
        client_email: editClientEmail.trim() || null,
        client_phone: editClientPhone.trim() || null,
        address: editAddress.trim(),
      })
    } catch (err) {
      alert(`Klaida atnaujinant pasiūlymą: ${(err as Error).message}`)
    }
  }

  const handleUpdateItem = async (itemId: string, field: 'quantity' | 'work_price' | 'material_price', value: number) => {
    if (!selectedQuote) return
    try {
      await updateQuoteItem.mutateAsync({ id: itemId, [field]: value })
      await recalcQuoteTotals(selectedQuote.id)
    } catch (err) {
      alert(`Klaida atnaujinant poziciją: ${(err as Error).message}`)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedQuote) return
    try {
      await deleteQuoteItem.mutateAsync(itemId)
      await recalcQuoteTotals(selectedQuote.id)
    } catch (err) {
      alert(`Klaida trinant poziciją: ${(err as Error).message}`)
    }
  }

  const handleAddItemToQuote = async (item: { id: string; name: string; work_price: number; material_price: number; warehouse_item_id?: string | null; price_item_id?: string | null }) => {
    if (!selectedQuote) return
    try {
      await createQuoteItem.mutateAsync({
        quote_id: selectedQuote.id,
        price_item_id: item.price_item_id ?? null,
        warehouse_item_id: item.warehouse_item_id ?? null,
        name: item.name,
        quantity: 1,
        work_price: item.work_price,
        material_price: item.material_price,
      })
      await recalcQuoteTotals(selectedQuote.id)
    } catch (err) {
      alert(`Klaida pridedant poziciją: ${(err as Error).message}`)
    }
  }

  const handleCreateItemInModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedQuote || !modalNewItemName.trim() || !modalNewItemPrice) return
    try {
      const newItem = await createPriceItem.mutateAsync({
        name: modalNewItemName.trim(),
        item_type: modalNewItemType,
        labor_price: modalNewItemType === 'service' ? parseFloat(modalNewItemPrice) : 0,
        material_price: modalNewItemType === 'product' ? parseFloat(modalNewItemPrice) : 0,
        category_id: null as any,
      })
      await handleAddItemToQuote({
        id: newItem.id,
        name: newItem.name,
        work_price: newItem.labor_price || 0,
        material_price: newItem.material_price || 0,
        price_item_id: newItem.id,
      })
      setModalNewItemName('')
      setModalNewItemType('service')
      setModalNewItemPrice('')
      setShowModalNewItem(false)
    } catch (err) {
      alert(`Klaida kuriant poziciją: ${(err as Error).message}`)
    }
  }

  const handleDeleteQuote = async () => {
    if (!selectedQuote) return
    if (!confirm('Ar tikrai ištrinti šį pasiūlymą?')) return
    try {
      await deleteQuote.mutateAsync(selectedQuote.id)
      setSelectedQuote(null)
    } catch (err) {
      alert(`Klaida trinant pasiūlymą: ${(err as Error).message}`)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Pasiūlymai</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? 'Uždaryti' : 'Naujas pasiūlymas'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Naujas pasiūlymas</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kliento pavadinimas
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Įveskite kliento pavadinimą"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  El. paštas
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="klientas@pvz.lt"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefonas
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="+370 6..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresas
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Įveskite adresą"
                  required
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Pozicijos
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewItemForm(!showNewItemForm)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Nauja pozicija
                </button>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Paieška..."
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
              />

              {/* Paslaugos */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Paslaugos</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                  {priceItems?.filter(item =>
                    item.item_type === 'service' &&
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleItemToggle(item.id)}
                        className="rounded"
                      />
                      <span className="flex-1">{item.name}</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantities[item.id] || 1}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={!selectedItems.has(item.id)}
                      />
                      <span className="text-sm text-gray-500">
                        €{item.labor_price?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                  {priceItems?.filter(item =>
                    item.item_type === 'service' &&
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length === 0 && (
                    <p className="text-sm text-gray-400">Nėra paslaugų</p>
                  )}
                </div>
              </div>

              {/* Prekės */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Prekės</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                  {priceItems?.filter(item =>
                    item.item_type === 'product' &&
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleItemToggle(item.id)}
                        className="rounded"
                      />
                      <span className="flex-1">{item.name}</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantities[item.id] || 1}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={!selectedItems.has(item.id)}
                      />
                      <span className="text-sm text-gray-500">
                        €{item.material_price?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                  {priceItems?.filter(item =>
                    item.item_type === 'product' &&
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length === 0 && (
                    <p className="text-sm text-gray-400">Nėra prekių</p>
                  )}
                </div>
              </div>

              {/* Sandėlio prekės */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Sandėlio prekės</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                  {warehouseItems?.filter(item =>
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedWarehouse.has(item.id)}
                        onChange={() => handleWarehouseToggle(item.id)}
                        className="rounded"
                      />
                      <span className="flex-1">{item.name}</span>
                      <span className="text-xs text-gray-400">
                        sandėlyje: {item.quantity} {item.unit}
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={item.quantity}
                        value={warehouseQuantities[item.id] || 1}
                        onChange={(e) => handleWarehouseQtyChange(item.id, parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={!selectedWarehouse.has(item.id)}
                      />
                      <span className="text-sm text-gray-500">
                        €{item.unit_price?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                  {warehouseItems?.filter(item =>
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length === 0 && (
                    <p className="text-sm text-gray-400">Sandėlyje nėra prekių</p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Sumos</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Darbai:</span>
                  <span className="text-gray-900">€{totals.totalWork.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Medžiagos:</span>
                  <span className="text-gray-900">€{totals.totalMaterial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PVM (21%):</span>
                  <span className="text-gray-900">€{totals.totalVat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span className="text-gray-700">Viso:</span>
                  <span className="text-gray-900">€{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Išsaugoti pasiūlymą
            </button>
          </form>
        </div>
      )}

      {showNewItemForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Nauja pozicija</h3>
          <form onSubmit={handleCreateNewItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pavadinimas
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Įveskite pavadinimą"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipas
              </label>
              <select
                value={newItemType}
                onChange={(e) => setNewItemType(e.target.value as 'service' | 'product')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="service">Paslauga</option>
                <option value="product">Prekė</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {newItemType === 'service' ? 'Darbo kaina' : 'Prekės kaina'}
              </label>
              <input
                type="number"
                step="0.01"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Įveskite kainą"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Sukurti
              </button>
              <button
                type="button"
                onClick={() => setShowNewItemForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Atšaukti
              </button>
            </div>
          </form>
        </div>
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
                Suma (€)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes?.map((quote) => (
              <tr
                key={quote.id}
                className={`hover:bg-gray-50 cursor-pointer ${selectedQuote?.id === quote.id ? 'bg-blue-50' : ''}`}
                onClick={() => handleSelectQuote(quote)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{quote.client_name || quote.clients?.name || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{quote.address}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[quote.status]}`}>
                    {statusLabels[quote.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{quote.total?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{new Date(quote.created_at).toLocaleDateString('lt-LT')}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={quote.status}
                    onChange={(e) => updateQuote.mutate({ id: quote.id, status: e.target.value as Quote['status'] })}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="draft">Juodraštis</option>
                    <option value="sent">Išsiųstas</option>
                    <option value="pending">Laukiama</option>
                    <option value="accepted">Priimtas</option>
                    <option value="rejected">Atmestas</option>
                    <option value="cancelled">Atšauktas</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {quote.public_token && (
                    <a
                      href={`/quote/${quote.public_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Vieša nuoroda
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pasiūlymo detalių modalas */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedQuote(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Pasiūlymas</h3>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[selectedQuote.status]}`}>
                    {statusLabels[selectedQuote.status]}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>

              {/* Kliento informacija */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Kliento informacija</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Pavadinimas</label>
                    <input
                      type="text"
                      value={editClientName}
                      onChange={(e) => setEditClientName(e.target.value)}
                      className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">El. paštas</label>
                    <input
                      type="email"
                      value={editClientEmail}
                      onChange={(e) => setEditClientEmail(e.target.value)}
                      className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Telefonas</label>
                    <input
                      type="tel"
                      value={editClientPhone}
                      onChange={(e) => setEditClientPhone(e.target.value)}
                      className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Adresas</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveClientInfo}
                  disabled={updateQuote.isPending}
                  className="mt-3 bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Išsaugoti kliento info
                </button>
              </div>

              {/* Pozicijos */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Pozicijos</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="py-1">Pavadinimas</th>
                      <th className="py-1 w-20">Kiekis</th>
                      <th className="py-1 w-24">Darbas €</th>
                      <th className="py-1 w-24">Medž. €</th>
                      <th className="py-1 w-20 text-right">Suma €</th>
                      <th className="py-1 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteItems?.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-1.5 pr-2">{item.name}</td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={item.quantity}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value)
                              if (val > 0 && val !== item.quantity) handleUpdateItem(item.id, 'quantity', val)
                            }}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={item.work_price}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              if (val !== item.work_price) handleUpdateItem(item.id, 'work_price', val)
                            }}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={item.material_price}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              if (val !== item.material_price) handleUpdateItem(item.id, 'material_price', val)
                            }}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="py-1.5 text-right">
                          {((item.work_price + item.material_price) * item.quantity).toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pridėti poziciją */}
                <div className="mt-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={addItemSearch}
                      onChange={(e) => setAddItemSearch(e.target.value)}
                      placeholder="Pridėti poziciją — ieškoti..."
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => setShowModalNewItem(!showModalNewItem)}
                      className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap px-2"
                    >
                      + Nauja pozicija
                    </button>
                  </div>

                  {showModalNewItem && (
                    <form onSubmit={handleCreateItemInModal} className="mt-2 p-3 border border-gray-200 rounded bg-gray-50 space-y-2">
                      <input
                        type="text"
                        value={modalNewItemName}
                        onChange={(e) => setModalNewItemName(e.target.value)}
                        placeholder="Pavadinimas"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        required
                      />
                      <div className="flex space-x-2">
                        <select
                          value={modalNewItemType}
                          onChange={(e) => setModalNewItemType(e.target.value as 'service' | 'product')}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="service">Paslauga</option>
                          <option value="product">Prekė</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={modalNewItemPrice}
                          onChange={(e) => setModalNewItemPrice(e.target.value)}
                          placeholder={modalNewItemType === 'service' ? 'Darbo kaina €' : 'Prekės kaina €'}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          required
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          disabled={createPriceItem.isPending}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          Sukurti ir pridėti
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowModalNewItem(false)}
                          className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                        >
                          Atšaukti
                        </button>
                      </div>
                    </form>
                  )}
                  {addItemSearch && (
                    <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded">
                      {priceItems?.filter(i => i.name.toLowerCase().includes(addItemSearch.toLowerCase())).map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            handleAddItemToQuote({
                              id: item.id,
                              name: item.name,
                              work_price: item.labor_price || 0,
                              material_price: item.material_price || 0,
                              price_item_id: item.id,
                            })
                            setAddItemSearch('')
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex justify-between"
                        >
                          <span>{item.name}</span>
                          <span className="text-gray-400 text-xs">
                            {item.item_type === 'service' ? 'Paslauga' : 'Prekė'} €{((item.labor_price || 0) + (item.material_price || 0)).toFixed(2)}
                          </span>
                        </button>
                      ))}
                      {warehouseItems?.filter(i => i.name.toLowerCase().includes(addItemSearch.toLowerCase())).map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            handleAddItemToQuote({
                              id: item.id,
                              name: item.name,
                              work_price: 0,
                              material_price: item.unit_price,
                              warehouse_item_id: item.id,
                            })
                            setAddItemSearch('')
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex justify-between"
                        >
                          <span>{item.name}</span>
                          <span className="text-gray-400 text-xs">
                            Sandėlis ({item.quantity} {item.unit}) €{item.unit_price.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sumos */}
              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Darbai:</span>
                    <span className="text-gray-900">€{(selectedQuote.total_work || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medžiagos:</span>
                    <span className="text-gray-900">€{(selectedQuote.total_material || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PVM (21%):</span>
                    <span className="text-gray-900">€{(selectedQuote.total_vat || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span className="text-gray-700">Viso:</span>
                    <span className="text-gray-900">€{(selectedQuote.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Veiksmai */}
              <div className="flex space-x-3">
                {selectedQuote.client_email && (
                  <button
                    onClick={async () => {
                      setSendingEmail(true)
                      try {
                        const { data, error } = await supabase.functions.invoke('send-quote-email', {
                          body: { quote_id: selectedQuote.id, app_url: window.location.origin },
                        })
                        if (error) {
                          let msg = error.message
                          try {
                            const body = await (error as { context?: Response }).context?.json()
                            if (body?.error) msg = body.error
                          } catch { /* paliekam originalų pranešimą */ }
                          throw new Error(msg)
                        }
                        if (data?.error) throw new Error(data.error)
                        setSelectedQuote({ ...selectedQuote, status: 'sent' })
                        alert('Laiškas išsiųstas')
                      } catch (err) {
                        alert(`Klaida siunčiant: ${(err as Error).message}`)
                      } finally {
                        setSendingEmail(false)
                      }
                    }}
                    disabled={sendingEmail}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {sendingEmail ? 'Siunčiama...' : 'Siųsti el. paštu'}
                  </button>
                )}
                {selectedQuote.public_token && (
                  <a
                    href={`/quote/${selectedQuote.public_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm"
                  >
                    Vieša nuoroda
                  </a>
                )}
                <button
                  onClick={handleDeleteQuote}
                  disabled={deleteQuote.isPending}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  {deleteQuote.isPending ? 'Trinama...' : 'Ištrinti pasiūlymą'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
