import { useEffect, useState } from 'react'
import { CalendarSync, X, Wallet, AlertCircle, CalendarCheck, ChevronRight, TrendingUp, TrendingDown, MoveRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Select from '@/components/Select'
import { useDashboard, type VueSeances } from '@/hooks/useDashboard'
import { usePaiements } from '@/hooks/usePaiements'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { CALENDAR_SYNCED_EVENT } from '@/services/calendarService'
import { Avatar, DateBlock, StatutSelect } from '@/components/ui'
import ForfaitBadge from '@/components/ForfaitBadge'
import { formatCurrency } from '@/utils/formatters'
import type { PaymentStatus } from '@/types'

const vues: { value: VueSeances; label: string; titre: string; vide: string }[] = [
  { value: 'mois', label: 'Mois', titre: 'Séances du mois', vide: 'Aucune séance ce mois-ci' },
  { value: 'semaine', label: 'Semaine', titre: 'Séances de la semaine', vide: 'Aucune séance cette semaine' },
  { value: 'jour', label: 'Jour', titre: "Séances du jour", vide: "Aucune séance aujourd'hui" },
]

const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function Dashboard() {
  const navigate = useNavigate()
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarInput, setCalendarInput] = useState('')
  const [vue, setVue] = useState<VueSeances>('mois')
  const { stats, seancesRecentes, loading } = useDashboard(mois, annee, refreshKey, vue)
  const { paiements, updatePaiementStatut: _updatePaiementStatut } = usePaiements()
  const { calendarUrl, saveUrl, sync, syncing, result, error: syncError } = useCalendarSync()

  // Recharge après chaque synchro calendrier (manuelle ou automatique)
  useEffect(() => {
    const refresh = () => setRefreshKey(k => k + 1)
    window.addEventListener(CALENDAR_SYNCED_EVENT, refresh)
    return () => window.removeEventListener(CALENDAR_SYNCED_EVENT, refresh)
  }, [])

  const updatePaiementStatut = async (id: string, statut: PaymentStatus) => {
    await _updatePaiementStatut(id, statut)
    setRefreshKey(k => k + 1)
  }

  const annees = [now.getFullYear() - 1, now.getFullYear()]
  const vueActive = vues.find(v => v.value === vue)!
  const aujourdhui = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="lueur px-4 py-5 md:p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">{aujourdhui}</p>
          <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight text-ink">Tableau de bord</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setCalendarInput(calendarUrl); setShowCalendarModal(true) }}
            className="h-9 bg-card ring-1 ring-white/10 shadow-sm text-ink2 px-3 rounded-full text-sm font-medium hover:bg-white/5 transition active:scale-[0.97] flex items-center gap-1.5"
          >
            <CalendarSync size={16} aria-hidden="true" />
            Calendrier
          </button>
          {/* Période : mois + année dans une seule pastille */}
          <div className="h-9 flex items-center bg-card ring-1 ring-white/10 shadow-sm rounded-full px-1.5 gap-1.5">
            <Select
              value={String(mois)}
              options={moisLabels.map((m, i) => ({ value: String(i + 1), label: m }))}
              onChange={v => setMois(Number(v))}
              ariaLabel="Mois affiché"
              className="flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium text-ink2 hover:bg-white/8 transition-colors"
            />
            <span className="w-px h-4 bg-white/15" aria-hidden="true" />
            <Select
              value={String(annee)}
              options={annees.map(a => ({ value: String(a), label: String(a) }))}
              onChange={v => setAnnee(Number(v))}
              ariaLabel="Année affichée"
              align="right"
              className="flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium text-ink2 tabular-nums hover:bg-white/8 transition-colors"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-faint text-sm">Chargement...</p>
      ) : (
        <>
          {/* Chiffres clés : le CA en premier, plus grand */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <section className="col-span-2 md:col-span-1 relative overflow-hidden rounded-2xl ring-1 ring-white/10 bg-card px-4 py-4 md:px-5">
              {/* Ardoise : dégradé gris-bleu et courbes de niveau sauge */}
              <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(160deg,#1f292f_0%,#161d21_70%)]" />
              <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-[0.16]" viewBox="0 0 350 140" preserveAspectRatio="xMaxYMin slice" fill="none" stroke="#9cc5a1" strokeWidth="1">
                <path d="M-10 128 C60 98 112 146 184 116 S300 58 360 86" />
                <path d="M-10 108 C60 78 112 126 184 96 S300 38 360 66" />
                <path d="M-10 88 C62 58 118 104 186 76 S300 18 360 46" />
                <path d="M-10 68 C66 40 124 82 190 56 S300 0 360 26" />
                <ellipse cx="292" cy="28" rx="44" ry="18" />
                <ellipse cx="292" cy="28" rx="24" ry="9" />
              </svg>
              {/* Liseré de lumière sur le bord haut */}
              <div aria-hidden="true" className="absolute left-5 right-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(220,240,230,0.22),transparent)]" />
              <div className="relative">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink2">
                  <Wallet size={16} aria-hidden="true" />
                  CA encaissé
                </p>
                <p className="font-display text-2xl md:text-3xl font-bold tracking-tight tabular-nums mt-1.5 text-ink">{formatCurrency(stats.caEncaisse)}</p>
                <EvolutionCA actuel={stats.caEncaisse} precedent={stats.caMoisPrecedent} moisPrecedent={moisLabels[(mois + 10) % 12]} />
              </div>
            </section>
            <Stat
              icon={<AlertCircle size={16} aria-hidden="true" />}
              label="En retard"
              value={formatCurrency(stats.enRetard)}
              sub={stats.enRetard > 0 ? `${stats.nbImpayés} impayé${stats.nbImpayés > 1 ? 's' : ''}` : 'Aucun retard'}
              alerte={stats.enRetard > 0}
            />
            <Stat
              icon={<CalendarCheck size={16} aria-hidden="true" />}
              label="Séances"
              value={String(stats.nbSeances)}
              sub={moisLabels[mois - 1]}
            />
          </div>

          {/* Liste des séances */}
          <section className="bg-card rounded-2xl ring-1 ring-white/10 shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-hair">
              <h2 className="font-display font-semibold text-ink whitespace-nowrap">{vueActive.titre}</h2>
              <div className="flex bg-white/8 rounded-full p-0.5" role="group" aria-label="Période affichée">
                {vues.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setVue(v.value)}
                    aria-pressed={vue === v.value}
                    className={`px-3 py-1 text-xs rounded-full transition ${vue === v.value ? 'bg-accent text-accent-ink font-semibold' : 'text-muted hover:text-ink'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {seancesRecentes.length === 0 ? (
              <p className="text-center text-faint text-sm py-10">{vueActive.vide}</p>
            ) : (
              <ul className="divide-y divide-hair">
                {seancesRecentes.map(seance => {
                  const paiement = paiements.find(p => p.seance_id === seance.id)
                  const heure = seance.heure_debut?.slice(0, 5)
                  return (
                    <li key={seance.id}>
                      <div
                        onClick={() => navigate(`/clients/${seance.client_id}?seance=${seance.id}`)}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 active:bg-white/8 transition-colors"
                      >
                        {vue === 'jour' ? (
                          <span className="w-11 shrink-0 text-center text-sm font-display font-semibold text-ink tabular-nums">{heure ?? '—'}</span>
                        ) : (
                          <DateBlock date={seance.date} />
                        )}
                        <Avatar prenom={seance.clients?.prenom} nom={seance.clients?.nom} type={seance.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {seance.clients?.prenom} {seance.clients?.nom}
                          </p>
                          <p className="text-xs text-muted truncate tabular-nums">
                            {[
                              !seance.forfait_id && formatCurrency(seance.tarif),
                              vue !== 'jour' && heure,
                              seance.type === 'salle' ? 'Salle' : 'Particulier',
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {seance.forfait_id ? (
                          <ForfaitBadge />
                        ) : paiement && (
                          <StatutSelect
                            statut={paiement.statut}
                            onChange={statut => updatePaiementStatut(paiement.id, statut)}
                          />
                        )}
                        <ChevronRight size={16} className="text-faint shrink-0 hidden sm:block" aria-hidden="true" />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Modal calendrier */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-card rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-hair">
              <h2 className="font-semibold text-ink">Synchronisation Apple Calendar</h2>
              <button onClick={() => setShowCalendarModal(false)} aria-label="Fermer" className="text-faint hover:text-muted"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <p className="text-sm text-muted">
                Colle ici l'URL de ton calendrier iCloud public. Les événements nommés <code className="bg-white/8 px-1 rounded text-xs">[NOM Prénom]</code> seront automatiquement importés (l'élève est créé s'il n'a pas encore de fiche), puis resynchronisés à chaque ouverture de l'appli et toutes les 15 minutes.
              </p>
              <div>
                <label className="block text-sm font-medium text-ink2 mb-1">URL du calendrier (webcal://...)</label>
                <input
                  type="text"
                  value={calendarInput}
                  onChange={e => setCalendarInput(e.target.value)}
                  className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="webcal://p-cal.icloud.com/published/..."
                />
              </div>

              {syncError && <p className="text-late text-sm">{syncError}</p>}

              {result && (
                <div role="status" className="bg-ok/12 border border-ok/25 rounded-xl p-3 text-sm">
                  <p className="font-medium text-ok">Synchronisation terminée</p>
                  <p className="text-ok">{result.imported} séance{result.imported > 1 ? 's' : ''} importée{result.imported > 1 ? 's' : ''}</p>
                  {result.lieesForfait > 0 && (
                    <p className="text-accent2">dont {result.lieesForfait} rattachée{result.lieesForfait > 1 ? 's' : ''} à un forfait</p>
                  )}
                  {result.updated > 0 && (
                    <p className="text-accent">{result.updated} séance{result.updated > 1 ? 's' : ''} déplacée{result.updated > 1 ? 's' : ''} mise{result.updated > 1 ? 's' : ''} à jour</p>
                  )}
                  {result.deleted > 0 && (
                    <p className="text-late">{result.deleted} séance{result.deleted > 1 ? 's' : ''} supprimée{result.deleted > 1 ? 's' : ''} (retirée{result.deleted > 1 ? 's' : ''} du calendrier)</p>
                  )}
                  <p className="text-muted">{result.skipped} déjà présente{result.skipped > 1 ? 's' : ''}</p>
                  {result.doublonsEvites > 0 && (
                    <p className="text-muted">{result.doublonsEvites} séance{result.doublonsEvites > 1 ? 's' : ''} déjà saisie{result.doublonsEvites > 1 ? 's' : ''} reliée{result.doublonsEvites > 1 ? 's' : ''} au calendrier (doublon évité)</p>
                  )}
                  {result.doublonsAVerifier.length > 0 && (
                    <div className="mt-2">
                      <p className="text-wait font-medium">Doublons à vérifier ({result.doublonsAVerifier.length}) — deux séances avec paiement ou forfait sur le même créneau :</p>
                      {result.doublonsAVerifier.map((d, i) => <p key={i} className="text-muted text-xs">— {d}</p>)}
                    </div>
                  )}
                  {result.clientsCrees.length > 0 && (
                    <div className="mt-2">
                      <p className="text-ok font-medium">
                        Élève{result.clientsCrees.length > 1 ? 's' : ''} créé{result.clientsCrees.length > 1 ? 's' : ''} ({result.clientsCrees.length}) — tarif à compléter sur la fiche :
                      </p>
                      {result.clientsCrees.map((c, i) => <p key={i} className="text-muted text-xs">— {c}</p>)}
                    </div>
                  )}
                  {result.unmatched.length > 0 && (
                    <div className="mt-2">
                      <p className="text-wait font-medium">Événements non reconnus ({result.unmatched.length}) :</p>
                      {result.unmatched.map((u, i) => <p key={i} className="text-muted text-xs">— {u}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCalendarModal(false)} className="px-4 py-2 text-sm text-muted hover:text-ink">
                  Fermer
                </button>
                <button
                  onClick={async () => {
                    saveUrl(calendarInput)
                    await sync(calendarInput)
                  }}
                  disabled={syncing || !calendarInput}
                  className="px-4 py-2 bg-accent text-accent-ink text-sm rounded-lg hover:bg-accent2 disabled:opacity-50"
                >
                  {syncing ? 'Synchronisation...' : 'Synchroniser'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Évolution du CA par rapport au mois précédent : flèche montante (sauge) ou descendante (rose)
function EvolutionCA({ actuel, precedent, moisPrecedent }: { actuel: number; precedent: number; moisPrecedent: string }) {
  const vs = `vs ${moisPrecedent.toLowerCase()}`
  // Rien à comparer : pas de pourcentage inventé
  if (precedent <= 0) {
    return <p className="text-xs text-muted mt-1">{actuel > 0 ? `Pas de CA en ${moisPrecedent.toLowerCase()}` : `Aucun CA ${vs}`}</p>
  }
  const pct = Math.round(((actuel - precedent) / precedent) * 100)
  const Icone = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : MoveRight
  const couleur = pct > 0 ? 'text-ok' : pct < 0 ? 'text-late' : 'text-muted'
  return (
    <p className={`flex items-center gap-1 text-xs font-medium mt-1 tabular-nums ${couleur}`}>
      <Icone size={14} strokeWidth={2.2} aria-hidden="true" />
      <span>{pct > 0 ? '+' : ''}{pct} %</span>
      <span className="text-muted font-normal">{vs}</span>
    </p>
  )
}

function Stat({ icon, label, value, sub, alerte = false, className = '' }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  alerte?: boolean
  className?: string
}) {
  return (
    <div className={`bg-card rounded-2xl ring-1 ring-white/10 shadow-sm px-4 py-4 md:px-5 ${className}`}>
      <p className={`flex items-center gap-1.5 text-[13px] font-medium ${alerte ? 'text-late' : 'text-muted'}`}>
        {icon}
        {label}
      </p>
      <p className={`font-display text-2xl md:text-3xl font-bold tracking-tight tabular-nums mt-1.5 ${alerte ? 'text-late' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-faint mt-0.5 first-letter:uppercase">{sub}</p>}
    </div>
  )
}
