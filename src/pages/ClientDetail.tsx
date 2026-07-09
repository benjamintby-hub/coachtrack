import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clientsService } from '@/services/clientsService'
import { seancesService } from '@/services/seancesService'
import { paiementsService } from '@/services/paiementsService'
import ClientBadge from '@/components/ClientBadge'
import ClientForm from '@/components/ClientForm'
import SeanceForm, { type SeanceFormData } from '@/components/SeanceForm'
import PaymentBadge from '@/components/PaymentBadge'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Client, PaymentStatus } from '@/types'

const statutLabels: Record<string, string> = {
  done: 'Réalisée',
  cancelled_client: 'Annulée (client)',
  cancelled_coach: 'Annulée (coach)',
  postponed: 'Reportée',
}

const modeLabels: Record<string, string> = { cash: 'Espèces', transfer: 'Virement' }

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [seances, setSeances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSeanceForm, setShowSeanceForm] = useState(false)
  const [editingSeance, setEditingSeance] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    const [clientData, seancesData] = await Promise.all([
      clientsService.getById(id),
      seancesService.getByClient(id),
    ])
    setClient(clientData)
    setSeances(seancesData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleCreateSeance = async (data: SeanceFormData) => {
    const { moyen_paiement, ...seanceData } = data
    const newSeance = await seancesService.create(seanceData)
    await paiementsService.create({
      seance_id: newSeance.id,
      montant_du: seanceData.tarif,
      montant_paye: 0,
      statut: seanceData.statut_seance === 'done' ? 'pending' : 'cancelled',
      mode: moyen_paiement as any || undefined,
    })
    setShowSeanceForm(false)
    await load()
  }

  const handleUpdateSeance = async (data: SeanceFormData) => {
    if (!editingSeance) return
    const { moyen_paiement, ...seanceData } = data
    await seancesService.update(editingSeance.id, seanceData)
    if (moyen_paiement !== undefined) {
      const paiement = editingSeance.paiements?.[0]
      if (paiement) await paiementsService.updateMode(paiement.id, moyen_paiement)
    }
    setEditingSeance(null)
    await load()
  }

  const handleDeleteSeance = async (seanceId: string) => {
    await seancesService.delete(seanceId)
    setConfirmDelete(null)
    await load()
  }

  const handleUpdateStatut = async (paiementId: string, statut: PaymentStatus) => {
    await paiementsService.updateStatut(paiementId, statut)
    await load()
  }

  const handleUpdateClient = async (data: Omit<Client, 'id' | 'created_at'>) => {
    if (!id) return
    await clientsService.update(id, data)
    setEditingClient(false)
    await load()
  }

  const handleArchive = async () => {
    if (!id) return
    await clientsService.archive(id)
    navigate('/clients')
  }

  if (loading) return <div className="p-6"><p className="text-gray-400 text-sm">Chargement...</p></div>
  if (!client) return <div className="p-6"><p className="text-red-500 text-sm">Client introuvable.</p></div>

  const seancesDone = seances.filter(s => s.statut_seance === 'done')
  const caTotal = seancesDone.reduce((acc, s) => acc + (s.paiements?.[0]?.montant_paye ?? 0), 0)
  const enAttente = seances.reduce((acc, s) => {
    const p = s.paiements?.[0]
    if (!p || p.statut === 'paid' || p.statut === 'cancelled' || p.statut === 'offered') return acc
    return acc + (p.montant_du - p.montant_paye)
  }, 0)
  const nbImpayés = seances.filter(s => {
    const p = s.paiements?.[0]
    return p && (p.statut === 'pending' || p.statut === 'late')
  }).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/clients')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        ← Clients
      </button>

      {/* Fiche client */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900">{client.prenom} {client.nom}</h1>
            <ClientBadge type={client.type} />
          </div>
          <div className="flex gap-4 flex-wrap">
            {client.email && <span className="text-sm text-gray-500">{client.email}</span>}
            {client.telephone && <span className="text-sm text-gray-500">{client.telephone}</span>}
            {client.tarif_defaut && <span className="text-sm text-gray-500">{formatCurrency(client.tarif_defaut)}/séance</span>}
          </div>
          {client.notes && <p className="text-xs text-gray-400 mt-1">{client.notes}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditingClient(true)}
            className="text-xs text-gray-500 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
          >
            Modifier
          </button>
          <button
            onClick={() => setConfirmArchive(true)}
            className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-300 transition-colors"
          >
            Archiver
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">CA encaissé</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(caTotal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">En attente</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(enAttente)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{nbImpayés} impayé{nbImpayés > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Séances</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{seances.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{seancesDone.length} réalisées</p>
        </div>
      </div>

      {/* Liste séances */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Séances</h2>
          <button
            onClick={() => setShowSeanceForm(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            + Nouvelle séance
          </button>
        </div>

        {seances.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Aucune séance enregistrée</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {seances.map(seance => {
              const paiement = seance.paiements?.[0]
              return (
                <div key={seance.id} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                  <span className="text-sm text-gray-400 w-20 shrink-0">{formatDate(seance.date)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-500">{statutLabels[seance.statut_seance]}</span>
                    {seance.notes && <p className="text-xs text-gray-400 truncate">{seance.notes}</p>}
                  </div>
                  <span className="text-sm font-medium text-gray-700 shrink-0">{formatCurrency(seance.tarif)}</span>
                  {paiement?.mode && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                      {modeLabels[paiement.mode] ?? paiement.mode}
                    </span>
                  )}
                  {paiement && (
                    <select
                      value={paiement.statut}
                      onChange={e => handleUpdateStatut(paiement.id, e.target.value as PaymentStatus)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
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
                  <button onClick={() => setEditingSeance(seance)} className="text-xs text-gray-400 hover:text-blue-600 shrink-0">Modifier</button>
                  <button onClick={() => setConfirmDelete(seance.id)} className="text-xs text-gray-400 hover:text-red-600 shrink-0">Supprimer</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showSeanceForm && (
        <Modal title="Nouvelle séance" onClose={() => setShowSeanceForm(false)}>
          <SeanceForm
            clients={[client]}
            initial={{ client_id: client.id, type: client.type, tarif: client.tarif_defaut }}
            onSubmit={handleCreateSeance}
            onCancel={() => setShowSeanceForm(false)}
          />
        </Modal>
      )}

      {editingSeance && (
        <Modal title="Modifier la séance" onClose={() => setEditingSeance(null)}>
          <SeanceForm
            clients={[client]}
            initial={editingSeance}
            initialMoyenPaiement={editingSeance.paiements?.[0]?.mode}
            onSubmit={handleUpdateSeance}
            onCancel={() => setEditingSeance(null)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Supprimer cette séance ?" onClose={() => setConfirmDelete(null)}>
          <p className="text-gray-600 text-sm mb-4">La séance et son paiement associé seront définitivement supprimés.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
            <button onClick={() => handleDeleteSeance(confirmDelete)} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Supprimer</button>
          </div>
        </Modal>
      )}

      {editingClient && (
        <Modal title="Modifier le client" onClose={() => setEditingClient(false)}>
          <ClientForm initial={client} onSubmit={handleUpdateClient} onCancel={() => setEditingClient(false)} />
        </Modal>
      )}

      {confirmArchive && (
        <Modal title="Archiver ce client ?" onClose={() => setConfirmArchive(false)}>
          <p className="text-gray-600 text-sm mb-4">Le client sera masqué mais ses données seront conservées.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmArchive(false)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
            <button onClick={handleArchive} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Archiver</button>
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
