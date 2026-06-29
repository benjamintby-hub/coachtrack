import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useStats } from '@/hooks/useStats'
import { formatCurrency } from '@/utils/formatters'

export default function Stats() {
  const now = new Date()
  const [annee, setAnnee] = useState(now.getFullYear())
  const { stats, loading } = useStats(annee)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vue annuelle</p>
        </div>
        <select
          value={annee}
          onChange={e => setAnnee(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Chargement...</p>
      ) : (
        <>
          {/* KPIs annuels */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KPI label="CA annuel" value={formatCurrency(stats.totalAnnee)} sub="Encaissé" />
            <KPI label="Salle" value={formatCurrency(stats.repartition[0]?.value ?? 0)} />
            <KPI label="Particuliers" value={formatCurrency(stats.repartition[1]?.value ?? 0)} />
            <KPI label="Taux annulation" value={`${stats.tauxAnnulation}%`} sub={`Délai paiement : ${stats.delaiMoyenPaiement}j`} />
          </div>

          {/* Graphique CA 12 mois */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="font-semibold text-gray-900 mb-4">CA mensuel {annee}</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.ca12mois} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="salle" name="Salle" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="particulier" name="Particuliers" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Taux annulation par client */}
          {stats.annulationsParClient.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Annulations par client</h2>
                <p className="text-xs text-gray-400 mt-0.5">Uniquement les clients ayant au moins une annulation</p>
              </div>
              <div className="divide-y divide-gray-50">
                {stats.annulationsParClient.map((c, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <span className="flex-1 text-sm font-medium text-gray-800">{c.nom}</span>
                    <span className="text-sm text-gray-400">{c.annulees} annulation{c.annulees > 1 ? 's' : ''} / {c.done + c.annulees} séances</span>
                    <div className="w-24 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.taux >= 30 ? 'bg-red-400' : c.taux >= 15 ? 'bg-orange-400' : 'bg-yellow-400'}`}
                          style={{ width: `${c.taux}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-9 text-right ${c.taux >= 30 ? 'text-red-500' : c.taux >= 15 ? 'text-orange-500' : 'text-yellow-600'}`}>
                        {c.taux}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Camembert répartition */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Répartition</h2>
              {stats.totalAnnee === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.repartition.filter(r => r.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                      labelLine={false}
                    >
                      {stats.repartition.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top clients */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Top clients</h2>
              {stats.topClients.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.topClients.map((client, i) => {
                    const pct = stats.totalAnnee > 0 ? (client.ca / stats.totalAnnee) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-800">{client.nom}</span>
                          <span className="text-gray-500">{formatCurrency(client.ca)} · {client.nbSeances} séance{client.nbSeances > 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
