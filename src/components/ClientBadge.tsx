import type { ClientType } from '@/types'

interface Props {
  type: ClientType
}

export default function ClientBadge({ type }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      type === 'salle'
        ? 'bg-info/12 text-info'
        : 'bg-sand/10 text-sand'
    }`}>
      {type === 'salle' ? 'Salle' : 'Particulier'}
    </span>
  )
}
