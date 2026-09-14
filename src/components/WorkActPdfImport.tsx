import { useRef, useState } from 'react'
import { extractPdfText, parseItems, parseWorkActItems, PdfLineItem } from '../lib/pdfParse'

interface WorkActPdfImportProps {
  onImport: (items: PdfLineItem[]) => Promise<void>
}

// Įkelia atliktų darbų akto PDF ir automatiškai importuoja darbus
export function WorkActPdfImport({ onImport }: WorkActPdfImportProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError(null)
    setImported(null)

    try {
      const fullText = await extractPdfText(file)

      console.log('=== Work act PDF extracted text ===')
      console.log(fullText)
      console.log('=== End of PDF text ===')

      if (fullText.trim().length < 10) {
        setError('PDF faile nėra teksto sluoksnio — tai nuskanuotas dokumentas. Reikalingas tekstinis PDF.')
        return
      }

      let parsed = parseItems(fullText)
      if (parsed.length === 0) {
        // Aktas be kainų: "1 Pavadinimas 10 vnt."
        parsed = parseWorkActItems(fullText)
      }
      if (parsed.length === 0) {
        setError('Nepavyko atpažinti darbų eilučių. Atidarykite Console (F12) ir atsiųskite ištrauktą tekstą.')
      } else {
        await onImport(parsed)
        setImported(parsed.length)
      }
    } catch (err) {
      setError(`Klaida skaitant PDF: ${(err as Error).message}`)
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1">
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
        className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
      >
        {parsing ? 'Skaitoma...' : '📄 Įkelti aktą (PDF)'}
      </button>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      {imported !== null && (
        <p className="text-green-700 text-xs">Importuota {imported} darbų</p>
      )}
    </div>
  )
}
