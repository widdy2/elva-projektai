import { useRef, useState } from 'react'
import { extractPdfText, parseItems, PdfLineItem } from '../lib/pdfParse'

export interface ParsedItem extends PdfLineItem {
  note?: string | null
}

export interface ImportResult {
  inserted: number
  merged: number
}

interface PdfImportProps {
  onImport: (items: ParsedItem[]) => Promise<ImportResult | void>
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
      const fullText = await extractPdfText(file)

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
