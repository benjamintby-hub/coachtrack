import { useEffect, useState } from 'react'
import { seancesService } from '@/services/seancesService'
import { paiementsService } from '@/services/paiementsService'
import type { Seance } from '@/types'

export function useSeances() {
  const [seances, setSeances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await seancesService.getAll()
      setSeances(data)
    } catch {
      setError('Impossible de charger les séances')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createSeance = async (seance: Omit<Seance, 'id' | 'created_at'>) => {
    const newSeance = await seancesService.create(seance)
    // Créer automatiquement le paiement associé
    await paiementsService.create({
      seance_id: newSeance.id,
      montant_du: seance.tarif,
      montant_paye: 0,
      statut: seance.statut_seance === 'done' ? 'pending' : 'cancelled',
    })
    await load()
    return newSeance
  }

  const updateSeance = async (id: string, updates: Partial<Seance>) => {
    await seancesService.update(id, updates)
    await load()
  }

  const deleteSeance = async (id: string) => {
    await seancesService.delete(id)
    setSeances(prev => prev.filter(s => s.id !== id))
  }

  return { seances, loading, error, createSeance, updateSeance, deleteSeance }
}
