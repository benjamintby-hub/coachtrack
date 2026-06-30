import { supabase } from '@/lib/supabase'
import type { Paiement, PaymentStatus } from '@/types'

export const paiementsService = {
  async getBySeance(seanceId: string) {
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .eq('seance_id', seanceId)
      .single()
    if (error) throw error
    return data as Paiement
  },

  async create(paiement: Omit<Paiement, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('paiements')
      .insert(paiement)
      .select()
      .single()
    if (error) throw error
    return data as Paiement
  },

  async updateStatut(id: string, statut: PaymentStatus, montantPaye?: number) {
    const updates: Partial<Paiement> = { statut }

    if (statut === 'paid') {
      // Récupère montant_du pour mettre montant_paye à jour automatiquement
      const { data: current } = await supabase.from('paiements').select('montant_du').eq('id', id).single()
      updates.montant_paye = montantPaye ?? current?.montant_du ?? 0
      updates.date_paiement = new Date().toISOString()
    } else if (montantPaye !== undefined) {
      updates.montant_paye = montantPaye
    }
    const { data, error } = await supabase
      .from('paiements')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Paiement
  },

  async updateMode(id: string, mode: string) {
    const { data, error } = await supabase
      .from('paiements')
      .update({ mode })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Paiement
  },
}
