import { supabase } from '@/lib/supabase'
import type { Client, Forfait, SeanceStatus } from '@/types'

export interface ForfaitAvecUsage extends Forfait {
  utilisees: number
  restantes: number
}

// Nombre de séances réalisées rattachées à chacun de ces forfaits
async function compterUtilisees(forfaitIds: string[]): Promise<Record<string, number>> {
  if (forfaitIds.length === 0) return {}
  const { data, error } = await supabase
    .from('seances')
    .select('forfait_id')
    .in('forfait_id', forfaitIds)
    .eq('statut_seance', 'done')
  if (error) throw error
  const nb: Record<string, number> = {}
  for (const s of data ?? []) nb[s.forfait_id] = (nb[s.forfait_id] ?? 0) + 1
  return nb
}

export const forfaitsService = {
  // Tous les forfaits d'un client, du plus récent au plus ancien, avec leur consommation.
  // Un client peut en enchaîner plusieurs : les anciens restent, ils portent l'historique.
  async getByClient(clientId: string): Promise<ForfaitAvecUsage[]> {
    const { data, error } = await supabase
      .from('forfaits')
      .select('*')
      .eq('client_id', clientId)
      .order('date_achat', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    const forfaits = (data ?? []) as Forfait[]
    const nb = await compterUtilisees(forfaits.map(f => f.id))
    return forfaits.map(f => ({ ...f, utilisees: nb[f.id] ?? 0, restantes: f.nb_seances - (nb[f.id] ?? 0) }))
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

  // Forfait à consommer pour chaque client : le plus ancien qui a encore des séances.
  // Un client peut avoir plusieurs forfaits ; on vide le plus ancien d'abord.
  async getRestantsParClient() {
    const { data, error } = await supabase
      .from('forfaits')
      .select('*')
      .order('date_achat', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    const forfaits = (data ?? []) as Forfait[]
    const nbUtilisees = await compterUtilisees(forfaits.map(f => f.id))

    const restants: Record<string, { forfaitId: string; restantes: number }> = {}
    for (const f of forfaits) {
      if (restants[f.client_id]) continue
      const restantes = f.nb_seances - (nbUtilisees[f.id] ?? 0)
      if (restantes > 0) restants[f.client_id] = { forfaitId: f.id, restantes }
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
