import { useEffect, useRef, useState } from 'react'
import { syncCalendar, getCalendarUrl, saveCalendarUrl, type SyncResult } from '@/services/calendarService'

export function useCalendarSync() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const calendarUrl = getCalendarUrl()

  const sync = async (url?: string) => {
    const targetUrl = url ?? calendarUrl
    if (!targetUrl) { setError('Aucune URL de calendrier configurée'); return }

    setSyncing(true)
    setError(null)
    setResult(null)

    try {
      setResult(await syncCalendar(targetUrl))
    } catch (e: any) {
      setError(e.message ?? 'Erreur de synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  return { calendarUrl, saveUrl: saveCalendarUrl, sync, syncing, result, error }
}

const INTERVALLE_MS = 15 * 60 * 1000
const DELAI_MIN_MS = 60 * 1000

// Synchro en arrière-plan : à l'ouverture, au retour sur l'appli et toutes les 15 min
export function useAutoCalendarSync() {
  const derniere = useRef(0)

  useEffect(() => {
    const lancer = () => {
      const url = getCalendarUrl()
      if (!url || document.visibilityState !== 'visible') return
      // Évite de relancer à chaque changement d'onglet rapproché
      if (Date.now() - derniere.current < DELAI_MIN_MS) return
      derniere.current = Date.now()
      syncCalendar(url).catch(e => console.warn('Synchro calendrier automatique échouée :', e))
    }

    lancer()
    const timer = setInterval(lancer, INTERVALLE_MS)
    document.addEventListener('visibilitychange', lancer)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', lancer)
    }
  }, [])
}
