export type ClientType = 'salle' | 'particulier'
export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'late' | 'offered' | 'cancelled'
export type PaymentMode = 'cash' | 'transfer' | 'check' | 'card' | 'other'
export type SeanceStatus = 'done' | 'cancelled_client' | 'cancelled_coach' | 'postponed'
export type DeclarationFrequency = 'monthly' | 'quarterly'

export interface Client {
  id: string
  created_at: string
  nom: string
  prenom: string
  email?: string
  telephone?: string
  type: ClientType
  tarif_defaut?: number
  mode_paiement_defaut?: PaymentMode
  notes?: string
  actif: boolean
}

export interface Seance {
  id: string
  client_id: string
  date: string
  heure_debut?: string
  duree_minutes?: number
  tarif: number
  statut_seance: SeanceStatus
  uid_calendrier?: string
  type: ClientType
  notes?: string
  created_at: string
}

export interface Paiement {
  id: string
  seance_id: string
  montant_du: number
  montant_paye: number
  mode?: PaymentMode
  statut: PaymentStatus
  date_paiement?: string
  notes?: string
  created_at: string
}

export interface Parametres {
  id: string
  user_id: string
  frequence_declaration: DeclarationFrequency
  seuil_alerte_retard_jours: number
  devise: string
  convention_calendrier: string
}
