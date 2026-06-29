import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DashboardStats {
  caEncaisse: number
  caEncaisseSalle: number
  caEncaisseParticulier: number
  enAttente: number
  nbSeances: number
  nbSeancesSalle: number
  nbSeancesParticulier: number
  nbImpayés: number
}

export function useDashboard(mois: number, annee: number, refreshKey = 0) {
  const [stats, setStats] = useState<DashboardStats>({
    caEncaisse: 0,
    caEncaisseSalle: 0,
    caEncaisseParticulier: 0,
    enAttente: 0,
    nbSeances: 0,
    nbSeancesSalle: 0,
    nbSeancesParticulier: 0,
    nbImpayés: 0,
  })
  const [seancesRecentes, setSeancesRecentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
      const fin = new Date(annee, mois, 0).toISOString().split('T')[0]

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
      let enAttente = 0, nbImpayés = 0
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
        } else if (p.statut === 'pending' || p.statut === 'late') {
          enAttente += p.montant_du
          nbImpayés++
        }
      }

      setStats({ caEncaisse, caEncaisseSalle, caEncaisseParticulier, enAttente, nbSeances, nbSeancesSalle, nbSeancesParticulier, nbImpayés })
      setSeancesRecentes(seances.slice(0, 8))
      setLoading(false)
    }

    load()
  }, [mois, annee, refreshKey])

  return { stats, seancesRecentes, loading }
}
