import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface Invoice {
  id: string
  organization_id: string
  project_id: string | null
  client_id: string | null
  invoice_number: string
  status: 'unpaid' | 'paid' | 'overdue' | 'cancelled'
  issue_date: string
  due_date: string | null
  subtotal: number
  vat_rate: number
  vat_amount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  clients?: { name: string } | null
  projects?: { name: string; address: string } | null
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  name: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  created_at: string
}

export function useInvoices() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['invoices', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name), projects(name, address)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Invoice[]
    },
    enabled: !!organizationId,
  })
}

export function useInvoiceItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoiceItems', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as InvoiceItem[]
    },
    enabled: !!invoiceId,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()

  return useMutation({
    mutationFn: async ({
      invoice,
      items,
    }: {
      invoice: Omit<Invoice, 'id' | 'organization_id' | 'invoice_number' | 'created_at' | 'updated_at' | 'clients' | 'projects'>
      items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[]
    }) => {
      const { data: invoiceNumber, error: numError } = await supabase
        .rpc('generate_invoice_number', { p_organization_id: organizationId })

      if (numError) throw numError

      const { data: created, error } = await supabase
        .from('invoices')
        .insert({ ...invoice, organization_id: organizationId, invoice_number: invoiceNumber })
        .select()
        .single()

      if (error) throw error

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items.map(i => ({ ...i, invoice_id: created.id })))

        if (itemsError) throw itemsError
      }

      return created as Invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...invoice }: Partial<Invoice> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update(invoice)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
