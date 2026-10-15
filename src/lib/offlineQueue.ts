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
      // update/delete be match sąlygos užlietų visas eilutes — tokią mutaciją praleidžiame
      const needsMatch = item.op === 'update' || item.op === 'delete' || item.op === 'storage_delete'
      if (needsMatch && (!item.match || Object.keys(item.match).length === 0)) {
        failed++
        continue
      }

      let error
      if (item.op === 'insert') {
        ;({ error } = await supabase.from(item.table).insert(item.payload))
      } else if (item.op === 'update') {
        ;({ error } = await supabase
          .from(item.table)
          .update(item.payload)
          .match(item.match!))
      } else if (item.op === 'delete') {
        ;({ error } = await supabase
          .from(item.table)
          .delete()
          .match(item.match!))
      } else if (item.op === 'storage_upload') {
        // Failas į Storage, tada DB eilutė
        if (!item.bucket || !item.storage_path || !item.blob) {
          throw new Error('Nepilnas įkėlimo įrašas eilėje')
        }
        ;({ error } = await supabase.storage
          .from(item.bucket)
          .upload(item.storage_path, item.blob, { contentType: 'image/jpeg' }))
        if (!error) {
          ;({ error } = await supabase.from(item.table).insert(item.payload))
        }
      } else {
        // storage_delete: DB eilutė + failas iš Storage (storage klaida nesustabdo — failo gali nebebūti)
        if (!item.bucket || !item.storage_path) {
          throw new Error('Nepilnas trynimo įrašas eilėje')
        }
        await supabase.storage.from(item.bucket).remove([item.storage_path])
        ;({ error } = await supabase
          .from(item.table)
          .delete()
          .match(item.match!))
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
