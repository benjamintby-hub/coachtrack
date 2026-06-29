import { useState } from 'react'
import { syncCalendar, type SyncResult } from '@/services/calendarService'
import { useClients } from '@/hooks/useClients'
import { useSeances } from '@/hooks/useSeances'

const STORAGE_KEY = 'coachtrack_calendar_url'

export function useCalendarSync() {
  const { clients } = useClients()
  const { seances, createSeance } = useSeances()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const calendarUrl = localStorage.getItem(STORAGE_KEY) ?? ''

  const saveUrl = (url: string) => {
    localStorage.setItem(STORAGE_KEY, url)
  }

  const sync = async (url?: string) => {
    const targetUrl = url ?? calendarUrl
    if (!targetUrl) { setError('Aucune URL de calendrier configurée'); return }

    setSyncing(true)
    setError(null)
    setResult(null)

    try {
      const existingUids = seances
        .map((s: any) => s.uid_calendrier)
        .filter(Boolean)

      const res = await syncCalendar(targetUrl, clients, existingUids, createSeance)
      setResult(res)
    } catch (e: any) {
      setError(e.message ?? 'Erreur de synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  return { calendarUrl, saveUrl, sync, syncing, result, error }
}
