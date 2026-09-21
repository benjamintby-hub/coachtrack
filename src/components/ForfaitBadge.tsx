export default function ForfaitBadge({ label = 'Forfait' }: { label?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-600">
      {label}
    </span>
  )
}
