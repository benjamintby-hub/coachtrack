import { supabase } from '@/lib/supabase'
import { clientsService } from '@/services/clientsService'
import { seancesService } from '@/services/seancesService'
import { paiementsService } from '@/services/paiementsService'
import { forfaitsService } from '@/services/forfaitsService'
import type { Client } from '@/types'

interface CalendarEvent {
  uid: string
  summary: string
  date: string
  heureDebut?: string
  dureeMinutes?: number
}

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function parseDateValue(raw: string): string {
  const datePart = raw.replace(/T.*$/, '').replace(/-/g, '')
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
}

function parseTimeValue(raw: string): string | undefined {
  const t = raw.indexOf('T')
  if (t === -1) return undefined
  const time = raw.slice(t + 1).replace('Z', '')
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`
}

function calcDuration(start: string, end: string): number | undefined {
  if (!start.includes('T') || !end.includes('T')) return undefined
  const toMs = (dt: string) => {
    const clean = dt.replace(/[-:TZ]/g, '')
    return new Date(
      parseInt(clean.slice(0, 4)),
      parseInt(clean.slice(4, 6)) - 1,
      parseInt(clean.slice(6, 8)),
      parseInt(clean.slice(8, 10) || '0'),
      parseInt(clean.slice(10, 12) || '0'),
    ).getTime()
  }
  return Math.round((toMs(end) - toMs(start)) / 60000)
}

function parseICS(icsText: string): CalendarEvent[] {
  const lines = unfold(icsText).split(/\r\n|\n|\r/)
  const events: CalendarEvent[] = []
  let cur: Record<string, string> | null = null

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1).trim()
    const key = rawKey.split(';')[0]

    if (key === 'BEGIN' && value === 'VEVENT') { cur = {} }
    else if (key === 'END' && value === 'VEVENT') {
      if (cur?.UID && cur?.SUMMARY && cur?.DTSTART) {
        events.push({
          uid: cur.UID,
          summary: cur.SUMMARY,
          date: parseDateValue(cur.DTSTART),
          heureDebut: parseTimeValue(cur.DTSTART),
          dureeMinutes: cur.DTEND ? calcDuration(cur.DTSTART, cur.DTEND) : undefined,
        })
      }
      cur = null
    } else if (cur) {
      if (['SUMMARY', 'UID', 'DTSTART', 'DTEND'].includes(key)) cur[key] = value
    }
  }

  return events
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function matchClient(summary: string, clients: Client[]): Client | undefined {
  const match = summary.match(/^\[([^\]]+)\]/)
  if (!match) return undefined

  const name = normalize(match[1].replace(/\s*-\s*SALLE\s*/i, ''))

  return clients.find(c => {
    const a = normalize(`${c.nom} ${c.prenom}`)
    const b = normalize(`${c.prenom} ${c.nom}`)
    return name === a || name === b
  })
}

export interface SyncResult {
  imported: number
  lieesForfait: number
  updated: number
  deleted: number
  skipped: number
  unmatched: string[]
}

export const CALENDAR_URL_KEY = 'coachtrack_calendar_url'
// Événement émis quand une synchro a modifié des séances, pour que les pages rechargent leurs données
export const CALENDAR_SYNCED_EVENT = 'coachtrack:calendar-synced'

export function getCalendarUrl(): string {
  try { return localStorage.getItem(CALENDAR_URL_KEY) ?? '' } catch { return '' }
}

export function saveCalendarUrl(url: string) {
  try { localStorage.setItem(CALENDAR_URL_KEY, url) } catch { /* stockage indisponible */ }
}

// Une seule synchro à la fois : les appels simultanés partagent la synchro en cours
let enCours: Promise<SyncResult> | null = null

export function syncCalendar(calendarUrl: string): Promise<SyncResult> {
  if (!enCours) {
    enCours = runSync(calendarUrl).finally(() => { enCours = null })
  }
  return enCours
}

async function runSync(calendarUrl: string): Promise<SyncResult> {
  const proxyUrl = `/api/calendar-proxy?url=${encodeURIComponent(calendarUrl)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Erreur proxy (${response.status}) : ${detail}`)
  }

  const icsText = await response.text()
  if (!icsText.includes('BEGIN:VCALENDAR')) {
    throw new Error("La réponse reçue n'est pas un calendrier : vérifie l'URL et que le proxy /api/calendar-proxy est bien servi")
  }
  // Ordre chronologique : le forfait est consommé par les séances les plus anciennes d'abord
  const events = parseICS(icsText).sort((a, b) =>
    `${a.date} ${a.heureDebut ?? ''}`.localeCompare(`${b.date} ${b.heureDebut ?? ''}`))

  const [clients, forfaitsRestants, { data: existantes, error }] = await Promise.all([
    clientsService.getAll(),
    forfaitsService.getRestantsParClient(),
    supabase.from('seances').select('id, uid_calendrier, date, heure_debut, duree_minutes, forfait_id').not('uid_calendrier', 'is', null),
  ])
  if (error) throw error
  const parUid = new Map((existantes ?? []).map(s => [s.uid_calendrier as string, s]))

  let imported = 0, lieesForfait = 0, updated = 0, deleted = 0, skipped = 0
  const unmatched: string[] = []
  const vus = new Set<string>()

  for (const event of events) {
    // Un même UID peut apparaître plusieurs fois (occurrences modifiées d'un événement récurrent)
    if (vus.has(event.uid)) continue
    vus.add(event.uid)

    const existante = parUid.get(event.uid)
    if (existante) {
      // Rendez-vous déplacé dans le calendrier : on reporte date, heure et durée
      const heure = event.heureDebut ?? null
      const duree = event.dureeMinutes ?? null
      if (existante.date !== event.date || existante.heure_debut?.slice(0, 5) !== (heure ?? undefined) || existante.duree_minutes !== duree) {
        await seancesService.update(existante.id, { date: event.date, heure_debut: heure as any, duree_minutes: duree as any })
        updated++
      } else {
        skipped++
      }
      continue
    }

    const client = matchClient(event.summary, clients)
    if (!client) { unmatched.push(event.summary); continue }

    const tarif = client.tarif_defaut ?? 0
    const newSeance = await seancesService.create({
      client_id: client.id,
      date: event.date,
      heure_debut: event.heureDebut,
      duree_minutes: event.dureeMinutes,
      tarif,
      statut_seance: 'done',
      type: client.type,
      uid_calendrier: event.uid,
    })
    await paiementsService.create({ seance_id: newSeance.id, montant_du: tarif, montant_paye: 0, statut: 'pending' })
    imported++

    const restant = forfaitsRestants[client.id]
    if (restant && restant.restantes > 0) {
      await forfaitsService.lierSeance(newSeance.id, restant.forfaitId)
      restant.restantes--
      lieesForfait++
    }
  }

  deleted = await supprimerDisparues(events, existantes ?? [])

  if (imported > 0 || updated > 0 || deleted > 0) window.dispatchEvent(new Event(CALENDAR_SYNCED_EVENT))
  return { imported, lieesForfait, updated, deleted, skipped, unmatched }
}

// Supprime les séances importées dont le rendez-vous a disparu du calendrier.
// On garde celles qui ont déjà un paiement enregistré (payée, partielle, offerte) pour ne pas fausser le CA.
async function supprimerDisparues(
  events: CalendarEvent[],
  existantes: { id: string; uid_calendrier: string | null; date: string; forfait_id: string | null }[],
): Promise<number> {
  // Garde-fou : un calendrier vide ou mal lu ne doit pas tout effacer
  if (events.length === 0) return 0
  // Garde-fou : on ne touche qu'à la période couverte par le calendrier publié
  const debutCalendrier = events[0].date
  const uids = new Set(events.map(e => e.uid))
  const disparues = existantes.filter(s => !uids.has(s.uid_calendrier as string) && s.date >= debutCalendrier)
  if (disparues.length === 0) return 0

  const { data: paiements, error } = await supabase
    .from('paiements').select('seance_id, statut').in('seance_id', disparues.map(s => s.id))
  if (error) throw error
  const statutParSeance = new Map((paiements ?? []).map(p => [p.seance_id, p.statut]))

  let deleted = 0
  for (const s of disparues) {
    const statut = statutParSeance.get(s.id)
    const aSupprimer = !!s.forfait_id || !statut || statut === 'pending' || statut === 'late'
    if (!aSupprimer) continue
    await seancesService.delete(s.id)
    deleted++
  }
  return deleted
}
