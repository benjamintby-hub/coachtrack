import { supabase } from '@/lib/supabase'
import type { Forfait } from '@/types'

export const forfaitsService = {
  async getByClient(clientId: string) {
    const { data } = await supabase
      .from('forfaits')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as Forfait | null
  },

  async create(forfait: Omit<Forfait, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('forfaits')
      .insert(forfait)
      .select()
      .single()
    if (error) throw error
    return data as Forfait
  },

  async update(id: string, updates: Partial<Pick<Forfait, 'nb_seances' | 'prix_total' | 'date_achat'>>) {
    const { data, error } = await supabase
      .from('forfaits')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Forfait
  },

  async delete(id: string) {
    const { error } = await supabase.from('forfaits').delete().eq('id', id)
    if (error) throw error
  },
}
