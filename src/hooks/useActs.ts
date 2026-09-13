import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ProjectAct {
  id: string
  project_id: string
  act_number: string
  status: 'generated' | 'signed'
  generated_at: string
  created_at: string
}

export function useProjectActs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projectActs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_acts')
        .select('*')
        .eq('project_id', projectId)
        .order('generated_at', { ascending: false })

      if (error) throw error
      return data as ProjectAct[]
    },
    enabled: !!projectId,
  })
}

export function useGenerateAct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const { data: actNumber, error: numError } = await supabase
        .rpc('generate_act_number', { p_project_id: projectId })

      if (numError) throw numError

      const { data, error } = await supabase
        .from('project_acts')
        .insert({
          project_id: projectId,
          act_number: actNumber,
          status: 'generated',
        })
        .select()
        .single()

      if (error) throw error
      return data as ProjectAct
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectActs', data.project_id] })
    },
  })
}

export function useUpdateActStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'generated' | 'signed' }) => {
      const { data, error } = await supabase
        .from('project_acts')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ProjectAct
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectActs', data.project_id] })
    },
  })
}
