import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export interface StatsData {
  ca12mois: { mois: string; cash: number; transfer: number; total: number }[]
  topClients: { nom: string; ca: number; nbSeances: number }[]
  annulationsParClient: { nom: string; done: number; annulees: number; taux: number }[]
  repartition: { name: string; value: number; color: string }[]
  tauxAnnulation: number
  delaiMoyenPaiement: number
  totalAnnee: number
  totalCash: number
  totalTransfer: number
}

export function useStats(annee: number) {
  const [stats, setStats] = useState<StatsData>({
    ca12mois: [],
    topClients: [],
    annulationsParClient: [],
    repartition: [],
    tauxAnnulation: 0,
    delaiMoyenPaiement: 0,
    totalAnnee: 0,
    totalCash: 0,
    totalTransfer: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const debut = `${annee}-01-01`
      const fin = `${annee}-12-31`

      const { data: seancesRaw } = await supabase
        .from('seances')
        .select('*, clients(nom, prenom)')
        .gte('date', debut)
        .lte('date', fin)

      if (!seancesRaw) { setLoading(false); return }

      // Paiements récupérés séparément pour éviter les problèmes de join RLS
      const { data: paiementsRaw } = await supabase
        .from('paiements')
        .select('*')
        .in('seance_id', seancesRaw.map(s => s.id))

      const pMap: Record<string, any> = {}
      for (const p of paiementsRaw ?? []) pMap[p.seance_id] = p

      const seances = seancesRaw.map(s => ({ ...s, paiement: pMap[s.id] ?? null }))

      // CA par mois
      const ca12mois = MOIS.map((mois, i) => {
        const m = String(i + 1).padStart(2, '0')
        const duMois = seances.filter(s => s.date.startsWith(`${annee}-${m}`) && s.statut_seance === 'done')
        const cash = duMois.filter(s => s.paiement?.mode === 'cash').reduce((acc, s) => acc + (s.paiement?.montant_paye ?? 0), 0)
        const transfer = duMois.filter(s => s.paiement?.mode === 'transfer').reduce((acc, s) => acc + (s.paiement?.montant_paye ?? 0), 0)
        const total = duMois.reduce((acc, s) => acc + (s.paiement?.montant_paye ?? 0), 0)
        return { mois, cash, transfer, total }
      })

      // Top clients
      const clientMap: Record<string, { nom: string; ca: number; nbSeances: number }> = {}
      for (const s of seances) {
        if (s.statut_seance !== 'done') continue
        const key = s.client_id
        const nom = `${s.clients?.prenom} ${s.clients?.nom}`
        const montant = s.paiement?.montant_paye ?? 0
        if (!clientMap[key]) clientMap[key] = { nom, ca: 0, nbSeances: 0 }
        clientMap[key].ca += montant
        clientMap[key].nbSeances++
      }
      const topClients = Object.values(clientMap)
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5)

      // Répartition espèces/virement
      const totalCash = ca12mois.reduce((acc, m) => acc + m.cash, 0)
      const totalTransfer = ca12mois.reduce((acc, m) => acc + m.transfer, 0)
      const repartition = [
        { name: 'Espèces', value: Math.round(totalCash), color: '#10b981' },
        { name: 'Virement', value: Math.round(totalTransfer), color: '#3b82f6' },
      ]

      // Taux annulation global
      const done = seances.filter(s => s.statut_seance === 'done').length
      const annulees = seances.filter(s => s.statut_seance === 'cancelled_client').length
      const tauxAnnulation = done + annulees > 0 ? Math.round((annulees / (done + annulees)) * 100) : 0

      // Taux annulation par client
      const annulMap: Record<string, { nom: string; done: number; annulees: number }> = {}
      for (const s of seances) {
        if (s.statut_seance !== 'done' && s.statut_seance !== 'cancelled_client') continue
        const key = s.client_id
        const nom = `${s.clients?.prenom} ${s.clients?.nom}`
        if (!annulMap[key]) annulMap[key] = { nom, done: 0, annulees: 0 }
        if (s.statut_seance === 'done') annulMap[key].done++
        else annulMap[key].annulees++
      }
      const annulationsParClient = Object.values(annulMap)
        .map(c => ({
          ...c,
          taux: Math.round((c.annulees / (c.done + c.annulees)) * 100),
        }))
        .filter(c => c.annulees > 0)
        .sort((a, b) => b.taux - a.taux)

      // Délai moyen paiement (jours entre date séance et date_paiement)
      const delais: number[] = []
      for (const s of seances) {
        const p = s.paiement
        if (p?.statut === 'paid' && p?.date_paiement) {
          const diff = (new Date(p.date_paiement).getTime() - new Date(s.date).getTime()) / 86400000
          if (diff >= 0 && diff < 365) delais.push(diff)
        }
      }
      const delaiMoyenPaiement = delais.length > 0 ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : 0

      const totalAnnee = ca12mois.reduce((acc, m) => acc + m.total, 0)

      setStats({ ca12mois, topClients, annulationsParClient, repartition, tauxAnnulation, delaiMoyenPaiement, totalAnnee, totalCash, totalTransfer })
      setLoading(false)
    }

    load()
  }, [annee])

  return { stats, loading }
}
