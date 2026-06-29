import jsPDF from 'jspdf'
import type { ComptaStats } from '@/hooks/useCompta'

const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR').format(new Date(d))

const statutLabels: Record<string, string> = {
  paid: 'Payé', pending: 'En attente', partial: 'Partiel',
  late: 'En retard', offered: 'Offert', cancelled: 'Annulé',
}

export function exportPDF(stats: ComptaStats, mois: number, annee: number) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const periode = `${moisLabels[mois - 1]} ${annee}`
  let y = 20

  const line = (text: string, x = 15, size = 10, bold = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(text, x, y)
    y += size * 0.5 + 2
  }

  const separator = () => {
    doc.setDrawColor(200)
    doc.line(15, y, 195, y)
    y += 5
  }

  // En-tête
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('CoachTrack', 15, 18)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Récapitulatif — ${periode}`, 15, 25)
  doc.setTextColor(0, 0, 0)
  y = 42

  // Section CA déclarable
  doc.setFillColor(239, 246, 255)
  doc.rect(12, y - 5, 186, 36, 'F')
  doc.setDrawColor(37, 99, 235)
  doc.rect(12, y - 5, 3, 36, 'F')

  line('MONTANT À DÉCLARER (BNC)', 20, 9, true)
  y += 2
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(formatEur(stats.caDeclarable), 20, y)
  y += 8
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Dont Salle : ${formatEur(stats.caDeclarableSalle)}   |   Particuliers : ${formatEur(stats.caDeclarableParticulier)}`, 20, y)
  y += 12

  separator()

  // Résumé
  line('RÉSUMÉ DU MOIS', 15, 10, true)
  y += 2
  const resumeItems = [
    [`Séances réalisées`, `${stats.nbSeancesDone}`],
    [`En attente d'encaissement`, formatEur(stats.enAttente)],
    [`Séances offertes`, `${stats.nbOfferts}`],
    [`Séances annulées`, `${stats.nbAnnules}`],
  ]
  for (const [label, val] of resumeItems) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(label, 20, y)
    doc.setFont('helvetica', 'bold')
    doc.text(val, 170, y, { align: 'right' })
    y += 7
  }
  y += 3
  separator()

  // Tableau des séances
  line('DÉTAIL DES SÉANCES', 15, 10, true)
  y += 2

  // En-têtes colonnes
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(243, 244, 246)
  doc.rect(12, y - 4, 186, 8, 'F')
  doc.text('Date', 15, y)
  doc.text('Client', 35, y)
  doc.text('Type', 95, y)
  doc.text('Tarif', 120, y)
  doc.text('Encaissé', 145, y)
  doc.text('Statut', 170, y)
  y += 8

  // Lignes
  doc.setFont('helvetica', 'normal')
  for (const l of stats.lignes) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(8)
    doc.text(formatDate(l.date), 15, y)
    doc.text(l.client.substring(0, 28), 35, y)
    doc.text(l.type === 'salle' ? 'Salle' : 'Particulier', 95, y)
    doc.text(formatEur(l.tarif), 120, y)
    doc.text(formatEur(l.montant_paye), 145, y)
    doc.text(statutLabels[l.statut] ?? l.statut, 170, y)
    y += 6
    doc.setDrawColor(240)
    doc.line(15, y - 1, 195, y - 1)
  }

  y += 8
  // Pied de page
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text('Document généré par CoachTrack — usage personnel', 105, 287, { align: 'center' })

  doc.save(`CoachTrack_${moisLabels[mois - 1]}_${annee}.pdf`)
}
