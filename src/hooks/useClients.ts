import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface Client {
  id: string
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  code: string | null
  vat_code: string | null
  created_at: string
  updated_at: string
}

export function useClients() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Client[]
    },
    enabled: !!organizationId,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()
  
  return useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...client, organization_id: organizationId })
        .select()
        .single()
      
      if (error) throw error
      return data as Client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...client }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(client)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data as Client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
