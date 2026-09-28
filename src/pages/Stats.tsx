import { useState } from 'react'
import Select from '@/components/Select'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
    <div className="bg-card border border-hair rounded-xl px-4 md:px-5 py-4">
      <p className="text-xs text-muted font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-ink mt-1">{value}</p>
      {sub && <p className="text-xs text-faint mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Statistiques</h1>
          <p className="text-muted text-sm mt-0.5">Vue annuelle</p>
        </div>
        <Select
          value={String(annee)}
          options={annees.map(a => ({ value: String(a), label: String(a) }))}
          onChange={v => setAnnee(Number(v))}
          ariaLabel="Année"
          align="right"
          className="h-9 flex items-center gap-1.5 bg-card ring-1 ring-white/10 rounded-full px-3 text-sm font-medium text-ink2 tabular-nums hover:bg-white/5 transition-colors"
        />
      </div>

      {loading ? (
        <p className="text-faint text-sm">Chargement...</p>
      ) : (
        <>
          {/* KPIs annuels */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KPI label="CA annuel" value={formatCurrency(stats.totalAnnee)} sub={stats.totalForfaits > 0 ? `Dont forfaits : ${formatCurrency(stats.totalForfaits)}` : 'Encaissé'} />
            <KPI label="Espèces" value={formatCurrency(stats.totalCash)} />
            <KPI label="Virement" value={formatCurrency(stats.totalTransfer)} />
            <KPI label="Taux annulation" value={`${stats.tauxAnnulation}%`} sub={`Délai paiement : ${stats.delaiMoyenPaiement}j`} />
          </div>

          {/* CA mensuel : une seule courbe continue, le détail est dans l'infobulle */}
          <div className="bg-card border border-hair rounded-xl p-4 md:p-5 mb-4">
            <h2 className="font-semibold text-ink mb-4">CA mensuel {annee}</h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.ca12mois} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="aireCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9cc5a1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#9cc5a1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="mois" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#8a9894' }} />
                <YAxis width={52} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#8a9894' }} tickFormatter={v => `${v} €`} />
                <Tooltip content={<InfobulleCA />} cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="CA encaissé"
                  stroke="#9cc5a1"
                  strokeWidth={2}
                  fill="url(#aireCA)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#cfe5d1', stroke: '#161d21', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Taux annulation par client */}
          {stats.annulationsParClient.length > 0 && (
            <div className="bg-card border border-hair rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-hair">
                <h2 className="font-semibold text-ink">Annulations par client</h2>
                <p className="text-xs text-faint mt-0.5">Uniquement les clients ayant au moins une annulation</p>
              </div>
              <div className="divide-y divide-hair">
                {stats.annulationsParClient.map((c, i) => (
                  <div key={i} className="flex items-center flex-wrap gap-x-4 gap-y-1 px-4 md:px-5 py-3">
                    <span className="flex-1 text-sm font-medium text-ink">{c.nom}</span>
                    <span className="text-sm text-faint">{c.annulees} annulation{c.annulees > 1 ? 's' : ''} / {c.done + c.annulees} séances</span>
                    <div className="w-24 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.taux >= 30 ? 'bg-late/80' : 'bg-wait/80'}`}
                          style={{ width: `${c.taux}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-9 text-right tabular-nums ${c.taux >= 30 ? 'text-late' : 'text-wait'}`}>
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
            <div className="bg-card border border-hair rounded-xl p-5">
              <h2 className="font-semibold text-ink mb-4">Répartition</h2>
              {stats.totalAnnee === 0 ? (
                <p className="text-faint text-sm text-center py-8">Aucune donnée</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats.repartition.filter(r => r.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={98}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#161d21"
                      strokeWidth={2}
                    >
                      {stats.repartition.filter(r => r.value > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<InfobulleGeneste />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {stats.totalAnnee > 0 && (
                <ul className="flex flex-col gap-1.5 mt-3">
                  {stats.repartition.filter(r => r.value > 0).map(r => (
                    <li key={r.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} aria-hidden="true" />
                      <span className="flex-1 text-ink2">{r.name}</span>
                      <span className="text-muted tabular-nums">{formatCurrency(r.value)}</span>
                      <span className="w-10 text-right text-faint tabular-nums">{Math.round((r.value / stats.totalAnnee) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top clients */}
            <div className="bg-card border border-hair rounded-xl p-5">
              <h2 className="font-semibold text-ink mb-4">Top clients</h2>
              {stats.topClients.length === 0 ? (
                <p className="text-faint text-sm text-center py-8">Aucune donnée</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.topClients.map((client, i) => {
                    const pct = stats.totalAnnee > 0 ? (client.ca / stats.totalAnnee) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between flex-wrap gap-x-3 text-sm mb-1">
                          <span className="font-medium text-ink">{client.nom}</span>
                          <span className="text-muted">{formatCurrency(client.ca)} · {client.nbSeances} séance{client.nbSeances > 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[linear-gradient(90deg,#5e8c66,#9cc5a1)]" style={{ width: `${pct}%` }} />
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

// Infobulle sombre : total du mois et détail par moyen de paiement
function InfobulleCA({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const autre = (d.total ?? 0) - (d.cash ?? 0) - (d.transfer ?? 0) - (d.forfait ?? 0)
  const lignes: [string, number][] = [
    ['Espèces', d.cash ?? 0],
    ['Virement', d.transfer ?? 0],
    ['Forfaits', d.forfait ?? 0],
    ['Mode non précisé', autre],
  ]
  return (
    <div className="bg-card ring-1 ring-hair rounded-xl shadow-2xl shadow-black/50 px-3 py-2 text-sm">
      <p className="font-medium text-ink">{label}</p>
      <p className="font-display font-bold text-accent tabular-nums mt-0.5">{formatCurrency(d.total)}</p>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {lignes.filter(([, v]) => v > 0).map(([nom, v]) => (
          <p key={nom} className="flex justify-between gap-4 text-xs text-muted tabular-nums">
            <span>{nom}</span>
            <span className="text-ink2">{formatCurrency(v)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

// Infobulle du camembert
function InfobulleGeneste({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-card ring-1 ring-hair rounded-xl shadow-2xl shadow-black/50 px-3 py-2 text-sm">
      <p className="text-ink2">{d.name}</p>
      <p className="font-display font-bold text-ink tabular-nums">{formatCurrency(Number(d.value))}</p>
    </div>
  )
}
