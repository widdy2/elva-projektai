import jsPDF from 'jspdf'
import type { Organization } from '../hooks/useOrganizationDetails'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (isNaN(n)) return [59, 130, 246]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function loadImage(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = dataUrl
    })
  } catch {
    return null
  }
}

/**
 * Nupiešia organizacijos antraštę PDF viršuje:
 * spalvota juosta, logo kairėje, rekvizitai dešinėje.
 * Grąžina Y koordinatę, nuo kurios tęsti turinį.
 */
export async function addOrgHeader(doc: jsPDF, org: Organization | null | undefined): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth()
  const [r, g, b] = hexToRgb(org?.brand_color || '#3b82f6')

  // Spalvota juosta viršuje
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pageWidth, 4, 'F')

  let contentY = 12

  // Logo kairėje
  if (org?.logo_url) {
    const img = await loadImage(org.logo_url)
    if (img && img.width > 0 && img.height > 0) {
      const maxH = 16
      const maxW = 45
      const ratio = img.width / img.height
      let h = maxH
      let w = h * ratio
      if (w > maxW) {
        w = maxW
        h = w / ratio
      }
      try {
        doc.addImage(img.dataUrl, 'AUTO', 14, contentY, w, h)
      } catch {
        // jei formato nepalaiko — praleidžiame logo
      }
    }
  }

  // Rekvizitai dešinėje
  if (org) {
    const lines: string[] = []
    if (org.name) lines.push(org.name)
    if (org.code) lines.push(`Imones kodas: ${org.code}`)
    if (org.vat_code) lines.push(`PVM kodas: ${org.vat_code}`)
    if (org.address) lines.push(org.address)
    const contact = [org.phone, org.email].filter(Boolean).join(' | ')
    if (contact) lines.push(contact)

    doc.setFontSize(11)
    doc.setTextColor(r, g, b)
    if (lines[0]) doc.text(lines[0], pageWidth - 14, contentY + 4, { align: 'right' })

    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    lines.slice(1).forEach((line, i) => {
      doc.text(line, pageWidth - 14, contentY + 9 + i * 4, { align: 'right' })
    })

    contentY = Math.max(contentY + 16, contentY + 9 + (lines.length - 1) * 4 + 4)
  } else {
    contentY += 12
  }

  // Plona linija po antrašte
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.5)
  doc.line(14, contentY, pageWidth - 14, contentY)
  doc.setTextColor(0, 0, 0)

  return contentY + 8
}
