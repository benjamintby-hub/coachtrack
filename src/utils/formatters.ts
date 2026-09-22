export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)

export const formatDate = (date: Date | string): string =>
  new Intl.DateTimeFormat('fr-FR').format(new Date(date))

export const formatDateShort = (date: Date | string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(date))

// Date locale au format YYYY-MM-DD (toISOString décalerait d'un jour à cause du fuseau)
export const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
