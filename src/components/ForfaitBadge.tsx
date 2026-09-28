export default function ForfaitBadge({ label = 'Forfait' }: { label?: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-info/12 text-info">
      {label}
    </span>
  )
}
