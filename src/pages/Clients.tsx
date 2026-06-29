import { useState } from 'react'
import { useClients } from '@/hooks/useClients'
import ClientBadge from '@/components/ClientBadge'
import ClientForm from '@/components/ClientForm'
import { formatCurrency } from '@/utils/formatters'
import type { Client, ClientType } from '@/types'

type Filter = 'tous' | ClientType

export default function Clients() {
  const { clients, loading, error, createClient, updateClient, archiveClient } = useClients()
  const [filter, setFilter] = useState<Filter>('tous')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)

  const filtered = clients.filter(c => filter === 'tous' || c.type === filter)

  const handleCreate = async (data: Omit<Client, 'id' | 'created_at'>) => {
    await createClient(data)
    setShowForm(false)
  }

  const handleUpdate = async (data: Omit<Client, 'id' | 'created_at'>) => {
    if (!editing) return
    await updateClient(editing.id, data)
    setEditing(null)
  }

  const handleArchive = async (id: string) => {
    await archiveClient(id)
    setConfirmArchive(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients.length} client{clients.length > 1 ? 's' : ''} actif{clients.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
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
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'tous' ? 'Tous' : f === 'salle' ? 'Salle' : 'Particuliers'}
          </button>
        ))}
      </div>

      {/* États */}
      {loading && <p className="text-gray-400 text-sm">Chargement...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Liste */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>Aucun client pour l'instant.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm hover:underline">
            Ajouter le premier client
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(client => (
          <div key={client.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{client.prenom} {client.nom}</span>
                <ClientBadge type={client.type} />
              </div>
              <div className="flex gap-4 mt-0.5">
                {client.email && <span className="text-xs text-gray-400">{client.email}</span>}
                {client.telephone && <span className="text-xs text-gray-400">{client.telephone}</span>}
              </div>
            </div>
            {client.tarif_defaut && (
              <span className="text-sm font-medium text-gray-700">{formatCurrency(client.tarif_defaut)}/séance</span>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(client)}
                className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                Modifier
              </button>
              <button
                onClick={() => setConfirmArchive(client.id)}
                className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Archiver
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal création */}
      {showForm && (
        <Modal title="Nouveau client" onClose={() => setShowForm(false)}>
          <ClientForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {/* Modal édition */}
      {editing && (
        <Modal title="Modifier le client" onClose={() => setEditing(null)}>
          <ClientForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
        </Modal>
      )}

      {/* Confirmation archivage */}
      {confirmArchive && (
        <Modal title="Archiver ce client ?" onClose={() => setConfirmArchive(null)}>
          <p className="text-gray-600 text-sm mb-4">Le client sera masqué mais ses données seront conservées.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmArchive(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button onClick={() => handleArchive(confirmArchive)} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
              Archiver
            </button>
          </div>
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
