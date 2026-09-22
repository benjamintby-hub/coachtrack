import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { forfaitsService } from '@/services/forfaitsService'
import { toISODate } from '@/utils/formatters'

export interface DashboardStats {
  caEncaisse: number
  caEncaisseSalle: number
  caEncaisseParticulier: number
  enAttente: number
  enRetard: number
  nbSeances: number
  nbSeancesSalle: number
  nbSeancesParticulier: number
  nbImpayés: number
}

export type VueSeances = 'mois' | 'semaine' | 'jour'

// Bornes de la semaine en cours (lundi → dimanche) ou du jour
function bornesVue(vue: Exclude<VueSeances, 'mois'>): [string, string] {
  const today = new Date()
  if (vue === 'jour') return [toISODate(today), toISODate(today)]
  const lundi = new Date(today)
  lundi.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const dimanche = new Date(lundi)
  dimanche.setDate(lundi.getDate() + 6)
  return [toISODate(lundi), toISODate(dimanche)]
}

export function useDashboard(mois: number, annee: number, refreshKey = 0, vue: VueSeances = 'mois') {
  const [stats, setStats] = useState<DashboardStats>({
    caEncaisse: 0,
    caEncaisseSalle: 0,
    caEncaisseParticulier: 0,
    enAttente: 0,
    enRetard: 0,
    nbSeances: 0,
    nbSeancesSalle: 0,
    nbSeancesParticulier: 0,
    nbImpayés: 0,
  })
  const [seancesMois, setSeancesMois] = useState<any[]>([])
  const [seancesPeriode, setSeancesPeriode] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
      const fin = toISODate(new Date(annee, mois, 0))

      // Séances du mois
      const { data: seances } = await supabase
        .from('seances')
        .select('*, paiements(*), clients(nom, prenom, type)')
        .gte('date', debut)
        .lte('date', fin)
        .eq('statut_seance', 'done')
        .order('date', { ascending: false })

      if (!seances) { setLoading(false); return }

      let caEncaisse = 0, caEncaisseSalle = 0, caEncaisseParticulier = 0
      let enAttente = 0, enRetard = 0, nbImpayés = 0
      let nbSeances = 0, nbSeancesSalle = 0, nbSeancesParticulier = 0

      for (const s of seances) {
        nbSeances++
        if (s.type === 'salle') nbSeancesSalle++
        else nbSeancesParticulier++

        const p = s.paiements?.[0]
        if (!p) continue

        if (p.statut === 'paid') {
          caEncaisse += p.montant_paye
          if (s.type === 'salle') caEncaisseSalle += p.montant_paye
          else caEncaisseParticulier += p.montant_paye
        } else if (p.statut === 'partial') {
          caEncaisse += p.montant_paye
          if (s.type === 'salle') caEncaisseSalle += p.montant_paye
          else caEncaisseParticulier += p.montant_paye
          enAttente += (p.montant_du - p.montant_paye)
          nbImpayés++
        } else if (p.statut === 'pending') {
          enAttente += p.montant_du
          nbImpayés++
        } else if (p.statut === 'late') {
          enAttente += p.montant_du
          enRetard += p.montant_du
          nbImpayés++
        }
      }

      // Forfaits achetés ce mois : encaissés à la date d'achat
      const achats = await forfaitsService.getAchatsPeriode(debut, fin)
      for (const f of achats) {
        const montant = f.prix_total ?? 0
        caEncaisse += montant
        if (f.client?.type === 'salle') caEncaisseSalle += montant
        else caEncaisseParticulier += montant
      }

      setStats({ caEncaisse, caEncaisseSalle, caEncaisseParticulier, enAttente, enRetard, nbSeances, nbSeancesSalle, nbSeancesParticulier, nbImpayés })
      setSeancesMois(seances.slice(0, 8))
      setLoading(false)
    }

    load()
  }, [mois, annee, refreshKey])

  // Séances de la semaine ou du jour, indépendamment du mois sélectionné
  useEffect(() => {
    if (vue === 'mois') return
    const [debut, fin] = bornesVue(vue)
    supabase
      .from('seances')
      .select('*, paiements(*), clients(nom, prenom, type)')
      .gte('date', debut)
      .lte('date', fin)
      .eq('statut_seance', 'done')
      .order('date', { ascending: true })
      .order('heure_debut', { ascending: true })
      .then(({ data }) => setSeancesPeriode(data ?? []))
  }, [vue, refreshKey])

  const seancesRecentes = vue === 'mois' ? seancesMois : seancesPeriode

  return { stats, seancesRecentes, loading }
}
