import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { paiementsService } from '@/services/paiementsService'
import type { Paiement, PaymentStatus } from '@/types'

export function usePaiements() {
  const [paiements, setPaiements] = useState<Paiement[]>([])

  const load = async () => {
    const { data } = await supabase.from('paiements').select('*')
    if (data) setPaiements(data as Paiement[])
  }

  useEffect(() => { load() }, [])

  const updatePaiementStatut = async (id: string, statut: PaymentStatus, montantPaye?: number) => {
    const updated = await paiementsService.updateStatut(id, statut, montantPaye)
    setPaiements(prev => prev.map(p => p.id === id ? updated : p))
  }

  const updatePaiementMode = async (id: string, mode: string) => {
    const updated = await paiementsService.updateMode(id, mode)
    setPaiements(prev => prev.map(p => p.id === id ? updated : p))
  }

  return { paiements, updatePaiementStatut, updatePaiementMode, reload: load }
}
