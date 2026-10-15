import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ProjectWork } from '../hooks/useProjectWorks'
import type { ProjectMaterial } from '../hooks/useMaterials'
import type { Organization } from '../hooks/useOrganizationDetails'
import { addOrgHeader } from './pdfHeader'

export interface ActProjectInfo {
  name?: string
  address?: string
  clients?: { name?: string } | null
}

/**
 * Sugeneruoja ir atsisiunčia atliktų darbų akto PDF:
 * atlikti darbai + sunaudotos medžiagos + sumos su PVM.
 */
export async function downloadActPdf(
  actNumber: string,
  project: ActProjectInfo,
  works: ProjectWork[],
  materials: ProjectMaterial[] | undefined,
  org: Organization | null | undefined
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const startY = await addOrgHeader(doc, org)

  doc.setFontSize(18)
  doc.setFont('DejaVuSans', 'bold')
  doc.text('ATLIKTŲ DARBŲ AKTAS', pageWidth / 2, startY + 6, { align: 'center' })
  doc.setFont('DejaVuSans', 'normal')
  doc.setFontSize(12)
  doc.text(actNumber, pageWidth / 2, startY + 14, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Objektas: ${project.name || ''}`, 14, startY + 26)
  doc.text(`Adresas: ${project.address || ''}`, 14, startY + 32)
  doc.text(`Klientas: ${project.clients?.name || ''}`, 14, startY + 38)
  doc.text(`Data: ${new Date().toLocaleDateString('lt-LT')}`, 14, startY + 44)

  const completedWorks = works.filter(w => w.status === 'completed')
  const worksTotal = completedWorks.reduce((s, w) => s + (w.quantity || 0) * (w.work_price || 0), 0)
  autoTable(doc, {
    startY: startY + 51,
    head: [['Darbas', 'Kiekis', 'Mato vnt.', '€/vnt', 'Suma €']],
    body: completedWorks.map(w => [
      w.name,
      (w.quantity || 0).toFixed(2),
      w.unit || 'vnt',
      (w.work_price || 0).toFixed(2),
      ((w.quantity || 0) * (w.work_price || 0)).toFixed(2),
    ]),
    styles: { fontSize: 9, font: 'DejaVuSans' },
    headStyles: { fillColor: [66, 66, 66], font: 'DejaVuSans', fontStyle: 'bold' },
  })

  const usedMats = (materials || []).filter(m => m.used_quantity > 0 || m.warehouse_item_id)
  const materialsTotal = usedMats.reduce(
    (s, m) => s + (m.used_quantity > 0 ? m.used_quantity : m.purchased_quantity) * (m.sale_price ?? m.unit_price),
    0
  )
  const materialsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  if (usedMats.length > 0) {
    doc.setFontSize(12)
    doc.text('Sunaudotos medžiagos:', 14, materialsY)
    autoTable(doc, {
      startY: materialsY + 5,
      head: [['Medžiaga', 'Kiekis', 'Mato vnt.', '€/vnt', 'Suma €']],
      body: usedMats.map(m => [
        m.name,
        (m.used_quantity > 0 ? m.used_quantity : m.purchased_quantity).toFixed(2),
        m.unit,
        (m.sale_price ?? m.unit_price).toFixed(2),
        ((m.used_quantity > 0 ? m.used_quantity : m.purchased_quantity) * (m.sale_price ?? m.unit_price)).toFixed(2),
      ]),
      styles: { fontSize: 9, font: 'DejaVuSans' },
      headStyles: { fillColor: [66, 66, 66], font: 'DejaVuSans', fontStyle: 'bold' },
    })
  }

  // Galutinė suma akte
  const totalNet = worksTotal + materialsTotal
  const totalGross = totalNet * 1.21
  const totalsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(10)
  doc.setFont('DejaVuSans', 'bold')
  doc.text(`Darbai: ${worksTotal.toFixed(2)} €`, pageWidth - 14, totalsY, { align: 'right' })
  doc.text(`Medžiagos: ${materialsTotal.toFixed(2)} €`, pageWidth - 14, totalsY + 6, { align: 'right' })
  doc.text(`Suma be PVM: ${totalNet.toFixed(2)} €`, pageWidth - 14, totalsY + 12, { align: 'right' })
  doc.text(`PVM (21%): ${(totalNet * 0.21).toFixed(2)} €`, pageWidth - 14, totalsY + 18, { align: 'right' })
  doc.text(`IŠ VISO su PVM: ${totalGross.toFixed(2)} €`, pageWidth - 14, totalsY + 24, { align: 'right' })
  doc.setFont('DejaVuSans', 'normal')

  const finalY = totalsY + 34
  doc.setFontSize(10)
  doc.text('Vadovas: _______________________', 14, finalY)
  doc.text('Klientas: _______________________', pageWidth - 80, finalY)

  doc.save(`${actNumber}.pdf`)
}
