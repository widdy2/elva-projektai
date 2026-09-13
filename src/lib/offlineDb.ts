import Dexie, { Table } from 'dexie'

export interface PendingMutation {
  id?: number
  table: string
  op: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  match?: Record<string, unknown>
  created_at: number
}

class OfflineDB extends Dexie {
  pending_mutations!: Table<PendingMutation, number>

  constructor() {
    super('elva-offline')
    this.version(1).stores({
      pending_mutations: '++id, table, created_at',
    })
  }
}

export const offlineDb = new OfflineDB()
