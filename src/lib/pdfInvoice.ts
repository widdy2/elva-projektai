import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice, InvoiceItem } from '../hooks/useInvoices'
import type { Organization } from '../hooks/useOrganizationDetails'
import { addOrgHeader } from './pdfHeader'
import { amountToWords } from './numberToWords'

/**
 * Sugeneruoja ir atsisiunčia sąskaitos PDF.
 * Atvirkštinei sąskaitai (reverse_charge): antraštė be "PVM",
 * PVM 0% ir privaloma pastraipa "Atvirkštinis apmokestinimas pagal 96 str."
 */
export async function downloadInvoicePdf(
  invoice: Invoice,
  items: InvoiceItem[] | null,
  org: Organization | null | undefined
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const startY = await addOrgHeader(doc, org)

  // Antraštė pagal ELVA pavyzdį — centruota
  doc.setFontSize(16)
  doc.setFont('DejaVuSans', 'bold')
  doc.text(invoice.reverse_charge ? 'Sąskaita faktūra' : 'PVM Sąskaita faktūra', pageWidth / 2, startY + 4, { align: 'center' })
  doc.setFont('DejaVuSans', 'normal')
  doc.setFontSize(10)
  doc.text(`Dok. Nr. ${invoice.invoice_number}`, pageWidth / 2, startY + 11, { align: 'center' })
  doc.text(`Data: ${new Date(invoice.issue_date).toLocaleDateString('lt-LT')}`, pageWidth / 2, startY + 17, { align: 'center' })
  if (invoice.due_date) {
    doc.text(`Apmokėti iki: ${new Date(invoice.due_date).toLocaleDateString('lt-LT')}`, pageWidth / 2, startY + 23, { align: 'center' })
  }

  // Pardavėjas (kairė) / Užsakovas (dešinė)
  const blockY = startY + (invoice.due_date ? 31 : 25)
  const rightX = pageWidth / 2 + 6

  doc.setFontSize(10)
  doc.setFont('DejaVuSans', 'bold')
  doc.text(org?.name || '', 14, blockY)
  doc.text('Užsakovas:', rightX, blockY)
  doc.setFont('DejaVuSans', 'normal')
  doc.setFontSize(9)

  const sellerLines: string[] = []
  if (org?.code) sellerLines.push(`Įmonės kodas: ${org.code}`)
  if (org?.vat_code) sellerLines.push(`PVM mokėtojo kodas: ${org.vat_code}`)
  if (org?.address) sellerLines.push(`Įm. adresas: ${org.address}`)
  if (org?.bank_name) sellerLines.push(org.bank_name)
  if (org?.bank_account) sellerLines.push(`A.s.: ${org.bank_account}`)
  if (org?.phone) sellerLines.push(`Tel.: ${org.phone}`)
  if (org?.email) sellerLines.push(org.email)

  const client = invoice.clients
  const buyerLines: string[] = []
  if (client?.name) buyerLines.push(client.name)
  if (client?.code) buyerLines.push(`Įmonės kodas: ${client.code}`)
  if (client?.vat_code) buyerLines.push(`PVM mokėtojo kodas: ${client.vat_code}`)
  if (client?.address) buyerLines.push(`Adresas: ${client.address}`)
  if (invoice.projects?.name) buyerLines.push(`Objektas: ${invoice.projects.name}`)
  if (invoice.projects?.address) buyerLines.push(`Objekto adresas: ${invoice.projects.address}`)

  // Laužome eilutes, kad kairys blokas neužlietų dešiniojo
  const colWidth = rightX - 14 - 4
  const sellerWrapped = sellerLines.flatMap(l => doc.splitTextToSize(l, colWidth) as string[])
  const buyerWrapped = buyerLines.flatMap(l => doc.splitTextToSize(l, pageWidth - 14 - rightX) as string[])
  sellerWrapped.forEach((l, i) => doc.text(l, 14, blockY + 6 + i * 4.5))
  buyerWrapped.forEach((l, i) => doc.text(l, rightX, blockY + 6 + i * 4.5))

  const tableY = blockY + 10 + Math.max(sellerWrapped.length, buyerWrapped.length) * 4.5

  // Pozicijos: Darbai ir Medžiagos atskiromis sekcijomis
  const allItems = items || []
  const isMaterial = (i: { item_type?: string; name: string }) =>
    i.item_type === 'material' || /\(medžiaga\)/i.test(i.name)
  const workItems = allItems.filter(i => !isMaterial(i))
  const materialItems = allItems.filter(i => isMaterial(i))

  const body: (string | { content: string; colSpan: number; styles: object })[][] = []
  let nr = 0
  const pushRow = (i: { name: string; quantity: number; unit: string; unit_price: number; total: number }) => {
    nr++
    body.push([
      nr.toString(),
      i.name.replace(/\s*\(medžiaga\)\s*/i, ''),
      i.unit,
      i.quantity.toString(),
      i.unit_price.toFixed(2),
      i.total.toFixed(2),
    ])
  }

  if (workItems.length > 0) {
    body.push([{ content: 'Darbai', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
    workItems.forEach(pushRow)
  }
  if (materialItems.length > 0) {
    body.push([{ content: 'Medžiagos', colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }])
    materialItems.forEach(pushRow)
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
      2: { cellWidth: 16 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
  })

  // Jei sumos/parašai netelpa puslapyje — naujas puslapis
  const pageHeight = doc.internal.pageSize.getHeight()
  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  if (finalY + 70 > pageHeight - 14) {
    doc.addPage()
    finalY = 20
  }
  doc.setFontSize(10)
  doc.text(`Suma ${invoice.subtotal.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' })
  doc.text(`PVM ${invoice.vat_rate}% ${invoice.vat_amount.toFixed(2)}`, pageWidth - 14, finalY + 5, { align: 'right' })
  doc.setFont('DejaVuSans', 'bold')
  doc.setFontSize(11)
  doc.text(`Suma apmokėjimui ${invoice.total.toFixed(2)}`, pageWidth - 14, finalY + 12, { align: 'right' })
  doc.setFont('DejaVuSans', 'normal')

  let extraY = finalY + 18

  // Atvirkštinis PVM (PVMĮ 96 str.) — privaloma pastraipa sąskaitoje
  if (invoice.reverse_charge) {
    doc.setFontSize(10)
    doc.setFont('DejaVuSans', 'bold')
    doc.text('Atvirkštinis apmokestinimas pagal 96 str.', 14, extraY)
    doc.setFont('DejaVuSans', 'normal')
    extraY += 6
  }

  // Suma žodžiais
  doc.setFontSize(9)
  const wordsLines = doc.splitTextToSize(`Suma žodžiais: ${amountToWords(invoice.total)}`, pageWidth - 28) as string[]
  wordsLines.forEach((line, i) => doc.text(line, 14, extraY + i * 4.5))
  extraY += (wordsLines.length - 1) * 4.5

  if (invoice.notes) {
    doc.text(`Pastabos: ${invoice.notes}`, 14, extraY + 8)
    extraY += 8
  }

  // Parašų eilutės
  const sigY = extraY + 10
  doc.setFontSize(10)
  doc.text('Sąskaitą išrašė:', 14, sigY)
  doc.text('Užsakovas:', rightX, sigY)
  doc.line(14, sigY + 12, 14 + 70, sigY + 12)
  doc.line(rightX, sigY + 12, rightX + 70, sigY + 12)
  doc.setFontSize(8)
  doc.text('Vardas, pavardė, parašas', 14, sigY + 16)
  doc.text('Vardas, pavardė, parašas', rightX, sigY + 16)

  doc.save(`${invoice.invoice_number}.pdf`)
}
