import { useState } from 'react'
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useInvoiceItems, Invoice } from '../hooks/useInvoices'
import { useProjects } from '../hooks/useProjects'
import { useClients } from '../hooks/useClients'
import { supabase } from '../lib/supabase'
import { useOrganizationDetails } from '../hooks/useOrganizationDetails'
import { downloadInvoicePdf } from '../lib/pdfInvoice'
import { toast } from 'sonner'

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
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [reverseCharge, setReverseCharge] = useState(false)
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

  // Siūlomas kitas numeris ELVA##### formatu
  const suggestedNumber = (() => {
    const max = (invoices || []).reduce((m, inv) => {
      const match = /^ELVA(\d+)$/i.exec(inv.invoice_number || '')
      return match ? Math.max(m, parseInt(match[1], 10)) : m
    }, 0)
    return `ELVA${String(max + 1).padStart(5, '0')}`
  })()

  const openForm = () => {
    setShowForm(true)
  }

  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const vatRate = 21
  const vatAmount = subtotal * vatRate / 100
  // Atvirkštinis apmokestinimas (96 str.): PVM 21% nurodomas, bet galutinė suma — be PVM
  const total = reverseCharge ? subtotal : subtotal + vatAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = items.filter(i => i.name.trim())
    if (validItems.length === 0) return

    try {
      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: invoiceNumber.trim() || undefined,
          project_id: projectId || null,
          client_id: clientId || null,
          status: 'unpaid',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: dueDate || null,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total,
          reverse_charge: reverseCharge,
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
      setInvoiceNumber('')
      setReverseCharge(false)
      setItems([{ name: '', quantity: '1', unit: 'vnt', unit_price: '', item_type: 'work' }])
    } catch (err) {
      toast.error(`Klaida kuriant sąskaitą: ${(err as Error).message}`)
    }
  }

  const handleDownloadPdf = async (invoice: Invoice) => {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)

    await downloadInvoicePdf(invoice, items, org)
  }

  if (isLoading) return <div className="text-gray-600">Kraunama...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sąskaitos</h2>
        <button
          onClick={() => (showForm ? setShowForm(false) : openForm())}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Atšaukti' : '+ Nauja sąskaita'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nauja sąskaita</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Sąskaitos nr. <span className="text-gray-400 font-normal">(tuščia = automatinis)</span></label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={suggestedNumber}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
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

          <div className="mb-4 flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="vat_type"
                checked={!reverseCharge}
                onChange={() => setReverseCharge(false)}
              />
              Sąskaita su PVM
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="vat_type"
                checked={reverseCharge}
                onChange={() => setReverseCharge(true)}
              />
              Sąskaita su atvirkštiniu PVM (96 str.)
            </label>
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
              <span className="ml-4">{reverseCharge ? `PVM ${vatRate}% (atvirkštinis, 96 str.)` : `PVM ${vatRate}%`}: <strong>€{vatAmount.toFixed(2)}</strong></span>
              <span className="ml-4">{reverseCharge ? 'Iš viso (be PVM):' : 'Iš viso:'} <strong className="text-lg">€{total.toFixed(2)}</strong></span>
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
                onNumberChange={(num) => updateInvoice.mutate({ id: inv.id, invoice_number: num })}
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
  onNumberChange,
  onDelete,
  onDownloadPdf,
}: {
  invoice: Invoice
  expanded: boolean
  onToggle: () => void
  onStatusChange: (status: string) => void
  onNumberChange: (num: string) => void
  onDelete: () => void
  onDownloadPdf: () => void
}) {
  const { data: items } = useInvoiceItems(expanded ? invoice.id : undefined)
  const [editNumber, setEditNumber] = useState(invoice.invoice_number)

  const isOverdue = invoice.status === 'unpaid' && invoice.due_date && new Date(invoice.due_date) < new Date()
  const displayStatus = isOverdue ? 'overdue' : invoice.status

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">
          {invoice.invoice_number}
          {invoice.reverse_charge && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 align-middle">
              Atvirkšt. PVM
            </span>
          )}
        </td>
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
            {items && items.length > 0 && (() => {
              const isMaterial = (i: { item_type?: string; name: string }) =>
                i.item_type === 'material' || /\(medžiaga\)/i.test(i.name)
              const worksSum = items.filter(i => !isMaterial(i)).reduce((s, i) => s + i.total, 0)
              const materialsSum = items.filter(i => isMaterial(i)).reduce((s, i) => s + i.total, 0)
              return (
                <div className="mt-3 pt-3 border-t border-gray-200 text-sm space-y-1 max-w-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Darbai (be PVM):</span>
                    <span className="font-medium">€{worksSum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medžiagos (be PVM):</span>
                    <span className="font-medium">€{materialsSum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Viso be PVM:</span>
                    <span className="font-medium">€{(worksSum + materialsSum).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {invoice.reverse_charge ? `PVM ${invoice.vat_rate || 21}% (atvirkštinis, 96 str.):` : `PVM ${invoice.vat_rate}%:`}
                    </span>
                    <span className="font-medium">
                      €{(invoice.reverse_charge ? invoice.subtotal * (invoice.vat_rate || 21) / 100 : invoice.vat_amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200">
                    <span className="text-gray-900 font-semibold">{invoice.reverse_charge ? 'Viso be PVM:' : 'Viso su PVM:'}</span>
                    <span className="font-semibold">€{invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              )
            })()}
            {invoice.notes && <p className="text-xs text-gray-500 mt-2">Pastabos: {invoice.notes}</p>}
            <div className="flex items-center gap-2 mt-3">
              <label className="text-xs text-gray-500 uppercase">Sąskaitos nr.:</label>
              <input
                type="text"
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              {editNumber.trim() && editNumber !== invoice.invoice_number && (
                <button
                  onClick={() => onNumberChange(editNumber.trim())}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Išsaugoti
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
