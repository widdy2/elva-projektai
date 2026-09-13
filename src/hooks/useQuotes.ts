import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface Quote {
  id: string
  organization_id: string
  client_id: string | null
  address: string
  status: 'draft' | 'sent' | 'pending' | 'accepted' | 'rejected' | 'cancelled'
  total_work: number
  total_material: number
  total_vat: number
  total: number
  public_token: string | null
  accepted_at: string | null
  accepted_ip: string | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  created_at: string
  updated_at: string
  clients?: {
    name: string
  }
}

export interface QuoteItem {
  id: string
  quote_id: string
  price_item_id: string | null
  warehouse_item_id: string | null
  name: string
  quantity: number
  work_price: number
  material_price: number
  created_at: string
}

export function useQuotes() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, clients(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as (Quote & { clients: { name: string } })[]
    },
    enabled: !!organizationId,
  })
}

export function useCreateQuote() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()

  return useMutation({
    mutationFn: async (quote: Omit<Quote, 'organization_id' | 'id' | 'created_at' | 'total_work' | 'total_material' | 'total_vat' | 'total' | 'public_token' | 'accepted_at' | 'accepted_ip' | 'updated_at' | 'client_name' | 'client_email' | 'client_phone'>) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert({ ...quote, organization_id: organizationId })
        .select()
        .single()

      if (error) throw error
      return data as Quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateQuote() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...quote }: Partial<Quote> & { id: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(quote)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data as Quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useQuoteItems(quoteId: string) {
  return useQuery({
    queryKey: ['quoteItems', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
      
      if (error) throw error
      return data as QuoteItem[]
    },
    enabled: !!quoteId,
  })
}

export function useCreateQuoteItem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (item: Omit<QuoteItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('quote_items')
        .insert(item)
        .select()
        .single()
      
      if (error) throw error
      return data as QuoteItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems'] })
    },
  })
}

export function useUpdateQuoteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<QuoteItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('quote_items')
        .update(item)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as QuoteItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems'] })
    },
  })
}

export function useDeleteQuoteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems'] })
    },
  })
}

export function useDeleteQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}
