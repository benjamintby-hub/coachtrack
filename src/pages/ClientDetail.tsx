import { useState, useEffect } from 'react'
import { ChevronLeft, X, Phone, Mail, Pencil, Archive, Trash2, Package, CircleCheck } from 'lucide-react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { clientsService } from '@/services/clientsService'
import { seancesService } from '@/services/seancesService'
import { paiementsService } from '@/services/paiementsService'
import { forfaitsService } from '@/services/forfaitsService'
import ClientForm from '@/components/ClientForm'
import Select from '@/components/Select'
import SeanceForm, { type SeanceFormData } from '@/components/SeanceForm'
import { Avatar, DateBlock, StatutSelect, ModeSelect } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { supabase } from '@/lib/supabase'
import { CALENDAR_SYNCED_EVENT } from '@/services/calendarService'
import type { Client, Forfait, PaymentStatus } from '@/types'

const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const STATUTS_A_REGLER: PaymentStatus[] = ['pending', 'late', 'partial']

// Les 12 derniers mois au format YYYY-MM, du plus récent au plus ancien
function derniersMois(): string[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

const defaultForfaitForm = { nb_seances: '', prix_total: '', date_achat: new Date().toISOString().split('T')[0] }

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [client, setClient] = useState<Client | null>(null)
  const [seances, setSeances] = useState<any[]>([])
  const [forfait, setForfait] = useState<Forfait | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSeanceForm, setShowSeanceForm] = useState(false)
  const [useForfait, setUseForfait] = useState(false)
  const [editingSeance, setEditingSeance] = useState<any | null>(null)
  const [editUseForfait, setEditUseForfait] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [showForfaitForm, setShowForfaitForm] = useState(false)
  const [forfaitForm, setForfaitForm] = useState(defaultForfaitForm)
  const [confirmDeleteForfait, setConfirmDeleteForfait] = useState(false)
  // Par défaut le mois précédent (règlement mensuel en début de mois)
  const [moisReglement, setMoisReglement] = useState<string | null>(null)
  const [reglementEnCours, setReglementEnCours] = useState(false)

  const load = async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
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
    const seancesWithPaiements = (seancesRaw ?? []).map((s: any) => ({ ...s, paiements: pMap[s.id] ? [pMap[s.id]] : [] }))
    setSeances(seancesWithPaiements)
    setLoading(false)

    // Ouverture directe d'une séance depuis le tableau de bord (?seance=<id>)
    const seanceId = searchParams.get('seance')
    if (seanceId) {
      const cible = seancesWithPaiements.find((s: any) => s.id === seanceId)
      if (cible) { setEditingSeance(cible); setEditUseForfait(!!cible.forfait_id) }
      setSearchParams({}, { replace: true })
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  // Recharge après une synchro calendrier (sans l'écran de chargement)
  useEffect(() => {
    const refresh = () => { load(true) }
    window.addEventListener(CALENDAR_SYNCED_EVENT, refresh)
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, refresh)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
    if (useForfait && forfait) {
      await forfaitsService.lierSeance(newSeance.id, forfait.id)
    }
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
    const etaitLiee = !!editingSeance.forfait_id
    if (editUseForfait && !etaitLiee && forfait) {
      await forfaitsService.lierSeance(editingSeance.id, forfait.id)
    } else if (!editUseForfait && etaitLiee) {
      await forfaitsService.delierSeance(editingSeance.id, seanceData.tarif, seanceData.statut_seance)
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

  // Séances non forfait du mois choisi qui restent à régler
  const seancesARegler = (mois: string) => seances.filter(s =>
    s.date.startsWith(mois) && s.statut_seance === 'done' && !s.forfait_id &&
    STATUTS_A_REGLER.includes(s.paiements?.[0]?.statut))

  const handleReglerMois = async () => {
    if (!moisReglement) return
    setReglementEnCours(true)
    for (const s of seancesARegler(moisReglement)) {
      await paiementsService.updateStatut(s.paiements[0].id, 'paid')
    }
    setReglementEnCours(false)
    setMoisReglement(null)
    await load(true)
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

  if (loading) return <div className="p-6"><p className="text-faint text-sm">Chargement...</p></div>
  if (!client) return <div className="p-6"><p className="text-late text-sm">Client introuvable.</p></div>

  const seancesDone = seances.filter(s => s.statut_seance === 'done')
  const caTotal = seancesDone.reduce((acc, s) => acc + (s.paiements?.[0]?.montant_paye ?? 0), 0) + (forfait?.prix_total ?? 0)
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
  const restantesCouleur = nbRestantes <= 1 ? 'text-late' : nbRestantes <= 3 ? 'text-wait' : 'text-accent2'

  const btnSecondaire = 'h-9 w-9 flex items-center justify-center rounded-full text-muted bg-white/8 hover:bg-white/15 hover:text-ink transition active:scale-[0.95]'

  return (
    <div className="lueur px-4 py-5 md:p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/clients')}
        className="text-sm font-medium text-accent hover:text-accent mb-4 -ml-1 flex items-center gap-0.5 transition active:opacity-60"
      >
        <ChevronLeft size={18} aria-hidden="true" />
        Clients
      </button>

      {/* Fiche client */}
      <section className="bg-card rounded-2xl ring-1 ring-white/10 shadow-sm p-4 md:p-5 mb-4">
        <div className="flex items-start gap-4">
          <Avatar prenom={client.prenom} nom={client.nom} type={client.type} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{client.prenom} {client.nom}</h1>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-muted">
              {client.tarif_defaut && <span className="tabular-nums">{formatCurrency(client.tarif_defaut)} / séance</span>}
              {client.telephone && (
                <a href={`tel:${client.telephone}`} className="flex items-center gap-1.5 hover:text-accent">
                  <Phone size={14} aria-hidden="true" />{client.telephone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-accent min-w-0">
                  <Mail size={14} aria-hidden="true" /><span className="truncate">{client.email}</span>
                </a>
              )}
            </div>
            {client.notes && <p className="text-sm text-faint mt-2">{client.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setMoisReglement(derniersMois()[1])}
            className="h-9 flex-1 sm:flex-none px-4 rounded-full bg-accent text-accent-ink text-sm font-medium hover:bg-accent2 transition active:scale-[0.97] flex items-center justify-center gap-1.5"
          >
            <CircleCheck size={16} aria-hidden="true" />
            Régler un mois
          </button>
          <button onClick={() => setEditingClient(true)} aria-label="Modifier le client" title="Modifier le client" className={btnSecondaire}>
            <Pencil size={16} aria-hidden="true" />
          </button>
          <button onClick={() => setConfirmArchive(true)} aria-label="Archiver le client" title="Archiver le client" className={btnSecondaire}>
            <Archive size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Chiffres clés : une seule carte, trois colonnes */}
      <section className="bg-card rounded-2xl ring-1 ring-white/10 shadow-sm grid grid-cols-3 divide-x divide-hair mb-4">
        <div className="px-3 py-3.5 md:px-5">
          <p className="text-xs font-medium text-muted">CA encaissé</p>
          <p className="font-display text-lg md:text-2xl font-bold tracking-tight tabular-nums text-ink mt-0.5">{formatCurrency(caTotal)}</p>
        </div>
        <div className="px-3 py-3.5 md:px-5">
          <p className={`text-xs font-medium ${enAttente > 0 ? 'text-wait' : 'text-muted'}`}>En attente</p>
          <p className={`font-display text-lg md:text-2xl font-bold tracking-tight tabular-nums mt-0.5 ${enAttente > 0 ? 'text-wait' : 'text-ink'}`}>{formatCurrency(enAttente)}</p>
          <p className="text-xs text-faint">{nbImpayés} impayé{nbImpayés > 1 ? 's' : ''}</p>
        </div>
        <div className="px-3 py-3.5 md:px-5">
          <p className="text-xs font-medium text-muted">Séances</p>
          <p className="font-display text-lg md:text-2xl font-bold tracking-tight tabular-nums text-ink mt-0.5">{seances.length}</p>
          <p className="text-xs text-faint">{seancesDone.length} réalisée{seancesDone.length > 1 ? 's' : ''}</p>
        </div>
      </section>

      {/* Forfait */}
      <section className="bg-card rounded-2xl ring-1 ring-white/10 shadow-sm p-4 md:p-5 mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink flex items-center gap-2">
            <Package size={18} className="text-accent2" aria-hidden="true" />
            Forfait
          </h2>
          {forfait ? (
            <div className="flex gap-2">
              <button onClick={() => openForfaitForm(forfait)} aria-label="Modifier le forfait" title="Modifier le forfait" className={btnSecondaire}>
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button onClick={() => setConfirmDeleteForfait(true)} aria-label="Supprimer le forfait" title="Supprimer le forfait" className={btnSecondaire}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button onClick={() => openForfaitForm()} className="h-8 px-3 rounded-full text-sm font-medium text-accent bg-accent/12 hover:bg-accent/20 transition active:scale-[0.97]">+ Créer un forfait</button>
          )}
        </div>

        {forfait ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className={`font-display text-2xl font-bold tracking-tight tabular-nums ${restantesCouleur}`}>
                {nbRestantes} <span className="text-sm font-medium">restante{nbRestantes > 1 ? 's' : ''}</span>
              </p>
              <span className="text-sm text-muted tabular-nums">{nbUtilisees}/{forfait.nb_seances} utilisées</span>
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all bg-[linear-gradient(90deg,#3e5566_0%,#9db9d6_40%,#9cc5a1_78%,#cfe5d1_100%)]"
                style={{ width: `${pctUtilise}%` }}
              />
            </div>
            <p className="text-xs text-faint mt-2 tabular-nums">
              {forfait.nb_seances} séances
              {forfait.prix_total != null && ` · ${formatCurrency(forfait.prix_total)}`}
              {` · acheté le ${formatDate(forfait.date_achat)}`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-faint mt-2">Aucun forfait actif pour ce client.</p>
        )}
      </section>

      {/* Liste séances */}
      <section className="bg-card rounded-2xl ring-1 ring-white/10 shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b border-hair flex items-center justify-between">
          <h2 className="font-semibold text-ink">Séances</h2>
          <button
            onClick={() => setShowSeanceForm(true)}
            className="h-8 px-3 rounded-full text-sm font-medium text-accent bg-accent/12 hover:bg-accent/20 transition active:scale-[0.97]"
          >
            + Nouvelle séance
          </button>
        </div>

        {seances.length === 0 ? (
          <p className="text-center text-faint text-sm py-10">Aucune séance enregistrée</p>
        ) : (
          <ul className="divide-y divide-hair">
            {seances.map(seance => {
              const paiement = seance.paiements?.[0]
              const lieeAuForfait = forfait && seance.forfait_id === forfait.id
              const heure = seance.heure_debut?.slice(0, 5)
              return (
                <li key={seance.id} className="flex items-center gap-3 px-4 md:px-5 py-3">
                  <DateBlock date={seance.date} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink tabular-nums">
                      {lieeAuForfait
                        ? <span className="text-accent2">Payée par forfait</span>
                        : formatCurrency(seance.tarif)}
                      {heure && <span className="text-faint font-normal"> · {heure}</span>}
                    </p>
                    {seance.notes && <p className="text-xs text-faint truncate">{seance.notes}</p>}
                    {paiement && !lieeAuForfait && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <StatutSelect statut={paiement.statut} onChange={statut => handleUpdateStatut(paiement.id, statut)} />
                        <ModeSelect mode={paiement.mode} onChange={mode => paiementsService.updateMode(paiement.id, mode).then(() => load(true))} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingSeance(seance); setEditUseForfait(!!seance.forfait_id) }}
                      aria-label="Modifier la séance" title="Modifier la séance"
                      className="h-8 w-8 flex items-center justify-center rounded-full text-faint hover:bg-white/8 hover:text-ink2 transition active:scale-[0.95]"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(seance.id)}
                      aria-label="Supprimer la séance" title="Supprimer la séance"
                      className="h-8 w-8 flex items-center justify-center rounded-full text-faint hover:bg-late/15 hover:text-late transition active:scale-[0.95]"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Modal nouvelle séance */}
      {showSeanceForm && (
        <Modal title="Nouvelle séance" onClose={() => { setShowSeanceForm(false); setUseForfait(false) }}>
          {forfait && nbRestantes > 0 && (
            <label className="flex items-center gap-3 mb-4 p-3 bg-accent/10 border border-accent/25 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={useForfait}
                onChange={e => setUseForfait(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-sm text-accent2 font-medium">
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
          {forfait && (editingSeance.forfait_id || nbRestantes > 0) && (
            <label className="flex items-center gap-3 mb-4 p-3 bg-accent/10 border border-accent/25 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={editUseForfait}
                onChange={e => setEditUseForfait(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-sm text-accent2 font-medium">
                Payée avec le forfait — <span className={restantesCouleur}>{nbRestantes} séance{nbRestantes > 1 ? 's' : ''} restante{nbRestantes > 1 ? 's' : ''}</span>
              </span>
            </label>
          )}
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
          <p className="text-muted text-sm mb-4">La séance et son paiement associé seront définitivement supprimés.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-muted">Annuler</button>
            <button onClick={() => handleDeleteSeance(confirmDelete)} className="px-4 py-2 bg-late text-late-ink text-sm rounded-lg hover:bg-late2">Supprimer</button>
          </div>
        </Modal>
      )}

      {/* Modal forfait */}
      {showForfaitForm && (
        <Modal title={forfait ? 'Modifier le forfait' : 'Créer un forfait'} onClose={() => setShowForfaitForm(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink2 mb-1">Nombre de séances *</label>
              <input
                type="number" min="1"
                value={forfaitForm.nb_seances}
                onChange={e => setForfaitForm(f => ({ ...f, nb_seances: e.target.value }))}
                className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink2 mb-1">Prix total payé (€)</label>
              <input
                type="number" min="0" step="0.01"
                value={forfaitForm.prix_total}
                onChange={e => setForfaitForm(f => ({ ...f, prix_total: e.target.value }))}
                className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink2 mb-1">Date d'achat *</label>
              <input
                type="date"
                value={forfaitForm.date_achat}
                onChange={e => setForfaitForm(f => ({ ...f, date_achat: e.target.value }))}
                className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForfaitForm(false)} className="px-4 py-2 text-sm text-muted">Annuler</button>
              <button
                onClick={handleSaveForfait}
                disabled={!forfaitForm.nb_seances}
                className="px-4 py-2 bg-accent text-accent-ink text-sm rounded-lg hover:bg-accent2 disabled:opacity-50"
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
          <p className="text-muted text-sm mb-4">Le forfait sera supprimé. Les séances associées ne seront plus liées à un forfait.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDeleteForfait(false)} className="px-4 py-2 text-sm text-muted">Annuler</button>
            <button onClick={handleDeleteForfait} className="px-4 py-2 bg-late text-late-ink text-sm rounded-lg hover:bg-late2">Supprimer</button>
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
      {/* Modal règlement d'un mois */}
      {moisReglement && (() => {
        const aRegler = seancesARegler(moisReglement)
        const total = aRegler.reduce((acc, s) => acc + (s.paiements[0].montant_du - s.paiements[0].montant_paye), 0)
        return (
          <Modal title="Marquer un mois comme payé" onClose={() => setMoisReglement(null)}>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-ink2 mb-1">Mois</label>
                <Select
                  value={moisReglement}
                  options={derniersMois().map(m => ({ value: m, label: `${moisLabels[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` }))}
                  onChange={setMoisReglement}
                  ariaLabel="Mois à régler"
                  className="w-full flex items-center justify-between gap-2 bg-field border border-hair rounded-xl px-3 py-2.5 text-sm text-ink hover:border-white/20 transition-colors"
                />
              </div>
              {aRegler.length === 0 ? (
                <p className="text-sm text-muted">Aucune séance à régler sur ce mois.</p>
              ) : (
                <div className="text-sm text-muted">
                  <p>
                    <span className="font-medium text-ink">{aRegler.length} séance{aRegler.length > 1 ? 's' : ''}</span> en attente, en retard ou partielle{aRegler.length > 1 ? 's' : ''} passeront en « Payé », pour un reste à encaisser de <span className="font-medium text-ink">{formatCurrency(total)}</span>.
                  </p>
                  <p className="text-xs text-faint mt-1">Les séances payées avec le forfait, offertes ou annulées ne sont pas modifiées.</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMoisReglement(null)} className="px-4 py-2 text-sm text-muted">Annuler</button>
                <button
                  onClick={handleReglerMois}
                  disabled={aRegler.length === 0 || reglementEnCours}
                  className="px-4 py-2 bg-ok text-ok-ink text-sm rounded-lg hover:bg-accent2 disabled:opacity-50"
                >
                  {reglementEnCours ? 'En cours...' : 'Marquer payé'}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {confirmArchive && (
        <Modal title="Archiver ce client ?" onClose={() => setConfirmArchive(false)}>
          <p className="text-muted text-sm mb-4">Le client sera masqué mais ses données seront conservées.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmArchive(false)} className="px-4 py-2 text-sm text-muted">Annuler</button>
            <button onClick={handleArchive} className="px-4 py-2 bg-late text-late-ink text-sm rounded-lg hover:bg-late2">Archiver</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hair shrink-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-faint hover:text-muted"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
