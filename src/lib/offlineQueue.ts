import { supabase } from './supabase'
import { offlineDb, PendingMutation } from './offlineDb'

const QUEUE_EVENT = 'offline-queue-change'

function notifyQueueChange() {
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

export function onQueueChange(listener: () => void) {
  window.addEventListener(QUEUE_EVENT, listener)
  return () => window.removeEventListener(QUEUE_EVENT, listener)
}

/** Prideda mutaciją į offline eilę (kai nėra ryšio). */
export async function enqueueMutation(
  m: Omit<PendingMutation, 'id' | 'created_at'>
) {
  await offlineDb.pending_mutations.add({ ...m, created_at: Date.now() })
  notifyQueueChange()
}

export async function getPendingCount() {
  return offlineDb.pending_mutations.count()
}

/**
 * Vykdo visas laukiančias mutacijas Supabase.
 * Grąžina kiek pavyko / nepavyko.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const items = await offlineDb.pending_mutations.orderBy('created_at').toArray()
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      let error
      if (item.op === 'insert') {
        ;({ error } = await supabase.from(item.table).insert(item.payload))
      } else if (item.op === 'update') {
        ;({ error } = await supabase
          .from(item.table)
          .update(item.payload)
          .match(item.match ?? {}))
      } else {
        ;({ error } = await supabase
          .from(item.table)
          .delete()
          .match(item.match ?? {}))
      }
      if (error) throw error
      await offlineDb.pending_mutations.delete(item.id!)
      synced++
    } catch {
      failed++
    }
  }

  notifyQueueChange()
  return { synced, failed }
}
