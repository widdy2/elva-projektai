import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { enqueueMutation } from '../lib/offlineQueue'

const RATE_KEY = 'elva:hourly_rate'

// getSession skaito lokalią sesiją be tinklo užklausos (getUser ją darytų)
async function getSessionUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Neprisijungęs vartotojas')
  return id
}

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
      const userId = await getSessionUserId()

      // Offline: įrašas eina į eilę su kliento sugeneruotu UUID,
      // kad vėlesnis stop-update galėtų rasti tą pačią eilutę
      if (!navigator.onLine) {
        const cachedRate = Number(localStorage.getItem(`${RATE_KEY}:${userId}`)) || 0
        const entry: WorkTimeEntry = {
          id: crypto.randomUUID(),
          work_id: workId || null,
          project_id: projectId || null,
          user_id: userId,
          started_at: new Date().toISOString(),
          ended_at: null,
          hourly_rate: cachedRate,
          created_at: new Date().toISOString(),
        }
        await enqueueMutation({
          table: 'work_time_entries',
          op: 'insert',
          payload: entry as unknown as Record<string, unknown>,
        })
        return entry
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', userId)
        .single()

      const rate = profile?.hourly_rate || 0
      localStorage.setItem(`${RATE_KEY}:${userId}`, String(rate))

      const { data, error } = await supabase
        .from('work_time_entries')
        .insert({
          work_id: workId || null,
          project_id: projectId || null,
          user_id: userId,
          started_at: new Date().toISOString(),
          hourly_rate: rate,
        })
        .select()
        .single()

      if (error) throw error
      return data as WorkTimeEntry
    },
    onSuccess: (entry) => {
      // Offline — sintetinis įrašas į cache, kad laikmatis rodytųsi iš karto
      if (!navigator.onLine && entry.project_id) {
        queryClient.setQueriesData<WorkTimeEntry[]>(
          { queryKey: ['workTimeEntries'] },
          (old) => (old ? [entry, ...old] : [entry])
        )
      }
      queryClient.invalidateQueries({ queryKey: ['workTimeEntries'] })
    },
  })
}

export function useStopWorkTime() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      const endedAt = new Date().toISOString()

      // Offline: update eina į eilę; jei start'as irgi buvo offline,
      // eilės tvarka garantuoja, kad insert vykdomas pirmas
      if (!navigator.onLine) {
        await enqueueMutation({
          table: 'work_time_entries',
          op: 'update',
          payload: { ended_at: endedAt },
          match: { id: entryId },
        })
        return { id: entryId, ended_at: endedAt } as WorkTimeEntry
      }

      const { data, error } = await supabase
        .from('work_time_entries')
        .update({ ended_at: endedAt })
        .eq('id', entryId)
        .select()
        .single()

      if (error) throw error
      return data as WorkTimeEntry
    },
    onSuccess: (entry, { entryId }) => {
      // Offline — pažymime cache įrašą baigtu, kad laikmatis sustotų
      if (!navigator.onLine) {
        queryClient.setQueriesData<WorkTimeEntry[]>(
          { queryKey: ['workTimeEntries'] },
          (old) => old?.map(e => e.id === entryId ? { ...e, ended_at: entry.ended_at } : e)
        )
      }
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
