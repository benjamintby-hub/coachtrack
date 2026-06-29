import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export interface StatsData {
  ca12mois: { mois: string; salle: number; particulier: number; total: number }[]
  topClients: { nom: string; ca: number; nbSeances: number }[]
  repartition: { name: string; value: number; color: string }[]
  tauxAnnulation: number
  delaiMoyenPaiement: number
  totalAnnee: number
}

export function useStats(annee: number) {
  const [stats, setStats] = useState<StatsData>({
    ca12mois: [],
    topClients: [],
    repartition: [],
    tauxAnnulation: 0,
    delaiMoyenPaiement: 0,
    totalAnnee: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const debut = `${annee}-01-01`
      const fin = `${annee}-12-31`

      const { data: seances } = await supabase
        .from('seances')
        .select('*, paiements(*), clients(nom, prenom)')
        .gte('date', debut)
        .lte('date', fin)

      if (!seances) { setLoading(false); return }

      // CA par mois
      const ca12mois = MOIS.map((mois, i) => {
        const m = String(i + 1).padStart(2, '0')
        const duMois = seances.filter(s => s.date.startsWith(`${annee}-${m}`) && s.statut_seance === 'done')
        const salle = duMois.filter(s => s.type === 'salle').reduce((acc, s) => acc + (s.paiements?.[0]?.montant_paye ?? 0), 0)
        const particulier = duMois.filter(s => s.type === 'particulier').reduce((acc, s) => acc + (s.paiements?.[0]?.montant_paye ?? 0), 0)
        return { mois, salle, particulier, total: salle + particulier }
      })

      // Top clients
      const clientMap: Record<string, { nom: string; ca: number; nbSeances: number }> = {}
      for (const s of seances) {
        if (s.statut_seance !== 'done') continue
        const key = s.client_id
        const nom = `${s.clients?.prenom} ${s.clients?.nom}`
        const montant = s.paiements?.[0]?.montant_paye ?? 0
        if (!clientMap[key]) clientMap[key] = { nom, ca: 0, nbSeances: 0 }
        clientMap[key].ca += montant
        clientMap[key].nbSeances++
      }
      const topClients = Object.values(clientMap)
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5)

      // Répartition salle/particulier
      const totalSalle = ca12mois.reduce((acc, m) => acc + m.salle, 0)
      const totalParticulier = ca12mois.reduce((acc, m) => acc + m.particulier, 0)
      const repartition = [
        { name: 'Salle', value: Math.round(totalSalle), color: '#3b82f6' },
        { name: 'Particuliers', value: Math.round(totalParticulier), color: '#10b981' },
      ]

      // Taux annulation
      const done = seances.filter(s => s.statut_seance === 'done').length
      const annulees = seances.filter(s => s.statut_seance === 'cancelled_client').length
      const tauxAnnulation = done + annulees > 0 ? Math.round((annulees / (done + annulees)) * 100) : 0

      // Délai moyen paiement (jours entre date séance et date_paiement)
      const delais: number[] = []
      for (const s of seances) {
        const p = s.paiements?.[0]
        if (p?.statut === 'paid' && p?.date_paiement) {
          const diff = (new Date(p.date_paiement).getTime() - new Date(s.date).getTime()) / 86400000
          if (diff >= 0 && diff < 365) delais.push(diff)
        }
      }
      const delaiMoyenPaiement = delais.length > 0 ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : 0

      const totalAnnee = ca12mois.reduce((acc, m) => acc + m.total, 0)

      setStats({ ca12mois, topClients, repartition, tauxAnnulation, delaiMoyenPaiement, totalAnnee })
      setLoading(false)
    }

    load()
  }, [annee])

  return { stats, loading }
}
