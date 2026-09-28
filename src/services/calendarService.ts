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

interface RawEvent {
  UID?: string
  SUMMARY?: string
  DTSTART?: string
  DTEND?: string
  RRULE?: string
  'RECURRENCE-ID'?: string
  EXDATE: string[]
}

function toEvent(raw: RawEvent, uid: string): CalendarEvent {
  return {
    uid,
    summary: raw.SUMMARY!,
    date: parseDateValue(raw.DTSTART!),
    heureDebut: parseTimeValue(raw.DTSTART!),
    dureeMinutes: raw.DTEND ? calcDuration(raw.DTSTART!, raw.DTEND) : undefined,
  }
}

// ---- Rendez-vous récurrents (RRULE) ----

const JOURS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

// Dates manipulées à midi pour ne jamais basculer de jour avec les changements d'heure
const versDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12) }
const versIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plusJours = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// Les répétitions sans fin sont dépliées jusqu'à la fin du mois prochain
function horizonRepetitions(): string {
  const now = new Date()
  return versIso(new Date(now.getFullYear(), now.getMonth() + 2, 0, 12))
}

// Dates (AAAA-MM-JJ) de toutes les occurrences d'une règle, bornées par UNTIL, COUNT et l'horizon
function occurrences(debut: string, rrule: string, horizon: string): string[] {
  const regle = Object.fromEntries(rrule.split(';').map(p => p.split('=') as [string, string]))
  const freq = regle.FREQ
  const intervalle = Math.max(1, parseInt(regle.INTERVAL ?? '1') || 1)
  const count = regle.COUNT ? parseInt(regle.COUNT) : Infinity
  const fin = [regle.UNTIL ? parseDateValue(regle.UNTIL) : horizon, horizon].sort()[0]
  const depart = versDate(debut)
  const dates: string[] = []

  const ajouter = (d: Date) => {
    const iso = versIso(d)
    if (iso < debut || iso > fin || dates.length >= count) return false
    dates.push(iso)
    return true
  }

  for (let k = 0; k < 5000 && dates.length < count; k++) {
    if (freq === 'DAILY') {
      const d = plusJours(depart, k * intervalle)
      if (versIso(d) > fin) break
      ajouter(d)
    } else if (freq === 'WEEKLY') {
      // Semaine commençant le lundi ; jours listés dans BYDAY, sinon le jour du premier rendez-vous
      const lundi = plusJours(depart, -((depart.getDay() + 6) % 7) + k * 7 * intervalle)
      if (versIso(lundi) > fin) break
      const jours = regle.BYDAY
        ? regle.BYDAY.split(',').map((j: string) => JOURS_ICS.indexOf(j.slice(-2))).filter((j: number) => j >= 0)
        : [depart.getDay()]
      for (const j of jours.map((j: number) => (j + 6) % 7).sort((a: number, b: number) => a - b)) ajouter(plusJours(lundi, j))
    } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
      const mois = freq === 'MONTHLY' ? k * intervalle : k * 12 * intervalle
      const d = new Date(depart.getFullYear(), depart.getMonth() + mois, depart.getDate(), 12)
      if (versIso(d) > fin) break
      // Un 31 n'existe pas tous les mois : ce mois-là est sauté
      if (d.getDate() === depart.getDate()) ajouter(d)
    } else {
      // Règle non gérée : seul le premier rendez-vous est gardé
      ajouter(depart)
      break
    }
  }
  return dates
}

function parseICS(icsText: string): CalendarEvent[] {
  const lines = unfold(icsText).split(/\r\n|\n|\r/)
  const raws: RawEvent[] = []
  let cur: RawEvent | null = null
  let dansAlarme = false

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1).trim()
    const key = rawKey.split(';')[0]

    if (key === 'BEGIN' && value === 'VEVENT') { cur = { EXDATE: [] } }
    else if (key === 'END' && value === 'VEVENT') {
      if (cur?.UID && cur?.SUMMARY && cur?.DTSTART) raws.push(cur)
      cur = null
    } else if (key === 'BEGIN' && value === 'VALARM') { dansAlarme = true }
    else if (key === 'END' && value === 'VALARM') { dansAlarme = false }
    else if (cur && !dansAlarme) {
      if (key === 'EXDATE') cur.EXDATE.push(...value.split(',').map(parseDateValue))
      else if (['SUMMARY', 'UID', 'DTSTART', 'DTEND', 'RRULE', 'RECURRENCE-ID'].includes(key)) (cur as any)[key] = value
    }
  }

  // Occurrences modifiées (déplacées, renommées) : même UID que la série + date d'origine en RECURRENCE-ID
  const modifiees = new Map<string, RawEvent>()
  for (const r of raws) {
    if (r['RECURRENCE-ID']) modifiees.set(`${r.UID}|${parseDateValue(r['RECURRENCE-ID'])}`, r)
  }

  const horizon = horizonRepetitions()
  const events: CalendarEvent[] = []
  for (const r of raws) {
    if (r['RECURRENCE-ID']) continue
    const debut = parseDateValue(r.DTSTART!)
    if (!r.RRULE) { events.push(toEvent(r, r.UID!)); continue }

    for (const date of occurrences(debut, r.RRULE, horizon)) {
      if (r.EXDATE.includes(date)) continue
      // Le premier rendez-vous garde l'UID de la série : les séances déjà importées ne sont pas dupliquées
      const uid = date === debut ? r.UID! : `${r.UID}/${date}`
      const cle = `${r.UID}|${date}`
      const modifiee = modifiees.get(cle)
      modifiees.delete(cle)
      if (modifiee) { events.push(toEvent(modifiee, uid)); continue }
      // Même heure et même durée que le premier rendez-vous, à la date de l'occurrence
      events.push({ ...toEvent(r, uid), date })
    }
  }
  // Occurrences modifiées dont la série n'est pas dans le calendrier : gardées telles quelles
  for (const [cle, r] of modifiees) {
    const date = cle.split('|')[1]
    events.push(toEvent(r, `${r.UID}/${date}`))
  }

  return events
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

const SALLE = /\s*-\s*SALLE\s*/i

// Contenu entre crochets en tête du titre : « [NOM Prénom] Coaching » → « NOM Prénom »
function nomEntreCrochets(summary: string): string | undefined {
  return summary.match(/^\[([^\]]+)\]/)?.[1]
}

function matchClient(summary: string, clients: Client[]): Client | undefined {
  const brut = nomEntreCrochets(summary)
  if (!brut) return undefined

  const name = normalize(brut.replace(SALLE, ''))

  return clients.find(c => {
    const a = normalize(`${c.nom} ${c.prenom}`)
    const b = normalize(`${c.prenom} ${c.nom}`)
    return name === a || name === b
  })
}

// Fiche d'un nouvel élève déduite de « [NOM Prénom] » (ou « [NOM Prénom - SALLE] ») :
// les mots en majuscules forment le nom, les autres le prénom ; à défaut, le premier mot est le nom.
function nouvelEleve(summary: string): Omit<Client, 'id' | 'created_at'> | undefined {
  const brut = nomEntreCrochets(summary)
  if (!brut) return undefined
  const mots = brut.replace(SALLE, ' ').trim().split(/\s+/)
  if (mots.length < 2) return undefined

  const enMajuscules = (m: string) => /\p{L}/u.test(m) && m === m.toUpperCase()
  const nomMots = mots.filter(enMajuscules)
  const prenomMots = mots.filter(m => !enMajuscules(m))
  const [nom, prenom] = nomMots.length > 0 && prenomMots.length > 0
    ? [nomMots.join(' '), prenomMots.join(' ')]
    : [mots[0], mots.slice(1).join(' ')]

  return { nom, prenom, type: SALLE.test(brut) ? 'salle' : 'particulier', actif: true }
}

// Nombre de lettres à changer pour passer d'un mot à l'autre (distance de Levenshtein)
function distance(a: string, b: string): number {
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const ligne = [i]
    for (let j = 1; j <= b.length; j++) {
      ligne[j] = Math.min(prec[j] + 1, ligne[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prec = ligne
  }
  return prec[b.length]
}

// Élève existant dont le nom s'écrit presque pareil (faute de frappe probable dans le calendrier)
function clientProche(fiche: { nom: string; prenom: string }, clients: Client[]): Client | undefined {
  const complet = normalize(`${fiche.nom} ${fiche.prenom}`)
  return clients.find(c => distance(complet, normalize(`${c.nom} ${c.prenom}`)) <= 2)
}

export interface SyncResult {
  imported: number
  lieesForfait: number
  updated: number
  deleted: number
  skipped: number
  unmatched: string[]
  clientsCrees: string[]
  doublonsEvites: number
  doublonsAVerifier: string[]
}

// ---- Séances déjà saisies (à la main ou par un ancien calendrier) ----

interface SeanceSync {
  id: string
  client_id: string
  uid_calendrier: string | null
  date: string
  heure_debut: string | null
  duree_minutes: number | null
  forfait_id: string | null
}

const enMinutes = (h?: string | null) => h ? parseInt(h.slice(0, 2)) * 60 + parseInt(h.slice(3, 5)) : undefined

// Même créneau : même jour et moins d'une heure d'écart (ou heure inconnue d'un côté)
function memeCreneau(a?: string | null, b?: string | null): boolean {
  const x = enMinutes(a), y = enMinutes(b)
  return x === undefined || y === undefined || Math.abs(x - y) <= 60
}

// Séance sans paiement enregistré ni forfait : on peut la supprimer sans rien perdre
async function sansSuivi(s: SeanceSync): Promise<boolean> {
  if (s.forfait_id) return false
  const { data, error } = await supabase.from('paiements').select('statut, montant_paye').eq('seance_id', s.id)
  if (error) throw error
  return (data ?? []).every(p => (p.statut === 'pending' || p.statut === 'late') && !p.montant_paye)
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
  // Une URL relative (ex. /calendrier-test.ics en mode test) est lue directement, sans proxy
  const source = calendarUrl.startsWith('/') ? calendarUrl : `/api/calendar-proxy?url=${encodeURIComponent(calendarUrl)}`
  const response = await fetch(source)
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

  // Tous les clients, archivés compris : un élève archivé qui revient n'est pas recréé en double
  // Toutes les séances, y compris celles saisies à la main, pour ne jamais créer de doublon
  const [{ data: tousClients, error: clientsError }, forfaitsRestants, { data: seancesData, error }] = await Promise.all([
    supabase.from('clients').select('*'),
    forfaitsService.getRestantsParClient(),
    supabase.from('seances').select('id, client_id, uid_calendrier, date, heure_debut, duree_minutes, forfait_id'),
  ])
  if (clientsError) throw clientsError
  if (error) throw error
  const toutes = (seancesData ?? []) as SeanceSync[]
  const existantes = toutes.filter(s => s.uid_calendrier)
  const parUid = new Map(existantes.map(s => [s.uid_calendrier as string, s]))
  const clients = tousClients as Client[]
  const actifs = clients.filter(c => c.actif)
  const archives = clients.filter(c => !c.actif)

  let imported = 0, lieesForfait = 0, updated = 0, deleted = 0, skipped = 0, doublonsEvites = 0
  const unmatched: string[] = []
  const clientsCrees: string[] = []
  const doublonsAVerifier: string[] = []
  const vus = new Set<string>()

  // Séance du même élève sur le même créneau qui n'est rattachée à aucun rendez-vous de ce calendrier
  const uidsCalendrier = new Set(events.map(e => e.uid))
  const jumelle = (clientId: string, date: string, heure: string | undefined, sauf?: SeanceSync) =>
    toutes.find(s => s !== sauf && s.client_id === clientId && s.date === date && memeCreneau(s.heure_debut, heure)
      && (!s.uid_calendrier || !uidsCalendrier.has(s.uid_calendrier)))

  // Rattache une séance existante au rendez-vous : le calendrier fait foi pour l'heure et la durée
  const relier = async (s: SeanceSync, event: CalendarEvent) => {
    const heure = event.heureDebut ?? s.heure_debut
    const duree = event.dureeMinutes ?? s.duree_minutes
    await seancesService.update(s.id, { uid_calendrier: event.uid, heure_debut: heure as any, duree_minutes: duree as any })
    Object.assign(s, { uid_calendrier: event.uid, heure_debut: heure, duree_minutes: duree })
  }
  const retirer = (s: SeanceSync) => toutes.splice(toutes.indexOf(s), 1)
  const nomClient = (id: string) => { const c = clients.find(c => c.id === id); return c ? `${c.prenom} ${c.nom}` : 'Élève' }

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
        Object.assign(existante, { date: event.date, heure_debut: heure, duree_minutes: duree })
        updated++
      } else {
        skipped++
      }

      // Doublon déjà en base (séance saisie à la main en plus de l'import) : on n'en garde qu'une
      const doublon = jumelle(existante.client_id, existante.date, event.heureDebut, existante)
      if (doublon) {
        if (await sansSuivi(existante)) {
          // La séance importée n'a rien d'enregistré : la séance saisie prend sa place
          await seancesService.delete(existante.id)
          retirer(existante)
          await relier(doublon, event)
          doublonsEvites++
        } else if (await sansSuivi(doublon)) {
          await seancesService.delete(doublon.id)
          retirer(doublon)
          doublonsEvites++
        } else {
          // Les deux ont un paiement ou un forfait : à trancher à la main
          doublonsAVerifier.push(`${nomClient(existante.client_id)} le ${existante.date.split('-').reverse().join('/')}`)
        }
      }
      continue
    }

    let client = matchClient(event.summary, actifs)
    if (!client) {
      // Élève archivé qui reprend : on le réactive plutôt que d'en créer un second
      const archive = matchClient(event.summary, archives)
      if (archive) {
        client = await clientsService.update(archive.id, { actif: true })
        archives.splice(archives.indexOf(archive), 1)
        actifs.push(client)
      }
    }
    if (!client) {
      // Nom et prénom entre crochets sans fiche : l'élève est créé automatiquement
      const fiche = nouvelEleve(event.summary)
      if (!fiche) { unmatched.push(event.summary); continue }
      // Faute de frappe probable : on ne crée pas de doublon, on signale l'événement
      const proche = clientProche(fiche, [...actifs, ...archives])
      if (proche) { unmatched.push(`${event.summary} (orthographe proche de ${proche.prenom} ${proche.nom} ?)`); continue }
      client = await clientsService.create(fiche)
      actifs.push(client)
      clientsCrees.push(`${client.prenom} ${client.nom}`)
    }

    // Séance déjà saisie à la main (ou importée d'un ancien calendrier) : on la relie au lieu d'en créer une
    const dejaSaisie = jumelle(client.id, event.date, event.heureDebut)
    if (dejaSaisie) {
      await relier(dejaSaisie, event)
      doublonsEvites++
      continue
    }

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

  // Seulement les séances encore en base : celles fusionnées ci-dessus sont déjà supprimées
  deleted = await supprimerDisparues(events, existantes.filter(s => toutes.includes(s)))

  if (imported > 0 || updated > 0 || deleted > 0 || doublonsEvites > 0) window.dispatchEvent(new Event(CALENDAR_SYNCED_EVENT))
  return { imported, lieesForfait, updated, deleted, skipped, unmatched, clientsCrees, doublonsEvites, doublonsAVerifier }
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
