import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Quote, QuoteItem } from '../hooks/useQuotes'
import type { PriceItem } from '../hooks/usePricelist'
import type { Organization } from '../hooks/useOrganizationDetails'
import { addOrgHeader } from './pdfHeader'

/**
 * Sugeneruoja ir atsisiunčia pasiūlymo PDF —
 * tas pats stilius kaip sąskaitose (logo, spalva, DejaVu).
 */
export async function downloadQuotePdf(
  quote: Quote & { clients?: { name: string } },
  quoteItems: QuoteItem[],
  priceItems: PriceItem[] | undefined,
  org: Organization | null | undefined
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const startY = await addOrgHeader(doc, org)

  // Antraštė — centruota
  doc.setFontSize(16)
  doc.setFont('DejaVuSans', 'bold')
  doc.text('Darbų pasiūlymas', pageWidth / 2, startY + 4, { align: 'center' })
  doc.setFont('DejaVuSans', 'normal')
  doc.setFontSize(10)
  doc.text(`Data: ${new Date(quote.created_at).toLocaleDateString('lt-LT')}`, pageWidth / 2, startY + 11, { align: 'center' })

  // Klientas (kairė) / Objektas (dešinė)
  const blockY = startY + 22
  const rightX = pageWidth / 2 + 6

  doc.setFontSize(10)
  doc.setFont('DejaVuSans', 'bold')
  doc.text('Klientas:', 14, blockY)
  doc.text('Objektas:', rightX, blockY)
  doc.setFont('DejaVuSans', 'normal')
  doc.setFontSize(9)

  const clientLines: string[] = []
  const cName = quote.client_name || quote.clients?.name
  if (cName) clientLines.push(cName)
  if (quote.client_email) clientLines.push(quote.client_email)
  if (quote.client_phone) clientLines.push(quote.client_phone)

  const addrLines = quote.address
    ? (doc.splitTextToSize(quote.address, pageWidth - 14 - rightX) as string[])
    : []

  const colWidth = rightX - 14 - 4
  const clientWrapped = clientLines.flatMap(l => doc.splitTextToSize(l, colWidth) as string[])
  clientWrapped.forEach((l, i) => doc.text(l, 14, blockY + 6 + i * 4.5))
  addrLines.forEach((l, i) => doc.text(l, rightX, blockY + 6 + i * 4.5))

  const tableY = blockY + 10 + Math.max(clientWrapped.length, addrLines.length, 1) * 4.5

  // Pozicijos: Paslaugos ir Prekės atskiromis sekcijomis
  const isProduct = (item: QuoteItem) => {
    if (item.warehouse_item_id) return true
    const pi = priceItems?.find(p => p.id === item.price_item_id)
    if (pi) return pi.item_type === 'product'
    return item.work_price === 0
  }
  const services = quoteItems.filter(i => !isProduct(i))
  const products = quoteItems.filter(isProduct)

  const body: (string | { content: string; colSpan: number; styles: object })[][] = []
  let nr = 0
  const pushRow = (i: QuoteItem) => {
    nr++
    const price = isProduct(i) ? i.material_price : i.work_price
    body.push([
      nr.toString(),
      i.name,
      i.unit || 'vnt',
      i.quantity.toString(),
      price.toFixed(2),
      (price * i.quantity).toFixed(2),
    ])
  }

  if (services.length > 0) {
    body.push([{ content: 'Paslaugos', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
    services.forEach(pushRow)
  }
  if (products.length > 0) {
    body.push([{ content: 'Prekės', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
    products.forEach(pushRow)
  }

  autoTable(doc, {
    startY: tableY,
    head: [['Nr.', 'Pavadinimas', 'vnt./m.', 'Kiekis', 'Kaina', 'Suma']],
    body,
    styles: { fontSize: 9, font: 'DejaVuSans', overflow: 'linebreak', cellPadding: 1.5 },
    headStyles: { fillColor: [66, 66, 66], font: 'DejaVuSans', fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
  })

  // Sumos — jei netelpa, naujas puslapis
  const pageHeight = doc.internal.pageSize.getHeight()
  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  if (finalY + 45 > pageHeight - 14) {
    doc.addPage()
    finalY = 20
  }

  const servicesSum = services.reduce((s, i) => s + i.work_price * i.quantity, 0)
  const productsSum = products.reduce((s, i) => s + i.material_price * i.quantity, 0)
  const subtotal = servicesSum + productsSum
  const vat = subtotal * 0.21

  doc.setFontSize(10)
  if (services.length > 0 && products.length > 0) {
    doc.text(`Paslaugos ${servicesSum.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' })
    doc.text(`Prekės ${productsSum.toFixed(2)}`, pageWidth - 14, finalY + 5, { align: 'right' })
    finalY += 5
  }
  doc.text(`Suma be PVM ${subtotal.toFixed(2)}`, pageWidth - 14, finalY + 5, { align: 'right' })
  doc.text(`PVM 21% ${vat.toFixed(2)}`, pageWidth - 14, finalY + 10, { align: 'right' })
  doc.setFont('DejaVuSans', 'bold')
  doc.setFontSize(11)
  doc.text(`Viso su PVM ${(subtotal + vat).toFixed(2)}`, pageWidth - 14, finalY + 17, { align: 'right' })
  doc.setFont('DejaVuSans', 'normal')

  // Parašų eilutės
  const sigY = finalY + 30
  doc.setFontSize(10)
  doc.text('Pasiūlymą parengė:', 14, sigY)
  doc.text('Užsakovas:', rightX, sigY)
  doc.line(14, sigY + 12, 14 + 70, sigY + 12)
  doc.line(rightX, sigY + 12, rightX + 70, sigY + 12)
  doc.setFontSize(8)
  doc.text('Vardas, pavardė, parašas', 14, sigY + 16)
  doc.text('Vardas, pavardė, parašas', rightX, sigY + 16)

  doc.save(`Pasiulymas-${new Date(quote.created_at).toISOString().split('T')[0]}.pdf`)
}
