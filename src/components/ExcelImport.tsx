import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'

interface ColumnMapping {
  key: string
  label: string
  required?: boolean
}

interface ExcelImportProps {
  title: string
  columns: ColumnMapping[]
  onImport: (rows: Record<string, string>[]) => Promise<void>
  templateHeaders: string[]
}

export function ExcelImport({ title, columns, onImport, templateHeaders }: ExcelImportProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

      if (rows.length === 0) {
        setResult('Failas tuščias arba neteisingas formatas')
        return
      }

      // Map Excel columns to our fields
      const mapped = rows.map(row => {
        const mapped: Record<string, string> = {}
        for (const col of columns) {
          // Try exact match, then case-insensitive
          const value = row[col.label] ?? row[col.label.toLowerCase()] ?? row[col.key] ?? ''
          mapped[col.key] = String(value).trim()
        }
        return mapped
      })

      // Filter out rows missing required fields
      const valid = mapped.filter(row =>
        columns.filter(c => c.required).every(c => row[c.key])
      )

      if (valid.length === 0) {
        setResult('Nerasta tinkamų eilučių. Patikrinkite stulpelių pavadinimus.')
        return
      }

      await onImport(valid)
      setResult(`Importuota ${valid.length} iš ${rows.length} eilučių`)
    } catch (err) {
      setResult(`Klaida: ${(err as Error).message}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `${title.toLowerCase()}-sablonas.xlsx`)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
      >
        {importing ? 'Importuojama...' : 'Importuoti Excel'}
      </button>
      <button
        onClick={downloadTemplate}
        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
      >
        Šablonas
      </button>
      {result && (
        <span className={`text-sm ${result.startsWith('Klaida') || result.startsWith('Nerasta') || result.startsWith('Failas') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </span>
      )}
    </div>
  )
}
