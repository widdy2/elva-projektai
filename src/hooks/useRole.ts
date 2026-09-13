import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRole() {
  return useQuery({
    queryKey: ['role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      return data?.role as 'owner' | 'employee' | 'accountant' | null
    },
  })
}
