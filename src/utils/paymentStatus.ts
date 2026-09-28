import type { PaymentStatus } from '@/types'

// Libellé et couleurs de chaque statut de paiement (pastilles, teintes sourdes sur fond sombre)
export const paymentStatusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  paid:      { label: 'Payé',       className: 'bg-ok/12 text-ok' },
  pending:   { label: 'En attente', className: 'bg-white/8 text-ink2' },
  partial:   { label: 'Partiel',    className: 'bg-wait/12 text-wait' },
  late:      { label: 'En retard',  className: 'bg-late/12 text-late' },
  offered:   { label: 'Offert',     className: 'bg-white/6 text-muted' },
  cancelled: { label: 'Annulé',     className: 'bg-white/6 text-faint line-through' },
}
