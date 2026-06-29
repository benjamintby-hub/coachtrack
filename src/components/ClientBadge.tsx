import type { ClientType } from '@/types'

interface Props {
  type: ClientType
}

export default function ClientBadge({ type }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      type === 'salle'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-green-100 text-green-700'
    }`}>
      {type === 'salle' ? 'Salle' : 'Particulier'}
    </span>
  )
}
