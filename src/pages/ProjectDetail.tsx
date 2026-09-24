import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProjectWorks, useCreateProjectWork, useUpdateProjectWork, useDeleteProjectWork } from '../hooks/useProjectWorks'
import { useProjectPhotos, useUploadProjectPhoto, useDeleteProjectPhoto } from '../hooks/useProjectPhotos'
import { useProjectTimeEntries, useStartWorkTime, useStopWorkTime, getEntryDurationHours, getEntryCost } from '../hooks/useWorkTimeEntries'
import { useProjectMaterials, useCreateProjectMaterial, useUpdateProjectMaterial, useDeleteProjectMaterial } from '../hooks/useMaterials'
import { useProjectActs, useGenerateAct, useUpdateActStatus } from '../hooks/useActs'
import { useCreateInvoice } from '../hooks/useInvoices'
import { useProfiles } from '../hooks/useProfiles'
import { useOrganizationDetails } from '../hooks/useOrganizationDetails'
import { addOrgHeader } from '../lib/pdfHeader'
import { WorkActPdfImport } from '../components/WorkActPdfImport'
import { PdfImport } from '../components/PdfImport'
import { PdfLineItem } from '../lib/pdfParse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const statusLabels: Record<string, string> = {
  planning: 'Planuojamas',
  in_progress: 'Vykdomas',
  completed: 'Užbaigtas',
  on_hold: 'Pristabdytas',
}

const statusColors: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-gray-100 text-gray-800',
}

const workStatusLabels: Record<string, string> = {
  pending: 'Laukiama',
  in_progress: 'Vykdoma',
  completed: 'Atlikta',
}

const workStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [newWorkName, setNewWorkName] = useState('')
  const [editingWork, setEditingWork] = useState<string | null>(null)
  const [editComments, setEditComments] = useState('')
  const [newMaterialName, setNewMaterialName] = useState('')
  const [newMaterialUnit, setNewMaterialUnit] = useState('vnt')
  const [newMaterialQty, setNewMaterialQty] = useState('')
  const [newMaterialPrice, setNewMaterialPrice] = useState('')
  const [priceAdjustPct, setPriceAdjustPct] = useState('')
  const [adjustingPrices, setAdjustingPrices] = useState(false)

  // Laikmatis ir ataskaitos modalas
  const [now, setNow] = useState(Date.now())
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportWorks, setReportWorks] = useState<Set<string>>(new Set())
  const [reportMaterials, setReportMaterials] = useState<Record<string, number>>({})
  const [savingReport, setSavingReport] = useState(false)
  const [reportNewWorkName, setReportNewWorkName] = useState('')
  const [reportNewWorks, setReportNewWorks] = useState<string[]>([])
  const [reportNewMatName, setReportNewMatName] = useState('')
  const [reportNewMatUnit, setReportNewMatUnit] = useState('vnt')
  const [reportNewMatQty, setReportNewMatQty] = useState('')
  const [reportNewMatPrice, setReportNewMatPrice] = useState('')
  const [reportNewMaterials, setReportNewMaterials] = useState<{ name: string; unit: string; qty: number; price: number }[]>([])

  // AI agentas
  const [showAiAgent, setShowAiAgent] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiWorks, setAiWorks] = useState<{ name: string; unit: string; quantity: number; work_price: number; material_price: number }[]>([])
  const [aiMaterials, setAiMaterials] = useState<{ name: string; unit: string; quantity: number; unit_price: number }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAdding, setAiAdding] = useState(false)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(name, email, phone)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: works, isLoading: worksLoading } = useProjectWorks(id)
  const { data: photos } = useProjectPhotos(id)
  const { data: profiles } = useProfiles()
  const { data: org } = useOrganizationDetails()
  const createWork = useCreateProjectWork()
  const updateWork = useUpdateProjectWork()
  const deleteWork = useDeleteProjectWork()
  const uploadPhoto = useUploadProjectPhoto()
  const deletePhoto = useDeleteProjectPhoto()

  const workIds = works?.map(w => w.id) || []
  const { data: timeEntries } = useProjectTimeEntries(id, workIds)
  const startTime = useStartWorkTime()
  const stopTime = useStopWorkTime()

  const activeEntry = timeEntries?.find(e => !e.ended_at)

  // Gyvas laikmatis
  useEffect(() => {
    if (!activeEntry) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeEntry])

  const { data: materials } = useProjectMaterials(id)
  const createMaterial = useCreateProjectMaterial()
  const updateMaterial = useUpdateProjectMaterial()
  const deleteMaterial = useDeleteProjectMaterial()

  const { data: acts } = useProjectActs(id)
  const generateAct = useGenerateAct()
  const updateActStatus = useUpdateActStatus()
  const createInvoice = useCreateInvoice()

  const handleCreateInvoiceFromAct = async () => {
    if (!project || !id) return

    const completedWorks = works?.filter(w => w.status === 'completed') || []
    // Medžiagos sąskaitoje eina kaip atskiros eilutės — darbų eilutėje tik darbo kaina.
    // Sandėlio prekės sąskaitoje nedubliuojamos, tik nusirašome likučius.
    const usedMaterials = materials?.filter(m => m.used_quantity > 0 && !m.warehouse_item_id) || []
    const warehouseMaterials = materials?.filter(m => m.warehouse_item_id && !m.stock_deducted) || []

    const items = [
      ...completedWorks.map(w => ({
        name: w.name,
        quantity: w.quantity || 1,
        unit: w.unit || 'vnt',
        unit_price: w.work_price || 0,
        total: (w.quantity || 1) * (w.work_price || 0),
        item_type: 'work' as const,
      })),
      ...usedMaterials.map(m => ({
        name: m.name,
        quantity: m.used_quantity,
        unit: m.unit,
        unit_price: m.unit_price,
        total: m.used_quantity * m.unit_price,
        item_type: 'material' as const,
      })),
    ]

    if (items.length === 0) {
      alert('Nėra atliktų darbų ar sunaudotų medžiagų sąskaitai')
      return
    }

    const subtotal = items.reduce((sum, i) => sum + i.total, 0)
    const vatRate = 21
    const vatAmount = subtotal * vatRate / 100

    try {
      await createInvoice.mutateAsync({
        invoice: {
          project_id: id,
          client_id: project.client_id,
          status: 'unpaid',
          issue_date: new Date().toISOString().split('T')[0],
          due_date: null,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total: subtotal + vatAmount,
          notes: null,
        },
        items,
      })

      // Nusirašyti sandėlio likučius už medžiagas iš sandėlio
      for (const m of warehouseMaterials) {
        const deductQty = m.used_quantity > 0 ? m.used_quantity : m.purchased_quantity
        if (deductQty <= 0) continue

        const { data: whItem } = await supabase
          .from('warehouse_items')
          .select('quantity')
          .eq('id', m.warehouse_item_id)
          .single()

        if (whItem) {
          await supabase
            .from('warehouse_items')
            .update({ quantity: Math.max(0, whItem.quantity - deductQty) })
            .eq('id', m.warehouse_item_id)

          await supabase
            .from('project_materials')
            .update({ stock_deducted: true, used_quantity: deductQty })
            .eq('id', m.id)
        }
      }

      alert('Sąskaita sukurta')
    } catch (err) {
      alert(`Klaida kuriant sąskaitą: ${(err as Error).message}`)
    }
  }

  const handleGenerateAct = async () => {
    if (!id) return
    try {
      await generateAct.mutateAsync({ projectId: id })
    } catch (err) {
      alert(`Klaida generuojant aktą: ${(err as Error).message}`)
    }
  }

  const handleDownloadActPdf = async (actNumber: string) => {
    if (!project || !works) return

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
    autoTable(doc, {
      startY: startY + 51,
      head: [['Darbas', 'Statusas', 'Terminas']],
      body: completedWorks.map(w => [
        w.name,
        'Atliktas',
        w.deadline || '-',
      ]),
      styles: { fontSize: 9, font: 'DejaVuSans' },
      headStyles: { fillColor: [66, 66, 66], font: 'DejaVuSans', fontStyle: 'bold' },
    })

    const materialsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    if (materials && materials.length > 0) {
      doc.setFontSize(12)
      doc.text('Sunaudotos medžiagos:', 14, materialsY)
      autoTable(doc, {
        startY: materialsY + 5,
        head: [['Medžiaga', 'Kiekis', 'Mato vnt.', 'Kaina €']],
        body: materials.filter(m => m.used_quantity > 0 || m.warehouse_item_id).map(m => [
          m.name,
          (m.used_quantity > 0 ? m.used_quantity : m.purchased_quantity).toFixed(2),
          m.unit,
          ((m.used_quantity > 0 ? m.used_quantity : m.purchased_quantity) * m.unit_price).toFixed(2),
        ]),
        styles: { fontSize: 9, font: 'DejaVuSans' },
        headStyles: { fillColor: [66, 66, 66], font: 'DejaVuSans', fontStyle: 'bold' },
      })
    }

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
    doc.setFontSize(10)
    doc.text('Vadovas: _______________________', 14, finalY)
    doc.text('Klientas: _______________________', pageWidth - 80, finalY)

    doc.save(`${actNumber}.pdf`)
  }

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMaterialName.trim() || !id) return

    await createMaterial.mutateAsync({
      project_id: id,
      warehouse_item_id: null,
      name: newMaterialName.trim(),
      unit: newMaterialUnit,
      planned_quantity: parseFloat(newMaterialQty) || 0,
      purchased_quantity: 0,
      used_quantity: 0,
      unit_price: parseFloat(newMaterialPrice) || 0,
      stock_deducted: false,
    })
    setNewMaterialName('')
    setNewMaterialUnit('vnt')
    setNewMaterialQty('')
    setNewMaterialPrice('')
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !id) return

    for (const file of Array.from(files)) {
      try {
        await uploadPhoto.mutateAsync({ projectId: id, file })
      } catch (err) {
        console.error('Photo upload failed:', err)
        alert(`Klaida įkeliant nuotrauką: ${(err as Error).message}`)
      }
    }
    e.target.value = ''
  }

  const handleAddWork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkName.trim() || !id) return

    await createWork.mutateAsync({
      project_id: id,
      name: newWorkName.trim(),
      status: 'pending',
      assignee_id: null,
      deadline: null,
      comments: null,
      quantity: 1,
      unit: 'vnt',
      work_price: 0,
      material_price: 0,
    })
    setNewWorkName('')
  }

  // Darbų akto PDF importas — visos pozicijos tampa atliktais darbais
  const handleWorkActImport = async (items: PdfLineItem[]) => {
    if (!id) return
    for (const item of items) {
      await createWork.mutateAsync({
        project_id: id,
        name: item.name,
        status: 'completed',
        assignee_id: null,
        deadline: null,
        comments: null,
        quantity: item.quantity,
        unit: item.unit,
        work_price: item.unit_price,
        material_price: 0,
      })
    }
  }

  // Medžiagų PDF importas — pozicijos iš tiekėjo sąskaitos/važtaraščio
  const handleMaterialPdfImport = async (items: PdfLineItem[]) => {
    if (!id) return
    for (const item of items) {
      await createMaterial.mutateAsync({
        project_id: id,
        warehouse_item_id: null,
        name: item.name,
        unit: item.unit,
        planned_quantity: item.quantity,
        purchased_quantity: item.quantity,
        used_quantity: 0,
        unit_price: item.unit_price,
        stock_deducted: false,
      })
    }
  }

  // Masinis kainų korektavimas — pritaiko ±% visoms objekto medžiagoms
  const handleAdjustMaterialPrices = async () => {
    const pct = parseFloat(priceAdjustPct)
    if (isNaN(pct) || pct === 0 || !materials?.length) return
    if (!confirm(`Pakeisti visas ${materials.length} medžiagų kainas ${pct > 0 ? '+' : ''}${pct}%?`)) return
    setAdjustingPrices(true)
    try {
      const factor = 1 + pct / 100
      for (const m of materials) {
        const newPrice = Math.round(m.unit_price * factor * 100) / 100
        if (newPrice !== m.unit_price) {
          await updateMaterial.mutateAsync({ id: m.id, unit_price: newPrice })
        }
      }
      setPriceAdjustPct('')
    } catch (err) {
      alert(`Klaida keičiant kainas: ${(err as Error).message}`)
    } finally {
      setAdjustingPrices(false)
    }
  }

  const handleStatusChange = async (workId: string, status: string) => {
    await updateWork.mutateAsync({ id: workId, status: status as 'pending' | 'in_progress' | 'completed' })
  }

  const handleAssigneeChange = async (workId: string, assigneeId: string) => {
    await updateWork.mutateAsync({ id: workId, assignee_id: assigneeId || null })
  }

  const handleDeadlineChange = async (workId: string, deadline: string) => {
    await updateWork.mutateAsync({ id: workId, deadline: deadline || null })
  }

  const handleSaveComments = async (workId: string) => {
    await updateWork.mutateAsync({ id: workId, comments: editComments || null })
    setEditingWork(null)
  }

  // --- Projekto laikmatis ---

  const handleStartTimer = async () => {
    if (!id) return
    try {
      await startTime.mutateAsync({ projectId: id })
    } catch (err) {
      alert(`Klaida paleidžiant laikmatį: ${(err as Error).message}`)
    }
  }

  const handleStopTimer = async () => {
    if (!activeEntry) return
    try {
      await stopTime.mutateAsync({ entryId: activeEntry.id })
      // Atidarome ataskaitos modalą — darbai ir medžiagos
      setReportWorks(new Set(works?.filter(w => w.status !== 'completed').map(w => w.id) || []))
      const matDefaults: Record<string, number> = {}
      materials?.forEach(m => { matDefaults[m.id] = m.used_quantity })
      setReportMaterials(matDefaults)
      setReportNewWorks([])
      setReportNewWorkName('')
      setReportNewMaterials([])
      setReportNewMatName('')
      setReportNewMatUnit('vnt')
      setReportNewMatQty('')
      setReportNewMatPrice('')
      setShowReportModal(true)
    } catch (err) {
      alert(`Klaida stabdant laikmatį: ${(err as Error).message}`)
    }
  }

  const handleSaveReport = async () => {
    if (!id) return
    setSavingReport(true)
    try {
      // Pažymėti pasirinktus darbus kaip atliktus
      for (const workId of reportWorks) {
        await updateWork.mutateAsync({ id: workId, status: 'completed' })
      }
      // Atnaujinti sunaudotas medžiagas
      for (const [matId, qty] of Object.entries(reportMaterials)) {
        const mat = materials?.find(m => m.id === matId)
        if (mat && qty !== mat.used_quantity) {
          await updateMaterial.mutateAsync({ id: matId, used_quantity: qty })
        }
      }
      // Sukurti naujus atliktus darbus
      for (const name of reportNewWorks) {
        await createWork.mutateAsync({
          project_id: id,
          name,
          status: 'completed',
          assignee_id: null,
          deadline: null,
          comments: null,
          quantity: 1,
          unit: 'vnt',
          work_price: 0,
          material_price: 0,
        })
      }
      // Sukurti naujas sunaudotas medžiagas
      for (const m of reportNewMaterials) {
        await createMaterial.mutateAsync({
          project_id: id,
          warehouse_item_id: null,
          name: m.name,
          unit: m.unit,
          planned_quantity: 0,
          purchased_quantity: m.qty,
          used_quantity: m.qty,
          unit_price: m.price,
          stock_deducted: false,
        })
      }
      // Sugeneruoti aktą automatiškai
      await generateAct.mutateAsync({ projectId: id })
      setShowReportModal(false)
    } catch (err) {
      alert(`Klaida išsaugant ataskaitą: ${(err as Error).message}`)
    } finally {
      setSavingReport(false)
    }
  }

  const formatElapsed = (startedAt: string) => {
    const diff = Math.max(0, now - new Date(startedAt).getTime())
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // --- AI agentas ---

  const handleAiParse = async () => {
    if (!aiText.trim()) return
    setAiLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('parse-works', {
        body: { text: aiText.trim() },
      })
      if (error) {
        // Edge function grąžino non-2xx — ištraukiame tikrą klaidą iš body
        let msg = error.message
        try {
          const body = await (error as { context?: Response }).context?.json?.()
          if (body?.error) msg = body.error
        } catch { /* paliekame generinę */ }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      setAiWorks(data.works || [])
      setAiMaterials(data.materials || [])
    } catch (err) {
      alert(`AI klaida: ${(err as Error).message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiAddAll = async () => {
    if (!id || (aiWorks.length === 0 && aiMaterials.length === 0)) return
    setAiAdding(true)
    try {
      for (const w of aiWorks) {
        await createWork.mutateAsync({
          project_id: id,
          name: w.name,
          status: 'completed',
          assignee_id: null,
          deadline: null,
          comments: null,
          quantity: w.quantity,
          unit: w.unit,
          work_price: w.work_price,
          material_price: w.material_price,
        })
      }
      for (const m of aiMaterials) {
        await createMaterial.mutateAsync({
          project_id: id,
          warehouse_item_id: null,
          name: m.name,
          unit: m.unit,
          planned_quantity: 0,
          purchased_quantity: m.quantity,
          used_quantity: m.quantity,
          unit_price: m.unit_price,
          stock_deducted: false,
        })
      }
      setAiWorks([])
      setAiMaterials([])
      setAiText('')
      setShowAiAgent(false)
    } catch (err) {
      alert(`Klaida pridedant: ${(err as Error).message}`)
    } finally {
      setAiAdding(false)
    }
  }

  if (projectLoading) {
    return <div className="text-gray-600">Kraunama...</div>
  }

  if (!project) {
    return <div className="text-red-600">Objektas nerastas</div>
  }

  const completedWorks = works?.filter(w => w.status === 'completed').length || 0
  const totalWorks = works?.length || 0

  return (
    <div>
      <button
        onClick={() => navigate('/projects')}
        className="text-blue-600 hover:text-blue-800 mb-4 text-sm"
      >
        ← Atgal į objektus
      </button>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project.name || 'Objektas'}</h2>
            <p className="text-gray-600">{project.address}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[project.status]}`}>
            {statusLabels[project.status]}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Klientas:</span>
            <p className="font-medium">{project.clients?.name || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Biudžetas:</span>
            <p className="font-medium">€{project.budget?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <span className="text-gray-500">Pradžia:</span>
            <p className="font-medium">{project.start_date || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Pabaiga:</span>
            <p className="font-medium">{project.end_date || '-'}</p>
          </div>
        </div>

        {/* Projekto laikmatis */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
          {activeEntry ? (
            <>
              <button
                onClick={handleStopTimer}
                disabled={stopTime.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              >
                ■ Baigti darbą
              </button>
              <span className="text-lg font-mono font-bold text-green-700">
                {formatElapsed(activeEntry.started_at)}
              </span>
              <span className="text-xs text-green-600 font-medium">● Vyksta</span>
            </>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={startTime.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              ▶ Pradėti darbą
            </button>
          )}
        </div>
      </div>

      {(() => {
        const saleAmount = project.budget || 0
        const materialsCost = materials?.reduce((sum, m) => sum + m.purchased_quantity * m.unit_price, 0) || 0
        const laborCost = timeEntries?.reduce((sum, e) => sum + getEntryCost(e), 0) || 0
        const profit = saleAmount - materialsCost - laborCost
        const margin = saleAmount > 0 ? (profit / saleAmount) * 100 : 0

        return (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Finansai</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <span className="text-xs text-gray-500 uppercase">Pardavimo suma</span>
                <p className="text-lg font-bold text-gray-900">€{saleAmount.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Medžiagos</span>
                <p className="text-lg font-bold text-orange-600">€{materialsCost.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Darbo savikaina</span>
                <p className="text-lg font-bold text-orange-600">€{laborCost.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Pelnas</span>
                <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  €{profit.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Marža</span>
                <p className={`text-lg font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Darbai</h3>
          <div className="flex items-center gap-3">
            <WorkActPdfImport onImport={handleWorkActImport} />
            <button
              onClick={() => setShowAiAgent(!showAiAgent)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
            >
              🤖 AI Agentas
            </button>
            <span className="text-sm text-gray-500">
              {completedWorks} / {totalWorks} atlikta
            </span>
          </div>
        </div>

        {/* AI agento panelė */}
        {showAiAgent && (
          <div className="mb-4 p-4 border border-purple-200 rounded-lg bg-purple-50">
            <p className="text-sm text-purple-800 mb-2">
              Apibūdinkite atliktus darbus laisvu tekstu — AI juos išskirs ir įkainos pagal Lietuvos rinkos kainas.
            </p>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Pvz.: Nudažėme 40 m² sienų, paklojome 25 m² laminato, sumontavome 3 vidaus duris..."
              className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm h-20 resize-y"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAiParse}
                disabled={aiLoading || !aiText.trim()}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm disabled:opacity-50"
              >
                {aiLoading ? 'Analizuojama...' : 'Apdoroti su AI'}
              </button>
              <button
                onClick={() => { setShowAiAgent(false); setAiWorks([]); setAiMaterials([]); setAiText('') }}
                className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
              >
                Uždaryti
              </button>
            </div>

            {/* AI rezultatai */}
            {(aiWorks.length > 0 || aiMaterials.length > 0) && (
              <div className="mt-3 space-y-3">
                {aiWorks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-800 mb-1">Darbai:</p>
                    <div className="space-y-1">
                      {aiWorks.map((w, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded border border-purple-100 text-sm">
                          <span className="flex-1 font-medium text-gray-900">{w.name}</span>
                          <span className="text-gray-500">{w.quantity} {w.unit}</span>
                          <span className="text-gray-500">€{w.work_price.toFixed(2)}/{w.unit}</span>
                          <span className="font-medium text-gray-900">
                            = €{(w.quantity * w.work_price).toFixed(2)}
                          </span>
                          <button
                            onClick={() => setAiWorks(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {aiMaterials.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-800 mb-1">Medžiagos:</p>
                    <div className="space-y-1">
                      {aiMaterials.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded border border-purple-100 text-sm">
                          <span className="flex-1 font-medium text-gray-900">{m.name}</span>
                          <span className="text-gray-500">{m.quantity} {m.unit}</span>
                          <span className="text-gray-500">€{m.unit_price.toFixed(2)}/{m.unit}</span>
                          <span className="font-medium text-gray-900">
                            = €{(m.quantity * m.unit_price).toFixed(2)}
                          </span>
                          <button
                            onClick={() => setAiMaterials(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleAiAddAll}
                  disabled={aiAdding}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                >
                  {aiAdding ? 'Pridedama...' : `Pridėti ${aiWorks.length} darbų ir ${aiMaterials.length} medžiagų`}
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAddWork} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newWorkName}
            onChange={(e) => setNewWorkName(e.target.value)}
            placeholder="Naujo darbo pavadinimas..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Pridėti
          </button>
        </form>

        {worksLoading ? (
          <p className="text-gray-500 text-sm">Kraunama...</p>
        ) : works && works.length > 0 ? (
          <div className="space-y-2">
            {works.map((work) => (
              <div key={work.id} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="checkbox"
                    checked={work.status === 'completed'}
                    onChange={(e) => handleStatusChange(work.id, e.target.checked ? 'completed' : 'pending')}
                    className="rounded h-4 w-4"
                  />
                  <span className={`flex-1 font-medium ${work.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {work.name}
                  </span>
                  <select
                    value={work.status}
                    onChange={(e) => handleStatusChange(work.id, e.target.value)}
                    className={`px-2 py-1 rounded text-xs font-semibold border-0 ${workStatusColors[work.status]}`}
                  >
                    <option value="pending">{workStatusLabels.pending}</option>
                    <option value="in_progress">{workStatusLabels.in_progress}</option>
                    <option value="completed">{workStatusLabels.completed}</option>
                  </select>
                  <select
                    value={work.assignee_id || ''}
                    onChange={(e) => handleAssigneeChange(work.id, e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option value="">Be atsakingo</option>
                    {profiles?.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name || 'Bevardis'}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={work.deadline || ''}
                    onChange={(e) => handleDeadlineChange(work.id, e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                  <button
                    onClick={() => {
                      setEditingWork(editingWork === work.id ? null : work.id)
                      setEditComments(work.comments || '')
                    }}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Komentarai
                  </button>
                  <button
                    onClick={() => deleteWork.mutate({ id: work.id, projectId: id! })}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Ištrinti
                  </button>
                </div>

                {/* Įkainojimas: mato vnt., kiekis, kainos */}
                <div className="mt-2 pl-7 flex items-center gap-2 flex-wrap text-xs text-gray-600">
                  <select
                    value={work.unit || 'vnt'}
                    onChange={(e) => updateWork.mutate({ id: work.id, unit: e.target.value })}
                    className="px-1 py-0.5 border border-gray-300 rounded text-xs"
                  >
                    <option value="vnt">vnt</option>
                    <option value="m">m</option>
                    <option value="val">val</option>
                    <option value="kpl">kpl</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={work.quantity}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (val !== work.quantity) updateWork.mutate({ id: work.id, quantity: val })
                    }}
                    className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs"
                    title="Kiekis"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={work.work_price}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (val !== work.work_price) updateWork.mutate({ id: work.id, work_price: val })
                    }}
                    className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                    title="Darbo kaina €/vnt"
                  />
                  <span>€ darbas</span>
                  <span className="font-medium text-gray-900">
                    = €{((work.quantity || 0) * (work.work_price || 0)).toFixed(2)}
                  </span>
                </div>

                {(() => {
                  const workEntries = timeEntries?.filter(e => e.work_id === work.id) || []
                  const totalHours = workEntries.reduce((sum, e) => sum + getEntryDurationHours(e), 0)
                  const totalCost = workEntries.reduce((sum, e) => sum + getEntryCost(e), 0)

                  if (totalHours <= 0) return null

                  return (
                    <div className="mt-2 pl-7 text-xs text-gray-600">
                      Laikas: {totalHours.toFixed(1)} val. | Savikaina: €{totalCost.toFixed(2)}
                    </div>
                  )
                })()}

                {editingWork === work.id && (
                  <div className="mt-2 flex gap-2">
                    <textarea
                      value={editComments}
                      onChange={(e) => setEditComments(e.target.value)}
                      placeholder="Komentarai..."
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      rows={2}
                    />
                    <button
                      onClick={() => handleSaveComments(work.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm self-start"
                    >
                      Išsaugoti
                    </button>
                  </div>
                )}

                {!editingWork && work.comments && (
                  <p className="mt-2 text-sm text-gray-500 pl-7">{work.comments}</p>
                )}
              </div>
            ))}

            {/* Atliktų darbų sumos */}
            {(() => {
              const done = works.filter(w => w.status === 'completed')
              if (done.length === 0) return null
              const totalNet = done.reduce((s, w) => s + (w.quantity || 0) * (w.work_price || 0), 0)
              const totalGross = totalNet * 1.21
              return (
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end gap-6 text-sm">
                  <span className="text-gray-600">
                    Atliktų darbų suma be PVM: <strong className="text-gray-900">€{totalNet.toFixed(2)}</strong>
                  </span>
                  <span className="text-gray-600">
                    Su PVM (21%): <strong className="text-gray-900">€{totalGross.toFixed(2)}</strong>
                  </span>
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Darbų dar nėra. Pridėkite pirmą darbą.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Medžiagos ({materials?.length || 0})
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              value={priceAdjustPct}
              onChange={(e) => setPriceAdjustPct(e.target.value)}
              placeholder="±%"
              title="Kainų korekcija procentais (pvz. 15 arba -10)"
              className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={handleAdjustMaterialPrices}
              disabled={adjustingPrices || !priceAdjustPct || !materials?.length}
              className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm disabled:opacity-50"
              title="Pritaikyti procentą visoms medžiagų kainoms"
            >
              {adjustingPrices ? 'Keičiama...' : 'Pritaikyti %'}
            </button>
            <PdfImport onImport={handleMaterialPdfImport} />
          </div>
        </div>

        <form onSubmit={handleAddMaterial} className="flex gap-2 mb-4 flex-wrap">
          <input
            type="text"
            value={newMaterialName}
            onChange={(e) => setNewMaterialName(e.target.value)}
            placeholder="Medžiagos pavadinimas..."
            className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <input
            type="text"
            value={newMaterialUnit}
            onChange={(e) => setNewMaterialUnit(e.target.value)}
            placeholder="Mato vnt."
            className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newMaterialQty}
            onChange={(e) => setNewMaterialQty(e.target.value)}
            placeholder="Kiekis"
            className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newMaterialPrice}
            onChange={(e) => setNewMaterialPrice(e.target.value)}
            placeholder="€/vnt"
            className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Pridėti
          </button>
        </form>

        {materials && materials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b">
                  <th className="py-2 pr-4">Pavadinimas</th>
                  <th className="py-2 pr-4">Planuota</th>
                  <th className="py-2 pr-4">Nupirkta</th>
                  <th className="py-2 pr-4">Sunaudota</th>
                  <th className="py-2 pr-4">Likutis</th>
                  <th className="py-2 pr-4">€/vnt</th>
                  <th className="py-2 pr-4">Suma</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materials.map((m) => {
                  const remaining = m.purchased_quantity - m.used_quantity
                  const total = m.purchased_quantity * m.unit_price
                  return (
                    <tr key={m.id}>
                      <td className="py-2 pr-4 font-medium text-gray-900">{m.name}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={m.planned_quantity}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            if (val !== m.planned_quantity) {
                              updateMaterial.mutate({ id: m.id, planned_quantity: val })
                            }
                          }}
                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        />
                        <span className="text-xs text-gray-400 ml-1">{m.unit}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={m.purchased_quantity}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            if (val !== m.purchased_quantity) {
                              updateMaterial.mutate({ id: m.id, purchased_quantity: val })
                            }
                          }}
                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        />
                        <span className="text-xs text-gray-400 ml-1">{m.unit}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={m.used_quantity}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            if (val !== m.used_quantity) {
                              updateMaterial.mutate({ id: m.id, used_quantity: val })
                            }
                          }}
                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        />
                        <span className="text-xs text-gray-400 ml-1">{m.unit}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={remaining < 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                          {remaining.toFixed(2)} {m.unit}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          key={`${m.id}-${m.unit_price}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={m.unit_price}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            if (val !== m.unit_price) {
                              updateMaterial.mutate({ id: m.id, unit_price: val })
                            }
                          }}
                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 pr-4 font-medium text-gray-900">€{total.toFixed(2)}</td>
                      <td className="py-2">
                        <button
                          onClick={() => deleteMaterial.mutate({ id: m.id, projectId: id! })}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Ištrinti
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Medžiagų sumos */}
            {(() => {
              const totalNet = materials.reduce((s, m) => s + m.purchased_quantity * m.unit_price, 0)
              const totalGross = totalNet * 1.21
              return (
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end gap-6 text-sm">
                  <span className="text-gray-600">
                    Medžiagų suma be PVM: <strong className="text-gray-900">€{totalNet.toFixed(2)}</strong>
                  </span>
                  <span className="text-gray-600">
                    Su PVM (21%): <strong className="text-gray-900">€{totalGross.toFixed(2)}</strong>
                  </span>
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Medžiagų dar nėra. Pridėkite pirmą medžiagą.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Nuotraukos ({photos?.length || 0})
          </h3>
          <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer">
            {uploadPhoto.isPending ? 'Įkeliama...' : '+ Įkelti nuotraukas'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={uploadPhoto.isPending}
            />
          </label>
        </div>

        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={photo.url}
                    alt={photo.file_name}
                    className="w-full h-32 object-cover rounded-md border border-gray-200"
                  />
                </a>
                <button
                  onClick={() => deletePhoto.mutate(photo)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Ištrinti"
                >
                  ×
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">{photo.file_name}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Nuotraukų dar nėra. Įkelkite pirmą nuotrauką.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Aktai ({acts?.length || 0})
          </h3>
          <button
            onClick={handleGenerateAct}
            disabled={generateAct.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {generateAct.isPending ? 'Generuojama...' : '+ Generuoti aktą'}
          </button>
        </div>

        {acts && acts.length > 0 ? (
          <div className="space-y-2">
            {acts.map((act) => (
              <div key={act.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">{act.act_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(act.generated_at).toLocaleDateString('lt-LT')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    act.status === 'signed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {act.status === 'signed' ? 'Pasirašytas' : 'Sugeneruotas'}
                  </span>
                  <button
                    onClick={() => handleDownloadActPdf(act.act_number)}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleCreateInvoiceFromAct}
                    disabled={createInvoice.isPending}
                    className="text-purple-600 hover:text-purple-800 text-xs disabled:opacity-50"
                  >
                    Sąskaita
                  </button>
                  {act.status === 'generated' && (
                    <button
                      onClick={() => updateActStatus.mutate({ id: act.id, status: 'signed' })}
                      className="text-green-600 hover:text-green-800 text-xs"
                    >
                      Pažymėti pasirašytu
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Aktų dar nėra. Sugeneruokite pirmą aktą.</p>
        )}
      </div>

      {/* Ataskaitos modalas — iššoka sustabdžius laikmatį */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowReportModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">Atliktų darbų ataskaita</h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>

              {/* Atlikti darbai */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Atlikti darbai</h4>
                {works && works.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded p-2">
                    {works.map((work) => (
                      <label key={work.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={work.status === 'completed' || reportWorks.has(work.id)}
                          disabled={work.status === 'completed'}
                          onChange={(e) => {
                            const next = new Set(reportWorks)
                            if (e.target.checked) next.add(work.id)
                            else next.delete(work.id)
                            setReportWorks(next)
                          }}
                          className="rounded"
                        />
                        <span className={`text-sm ${work.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {work.name}
                        </span>
                        {work.status === 'completed' && (
                          <span className="text-xs text-green-600 ml-auto">Atlikta</span>
                        )}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Darbų nėra</p>
                )}

                {/* Nauji atlikti darbai */}
                {reportNewWorks.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 mt-1 bg-green-50 rounded">
                    <span className="flex-1 text-sm text-gray-900">{name}</span>
                    <span className="text-xs text-green-600">Naujas — bus atliktas</span>
                    <button
                      onClick={() => setReportNewWorks(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={reportNewWorkName}
                    onChange={(e) => setReportNewWorkName(e.target.value)}
                    placeholder="Papildomas atliktas darbas..."
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && reportNewWorkName.trim()) {
                        e.preventDefault()
                        setReportNewWorks(prev => [...prev, reportNewWorkName.trim()])
                        setReportNewWorkName('')
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!reportNewWorkName.trim()) return
                      setReportNewWorks(prev => [...prev, reportNewWorkName.trim()])
                      setReportNewWorkName('')
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    + Pridėti
                  </button>
                </div>
              </div>

              {/* Sunaudotos medžiagos */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Sunaudotos medžiagos</h4>
                {materials && materials.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded p-2">
                    {materials.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-1.5">
                        <span className="flex-1 text-sm text-gray-900">{m.name}</span>
                        <span className="text-xs text-gray-400">
                          nupirkta: {m.purchased_quantity} {m.unit}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={reportMaterials[m.id] ?? m.used_quantity}
                          onChange={(e) => setReportMaterials(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) || 0 }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-xs text-gray-400 w-8">{m.unit}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Medžiagų nėra</p>
                )}

                {/* Naujos sunaudotos medžiagos */}
                {reportNewMaterials.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 mt-1 bg-green-50 rounded">
                    <span className="flex-1 text-sm text-gray-900">{m.name}</span>
                    <span className="text-xs text-green-600">
                      {m.qty} {m.unit} × €{m.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => setReportNewMaterials(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <input
                    type="text"
                    value={reportNewMatName}
                    onChange={(e) => setReportNewMatName(e.target.value)}
                    placeholder="Papildoma medžiaga..."
                    className="flex-1 min-w-[120px] px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={reportNewMatUnit}
                    onChange={(e) => setReportNewMatUnit(e.target.value)}
                    placeholder="vnt."
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportNewMatQty}
                    onChange={(e) => setReportNewMatQty(e.target.value)}
                    placeholder="Kiekis"
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportNewMatPrice}
                    onChange={(e) => setReportNewMatPrice(e.target.value)}
                    placeholder="€/vnt"
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!reportNewMatName.trim()) return
                      setReportNewMaterials(prev => [...prev, {
                        name: reportNewMatName.trim(),
                        unit: reportNewMatUnit || 'vnt',
                        qty: parseFloat(reportNewMatQty) || 0,
                        price: parseFloat(reportNewMatPrice) || 0,
                      }])
                      setReportNewMatName('')
                      setReportNewMatUnit('vnt')
                      setReportNewMatQty('')
                      setReportNewMatPrice('')
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    + Pridėti
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveReport}
                  disabled={savingReport}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {savingReport ? 'Saugoma...' : 'Išsaugoti ir generuoti aktą'}
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Atšaukti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
