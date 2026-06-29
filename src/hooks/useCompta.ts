import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface LigneCompta {
  date: string
  client: string
  type: 'salle' | 'particulier'
  tarif: number
  montant_paye: number
  montant_du: number
  statut: string
  mode?: string
  date_paiement?: string
}

export interface ComptaStats {
  caDeclarable: number
  caDeclarableSalle: number
  caDeclarableParticulier: number
  enAttente: number
  nbSeancesDone: number
  nbOfferts: number
  nbAnnules: number
  lignes: LigneCompta[]
}

const modeLabels: Record<string, string> = {
  cash: 'Espèces',
  transfer: 'Virement',
  check: 'Chèque',
  card: 'Carte',
  other: 'Autre',
}

export function useCompta(mois: number, annee: number) {
  const [stats, setStats] = useState<ComptaStats>({
    caDeclarable: 0,
    caDeclarableSalle: 0,
    caDeclarableParticulier: 0,
    enAttente: 0,
    nbSeancesDone: 0,
    nbOfferts: 0,
    nbAnnules: 0,
    lignes: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
      const fin = new Date(annee, mois, 0).toISOString().split('T')[0]

      const { data: seances } = await supabase
        .from('seances')
        .select('*, paiements(*), clients(nom, prenom)')
        .gte('date', debut)
        .lte('date', fin)
        .order('date', { ascending: true })

      if (!seances) { setLoading(false); return }

      let caDeclarable = 0, caDeclarableSalle = 0, caDeclarableParticulier = 0
      let enAttente = 0, nbSeancesDone = 0, nbOfferts = 0, nbAnnules = 0
      const lignes: LigneCompta[] = []

      for (const s of seances) {
        const p = s.paiements?.[0]
        if (!p) continue

        if (s.statut_seance === 'done') nbSeancesDone++
        if (p.statut === 'offered') nbOfferts++
        if (p.statut === 'cancelled') nbAnnules++

        if (p.statut === 'paid' || p.statut === 'partial') {
          caDeclarable += p.montant_paye
          if (s.type === 'salle') caDeclarableSalle += p.montant_paye
          else caDeclarableParticulier += p.montant_paye
        }
        if (p.statut === 'pending' || p.statut === 'late') {
          enAttente += p.montant_du
        }
        if (p.statut === 'partial') {
          enAttente += (p.montant_du - p.montant_paye)
        }

        lignes.push({
          date: s.date,
          client: `${s.clients?.prenom} ${s.clients?.nom}`,
          type: s.type,
          tarif: s.tarif,
          montant_du: p.montant_du,
          montant_paye: p.montant_paye,
          statut: p.statut,
          mode: p.mode ? modeLabels[p.mode] : undefined,
          date_paiement: p.date_paiement,
        })
      }

      setStats({ caDeclarable, caDeclarableSalle, caDeclarableParticulier, enAttente, nbSeancesDone, nbOfferts, nbAnnules, lignes })
      setLoading(false)
    }

    load()
  }, [mois, annee])

  return { stats, loading }
}
