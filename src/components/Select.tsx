import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
  /** Contenu du bouton ; par défaut le libellé de l'option choisie */
  children?: React.ReactNode
  className?: string
  /** Alignement du menu sous le bouton */
  align?: 'left' | 'right'
  disabled?: boolean
}

// Menu déroulant maison : le menu natif du système ne peut pas être stylisé
// (coins carrés, fond clair), celui-ci reprend les arrondis et les couleurs de l'appli.
export default function Select({ value, options, onChange, ariaLabel, children, className = '', align = 'left', disabled }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [survol, setSurvol] = useState(() => Math.max(0, options.findIndex(o => o.value === value)))
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; minWidth: number; maxHeight: number } | null>(null)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const choisie = options.find(o => o.value === value)

  const placer = () => {
    const bouton = boutonRef.current
    if (!bouton) return
    const r = bouton.getBoundingClientRect()
    const largeurMenu = Math.max(r.width, 160)
    const left = align === 'right' ? r.right - largeurMenu : r.left
    // Pas assez de place en dessous : le menu s'ouvre vers le haut
    // Sur téléphone, la barre de navigation du bas masque le dernier tiers du menu
    const margeBas = window.innerWidth < 768 ? 84 : 16
    const placeDessous = window.innerHeight - r.bottom - margeBas
    const placeDessus = r.top - 12
    const versLeHaut = placeDessous < 220 && placeDessus > placeDessous
    setPosition({
      top: versLeHaut ? undefined : r.bottom + 6,
      bottom: versLeHaut ? window.innerHeight - r.top + 6 : undefined,
      left: Math.min(Math.max(8, left), window.innerWidth - largeurMenu - 8),
      minWidth: largeurMenu,
      maxHeight: Math.max(160, (versLeHaut ? placeDessus : placeDessous) - 8),
    })
  }

  const ouvrir = () => {
    setSurvol(Math.max(0, options.findIndex(o => o.value === value)))
    placer()
    setOuvert(true)
  }

  // Le menu suit le bouton et se referme si la page bouge sous lui
  useLayoutEffect(() => {
    if (!ouvert) return
    const fermer = () => setOuvert(false)
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('resize', fermer)
    return () => {
      window.removeEventListener('scroll', fermer, true)
      window.removeEventListener('resize', fermer)
    }
  }, [ouvert])

  useEffect(() => {
    if (!ouvert) return
    menuRef.current?.focus()
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node
      if (!menuRef.current?.contains(cible) && !boutonRef.current?.contains(cible)) setOuvert(false)
    }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [ouvert])

  const choisir = (v: string) => {
    setOuvert(false)
    boutonRef.current?.focus()
    if (v !== value) onChange(v)
  }

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOuvert(false); boutonRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSurvol(i => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSurvol(i => Math.max(0, i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setSurvol(0) }
    else if (e.key === 'End') { e.preventDefault(); setSurvol(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = options[survol]; if (o) choisir(o.value) }
  }

  return (
    <>
      <button
        type="button"
        ref={boutonRef}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className={className}
      >
        {children ?? choisie?.label ?? ''}
        <ChevronDown size={13} strokeWidth={2.5} aria-hidden="true" className="opacity-60 shrink-0" />
      </button>

      {ouvert && position && createPortal(
        <ul
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={auClavier}
          style={{ top: position.top, bottom: position.bottom, left: position.left, minWidth: position.minWidth, maxHeight: position.maxHeight }}
          className="fixed z-[60] overflow-y-auto p-1 rounded-2xl bg-card ring-1 ring-hair shadow-2xl shadow-black/50 focus:outline-none"
        >
          {options.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setSurvol(i)}
                onClick={() => choisir(o.value)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                  i === survol ? 'bg-white/8' : ''
                } ${o.value === value ? 'text-accent font-medium' : 'text-ink2'}`}
              >
                <Check size={14} aria-hidden="true" className={o.value === value ? 'opacity-100' : 'opacity-0'} />
                {o.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}
