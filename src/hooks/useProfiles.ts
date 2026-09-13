import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface Profile {
  id: string
  organization_id: string
  full_name: string
  role: string
  hourly_rate: number | null
  created_at: string
}

export function useProfiles() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['profiles', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('full_name', { ascending: true })

      if (error) throw error
      return data as Profile[]
    },
    enabled: !!organizationId,
  })
}
