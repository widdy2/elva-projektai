import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfLineItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
}

// Skaičiaus atpažinimas: "12,50" arba "12.50" arba "1 234,56"
export function parseNumber(s: string): number | null {
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Ištraukia visą tekstą iš PDF failo, sugrupuotą pagal eilutes
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Grupuoti teksto elementus pagal Y koordinatę (eilutes)
    const lineMap = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5])
      const existing = [...lineMap.keys()].find(k => Math.abs(k - y) < 3)
      const key = existing ?? y
      if (!lineMap.has(key)) lineMap.set(key, [])
      lineMap.get(key)!.push({ x: item.transform[4], str: item.str })
    }

    const sortedLines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.str).join(' '))

    fullText += sortedLines.join('\n') + '\n'
  }

  return fullText
}

// Išskaido PDF tekstą į pozicijas
// Formatas: "N. kodas prekės_kodas pavadinimas VNT kiekis kaina suma"
// Pavadinimas gali tęstis kitoje eilutėje
export function parseItems(text: string): PdfLineItem[] {
  const items: PdfLineItem[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const UNIT = '(EA|vnt\.?|m2|m²|m3|m³|kg|g|ml|l|m|kompl\.?|pak\.?|rit\.?|val\.?|vnt|tk|gb|m\.?vnt)'
  // Variantas A: PAVADINIMAS VNT KIEKIS KAINA SUMA (du skaičiai gale)
  const itemRegex = new RegExp(`^(.*?)\\s+${UNIT}\\s+(\\d+(?:[.,]\\d+)?)\\s+([\\d\\s]*[.,]\\d{2})\\s+([\\d\\s]*[.,]\\d{2})\\s*$`, 'i')
  // Variantas B: PAVADINIMAS VNT KIEKIS SUMA (vienas skaičius gale — vieneto kaina = suma/kiekis)
  const itemRegexShort = new RegExp(`^(.*?)\\s+${UNIT}\\s+(\\d+(?:[.,]\\d+)?)\\s+([\\d\\s]*[.,]\\d{2})\\s*$`, 'i')

  // Eilutės kurias reikia praleisti (antraštės, sumos, parašai)
  const skipPatterns = /viso|pvm\b|suma\b|sąskaita|pardav|pirk|pristatymo|adresas|telefonas|kodas|pavadinimas|kiekis|kaina|parašas|užsakymas|žodžiais|p\.\d|gavau|išrašė|registre|duomenys|skolinimo|dokumentas|ofisas|objekto|užsakė|nr\.|data|vnt\.|prek|aktas|priėm|perdav/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let match = line.match(itemRegex)
    let unitPrice: number
    let quantity: number
    let name: string
    let unit: string

    if (match) {
      name = match[1].trim()
      unit = match[2].replace('.', '')
      quantity = parseNumber(match[3]) || 1
      unitPrice = parseNumber(match[4]) || 0
    } else {
      match = line.match(itemRegexShort)
      if (!match) continue
      name = match[1].trim()
      unit = match[2].replace('.', '')
      quantity = parseNumber(match[3]) || 1
      const total = parseNumber(match[4]) || 0
      unitPrice = quantity > 0 ? total / quantity : total
    }

    // Pašalinti "N. kodas prekės_kodas" iš pavadinimo pradžios
    name = name.replace(/^\d+\.\s+\d+\s+\S+\s+/, '').trim()
    if (/^\d+\./.test(name)) {
      name = name.replace(/^\d+\.\s+\d+\s+/, '').trim()
    }
    if (/^\d+\./.test(name)) {
      name = name.replace(/^\d+\.\s+/, '').trim()
    }

    if (name.length < 2 || unitPrice <= 0) continue
    if (skipPatterns.test(name)) continue

    // Pavadinimas gali tęstis sekančiose eilutėse
    let j = i + 1
    while (j < lines.length) {
      const next = lines[j]
      if (next.match(itemRegex) || next.match(itemRegexShort)) break
      if (/^\d+\.\s+\d+/.test(next)) break
      if (skipPatterns.test(next)) break
      name += ' ' + next
      j++
    }
    i = j - 1

    items.push({ name, quantity, unit, unit_price: unitPrice })
  }

  return items
}
