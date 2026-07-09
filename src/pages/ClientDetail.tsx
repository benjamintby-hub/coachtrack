import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clientsService } from '@/services/clientsService'
import { seancesService } from '@/services/seancesService'
import { paiementsService } from '@/services/paiementsService'
import { forfaitsService } from '@/services/forfaitsService'
import ClientBadge from '@/components/ClientBadge'
import ClientForm from '@/components/ClientForm'
import SeanceForm, { type SeanceFormData } from '@/components/SeanceForm'
import PaymentBadge from '@/components/PaymentBadge'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { supabase } from '@/lib/supabase'
import type { Client, Forfait, PaymentStatus } from '@/types'

const modeLabels: Record<string, string> = { cash: 'Espèces', transfer: 'Virement' }

const defaultForfaitForm = { nb_seances: '', prix_total: '', date_achat: new Date().toISOString().split('T')[0] }

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [seances, setSeances] = useState<any[]>([])
  const [forfait, setForfait] = useState<Forfait | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSeanceForm, setShowSeanceForm] = useState(false)
  const [useForfait, setUseForfait] = useState(false)
  const [editingSeance, setEditingSeance] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [showForfaitForm, setShowForfaitForm] = useState(false)
  const [forfaitForm, setForfaitForm] = useState(defaultForfaitForm)
  const [confirmDeleteForfait, setConfirmDeleteForfait] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    const [clientData, seancesRaw, forfaitData] = await Promise.all([
      clientsService.getById(id),
      seancesService.getByClient(id),
      forfaitsService.getByClient(id),
    ])
    setClient(clientData)
    setForfait(forfaitData)

    const ids = (seancesRaw ?? []).map((s: any) => s.id)
    let pMap: Record<string, any> = {}
    if (ids.length > 0) {
      const { data: paiementsRaw } = await supabase
        .from('paiements').select('*').in('seance_id', ids)
      for (const p of paiementsRaw ?? []) pMap[p.seance_id] = p
    }
    setSeances((seancesRaw ?? []).map((s: any) => ({ ...s, paiements: pMap[s.id] ? [pMap[s.id]] : [] })))
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleCreateSeance = async (data: SeanceFormData) => {
    const { moyen_paiement, ...seanceData } = data
    if (useForfait && forfait) seanceData.forfait_id = forfait.id
    const newSeance = await seancesService.create(seanceData)
    await paiementsService.create({
      seance_id: newSeance.id,
      montant_du: seanceData.tarif,
      montant_paye: useForfait && forfait ? seanceData.tarif : 0,
      statut: useForfait && forfait ? 'paid' : (seanceData.statut_seance === 'done' ? 'pending' : 'cancelled'),
      mode: moyen_paiement as any || undefined,
    })
    setShowSeanceForm(false)
    setUseForfait(false)
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

  const openForfaitForm = (existing?: Forfait) => {
    setForfaitForm(existing ? {
      nb_seances: String(existing.nb_seances),
      prix_total: existing.prix_total != null ? String(existing.prix_total) : '',
      date_achat: existing.date_achat,
    } : defaultForfaitForm)
    setShowForfaitForm(true)
  }

  const handleSaveForfait = async () => {
    if (!id || !forfaitForm.nb_seances) return
    const payload = {
      client_id: id,
      nb_seances: parseInt(forfaitForm.nb_seances),
      prix_total: forfaitForm.prix_total ? parseFloat(forfaitForm.prix_total) : undefined,
      date_achat: forfaitForm.date_achat,
    }
    if (forfait) {
      await forfaitsService.update(forfait.id, payload)
    } else {
      await forfaitsService.create(payload)
    }
    setShowForfaitForm(false)
    await load()
  }

  const handleDeleteForfait = async () => {
    if (!forfait) return
    await forfaitsService.delete(forfait.id)
    setConfirmDeleteForfait(false)
    await load()
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

  // Forfait stats
  const nbUtilisees = forfait ? seances.filter(s => s.forfait_id === forfait.id && s.statut_seance === 'done').length : 0
  const nbRestantes = forfait ? forfait.nb_seances - nbUtilisees : 0
  const pctUtilise = forfait ? Math.round((nbUtilisees / forfait.nb_seances) * 100) : 0
  const restantesCouleur = nbRestantes <= 1 ? 'text-red-500' : nbRestantes <= 3 ? 'text-orange-500' : 'text-green-600'

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
          <button onClick={() => setEditingClient(true)} className="text-xs text-gray-500 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">Modifier</button>
          <button onClick={() => setConfirmArchive(true)} className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-300 transition-colors">Archiver</button>
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

      {/* Forfait */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Forfait</h2>
          <div className="flex gap-2">
            {forfait ? (
              <>
                <button onClick={() => openForfaitForm(forfait)} className="text-xs text-gray-500 hover:text-blue-600 px-3 py-1 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">Modifier</button>
                <button onClick={() => setConfirmDeleteForfait(true)} className="text-xs text-gray-500 hover:text-red-600 px-3 py-1 rounded-lg border border-gray-200 hover:border-red-300 transition-colors">Supprimer</button>
              </>
            ) : (
              <button onClick={() => openForfaitForm()} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors">+ Créer un forfait</button>
            )}
          </div>
        </div>

        {forfait ? (
          <div>
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <span className="text-sm text-gray-600">{forfait.nb_seances} séances achetées</span>
              {forfait.prix_total != null && <span className="text-sm text-gray-600">{formatCurrency(forfait.prix_total)}</span>}
              <span className="text-sm text-gray-400">le {formatDate(forfait.date_achat)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pctUtilise >= 80 ? 'bg-red-400' : pctUtilise >= 60 ? 'bg-orange-400' : 'bg-green-400'}`}
                  style={{ width: `${pctUtilise}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 shrink-0">{nbUtilisees}/{forfait.nb_seances} utilisées</span>
              <span className={`text-sm font-semibold shrink-0 ${restantesCouleur}`}>
                {nbRestantes} restante{nbRestantes > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun forfait actif pour ce client.</p>
        )}
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
              const lieeAuForfait = forfait && seance.forfait_id === forfait.id
              return (
                <div key={seance.id} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                  <span className="text-sm text-gray-400 w-20 shrink-0">{formatDate(seance.date)}</span>
                  <div className="flex-1 min-w-0">
                    {lieeAuForfait && <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium">Forfait</span>}
                    {seance.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{seance.notes}</p>}
                  </div>
                  <span className="text-sm font-medium text-gray-700 shrink-0">{formatCurrency(seance.tarif)}</span>
                  {paiement && (
                    <select
                      value={paiement.mode ?? ''}
                      onChange={e => paiementsService.updateMode(paiement.id, e.target.value).then(load)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                    >
                      <option value="">— Mode —</option>
                      <option value="cash">Espèces</option>
                      <option value="transfer">Virement</option>
                    </select>
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

      {/* Modal nouvelle séance */}
      {showSeanceForm && (
        <Modal title="Nouvelle séance" onClose={() => { setShowSeanceForm(false); setUseForfait(false) }}>
          {forfait && nbRestantes > 0 && (
            <label className="flex items-center gap-3 mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={useForfait}
                onChange={e => setUseForfait(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              <span className="text-sm text-purple-700 font-medium">
                Utiliser le forfait — <span className={restantesCouleur}>{nbRestantes} séance{nbRestantes > 1 ? 's' : ''} restante{nbRestantes > 1 ? 's' : ''}</span>
              </span>
            </label>
          )}
          <SeanceForm
            clients={[client]}
            initial={{ client_id: client.id, type: client.type, tarif: client.tarif_defaut }}
            onSubmit={handleCreateSeance}
            onCancel={() => { setShowSeanceForm(false); setUseForfait(false) }}
          />
        </Modal>
      )}

      {/* Modal édition séance */}
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

      {/* Confirmation suppression séance */}
      {confirmDelete && (
        <Modal title="Supprimer cette séance ?" onClose={() => setConfirmDelete(null)}>
          <p className="text-gray-600 text-sm mb-4">La séance et son paiement associé seront définitivement supprimés.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
            <button onClick={() => handleDeleteSeance(confirmDelete)} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Supprimer</button>
          </div>
        </Modal>
      )}

      {/* Modal forfait */}
      {showForfaitForm && (
        <Modal title={forfait ? 'Modifier le forfait' : 'Créer un forfait'} onClose={() => setShowForfaitForm(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de séances *</label>
              <input
                type="number" min="1"
                value={forfaitForm.nb_seances}
                onChange={e => setForfaitForm(f => ({ ...f, nb_seances: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix total payé (€)</label>
              <input
                type="number" min="0" step="0.01"
                value={forfaitForm.prix_total}
                onChange={e => setForfaitForm(f => ({ ...f, prix_total: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'achat *</label>
              <input
                type="date"
                value={forfaitForm.date_achat}
                onChange={e => setForfaitForm(f => ({ ...f, date_achat: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForfaitForm(false)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
              <button
                onClick={handleSaveForfait}
                disabled={!forfaitForm.nb_seances}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation suppression forfait */}
      {confirmDeleteForfait && (
        <Modal title="Supprimer ce forfait ?" onClose={() => setConfirmDeleteForfait(false)}>
          <p className="text-gray-600 text-sm mb-4">Le forfait sera supprimé. Les séances associées ne seront plus liées à un forfait.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDeleteForfait(false)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
            <button onClick={handleDeleteForfait} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Supprimer</button>
          </div>
        </Modal>
      )}

      {/* Modal édition client */}
      {editingClient && (
        <Modal title="Modifier le client" onClose={() => setEditingClient(false)}>
          <ClientForm initial={client} onSubmit={handleUpdateClient} onCancel={() => setEditingClient(false)} />
        </Modal>
      )}

      {/* Confirmation archivage */}
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
