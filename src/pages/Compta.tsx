import { useState } from 'react'
import { useCompta } from '@/hooks/useCompta'
import { exportPDF } from '@/utils/pdfExport'
import ClientBadge from '@/components/ClientBadge'
import PaymentBadge from '@/components/PaymentBadge'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { ClientType } from '@/types'

const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

type Filter = 'tous' | ClientType

export default function Compta() {
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [filter, setFilter] = useState<Filter>('tous')
  const { stats, loading } = useCompta(mois, annee)
  const annees = [now.getFullYear() - 1, now.getFullYear()]

  const lignesFiltrees = stats.lignes.filter(l => filter === 'tous' || l.type === filter)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 text-sm mt-0.5">Récapitulatif mensuel BNC</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={mois}
            onChange={e => setMois(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {moisLabels.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => exportPDF(stats, mois, annee)}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Exporter PDF
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Chargement...</p>
      ) : (
        <>
          {/* Bloc CA à déclarer */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 mb-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Montant à déclarer — BNC encaissé</p>
            <p className="text-4xl font-bold text-blue-700">{formatCurrency(stats.caDeclarable)}</p>
            <div className="flex gap-6 mt-2 text-sm text-blue-600">
              <span>Salle : <strong>{formatCurrency(stats.caDeclarableSalle)}</strong></span>
              <span>Particuliers : <strong>{formatCurrency(stats.caDeclarableParticulier)}</strong></span>
            </div>
          </div>

          {/* Autres KPIs */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">En attente</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(stats.enAttente)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Séances réalisées</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{stats.nbSeancesDone}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Offertes / Annulées</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{stats.nbOfferts} / {stats.nbAnnules}</p>
            </div>
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

          {/* Tableau détaillé */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span className="col-span-2">Date</span>
              <span className="col-span-3">Client</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2 text-right">Tarif</span>
              <span className="col-span-2 text-right">Encaissé</span>
              <span className="col-span-1 text-right">Statut</span>
            </div>

            {lignesFiltrees.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Aucune séance ce mois-ci</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {lignesFiltrees.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                    <span className="col-span-2 text-sm text-gray-500">{formatDate(l.date)}</span>
                    <span className="col-span-3 text-sm font-medium text-gray-800">{l.client}</span>
                    <span className="col-span-2"><ClientBadge type={l.type} /></span>
                    <span className="col-span-2 text-sm text-gray-700 text-right">{formatCurrency(l.tarif)}</span>
                    <span className={`col-span-2 text-sm font-medium text-right ${l.montant_paye > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatCurrency(l.montant_paye)}
                    </span>
                    <span className="col-span-1 flex justify-end">
                      <PaymentBadge statut={l.statut as any} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {lignesFiltrees.length > 0 && (
              <div className="grid grid-cols-12 px-4 py-3 bg-gray-50 border-t border-gray-200">
                <span className="col-span-7 text-sm font-semibold text-gray-700">Total encaissé</span>
                <span className="col-span-2 text-sm text-right text-gray-500">
                  {formatCurrency(lignesFiltrees.reduce((s, l) => s + l.tarif, 0))}
                </span>
                <span className="col-span-2 text-sm font-bold text-green-600 text-right">
                  {formatCurrency(lignesFiltrees.reduce((s, l) => s + l.montant_paye, 0))}
                </span>
                <span className="col-span-1" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
