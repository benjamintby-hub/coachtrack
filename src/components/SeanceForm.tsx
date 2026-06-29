import { useState } from 'react'
import type { Client, Seance, SeanceStatus } from '@/types'

interface Props {
  clients: Client[]
  initial?: Partial<Seance>
  onSubmit: (data: Omit<Seance, 'id' | 'created_at'>) => Promise<void>
  onCancel: () => void
}

const statutLabels: Record<SeanceStatus, string> = {
  done: 'Réalisée',
  cancelled_client: 'Annulée (client)',
  cancelled_coach: 'Annulée (coach)',
  postponed: 'Reportée',
}

export default function SeanceForm({ clients, initial, onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? '',
    date: initial?.date ?? today,
    heure_debut: initial?.heure_debut ?? '',
    duree_minutes: initial?.duree_minutes?.toString() ?? '60',
    tarif: initial?.tarif?.toString() ?? '',
    statut_seance: (initial?.statut_seance ?? 'done') as SeanceStatus,
    type: initial?.type ?? 'particulier' as const,
    notes: initial?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    setForm(f => ({
      ...f,
      client_id: clientId,
      type: client?.type ?? f.type,
      tarif: client?.tarif_defaut?.toString() ?? f.tarif,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id) { setError('Sélectionne un client'); return }
    if (!form.tarif) { setError('Indique un tarif'); return }
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        client_id: form.client_id,
        date: form.date,
        heure_debut: form.heure_debut || undefined,
        duree_minutes: form.duree_minutes ? parseInt(form.duree_minutes) : undefined,
        tarif: parseFloat(form.tarif),
        statut_seance: form.statut_seance,
        type: form.type,
        notes: form.notes || undefined,
      })
    } catch {
      setError('Une erreur est survenue.')
      setLoading(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {field('Client *', (
        <select className={inputClass} value={form.client_id} onChange={e => handleClientChange(e.target.value)} required>
          <option value="">— Sélectionner un client —</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.prenom} {c.nom} ({c.type})</option>
          ))}
        </select>
      ))}

      <div className="grid grid-cols-2 gap-4">
        {field('Date *', (
          <input className={inputClass} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        ))}
        {field('Heure de début', (
          <input className={inputClass} type="time" value={form.heure_debut} onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field('Durée (minutes)', (
          <input className={inputClass} type="number" min="15" step="15" value={form.duree_minutes} onChange={e => setForm(f => ({ ...f, duree_minutes: e.target.value }))} />
        ))}
        {field('Tarif (€) *', (
          <input className={inputClass} type="number" min="0" step="0.01" value={form.tarif} onChange={e => setForm(f => ({ ...f, tarif: e.target.value }))} placeholder="50" required />
        ))}
      </div>

      {field('Statut de la séance', (
        <select className={inputClass} value={form.statut_seance} onChange={e => setForm(f => ({ ...f, statut_seance: e.target.value as SeanceStatus }))}>
          {Object.entries(statutLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      ))}

      {field('Notes', (
        <textarea className={inputClass} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Remarques..." />
      ))}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
