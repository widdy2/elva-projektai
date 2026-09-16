import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuotes, useCreateQuote, useCreateQuoteItem, useUpdateQuote, useQuoteItems, useUpdateQuoteItem, useDeleteQuoteItem, useDeleteQuote, Quote, QuoteItem } from '../hooks/useQuotes'
import { usePriceItems, useCreatePriceItem, useUpdatePriceItem } from '../hooks/usePricelist'
import { useWarehouseItems, useUpdateWarehouseItem } from '../hooks/useMaterials'
import { useClients } from '../hooks/useClients'
import { useOrganizationDetails } from '../hooks/useOrganizationDetails'
import { addOrgHeader } from '../lib/pdfHeader'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

const unitOptions = [
  { value: 'vnt', label: 'vnt.' },
  { value: 'm', label: 'm' },
  { value: 'kpl', label: 'kpl.' },
  { value: 'val', label: 'val.' },
]

export function Quotes() {
  const [showForm, setShowForm] = useState(false)
  const [newItemForm, setNewItemForm] = useState<'service' | 'product' | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [address, setAddress] = useState('')
  const [objectName, setObjectName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('vnt')
  const [searchTerm, setSearchTerm] = useState('')

  const queryClient = useQueryClient()
  const { data: quotes } = useQuotes()
  const { data: priceItems } = usePriceItems()
  const { data: warehouseItems } = useWarehouseItems()
  const { data: clients } = useClients()
  const createQuote = useCreateQuote()
  const createQuoteItem = useCreateQuoteItem()
  const updateQuote = useUpdateQuote()
  const createPriceItem = useCreatePriceItem()
  const updatePriceItem = useUpdatePriceItem()
  const updateWarehouseItem = useUpdateWarehouseItem()
  const { data: org } = useOrganizationDetails()

  const [selectedWarehouse, setSelectedWarehouse] = useState<Set<string>>(new Set())
  const [warehouseQuantities, setWarehouseQuantities] = useState<Record<string, number>>({})

  // Detalių modalas
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [editClientName, setEditClientName] = useState('')
  const [editClientEmail, setEditClientEmail] = useState('')
  const [editClientPhone, setEditClientPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editObjectName, setEditObjectName] = useState('')
  const [addItemSearch, setAddItemSearch] = useState('')
  const [showModalNewItem, setShowModalNewItem] = useState(false)
  const [modalNewItemName, setModalNewItemName] = useState('')
  const [modalNewItemType, setModalNewItemType] = useState<'service' | 'product'>('service')
  const [modalNewItemPrice, setModalNewItemPrice] = useState('')
  const [modalNewItemUnit, setModalNewItemUnit] = useState('vnt')
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
    if (!newItemName || !newItemPrice || !newItemForm) return

    try {
      await createPriceItem.mutateAsync({
        name: newItemName,
        item_type: newItemForm,
        unit: newItemUnit,
        labor_price: newItemForm === 'service' ? parseFloat(newItemPrice) : 0,
        material_price: newItemForm === 'product' ? parseFloat(newItemPrice) : 0,
        category_id: null as any,
      })

      setNewItemName('')
      setNewItemPrice('')
      setNewItemUnit('vnt')
      setSearchTerm('')
      setNewItemForm(null)
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
        if (item.item_type === 'product') {
          totalMaterial += materialPrice * quantity
        } else {
          totalWork += laborPrice * quantity
        }
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
      client_id: selectedClientId || null,
      address,
      object_name: objectName.trim() || null,
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
          unit: item.unit || 'vnt',
          work_price: item.item_type === 'product' ? 0 : item.labor_price,
          material_price: item.item_type === 'product' ? item.material_price : 0,
        })
        if (item.item_type === 'product') {
          totalMaterial += (item.material_price || 0) * quantity
        } else {
          totalWork += (item.labor_price || 0) * quantity
        }
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
          unit: item.unit || 'vnt',
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
    setObjectName('')
    setSelectedClientId('')
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
    setEditObjectName(quote.object_name || '')
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
      const isProduct = item.warehouse_item_id != null ||
        priceItems?.find(p => p.id === item.price_item_id)?.item_type === 'product' ||
        (item.price_item_id == null && item.work_price === 0)
      if (isProduct) {
        totalMaterial += (item.material_price || 0) * item.quantity
      } else {
        totalWork += (item.work_price || 0) * item.quantity
      }
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
        object_name: editObjectName.trim() || null,
      })
      setSelectedQuote({
        ...selectedQuote,
        client_name: editClientName.trim(),
        client_email: editClientEmail.trim() || null,
        client_phone: editClientPhone.trim() || null,
        address: editAddress.trim(),
        object_name: editObjectName.trim() || null,
      })
    } catch (err) {
      alert(`Klaida atnaujinant pasiūlymą: ${(err as Error).message}`)
    }
  }

  const handleUpdateItem = async (itemId: string, field: 'quantity' | 'work_price' | 'material_price' | 'name' | 'unit', value: number | string) => {
    if (!selectedQuote) return
    try {
      await updateQuoteItem.mutateAsync({ id: itemId, [field]: value })
      await recalcQuoteTotals(selectedQuote.id)
    } catch (err) {
      alert(`Klaida atnaujinant poziciją: ${(err as Error).message}`)
    }
  }

  // Pavadinimo taisymas kūrimo formoje — atnaujina kainyną arba sandėlį
  const handleRenameItem = (id: string, newName: string, oldName: string) => {
    const name = newName.trim()
    if (!name || name === oldName) return
    if (warehouseItems?.some(w => w.id === id)) {
      updateWarehouseItem.mutate({ id, name })
    } else {
      updatePriceItem.mutate({ id, name })
    }
  }

  // Pasiūlymo PDF — tas pats stilius kaip sąskaitose (logo, spalva, DejaVu)
  const handleDownloadQuotePdf = async () => {
    if (!selectedQuote || !quoteItems) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const startY = await addOrgHeader(doc, org)

    // Antraštė — centruota
    doc.setFontSize(16)
    doc.setFont('DejaVuSans', 'bold')
    doc.text('Darbų pasiūlymas', pageWidth / 2, startY + 4, { align: 'center' })
    doc.setFont('DejaVuSans', 'normal')
    doc.setFontSize(10)
    doc.text(`Data: ${new Date(selectedQuote.created_at).toLocaleDateString('lt-LT')}`, pageWidth / 2, startY + 11, { align: 'center' })

    // Klientas (kairė) / Objektas (dešinė)
    const blockY = startY + 22
    const rightX = pageWidth / 2 + 6

    doc.setFontSize(10)
    doc.setFont('DejaVuSans', 'bold')
    doc.text('Klientas:', 14, blockY)
    doc.text('Objektas:', rightX, blockY)
    doc.setFont('DejaVuSans', 'normal')
    doc.setFontSize(9)

    const clientLines: string[] = []
    const cName = selectedQuote.client_name || selectedQuote.clients?.name
    if (cName) clientLines.push(cName)
    if (selectedQuote.client_email) clientLines.push(selectedQuote.client_email)
    if (selectedQuote.client_phone) clientLines.push(selectedQuote.client_phone)

    const addrLines = selectedQuote.address
      ? (doc.splitTextToSize(selectedQuote.address, pageWidth - 14 - rightX) as string[])
      : []

    const colWidth = rightX - 14 - 4
    const clientWrapped = clientLines.flatMap(l => doc.splitTextToSize(l, colWidth) as string[])
    clientWrapped.forEach((l, i) => doc.text(l, 14, blockY + 6 + i * 4.5))
    addrLines.forEach((l, i) => doc.text(l, rightX, blockY + 6 + i * 4.5))

    const tableY = blockY + 10 + Math.max(clientWrapped.length, addrLines.length, 1) * 4.5

    // Pozicijos: Paslaugos ir Prekės atskiromis sekcijomis
    const isProduct = (item: QuoteItem) => {
      if (item.warehouse_item_id) return true
      const pi = priceItems?.find(p => p.id === item.price_item_id)
      if (pi) return pi.item_type === 'product'
      return item.work_price === 0
    }
    const services = quoteItems.filter(i => !isProduct(i))
    const products = quoteItems.filter(isProduct)

    const body: (string | { content: string; colSpan: number; styles: object })[][] = []
    let nr = 0
    const pushRow = (i: QuoteItem) => {
      nr++
      const price = isProduct(i) ? i.material_price : i.work_price
      body.push([
        nr.toString(),
        i.name,
        i.unit || 'vnt',
        i.quantity.toString(),
        price.toFixed(2),
        (price * i.quantity).toFixed(2),
      ])
    }

    if (services.length > 0) {
      body.push([{ content: 'Paslaugos', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
      services.forEach(pushRow)
    }
    if (products.length > 0) {
      body.push([{ content: 'Prekės', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
      products.forEach(pushRow)
    }

    autoTable(doc, {
      startY: tableY,
      head: [['Nr.', 'Pavadinimas', 'vnt./m.', 'Kiekis', 'Kaina', 'Suma']],
      body,
      styles: { fontSize: 9, font: 'DejaVuSans', overflow: 'linebreak', cellPadding: 1.5 },
      headStyles: { fillColor: [66, 66, 66], font: 'DejaVuSans', fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 14 },
        3: { cellWidth: 14, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
      },
    })

    // Sumos — jei netelpa, naujas puslapis
    const pageHeight = doc.internal.pageSize.getHeight()
    let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    if (finalY + 45 > pageHeight - 14) {
      doc.addPage()
      finalY = 20
    }

    const servicesSum = services.reduce((s, i) => s + i.work_price * i.quantity, 0)
    const productsSum = products.reduce((s, i) => s + i.material_price * i.quantity, 0)
    const subtotal = servicesSum + productsSum
    const vat = subtotal * 0.21

    doc.setFontSize(10)
    if (services.length > 0 && products.length > 0) {
      doc.text(`Paslaugos ${servicesSum.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' })
      doc.text(`Prekės ${productsSum.toFixed(2)}`, pageWidth - 14, finalY + 5, { align: 'right' })
      finalY += 5
    }
    doc.text(`Suma be PVM ${subtotal.toFixed(2)}`, pageWidth - 14, finalY + 5, { align: 'right' })
    doc.text(`PVM 21% ${vat.toFixed(2)}`, pageWidth - 14, finalY + 10, { align: 'right' })
    doc.setFont('DejaVuSans', 'bold')
    doc.setFontSize(11)
    doc.text(`Viso su PVM ${(subtotal + vat).toFixed(2)}`, pageWidth - 14, finalY + 17, { align: 'right' })
    doc.setFont('DejaVuSans', 'normal')

    // Parašų eilutės
    const sigY = finalY + 30
    doc.setFontSize(10)
    doc.text('Pasiūlymą parengė:', 14, sigY)
    doc.text('Užsakovas:', rightX, sigY)
    doc.line(14, sigY + 12, 14 + 70, sigY + 12)
    doc.line(rightX, sigY + 12, rightX + 70, sigY + 12)
    doc.setFontSize(8)
    doc.text('Vardas, pavardė, parašas', 14, sigY + 16)
    doc.text('Vardas, pavardė, parašas', rightX, sigY + 16)

    doc.save(`Pasiulymas-${new Date(selectedQuote.created_at).toISOString().split('T')[0]}.pdf`)
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

  const handleAddItemToQuote = async (item: { id: string; name: string; work_price: number; material_price: number; warehouse_item_id?: string | null; price_item_id?: string | null; unit?: string }) => {
    if (!selectedQuote) return
    try {
      await createQuoteItem.mutateAsync({
        quote_id: selectedQuote.id,
        price_item_id: item.price_item_id ?? null,
        warehouse_item_id: item.warehouse_item_id ?? null,
        name: item.name,
        quantity: 1,
        unit: item.unit || 'vnt',
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
        unit: modalNewItemUnit,
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
        unit: modalNewItemUnit,
      })
      setModalNewItemName('')
      setModalNewItemType('service')
      setModalNewItemPrice('')
      setModalNewItemUnit('vnt')
      setShowModalNewItem(false)
    } catch (err) {
      alert(`Klaida kuriant poziciją: ${(err as Error).message}`)
    }
  }

  // Statuso keitimas — "Priimtas" kviečia accept_quote RPC (sukuria klientą ir objektą)
  const handleStatusChange = async (quote: Quote, newStatus: Quote['status']) => {
    if (newStatus === 'accepted' && quote.public_token) {
      try {
        const { data, error } = await supabase.rpc('accept_quote', { p_public_token: quote.public_token })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        setSelectedQuote(prev => prev?.id === quote.id ? { ...prev, status: 'accepted' } : prev)
      } catch (err) {
        alert(`Klaida priimant pasiūlymą: ${(err as Error).message}`)
      }
      return
    }
    updateQuote.mutate({ id: quote.id, status: newStatus })
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Esamas klientas
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedClientId(id)
                  const c = clients?.find(cl => cl.id === id)
                  if (c) {
                    setClientName(c.name)
                    setClientEmail(c.email || '')
                    setClientPhone(c.phone || '')
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">— Naujas klientas —</option>
                {clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objekto pavadinimas
                </label>
                <input
                  type="text"
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="pvz. Namo renovacija"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Pozicijos
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewItemForm(newItemForm === 'service' ? null : 'service')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Nauja paslauga
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemForm(newItemForm === 'product' ? null : 'product')}
                    className="text-sm text-orange-600 hover:text-orange-800"
                  >
                    + Nauja prekė
                  </button>
                </div>
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
                <h4 className="text-sm font-semibold text-blue-700 mb-2 border-b border-blue-200 pb-1">Paslaugos</h4>
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
                      <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => handleRenameItem(item.id, e.target.value, item.name)}
                        className="flex-1 px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded text-sm"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantities[item.id] || 1}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={!selectedItems.has(item.id)}
                      />
                      <span className="text-xs text-gray-400 w-8">{item.unit || 'vnt'}</span>
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

              {/* Prekės — rodomos tik pradėjus ieškoti */}
              <div>
                <h4 className="text-sm font-semibold text-orange-700 mb-2 border-b border-orange-200 pb-1">Prekės</h4>
                {!searchTerm.trim() ? (
                  <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded p-2">
                    Pradėkite vesti paiešką, kad matytumėte prekes
                  </p>
                ) : (
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
                      <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => handleRenameItem(item.id, e.target.value, item.name)}
                        className="flex-1 px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded text-sm"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantities[item.id] || 1}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={!selectedItems.has(item.id)}
                      />
                      <span className="text-xs text-gray-400 w-8">{item.unit || 'vnt'}</span>
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
                )}
              </div>

              {/* Sandėlio prekės — rodomos tik pradėjus ieškoti */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-orange-700 mb-2 border-b border-orange-200 pb-1">Sandėlio prekės</h4>
                {!searchTerm.trim() ? (
                  <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded p-2">
                    Pradėkite vesti paiešką, kad matytumėte sandėlio prekes
                  </p>
                ) : (
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
                      <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => handleRenameItem(item.id, e.target.value, item.name)}
                        className="flex-1 px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded text-sm"
                      />
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
                )}
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

      {newItemForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            {newItemForm === 'service' ? 'Nauja paslauga' : 'Nauja prekė'}
          </h3>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {newItemForm === 'service' ? 'Darbo kaina' : 'Prekės kaina'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mato vienetas
                </label>
                <select
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {unitOptions.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
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
                onClick={() => setNewItemForm(null)}
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
                    onChange={(e) => handleStatusChange(quote, e.target.value as Quote['status'])}
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
                  <div>
                    <label className="text-xs text-gray-500">Objekto pavadinimas</label>
                    <input
                      type="text"
                      value={editObjectName}
                      onChange={(e) => setEditObjectName(e.target.value)}
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

              {/* Pozicijos — atskirtos paslaugos ir prekės */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Pozicijos</h4>
                {(() => {
                  const isProduct = (item: QuoteItem) => {
                    if (item.warehouse_item_id) return true
                    const pi = priceItems?.find(p => p.id === item.price_item_id)
                    if (pi) return pi.item_type === 'product'
                    return item.work_price === 0
                  }
                  const services = (quoteItems || []).filter(i => !isProduct(i))
                  const products = (quoteItems || []).filter(isProduct)
                  const servicesSum = services.reduce((s, i) => s + i.work_price * i.quantity, 0)
                  const productsSum = products.reduce((s, i) => s + i.material_price * i.quantity, 0)

                  const qtyCell = (item: QuoteItem) => (
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
                  )
                  const unitCell = (item: QuoteItem) => (
                    <td className="py-1.5">
                      <select
                        value={item.unit || 'vnt'}
                        onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                        className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                      >
                        {unitOptions.map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </td>
                  )
                  const deleteCell = (item: QuoteItem) => (
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        ✕
                      </button>
                    </td>
                  )

                  return (
                    <>
                      {/* Paslaugos */}
                      <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Paslaugos</p>
                      {services.length > 0 ? (
                        <table className="w-full text-sm mb-1">
                          <thead>
                            <tr className="border-b text-left text-xs text-gray-500">
                              <th className="py-1">Pavadinimas</th>
                              <th className="py-1 w-20">Kiekis</th>
                              <th className="py-1 w-16">Vnt.</th>
                              <th className="py-1 w-24">Darbas €</th>
                              <th className="py-1 w-20 text-right">Suma €</th>
                              <th className="py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {services.map((item) => (
                              <tr key={item.id} className="border-b">
                                <td className="py-1.5 pr-2">
                                  <input
                                    type="text"
                                    defaultValue={item.name}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim()
                                      if (val && val !== item.name) handleUpdateItem(item.id, 'name', val)
                                    }}
                                    className="w-full px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded text-sm"
                                  />
                                </td>
                                {qtyCell(item)}
                                {unitCell(item)}
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
                                <td className="py-1.5 text-right">
                                  {(item.work_price * item.quantity).toFixed(2)}
                                </td>
                                {deleteCell(item)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-400 mb-1">Paslaugų nėra</p>
                      )}
                      <p className="text-xs text-gray-500 text-right mb-3">Paslaugų suma: €{servicesSum.toFixed(2)}</p>

                      {/* Prekės */}
                      <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Prekės</p>
                      {products.length > 0 ? (
                        <table className="w-full text-sm mb-1">
                          <thead>
                            <tr className="border-b text-left text-xs text-gray-500">
                              <th className="py-1">Pavadinimas</th>
                              <th className="py-1 w-20">Kiekis</th>
                              <th className="py-1 w-16">Vnt.</th>
                              <th className="py-1 w-24">Kaina €</th>
                              <th className="py-1 w-20 text-right">Suma €</th>
                              <th className="py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((item) => (
                              <tr key={item.id} className="border-b">
                                <td className="py-1.5 pr-2">
                                  <input
                                    type="text"
                                    defaultValue={item.name}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim()
                                      if (val && val !== item.name) handleUpdateItem(item.id, 'name', val)
                                    }}
                                    className="w-full px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded text-sm"
                                  />
                                </td>
                                {qtyCell(item)}
                                {unitCell(item)}
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
                                  {(item.material_price * item.quantity).toFixed(2)}
                                </td>
                                {deleteCell(item)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-400 mb-1">Prekių nėra</p>
                      )}
                      <p className="text-xs text-gray-500 text-right">Prekių suma: €{productsSum.toFixed(2)}</p>
                    </>
                  )
                })()}

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
                      onClick={() => { setModalNewItemType('service'); setShowModalNewItem(true) }}
                      className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap px-2"
                    >
                      + Paslauga
                    </button>
                    <button
                      onClick={() => { setModalNewItemType('product'); setShowModalNewItem(true) }}
                      className="text-sm text-orange-600 hover:text-orange-800 whitespace-nowrap px-2"
                    >
                      + Prekė
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
                      <div className="flex space-x-2 items-center">
                        <span className={`text-xs font-semibold w-16 ${modalNewItemType === 'service' ? 'text-blue-700' : 'text-orange-700'}`}>
                          {modalNewItemType === 'service' ? 'Paslauga' : 'Prekė'}
                        </span>
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
                        <select
                          value={modalNewItemUnit}
                          onChange={(e) => setModalNewItemUnit(e.target.value)}
                          className="w-20 px-1 py-1 border border-gray-300 rounded text-sm"
                        >
                          {unitOptions.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
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
                              work_price: item.item_type === 'product' ? 0 : (item.labor_price || 0),
                              material_price: item.item_type === 'product' ? (item.material_price || 0) : 0,
                              price_item_id: item.id,
                              unit: item.unit || 'vnt',
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
                              unit: item.unit || 'vnt',
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
                <button
                  onClick={handleDownloadQuotePdf}
                  className="flex-1 bg-gray-700 text-white py-2 px-4 rounded hover:bg-gray-800 text-sm"
                >
                  Atsisiųsti PDF
                </button>
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
