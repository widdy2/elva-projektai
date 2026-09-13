import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getPendingCount, flushQueue, onQueueChange } from '../lib/offlineQueue'

/**
 * Seko online/offline būseną ir laukiančių mutacijų skaičių.
 * Atsiradus ryšiui automatiškai sinchronizuoja eilę.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const refreshCount = async () => setPending(await getPendingCount())

    const handleOnline = async () => {
      setOnline(true)
      setSyncing(true)
      try {
        const { synced } = await flushQueue()
        if (synced > 0) {
          queryClient.invalidateQueries()
        }
      } finally {
        setSyncing(false)
        refreshCount()
      }
    }

    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const offQueue = onQueueChange(refreshCount)
    refreshCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      offQueue()
    }
  }, [queryClient])

  return { online, pending, syncing }
}
