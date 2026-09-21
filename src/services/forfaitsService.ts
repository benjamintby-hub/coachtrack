import { supabase } from '@/lib/supabase'
import type { Client, Forfait, SeanceStatus } from '@/types'

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
    // Les séances rattachées redeviennent des séances à payer normalement
    const { data: liees } = await supabase
      .from('seances')
      .select('id, tarif, statut_seance')
      .eq('forfait_id', id)
    for (const s of liees ?? []) {
      await forfaitsService.delierSeance(s.id, s.tarif, s.statut_seance)
    }
    const { error } = await supabase.from('forfaits').delete().eq('id', id)
    if (error) throw error
  },

  // Achats de forfaits sur une période (encaissement BNC à la date d'achat)
  async getAchatsPeriode(debut: string, fin: string) {
    const { data: forfaits, error } = await supabase
      .from('forfaits')
      .select('*')
      .gte('date_achat', debut)
      .lte('date_achat', fin)
      .order('date_achat', { ascending: true })
    if (error) throw error
    if (!forfaits || forfaits.length === 0) return []

    const { data: clients } = await supabase
      .from('clients')
      .select('id, nom, prenom, type')
      .in('id', forfaits.map(f => f.client_id))
    const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]))

    return forfaits.map(f => ({
      ...(f as Forfait),
      client: clientMap[f.client_id] as Pick<Client, 'id' | 'nom' | 'prenom' | 'type'> | undefined,
    }))
  },

  // Forfait le plus récent de chaque client, avec le nombre de séances restantes
  async getRestantsParClient() {
    const { data: forfaits } = await supabase
      .from('forfaits')
      .select('*')
      .order('created_at', { ascending: false })
    const derniers: Record<string, Forfait> = {}
    for (const f of forfaits ?? []) {
      if (!derniers[f.client_id]) derniers[f.client_id] = f
    }
    const ids = Object.values(derniers).map(f => f.id)
    if (ids.length === 0) return {}

    const { data: utilisees } = await supabase
      .from('seances')
      .select('forfait_id')
      .in('forfait_id', ids)
      .eq('statut_seance', 'done')
    const nbUtilisees: Record<string, number> = {}
    for (const s of utilisees ?? []) nbUtilisees[s.forfait_id] = (nbUtilisees[s.forfait_id] ?? 0) + 1

    const restants: Record<string, { forfaitId: string; restantes: number }> = {}
    for (const [clientId, f] of Object.entries(derniers)) {
      restants[clientId] = { forfaitId: f.id, restantes: f.nb_seances - (nbUtilisees[f.id] ?? 0) }
    }
    return restants
  },

  // Rattache une séance au forfait : elle est réglée par le forfait, donc 0 € encaissé sur la séance
  async lierSeance(seanceId: string, forfaitId: string) {
    const { error } = await supabase.from('seances').update({ forfait_id: forfaitId }).eq('id', seanceId)
    if (error) throw error
    const { error: pError } = await supabase
      .from('paiements')
      .update({ montant_du: 0, montant_paye: 0, statut: 'paid', date_paiement: null })
      .eq('seance_id', seanceId)
    if (pError) throw pError
  },

  // Détache une séance du forfait : elle redevient due au tarif de la séance
  async delierSeance(seanceId: string, tarif: number, statutSeance: SeanceStatus) {
    const { error } = await supabase.from('seances').update({ forfait_id: null }).eq('id', seanceId)
    if (error) throw error
    const { error: pError } = await supabase
      .from('paiements')
      .update({
        montant_du: tarif,
        montant_paye: 0,
        statut: statutSeance === 'done' ? 'pending' : 'cancelled',
        date_paiement: null,
      })
      .eq('seance_id', seanceId)
    if (pError) throw pError
  },
}
