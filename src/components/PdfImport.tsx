import { useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface ParsedItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
  note?: string | null
}

export interface ImportResult {
  inserted: number
  merged: number
}

interface PdfImportProps {
  onImport: (items: ParsedItem[]) => Promise<ImportResult | void>
}

// Skaičiaus atpažinimas: "12,50" arba "12.50" arba "1 234,56"
function parseNumber(s: string): number | null {
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Iš PDF teksto ištraukia objekto pavadinimą (pvz. "Objektas: Vilniaus g. 1")
function extractObjectName(text: string): string | null {
  const lines = text.split('\n')
  for (const line of lines) {
    const m = line.match(/objekt\w*\s*(?:pavadinimas|adresas)?\s*[:\-\u2013]\s*(.+)/i)
    if (m && m[1]) {
      const val = m[1].trim()
      if (val.length > 2 && val.length < 120) return val
    }
  }
  return null
}

// Išskaido PDF tekstą į pozicijas
// Formatas: "N. kodas prekės_kodas pavadinimas VNT kiekis kaina suma"
// Pavadinimas gali tęstis kitoje eilutėje
function parseItems(text: string): ParsedItem[] {
  const items: ParsedItem[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Eilutė baigiasi: VNT KIEKIS KAINA SUMA (du skaičiai su kableliu gale)
  const itemRegex = /^(.*?)\s+(EA|vnt\.?|m2|m²|m3|m³|kg|g|ml|l|m|kompl\.?|pak\.?|rit\.?|val\.?|vnt)\s+(\d+(?:[.,]\d+)?)\s+([\d\s]*[.,]\d{2})\s+([\d\s]*[.,]\d{2})\s*$/i

  // Eilutės kurias reikia praleisti (antraštės, sumos, parašai)
  const skipPatterns = /viso|pvm\b|suma\b|sąskaita|pardav|pirk|pristatymo|adresas|telefonas|kodas|pavadinimas|kiekis|kaina|parašas|užsakymas|žodžiais|p\.\d|gavau|išrašė|registre|duomenys|skolinimo|dokumentas|ofisas|objekto|užsakė|nr\.|data|vnt\.|prek/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(itemRegex)
    if (!match) continue

    let name = match[1].trim()
    const unit = match[2].replace('.', '')
    const quantity = parseNumber(match[3]) || 1
    const unitPrice = parseNumber(match[4]) || 0

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
      if (next.match(itemRegex)) break
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

export function PdfImport({ onImport }: PdfImportProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ count: number; merged: number; objectName: string | null } | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError(null)
    setResult(null)

    try {
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

      console.log('=== PDF extracted text ===')
      console.log(fullText)
      console.log('=== End of PDF text ===')

      const parsed = parseItems(fullText)
      if (parsed.length === 0) {
        setError('Nepavyko atpažinti pozicijų iš PDF. Patikrinkite ar failas yra tekstinis (ne nuskanuotas).')
      } else {
        const objectName = extractObjectName(fullText)
        const withNote = parsed.map(p => ({ ...p, note: objectName }))
        const res = await onImport(withNote)
        setResult({ count: withNote.length, merged: res?.merged ?? 0, objectName })
      }
    } catch (err) {
      setError(`Klaida skaitant PDF: ${(err as Error).message}`)
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
      >
        {parsing ? 'Skaitoma...' : 'Importuoti PDF'}
      </button>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {result && (
        <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
          Importuota <strong>{result.count}</strong> pozicijų
          {result.merged > 0 && <> ({result.merged} sujungtos su esamomis)</>}
          {result.objectName && <> — objektas: <strong>{result.objectName}</strong></>}
        </div>
      )}
    </div>
  )
}
