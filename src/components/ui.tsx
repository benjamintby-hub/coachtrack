import type { ClientType, PaymentStatus } from '@/types'
import { paymentStatusConfig } from '@/utils/paymentStatus'
import Select, { type SelectOption } from '@/components/Select'

const joursCourts = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

// Date d'une séance en bloc vertical : jour de la semaine, numéro, mois
export function DateBlock({ date }: { date: string }) {
  const [y, m, d] = date.split('-').map(Number)
  const jour = new Date(y, m - 1, d)
  return (
    <div className="w-11 shrink-0 text-center leading-none" aria-label={jour.toLocaleDateString('fr-FR')}>
      <p className="text-[11px] font-medium text-faint uppercase">{joursCourts[jour.getDay()]}</p>
      <p className="text-lg font-display font-semibold text-ink tabular-nums mt-0.5">{d}</p>
      <p className="text-[11px] text-faint mt-0.5">{moisCourts[m - 1]}</p>
    </div>
  )
}

// Initiales du client, teintées selon le type (salle / particulier)
export function Avatar({ prenom, nom, type, size = 'md' }: { prenom?: string; nom?: string; type: ClientType; size?: 'md' | 'lg' }) {
  const initiales = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
  const couleur = type === 'salle' ? 'bg-info/12 text-info' : 'bg-sand/10 text-sand'
  const taille = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-9 h-9 text-xs'
  return (
    <div className={`${taille} ${couleur} rounded-full flex items-center justify-center font-semibold shrink-0`} aria-hidden="true">
      {initiales}
    </div>
  )
}

// Pastille cliquable ouvrant le menu maison (le menu natif ne peut pas être stylisé)
function PastilleSelect({ label, value, onChange, className, options, ariaLabel }: {
  label: string
  value: string
  onChange: (value: string) => void
  className: string
  options: SelectOption[]
  ariaLabel: string
}) {
  return (
    <span className="inline-flex shrink-0" onClick={e => e.stopPropagation()}>
      <Select
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={ariaLabel}
        className={`inline-flex items-center gap-1 rounded-full pl-2.5 pr-2 py-1 text-xs font-medium transition-transform active:scale-[0.96] ${className}`}
      >
        {label}
      </Select>
    </span>
  )
}

const statutsPaiement: SelectOption[] = (Object.keys(paymentStatusConfig) as PaymentStatus[])
  .map(s => ({ value: s, label: paymentStatusConfig[s].label }))

export function StatutSelect({ statut, onChange }: { statut: PaymentStatus; onChange: (statut: PaymentStatus) => void }) {
  const config = paymentStatusConfig[statut] ?? paymentStatusConfig.pending
  return (
    <PastilleSelect
      label={config.label}
      value={statut}
      onChange={v => onChange(v as PaymentStatus)}
      className={config.className}
      options={statutsPaiement}
      ariaLabel="Statut du paiement"
    />
  )
}

const modesPaiement: Record<string, string> = { cash: 'Espèces', transfer: 'Virement' }

const optionsMode: SelectOption[] = [
  { value: '', label: 'Non précisé' },
  ...Object.entries(modesPaiement).map(([value, label]) => ({ value, label })),
]

export function ModeSelect({ mode, onChange }: { mode?: string; onChange: (mode: string) => void }) {
  return (
    <PastilleSelect
      label={mode ? (modesPaiement[mode] ?? mode) : 'Mode'}
      value={mode ?? ''}
      onChange={onChange}
      className={mode ? 'bg-white/8 text-ink2' : 'bg-card text-faint ring-1 ring-inset ring-hair'}
      options={optionsMode}
      ariaLabel="Mode de paiement"
    />
  )
}
