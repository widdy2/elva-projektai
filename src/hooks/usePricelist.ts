import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface PriceCategory {
  id: string
  organization_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface PriceItem {
  id: string
  organization_id: string
  category_id: string | null
  name: string
  labor_price: number
  material_price: number
  item_type?: 'service' | 'product'
  unit?: string
  created_at: string
  updated_at: string
}

export function usePriceCategories() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['priceCategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
      
      if (error) throw error
      return data as PriceCategory[]
    },
    enabled: !!organizationId,
  })
}

export function usePriceItems() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['priceItems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_items')
        .select('*, price_categories(name)')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
      
      if (error) throw error
      return data as (PriceItem & { price_categories: { name: string } | null })[]
    },
    enabled: !!organizationId,
  })
}

export function useCreatePriceCategory() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()
  
  return useMutation({
    mutationFn: async (category: Omit<PriceCategory, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('price_categories')
        .insert({ ...category, organization_id: organizationId })
        .select()
        .single()
      
      if (error) throw error
      return data as PriceCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceCategories'] })
    },
  })
}

export function useCreatePriceItem() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()

  return useMutation({
    mutationFn: async (item: Omit<PriceItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      console.log('Creating price item with organization_id:', organizationId)
      console.log('Item data:', item)

      const { data, error } = await supabase
        .from('price_items')
        .insert({ ...item, organization_id: organizationId })
        .select()
        .single()

      if (error) {
        console.error('Error creating price item:', error)
        throw error
      }

      console.log('Created price item:', data)
      return data as PriceItem
    },
    onSuccess: () => {
      console.log('Price item created successfully, invalidating queries')
      queryClient.invalidateQueries({ queryKey: ['priceItems'] })
    },
  })
}

export function useUpdatePriceItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<PriceItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('price_items')
        .update(item)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as PriceItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceItems'] })
    },
  })
}

export function useDeletePriceItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceItems'] })
    },
  })
}
