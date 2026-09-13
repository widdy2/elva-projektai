import { useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface ParsedItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
}

interface PdfImportProps {
  onImport: (items: ParsedItem[]) => Promise<void>
}

// Skaičiaus atpažinimas: "12,50" arba "12.50" arba "1 234,56"
function parseNumber(s: string): number | null {
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
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
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError(null)
    setItems(null)

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
        setItems(parsed)
      }
    } catch (err) {
      setError(`Klaida skaitant PDF: ${(err as Error).message}`)
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const updateItem = (index: number, field: keyof ParsedItem, value: string) => {
    if (!items) return
    const updated = [...items]
    if (field === 'name' || field === 'unit') {
      updated[index] = { ...updated[index], [field]: value }
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 }
    }
    setItems(updated)
  }

  const removeItem = (index: number) => {
    setItems(items?.filter((_, i) => i !== index) || null)
  }

  const handleConfirm = async () => {
    if (!items || items.length === 0) return
    setImporting(true)
    try {
      await onImport(items)
      setItems(null)
    } catch (err) {
      setError(`Klaida importuojant: ${(err as Error).message}`)
    } finally {
      setImporting(false)
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

      {items && (
        <div className="mt-4 bg-white rounded-lg shadow-md p-4">
          <h4 className="font-semibold text-gray-900 mb-3">
            Atpažintos pozicijos ({items.length}) - patikrinkite ir patvirtinkite
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button onClick={() => removeItem(i)} className="text-red-600 text-sm">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleConfirm}
              disabled={importing || items.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {importing ? 'Importuojama...' : `Importuoti ${items.length} pozicijas į sandėlį`}
            </button>
            <button
              onClick={() => setItems(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
            >
              Atšaukti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
