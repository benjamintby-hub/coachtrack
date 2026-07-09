import { supabase } from '@/lib/supabase'
import type { Client, ClientType } from '@/types'

export const clientsService = {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Client
  },

  async getAll() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })
    if (error) throw error
    return data as Client[]
  },

  async create(client: Omit<Client, 'id' | 'created_at'>) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...client, user_id: user?.id })
      .select()
      .single()
    if (error) throw error
    return data as Client
  },

  async update(id: string, updates: Partial<Client>) {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Client
  },

  async archive(id: string) {
    const { error } = await supabase
      .from('clients')
      .update({ actif: false })
      .eq('id', id)
    if (error) throw error
  },
}
