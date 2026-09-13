import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { enqueueMutation } from '../lib/offlineQueue'

export interface ProjectWork {
  id: string
  project_id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  assignee_id: string | null
  deadline: string | null
  comments: string | null
  quantity: number
  unit: string
  work_price: number
  material_price: number
  created_at: string
  updated_at: string
}

export function useProjectWorks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projectWorks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_works')
        .select('*, profiles(full_name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as (ProjectWork & { profiles: { full_name: string } | null })[]
    },
    enabled: !!projectId,
  })
}

export function useCreateProjectWork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (work: Omit<ProjectWork, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('project_works')
        .insert(work)
        .select()
        .single()

      if (error) throw error
      return data as ProjectWork
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectWorks', data.project_id] })
    },
  })
}

export function useUpdateProjectWork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...work }: Partial<ProjectWork> & { id: string }) => {
      if (!navigator.onLine) {
        await enqueueMutation({
          table: 'project_works',
          op: 'update',
          payload: work,
          match: { id },
        })
        return { id, ...work } as ProjectWork
      }
      const { data, error } = await supabase
        .from('project_works')
        .update(work)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ProjectWork
    },
    onSuccess: (data) => {
      if (data?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['projectWorks', data.project_id] })
      }
    },
  })
}

export function useDeleteProjectWork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      if (!navigator.onLine) {
        await enqueueMutation({
          table: 'project_works',
          op: 'delete',
          payload: {},
          match: { id },
        })
        return { projectId }
      }
      const { error } = await supabase
        .from('project_works')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { projectId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectWorks', data.projectId] })
    },
  })
}
