import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface WorkTimeEntry {
  id: string
  work_id: string | null
  project_id: string | null
  user_id: string | null
  started_at: string
  ended_at: string | null
  hourly_rate: number
  created_at: string
}

export function useWorkTimeEntries(workIds: string[]) {
  return useQuery({
    queryKey: ['workTimeEntries', workIds],
    queryFn: async () => {
      if (workIds.length === 0) return []

      const { data, error } = await supabase
        .from('work_time_entries')
        .select('*')
        .in('work_id', workIds)
        .order('started_at', { ascending: false })

      if (error) throw error
      return data as WorkTimeEntry[]
    },
    enabled: workIds.length > 0,
  })
}

export function useProjectTimeEntries(projectId: string | undefined, workIds: string[]) {
  return useQuery({
    queryKey: ['workTimeEntries', 'project', projectId],
    queryFn: async () => {
      let query = supabase
        .from('work_time_entries')
        .select('*')
        .order('started_at', { ascending: false })

      if (workIds.length > 0) {
        query = query.or(`project_id.eq.${projectId},work_id.in.(${workIds.join(',')})`)
      } else {
        query = query.eq('project_id', projectId!)
      }

      const { data, error } = await query
      if (error) throw error
      return data as WorkTimeEntry[]
    },
    enabled: !!projectId,
  })
}

export function useStartWorkTime() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workId, projectId }: { workId?: string; projectId?: string }) => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('Neprisijungęs vartotojas')

      const { data: profile } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', userId)
        .single()

      const { data, error } = await supabase
        .from('work_time_entries')
        .insert({
          work_id: workId || null,
          project_id: projectId || null,
          user_id: userId,
          started_at: new Date().toISOString(),
          hourly_rate: profile?.hourly_rate || 0,
        })
        .select()
        .single()

      if (error) throw error
      return data as WorkTimeEntry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTimeEntries'] })
    },
  })
}

export function useStopWorkTime() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      const { data, error } = await supabase
        .from('work_time_entries')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', entryId)
        .select()
        .single()

      if (error) throw error
      return data as WorkTimeEntry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTimeEntries'] })
    },
  })
}

export function getEntryDurationHours(entry: WorkTimeEntry): number {
  const start = new Date(entry.started_at).getTime()
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : Date.now()
  return (end - start) / (1000 * 60 * 60)
}

export function getEntryCost(entry: WorkTimeEntry): number {
  return getEntryDurationHours(entry) * entry.hourly_rate
}
