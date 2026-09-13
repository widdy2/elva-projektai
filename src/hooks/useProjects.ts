import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface Project {
  id: string
  organization_id: string
  client_id: string
  name: string
  address: string
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold'
  start_date: string | null
  end_date: string | null
  budget: number
  created_at: string
  updated_at: string
}

export function useProjects() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as (Project & { clients: { name: string } })[]
    },
    enabled: !!organizationId,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()
  
  return useMutation({
    mutationFn: async (project: Omit<Project, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...project, organization_id: organizationId })
        .select()
        .single()
      
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...project }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(project)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
