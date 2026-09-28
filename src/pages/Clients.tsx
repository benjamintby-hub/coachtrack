import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import ClientForm from '@/components/ClientForm'
import { formatCurrency } from '@/utils/formatters'
import type { Client, ClientType } from '@/types'

type Filter = 'tous' | ClientType

export default function Clients() {
  const navigate = useNavigate()
  const { clients, loading, error, createClient } = useClients()
  const [filter, setFilter] = useState<Filter>('tous')
  const [showForm, setShowForm] = useState(false)

  const filtered = clients.filter(c => filter === 'tous' || c.type === filter)

  const handleCreate = async (data: Omit<Client, 'id' | 'created_at'>) => {
    await createClient(data)
    setShowForm(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Clients</h1>
          <p className="text-muted text-sm mt-0.5">{clients.length} client{clients.length > 1 ? 's' : ''} actif{clients.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-accent text-accent-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent2 transition-colors"
        >
          + Nouveau client
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
            {f === 'tous' ? 'Tous' : f === 'salle' ? 'Salle' : 'Particuliers'}
          </button>
        ))}
      </div>

      {/* États */}
      {loading && <p className="text-faint text-sm">Chargement...</p>}
      {error && <p className="text-late text-sm">{error}</p>}

      {/* Liste */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-faint">
          <p>Aucun client pour l'instant.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-accent text-sm hover:underline">
            Ajouter le premier client
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(client => (
          <button
            key={client.id}
            onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-card border border-hair rounded-xl px-4 py-3 flex items-center gap-4 hover:border-accent/40 hover:shadow-sm transition-all text-left w-full"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-ink">{client.prenom} {client.nom}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 mt-0.5">
                {client.email && <span className="text-xs text-faint">{client.email}</span>}
                {client.telephone && <span className="text-xs text-faint">{client.telephone}</span>}
              </div>
            </div>
            {client.tarif_defaut && (
              <span className="text-sm font-medium text-ink2 shrink-0">{formatCurrency(client.tarif_defaut)}<span className="hidden sm:inline">/séance</span></span>
            )}
            <ChevronRight size={18} className="text-faint shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Modal création */}
      {showForm && (
        <Modal title="Nouveau client" onClose={() => setShowForm(false)}>
          <ClientForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
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
