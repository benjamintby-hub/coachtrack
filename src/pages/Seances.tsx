import { useState } from 'react'
import { X } from 'lucide-react'
import { useSeances } from '@/hooks/useSeances'
import { useClients } from '@/hooks/useClients'
import { usePaiements } from '@/hooks/usePaiements'
import SeanceForm, { type SeanceFormData } from '@/components/SeanceForm'
import ClientBadge from '@/components/ClientBadge'
import PaymentBadge from '@/components/PaymentBadge'
import { StatutSelect } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { ClientType } from '@/types'

const modeLabels: Record<string, string> = { cash: 'Espèces', transfer: 'Virement' }

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
  const { paiements, updatePaiementStatut, updatePaiementMode } = usePaiements()
  const [filter, setFilter] = useState<Filter>('tous')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = seances.filter(s => filter === 'tous' || s.type === filter)

  const handleCreate = async (data: SeanceFormData) => {
    const { moyen_paiement, ...seanceData } = data
    await createSeance(seanceData, moyen_paiement)
    setShowForm(false)
  }

  const handleUpdate = async (data: SeanceFormData) => {
    if (!editing) return
    const { moyen_paiement, ...seanceData } = data
    await updateSeance(editing.id, seanceData)
    if (moyen_paiement !== undefined) {
      const paiement = paiements.find(p => p.seance_id === editing.id)
      if (paiement) await updatePaiementMode(paiement.id, moyen_paiement)
    }
    setEditing(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Séances</h1>
          <p className="text-muted text-sm mt-0.5">{seances.length} séance{seances.length > 1 ? 's' : ''} enregistrée{seances.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-accent text-accent-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent2 transition-colors"
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
              filter === f ? 'bg-accent text-accent-ink' : 'bg-card text-muted border border-hair hover:border-hair'
            }`}
          >
            {f === 'tous' ? 'Toutes' : f === 'salle' ? 'Salle' : 'Particuliers'}
          </button>
        ))}
      </div>

      {loading && <p className="text-faint text-sm">Chargement...</p>}
      {error && <p className="text-late text-sm">{error}</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-faint">
          <p>Aucune séance enregistrée.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-accent text-sm hover:underline">
            Ajouter la première séance
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="flex flex-col gap-2">
        {filtered.map(seance => {
          const paiement = paiements.find(p => p.seance_id === seance.id)
          return (
            <div key={seance.id} className="bg-card border border-hair rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="text-sm text-muted w-24 shrink-0">{formatDate(seance.date)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink">
                    {seance.clients?.prenom} {seance.clients?.nom}
                  </span>
                  <ClientBadge type={seance.type} />
                  <span className="text-xs text-faint">{statutSeanceLabels[seance.statut_seance]}</span>
                </div>
                {seance.notes && <p className="text-xs text-faint mt-0.5 truncate">{seance.notes}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium text-ink2">{formatCurrency(seance.tarif)}</span>
                {paiement?.mode && (
                  <span className="text-xs text-muted bg-white/8 px-2 py-0.5 rounded-full">
                    {modeLabels[paiement.mode] ?? paiement.mode}
                  </span>
                )}
                {paiement && (
                  <StatutSelect
                    statut={paiement.statut}
                    onChange={statut => updatePaiementStatut(paiement.id, statut)}
                  />
                )}
                {paiement && <PaymentBadge statut={paiement.statut} />}
              </div>
              <button
                onClick={() => setEditing(seance)}
                className="text-xs text-muted hover:text-accent px-2 py-1 rounded hover:bg-accent/12 transition-colors shrink-0"
              >
                Modifier
              </button>
              <button
                onClick={() => setConfirmDelete(seance.id)}
                className="text-xs text-muted hover:text-late px-2 py-1 rounded hover:bg-late/15 transition-colors shrink-0"
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
          <p className="text-muted text-sm mb-4">La séance et son paiement associé seront définitivement supprimés.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-muted hover:text-ink">
              Annuler
            </button>
            <button
              onClick={async () => { await deleteSeance(confirmDelete); setConfirmDelete(null) }}
              className="px-4 py-2 bg-late text-late-ink text-sm rounded-lg hover:bg-late2"
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      {/* Modal édition */}
      {editing && (
        <Modal title="Modifier la séance" onClose={() => setEditing(null)}>
          <SeanceForm
            clients={clients}
            initial={editing}
            initialMoyenPaiement={paiements.find(p => p.seance_id === editing.id)?.mode}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hair">
          <h2 className="font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-faint hover:text-muted"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
