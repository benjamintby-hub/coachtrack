import { supabase } from '@/lib/supabase'
import type { Seance } from '@/types'

export const seancesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('seances')
      .select('*, clients(nom, prenom, type)')
      .order('date', { ascending: false })
    if (error) throw error
    return data
  },

  async create(seance: Omit<Seance, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('seances')
      .insert(seance)
      .select()
      .single()
    if (error) throw error
    return data as Seance
  },

  async update(id: string, updates: Partial<Seance>) {
    const { data, error } = await supabase
      .from('seances')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Seance
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('seances')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
