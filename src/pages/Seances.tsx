import { useState } from 'react'
import { useSeances } from '@/hooks/useSeances'
import { useClients } from '@/hooks/useClients'
import { usePaiements } from '@/hooks/usePaiements'
import SeanceForm from '@/components/SeanceForm'
import ClientBadge from '@/components/ClientBadge'
import PaymentBadge from '@/components/PaymentBadge'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Seance, ClientType } from '@/types'

type Filter = 'tous' | ClientType

const statutSeanceLabels: Record<string, string> = {
  done: 'Réalisée',
  cancelled_client: 'Annulée (client)',
  cancelled_coach: 'Annulée (coach)',
  postponed: 'Reportée',
}

export default function Seances() {
  const { seances, loading, error, createSeance, updateSeance, deleteSeance } = useSeances()
  const { clients } = useClients()
  const { paiements, updatePaiementStatut } = usePaiements()
  const [filter, setFilter] = useState<Filter>('tous')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = seances.filter(s => filter === 'tous' || s.type === filter)

  const handleCreate = async (data: Omit<Seance, 'id' | 'created_at'>) => {
    await createSeance(data)
    setShowForm(false)
  }

  const handleUpdate = async (data: Omit<Seance, 'id' | 'created_at'>) => {
    if (!editing) return
    await updateSeance(editing.id, data)
    setEditing(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Séances</h1>
          <p className="text-gray-500 text-sm mt-0.5">{seances.length} séance{seances.length > 1 ? 's' : ''} enregistrée{seances.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nouvelle séance
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4">
        {(['tous', 'particulier', 'salle'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'tous' ? 'Toutes' : f === 'salle' ? 'Salle' : 'Particuliers'}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Chargement...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>Aucune séance enregistrée.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm hover:underline">
            Ajouter la première séance
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="flex flex-col gap-2">
        {filtered.map(seance => {
          const paiement = paiements.find(p => p.seance_id === seance.id)
          return (
            <div key={seance.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="text-sm text-gray-500 w-24 shrink-0">{formatDate(seance.date)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">
                    {seance.clients?.prenom} {seance.clients?.nom}
                  </span>
                  <ClientBadge type={seance.type} />
                  <span className="text-xs text-gray-400">{statutSeanceLabels[seance.statut_seance]}</span>
                </div>
                {seance.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{seance.notes}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium text-gray-700">{formatCurrency(seance.tarif)}</span>
                {paiement && (
                  <select
                    value={paiement.statut}
                    onChange={e => updatePaiementStatut(paiement.id, e.target.value as any)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="pending">En attente</option>
                    <option value="paid">Payé</option>
                    <option value="partial">Partiel</option>
                    <option value="late">En retard</option>
                    <option value="offered">Offert</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                )}
                {paiement && <PaymentBadge statut={paiement.statut} />}
              </div>
              <button
                onClick={() => setEditing(seance)}
                className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors shrink-0"
              >
                Modifier
              </button>
              <button
                onClick={() => setConfirmDelete(seance.id)}
                className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0"
              >
                Supprimer
              </button>
            </div>
          )
        })}
      </div>

      {/* Modal création */}
      {showForm && (
        <Modal title="Nouvelle séance" onClose={() => setShowForm(false)}>
          <SeanceForm clients={clients} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {/* Confirmation suppression */}
      {confirmDelete && (
        <Modal title="Supprimer cette séance ?" onClose={() => setConfirmDelete(null)}>
          <p className="text-gray-600 text-sm mb-4">La séance et son paiement associé seront définitivement supprimés.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button
              onClick={async () => { await deleteSeance(confirmDelete); setConfirmDelete(null) }}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      {/* Modal édition */}
      {editing && (
        <Modal title="Modifier la séance" onClose={() => setEditing(null)}>
          <SeanceForm clients={clients} initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
