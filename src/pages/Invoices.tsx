import { useState } from 'react'
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useInvoiceItems, Invoice } from '../hooks/useInvoices'
import { useProjects } from '../hooks/useProjects'
import { useClients } from '../hooks/useClients'
import { supabase } from '../lib/supabase'
import { useOrganizationDetails } from '../hooks/useOrganizationDetails'
import { addOrgHeader } from '../lib/pdfHeader'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const statusLabels: Record<string, string> = {
  unpaid: 'Neapmokėta',
  paid: 'Apmokėta',
  overdue: 'Vėluoja',
  cancelled: 'Atšaukta',
}

const statusColors: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

interface ItemRow {
  name: string
  quantity: string
  unit: string
  unit_price: string
  item_type: 'work' | 'material'
}

export function Invoices() {
  const { data: invoices, isLoading } = useInvoices()
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const { data: org } = useOrganizationDetails()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const deleteInvoice = useDeleteInvoice()

  const [showForm, setShowForm] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ name: '', quantity: '1', unit: 'vnt', unit_price: '', item_type: 'work' }])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleProjectChange = (pid: string) => {
    setProjectId(pid)
    const project = projects?.find(p => p.id === pid)
    if (project?.client_id) setClientId(project.client_id)
  }

  const addItemRow = () => {
    setItems([...items, { name: '', quantity: '1', unit: 'vnt', unit_price: '', item_type: 'work' }])
  }

  const updateItem = (index: number, field: keyof ItemRow, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const vatRate = 21
  const vatAmount = subtotal * vatRate / 100
  const total = subtotal + vatAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = items.filter(i => i.name.trim())
    if (validItems.length === 0) return

    try {
      await createInvoice.mutateAsync({
        invoice: {
          project_id: projectId || null,
          client_id: clientId || null,
          status: 'unpaid',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate || null,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total,
          notes: notes || null,
        },
        items: validItems.map(i => ({
          name: i.name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit,
          unit_price: parseFloat(i.unit_price) || 0,
          total: (parseFloat(i.quantity) || 1) * (parseFloat(i.unit_price) || 0),
          item_type: i.item_type,
        })),
      })
      setShowForm(false)
      setProjectId('')
      setClientId('')
      setDueDate('')
      setNotes('')
      setItems([{ name: '', quantity: '1', unit: 'vnt', unit_price: '', item_type: 'work' }])
    } catch (err) {
      alert(`Klaida kuriant sąskaitą: ${(err as Error).message}`)
    }
  }

  const handleDownloadPdf = async (invoice: Invoice) => {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const startY = await addOrgHeader(doc, org)

    // Antraštė pagal ELVA pavyzdį — centruota
    doc.setFontSize(16)
    doc.setFont('DejaVuSans', 'bold')
    doc.text('PVM Sąskaita faktūra', pageWidth / 2, startY + 4, { align: 'center' })
    doc.setFont('DejaVuSans', 'normal')
    doc.setFontSize(10)
    doc.text(`Dok. Nr. ${invoice.invoice_number}`, pageWidth / 2, startY + 11, { align: 'center' })
    doc.text(`Data: ${new Date(invoice.issue_date).toLocaleDateString('lt-LT')}`, pageWidth / 2, startY + 17, { align: 'center' })
    if (invoice.due_date) {
      doc.text(`Apmokėti iki: ${new Date(invoice.due_date).toLocaleDateString('lt-LT')}`, pageWidth / 2, startY + 23, { align: 'center' })
    }

    // Pardavėjas (kairė) / Užsakovas (dešinė)
    const blockY = startY + (invoice.due_date ? 31 : 25)
    const rightX = pageWidth / 2 + 6

    doc.setFontSize(10)
    doc.setFont('DejaVuSans', 'bold')
    doc.text(org?.name || '', 14, blockY)
    doc.text('Užsakovas:', rightX, blockY)
    doc.setFont('DejaVuSans', 'normal')
    doc.setFontSize(9)

    const sellerLines: string[] = []
    if (org?.code) sellerLines.push(`Įmonės kodas: ${org.code}`)
    if (org?.vat_code) sellerLines.push(`PVM mokėtojo kodas: ${org.vat_code}`)
    if (org?.address) sellerLines.push(`Įm. adresas: ${org.address}`)
    if (org?.bank_name) sellerLines.push(org.bank_name)
    if (org?.bank_account) sellerLines.push(`A.s.: ${org.bank_account}`)
    if (org?.phone) sellerLines.push(`Tel.: ${org.phone}`)
    if (org?.email) sellerLines.push(org.email)

    const client = invoice.clients
    const buyerLines: string[] = []
    if (client?.name) buyerLines.push(client.name)
    if (client?.code) buyerLines.push(`Įmonės kodas: ${client.code}`)
    if (client?.vat_code) buyerLines.push(`PVM mokėtojo kodas: ${client.vat_code}`)
    if (client?.address) buyerLines.push(`Adresas: ${client.address}`)
    if (invoice.projects?.name) buyerLines.push(`Objektas: ${invoice.projects.name}`)
    if (invoice.projects?.address) buyerLines.push(`Objekto adresas: ${invoice.projects.address}`)

    // Laužome eilutes, kad kairys blokas neužlietų dešiniojo
    const colWidth = rightX - 14 - 4
    const sellerWrapped = sellerLines.flatMap(l => doc.splitTextToSize(l, colWidth) as string[])
    const buyerWrapped = buyerLines.flatMap(l => doc.splitTextToSize(l, pageWidth - 14 - rightX) as string[])
    sellerWrapped.forEach((l, i) => doc.text(l, 14, blockY + 6 + i * 4.5))
    buyerWrapped.forEach((l, i) => doc.text(l, rightX, blockY + 6 + i * 4.5))

    const tableY = blockY + 10 + Math.max(sellerWrapped.length, buyerWrapped.length) * 4.5

    // Pozicijos: Darbai ir Medžiagos atskiromis sekcijomis
    const allItems = items || []
    const isMaterial = (i: { item_type?: string; name: string }) =>
      i.item_type === 'material' || /\(medžiaga\)/i.test(i.name)
    const workItems = allItems.filter(i => !isMaterial(i))
    const materialItems = allItems.filter(i => isMaterial(i))

    const body: (string | { content: string; colSpan: number; styles: object })[][] = []
    let nr = 0
    const pushRow = (i: { name: string; quantity: number; unit: string; unit_price: number; total: number }) => {
      nr++
      body.push([
        nr.toString(),
        i.name.replace(/\s*\(medžiaga\)\s*/i, ''),
        i.unit,
        i.quantity.toString(),
        i.unit_price.toFixed(2),
        i.total.toFixed(2),
      ])
    }

    if (workItems.length > 0) {
      body.push([{ content: 'Darbai', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
      workItems.forEach(pushRow)
    }
    if (materialItems.length > 0) {
      body.push([{ content: 'Medžiagos', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
      materialItems.forEach(pushRow)
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
        2: { cellWidth: 16 },
        3: { cellWidth: 14, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
      },
    })

    // Jei sumos/parašai netelpa puslapyje — naujas puslapis
    const pageHeight = doc.internal.pageSize.getHeight()
    let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    if (finalY + 50 > pageHeight - 14) {
      doc.addPage()
      finalY = 20
    }
    doc.setFontSize(10)
    doc.text(`Suma ${invoice.subtotal.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' })
    doc.text(`PVM ${invoice.vat_rate}% ${invoice.vat_amount.toFixed(2)}`, pageWidth - 14, finalY + 5, { align: 'right' })
    doc.setFont('DejaVuSans', 'bold')
    doc.setFontSize(11)
    doc.text(`Suma apmokėjimui ${invoice.total.toFixed(2)}`, pageWidth - 14, finalY + 12, { align: 'right' })
    doc.setFont('DejaVuSans', 'normal')

    if (invoice.notes) {
      doc.setFontSize(9)
      doc.text(`Pastabos: ${invoice.notes}`, 14, finalY + 20)
    }

    // Parašų eilutės
    const sigY = finalY + (invoice.notes ? 30 : 24)
    doc.setFontSize(10)
    doc.text('Sąskaitą išrašė:', 14, sigY)
    doc.text('Užsakovas:', rightX, sigY)
    doc.line(14, sigY + 12, 14 + 70, sigY + 12)
    doc.line(rightX, sigY + 12, rightX + 70, sigY + 12)
    doc.setFontSize(8)
    doc.text('Vardas, pavardė, parašas', 14, sigY + 16)
    doc.text('Vardas, pavardė, parašas', rightX, sigY + 16)

    doc.save(`${invoice.invoice_number}.pdf`)
  }

  if (isLoading) return <div className="text-gray-600">Kraunama...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sąskaitos</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Atšaukti' : '+ Nauja sąskaita'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nauja sąskaita</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Objektas</label>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">-- Pasirinkti --</option>
                {projects?.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.clients?.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Klientas</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">-- Pasirinkti --</option>
                {clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Apmokėti iki</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Pozicijos</label>
              <button type="button" onClick={addItemRow} className="text-blue-600 text-sm">+ Pridėti eilutę</button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  placeholder="Pavadinimas"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  placeholder="Kiekis"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  placeholder="Vnt."
                  className="w-16 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                  placeholder="€/vnt"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <select
                  value={item.item_type}
                  onChange={(e) => updateItem(i, 'item_type', e.target.value)}
                  className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="work">Darbas</option>
                  <option value="material">Medžiaga</option>
                </select>
                <span className="w-20 py-2 text-sm text-gray-700 text-right">
                  €{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-600 text-sm">×</button>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Pastabos</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={2}
            />
          </div>

          <div className="flex justify-between items-center border-t pt-4">
            <div className="text-sm text-gray-600">
              <span>Tarpinė suma: <strong>€{subtotal.toFixed(2)}</strong></span>
              <span className="ml-4">PVM {vatRate}%: <strong>€{vatAmount.toFixed(2)}</strong></span>
              <span className="ml-4">Iš viso: <strong className="text-lg">€{total.toFixed(2)}</strong></span>
            </div>
            <button
              type="submit"
              disabled={createInvoice.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {createInvoice.isPending ? 'Kuriama...' : 'Sukurti sąskaitą'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numeris</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Klientas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objektas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Išrašyta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suma</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statusas</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices?.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                expanded={expandedId === inv.id}
                onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                onStatusChange={(status) => updateInvoice.mutate({ id: inv.id, status: status as Invoice['status'] })}
                onDelete={() => deleteInvoice.mutate(inv.id)}
                onDownloadPdf={() => handleDownloadPdf(inv)}
              />
            ))}
          </tbody>
        </table>
        {(!invoices || invoices.length === 0) && (
          <p className="text-gray-500 text-sm p-6">Sąskaitų nėra. Sukurkite pirmą.</p>
        )}
      </div>
    </div>
  )
}

function InvoiceRow({
  invoice,
  expanded,
  onToggle,
  onStatusChange,
  onDelete,
  onDownloadPdf,
}: {
  invoice: Invoice
  expanded: boolean
  onToggle: () => void
  onStatusChange: (status: string) => void
  onDelete: () => void
  onDownloadPdf: () => void
}) {
  const { data: items } = useInvoiceItems(expanded ? invoice.id : undefined)

  const isOverdue = invoice.status === 'unpaid' && invoice.due_date && new Date(invoice.due_date) < new Date()
  const displayStatus = isOverdue ? 'overdue' : invoice.status

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
        <td className="px-6 py-4 text-sm text-gray-700">{invoice.clients?.name || '-'}</td>
        <td className="px-6 py-4 text-sm text-gray-700">{invoice.projects?.name || '-'}</td>
        <td className="px-6 py-4 text-sm text-gray-700">{invoice.issue_date}</td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">€{invoice.total.toFixed(2)}</td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[displayStatus]}`}>
            {statusLabels[displayStatus]}
          </span>
        </td>
        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
          <button onClick={onDownloadPdf} className="text-blue-600 hover:text-blue-800 text-xs mr-2">PDF</button>
          {invoice.status === 'unpaid' && (
            <button onClick={() => onStatusChange('paid')} className="text-green-600 hover:text-green-800 text-xs mr-2">
              Apmokėta
            </button>
          )}
          <button onClick={onDelete} className="text-red-600 hover:text-red-800 text-xs">Ištrinti</button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50">
            {items && items.length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="py-1 pr-4">Pavadinimas</th>
                    <th className="py-1 pr-4">Kiekis</th>
                    <th className="py-1 pr-4">€/vnt</th>
                    <th className="py-1">Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="py-1 pr-4">{item.name}</td>
                      <td className="py-1 pr-4">{item.quantity} {item.unit}</td>
                      <td className="py-1 pr-4">€{item.unit_price.toFixed(2)}</td>
                      <td className="py-1">€{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">Pozicijų nėra.</p>
            )}
            {invoice.notes && <p className="text-xs text-gray-500 mt-2">Pastabos: {invoice.notes}</p>}
          </td>
        </tr>
      )}
    </>
  )
}
