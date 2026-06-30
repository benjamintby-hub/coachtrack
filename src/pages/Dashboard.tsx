import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { usePaiements } from '@/hooks/usePaiements'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import ClientBadge from '@/components/ClientBadge'
import PaymentBadge from '@/components/PaymentBadge'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { PaymentStatus } from '@/types'

const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function Dashboard() {
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarInput, setCalendarInput] = useState('')
  const { stats, seancesRecentes, loading } = useDashboard(mois, annee, refreshKey)
  const { paiements, updatePaiementStatut: _updatePaiementStatut } = usePaiements()
  const { calendarUrl, saveUrl, sync, syncing, result, error: syncError } = useCalendarSync()

  const updatePaiementStatut = async (id: string, statut: PaymentStatus) => {
    await _updatePaiementStatut(id, statut)
    setRefreshKey(k => k + 1)
  }

  const annees = [now.getFullYear() - 1, now.getFullYear()]

  const KPI = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setCalendarInput(calendarUrl); setShowCalendarModal(true) }}
            className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:border-gray-300 transition-colors"
          >
            📅 Calendrier
          </button>
          <select
            value={mois}
            onChange={e => setMois(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {moisLabels.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Chargement...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <KPI
              label="CA encaissé"
              value={formatCurrency(stats.caEncaisse)}
              sub={`À déclarer BNC`}
            />
            <KPI
              label="En attente"
              value={formatCurrency(stats.enAttente)}
              sub={`${stats.nbImpayés} impayé${stats.nbImpayés > 1 ? 's' : ''}`}
            />
            <KPI
              label="Séances"
              value={String(stats.nbSeances)}
            />
          </div>

          {/* Séances récentes */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Séances du mois</h2>
            </div>
            {seancesRecentes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Aucune séance ce mois-ci</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {seancesRecentes.map(seance => {
                  const paiement = paiements.find(p => p.seance_id === seance.id)
                  return (
                    <div key={seance.id} className="flex items-center gap-4 px-4 py-3">
                      <span className="text-sm text-gray-400 w-20 shrink-0">{formatDate(seance.date)}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {seance.clients?.prenom} {seance.clients?.nom}
                        </span>
                        <ClientBadge type={seance.type} />
                      </div>
                      <span className="text-sm font-medium text-gray-700 shrink-0">{formatCurrency(seance.tarif)}</span>
                      {paiement && (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={paiement.statut}
                            onChange={e => updatePaiementStatut(paiement.id, e.target.value as PaymentStatus)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                          >
                            <option value="pending">En attente</option>
                            <option value="paid">Payé</option>
                            <option value="partial">Partiel</option>
                            <option value="late">En retard</option>
                            <option value="offered">Offert</option>
                            <option value="cancelled">Annulé</option>
                          </select>
                          <PaymentBadge statut={paiement.statut} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal calendrier */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Synchronisation Apple Calendar</h2>
              <button onClick={() => setShowCalendarModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <p className="text-sm text-gray-600">
                Colle ici l'URL de ton calendrier iCloud public. Les événements nommés <code className="bg-gray-100 px-1 rounded text-xs">[NOM Prénom]</code> seront automatiquement importés.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL du calendrier (webcal://...)</label>
                <input
                  type="text"
                  value={calendarInput}
                  onChange={e => setCalendarInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="webcal://p-cal.icloud.com/published/..."
                />
              </div>

              {syncError && <p className="text-red-500 text-sm">{syncError}</p>}

              {result && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-green-700">Synchronisation terminée</p>
                  <p className="text-green-600">{result.imported} séance{result.imported > 1 ? 's' : ''} importée{result.imported > 1 ? 's' : ''}</p>
                  <p className="text-gray-500">{result.skipped} déjà présente{result.skipped > 1 ? 's' : ''}</p>
                  {result.unmatched.length > 0 && (
                    <div className="mt-2">
                      <p className="text-orange-600 font-medium">Événements non reconnus ({result.unmatched.length}) :</p>
                      {result.unmatched.map((u, i) => <p key={i} className="text-gray-500 text-xs">— {u}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCalendarModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  Fermer
                </button>
                <button
                  onClick={async () => {
                    saveUrl(calendarInput)
                    await sync(calendarInput)
                    setRefreshKey(k => k + 1)
                  }}
                  disabled={syncing || !calendarInput}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
