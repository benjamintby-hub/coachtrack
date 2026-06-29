import type { PaymentStatus } from '@/types'

const config: Record<PaymentStatus, { label: string; className: string }> = {
  paid:      { label: 'Payé',      className: 'bg-green-100 text-green-700' },
  pending:   { label: 'En attente', className: 'bg-blue-100 text-blue-700' },
  partial:   { label: 'Partiel',   className: 'bg-orange-100 text-orange-700' },
  late:      { label: 'En retard', className: 'bg-red-100 text-red-700' },
  offered:   { label: 'Offert',    className: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Annulé',    className: 'bg-gray-100 text-gray-400 line-through' },
}

export default function PaymentBadge({ statut }: { statut: PaymentStatus }) {
  const { label, className } = config[statut] ?? config.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
