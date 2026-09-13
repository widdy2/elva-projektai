import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from '../hooks/useOrganization'
import { getEntryCost } from '../hooks/useWorkTimeEntries'

export function Reports() {
  const { data: organizationId } = useOrganization()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [dateFrom, setDateFrom] = useState(firstDay)
  const [dateTo, setDateTo] = useState(lastDay)

  const { data: invoices } = useQuery({
    queryKey: ['reportInvoices', organizationId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name), projects(name)')
        .eq('organization_id', organizationId)
        .gte('issue_date', dateFrom)
        .lte('issue_date', dateTo)
      if (error) throw error
      return data
    },
    enabled: !!organizationId,
  })

  const { data: materials } = useQuery({
    queryKey: ['reportMaterials', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_materials')
        .select('*, projects!inner(organization_id)')
        .eq('projects.organization_id', organizationId)
      if (error) throw error
      return data
    },
    enabled: !!organizationId,
  })

  const { data: timeEntries } = useQuery({
    queryKey: ['reportTimeEntries', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_time_entries')
        .select('*, project_works!inner(project_id, projects!inner(organization_id))')
        .eq('project_works.projects.organization_id', organizationId)
      if (error) throw error
      return data
    },
    enabled: !!organizationId,
  })

  const totalInvoiced = invoices?.reduce((sum, i) => sum + i.total, 0) || 0
  const totalPaid = invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0) || 0
  const totalUnpaid = totalInvoiced - totalPaid
  const materialsCost = materials?.reduce((sum, m) => sum + m.purchased_quantity * m.unit_price, 0) || 0
  const laborCost = timeEntries?.reduce((sum, e) => sum + getEntryCost(e), 0) || 0
  const profit = totalInvoiced - materialsCost - laborCost

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Ataskaitos</h2>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nuo</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Iki</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Išrašyta sąskaitų</h3>
          <p className="text-2xl font-bold text-gray-900">€{totalInvoiced.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{invoices?.length || 0} sąskaitos</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Apmokėta</h3>
          <p className="text-2xl font-bold text-green-600">€{totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Neapmokėta</h3>
          <p className="text-2xl font-bold text-yellow-600">€{totalUnpaid.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Pelnas / Nuostolis</h3>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            €{profit.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Sąnaudos</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Medžiagos</span>
              <span className="font-medium">€{materialsCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Darbo savikaina</span>
              <span className="font-medium">€{laborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Iš viso sąnaudų</span>
              <span>€{(materialsCost + laborCost).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Pajamų suvestinė</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Išrašyta sąskaitų</span>
              <span className="font-medium">€{totalInvoiced.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sąnaudos</span>
              <span className="font-medium text-red-600">-€{(materialsCost + laborCost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Pelnas</span>
              <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                €{profit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 p-6 pb-0">Sąskaitos pagal laikotarpį</h3>
        <table className="min-w-full divide-y divide-gray-200 mt-4">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numeris</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Klientas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objektas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suma</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statusas</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices?.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{inv.clients?.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{inv.projects?.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{inv.issue_date}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">€{inv.total.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                    inv.status === 'unpaid' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {inv.status === 'paid' ? 'Apmokėta' : inv.status === 'unpaid' ? 'Neapmokėta' : inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!invoices || invoices.length === 0) && (
          <p className="text-gray-500 text-sm p-6">Sąskaitų šiuo laikotarpiu nėra.</p>
        )}
      </div>
    </div>
  )
}
