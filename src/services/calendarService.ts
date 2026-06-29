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
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
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
  skipped: number
  unmatched: string[]
}

export async function syncCalendar(
  calendarUrl: string,
  clients: Client[],
  existingUids: string[],
  createSeance: (data: any) => Promise<any>,
): Promise<SyncResult> {
  const proxyUrl = `/api/calendar-proxy?url=${encodeURIComponent(calendarUrl)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Erreur proxy (${response.status}) : ${detail}`)
  }

  const icsText = await response.text()
  const events = parseICS(icsText)

  let imported = 0, skipped = 0
  const unmatched: string[] = []

  for (const event of events) {
    if (existingUids.includes(event.uid)) { skipped++; continue }

    const client = matchClient(event.summary, clients)
    if (!client) {
      if (!existingUids.includes(event.uid)) unmatched.push(event.summary)
      continue
    }

    await createSeance({
      client_id: client.id,
      date: event.date,
      heure_debut: event.heureDebut,
      duree_minutes: event.dureeMinutes,
      tarif: client.tarif_defaut ?? 0,
      statut_seance: 'done',
      type: client.type,
      uid_calendrier: event.uid,
    })
    imported++
  }

  return { imported, skipped, unmatched }
}
