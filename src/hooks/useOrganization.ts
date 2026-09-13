import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      return data?.organization_id
    },
  })
}
