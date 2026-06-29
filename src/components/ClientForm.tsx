import { useState } from 'react'
import type { Client, ClientType, PaymentMode } from '@/types'

interface Props {
  initial?: Partial<Client>
  onSubmit: (data: Omit<Client, 'id' | 'created_at'>) => Promise<void>
  onCancel: () => void
}

const modeLabels: Record<PaymentMode, string> = {
  cash: 'Espèces',
  transfer: 'Virement',
  check: 'Chèque',
  card: 'Carte bancaire',
  other: 'Autre',
}

export default function ClientForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    nom: initial?.nom ?? '',
    prenom: initial?.prenom ?? '',
    email: initial?.email ?? '',
    telephone: initial?.telephone ?? '',
    type: (initial?.type ?? 'particulier') as ClientType,
    tarif_defaut: initial?.tarif_defaut?.toString() ?? '',
    mode_paiement_defaut: (initial?.mode_paiement_defaut ?? '') as PaymentMode | '',
    notes: initial?.notes ?? '',
    actif: initial?.actif ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        type: form.type,
        tarif_defaut: form.tarif_defaut ? parseFloat(form.tarif_defaut) : undefined,
        mode_paiement_defaut: form.mode_paiement_defaut || undefined,
        notes: form.notes || undefined,
        actif: form.actif,
      })
    } catch {
      setError('Une erreur est survenue, réessaie.')
      setLoading(false)
    }
  }

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {field('Nom *', (
          <input className={inputClass} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required placeholder="DUPONT" />
        ))}
        {field('Prénom *', (
          <input className={inputClass} value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} required placeholder="Jean" />
        ))}
      </div>

      {field('Type de client *', (
        <div className="flex gap-3">
          {(['particulier', 'salle'] as ClientType[]).map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                checked={form.type === t}
                onChange={() => setForm(f => ({ ...f, type: t }))}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{t === 'salle' ? 'Salle' : 'Particulier'}</span>
            </label>
          ))}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4">
        {field('Email', (
          <input className={inputClass} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jean@email.com" />
        ))}
        {field('Téléphone', (
          <input className={inputClass} value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="06 00 00 00 00" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field('Tarif par défaut (€)', (
          <input className={inputClass} type="number" min="0" step="0.01" value={form.tarif_defaut} onChange={e => setForm(f => ({ ...f, tarif_defaut: e.target.value }))} placeholder="50" />
        ))}
        {field('Mode de paiement préféré', (
          <select className={inputClass} value={form.mode_paiement_defaut} onChange={e => setForm(f => ({ ...f, mode_paiement_defaut: e.target.value as PaymentMode }))}>
            <option value="">— Non défini —</option>
            {Object.entries(modeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        ))}
      </div>

      {field('Notes', (
        <textarea className={inputClass} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Informations supplémentaires..." />
      ))}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
