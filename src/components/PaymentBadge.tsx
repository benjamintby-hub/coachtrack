import type { PaymentStatus } from '@/types'
import { paymentStatusConfig } from '@/utils/paymentStatus'

export default function PaymentBadge({ statut }: { statut: PaymentStatus }) {
  const { label, className } = paymentStatusConfig[statut] ?? paymentStatusConfig.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
