import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { usePaiements } from '@/hooks/usePaiements'
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
  const { stats, seancesRecentes, loading } = useDashboard(mois, annee, refreshKey)
  const { paiements, updatePaiementStatut: _updatePaiementStatut } = usePaiements()

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
              sub={`${stats.nbSeancesSalle} salle · ${stats.nbSeancesParticulier} particulier`}
            />
            <KPI
              label="Salle vs Particulier"
              value={formatCurrency(stats.caEncaisseSalle)}
              sub={`Particulier : ${formatCurrency(stats.caEncaisseParticulier)}`}
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
    </div>
  )
}
