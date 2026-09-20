import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Proxy į Lietuvos atvirų duomenų API (get.data.gov.lt / JAR registras).
// Naršyklė negali kreiptis tiesiogiai (API neteikia CORS headerių),
// todėl visa grandinė vykdoma serveryje.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API = 'https://get.data.gov.lt'

async function fetchJson(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Įmonių paieška pagal pavadinimo fragmentą
async function searchCompanies(query: string) {
  const q = query.trim()
  if (q.length < 3) return []

  const url = (v: string) =>
    `${API}/datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo?ja_pavadinimas.contains(${encodeURIComponent(JSON.stringify(v))})&limit(8)`

  let data = await fetchJson(url(q))
  let rows = data?._data || []
  // JAR pavadinimai dažniausiai DIDŽIOSIOMIS — jei tuščia, bandoma uppercase
  if (rows.length === 0 && q !== q.toUpperCase()) {
    data = await fetchJson(url(q.toUpperCase()))
    rows = data?._data || []
  }
  return rows.map((r: { _id: string; ja_kodas: number; ja_pavadinimas: string }) => ({
    _id: r._id,
    ja_kodas: r.ja_kodas,
    ja_pavadinimas: r.ja_pavadinimas,
  }))
}

// Pilnas registruotos buveinės adresas pagal JuridinisAsmuo._id
async function fetchAddress(jaId: string): Promise<string | null> {
  // 1. Buveinė → adreso objekto ref
  const buveine = await fetchJson(
    `${API}/datasets/gov/rc/jar/buveines/Buveine?juridinis_asmuo._id=${encodeURIComponent(`"${jaId}"`)}&limit(1)`
  )
  const adresasId = buveine?._data?.[0]?.adresas?._id
  if (!adresasId) return null

  // 2. Adreso objektas → pastatas (arba patalpa → pastatas)
  const aobFilter = `aob_kodas._id=${encodeURIComponent(`"${adresasId}"`)}&limit(1)`
  let pastatas = (await fetchJson(`${API}/datasets/gov/rc/ar/pastatas/Pastatas?${aobFilter}`))?._data?.[0]
  let patalposNr: string | null = null

  if (!pastatas) {
    const patalpa = (await fetchJson(`${API}/datasets/gov/rc/ar/patalpa/Patalpa?${aobFilter}`))?._data?.[0]
    if (patalpa?.pastatas?._id) {
      patalposNr = patalpa.patalpos_nr || null
      pastatas = await fetchJson(`${API}/datasets/gov/rc/ar/pastatas/Pastatas/${patalpa.pastatas._id}`)
    }
  }
  if (!pastatas) return null

  // 3. Gatvė ir gyvenvietė (lygiagrečiai)
  const [gatve, gyvenviete] = await Promise.all([
    pastatas.gatve?._id
      ? fetchJson(`${API}/datasets/gov/rc/ar/gatve/Gatve/${pastatas.gatve._id}`)
      : null,
    pastatas.gyvenamoji_vietove?._id
      ? fetchJson(`${API}/datasets/gov/rc/ar/gyvenamojivietove/GyvenamojiVietove/${pastatas.gyvenamoji_vietove._id}`)
      : null,
  ])

  // 4. Sulipdyti: "Naugarduko g. 84-42, LT-03160 Vilnius"
  const street = [gatve?.pavadinimas, gatve?.tipo_santrumpa].filter(Boolean).join(' ')
  const building = [pastatas.nr, pastatas.korpuso_nr ? `-${pastatas.korpuso_nr}` : ''].join('')
  let line1 = [street, building].filter(Boolean).join(' ')
  if (patalposNr) line1 += `-${patalposNr}`
  const city = [pastatas.pasto_kodas, gyvenviete?.pavadinimas].filter(Boolean).join(' ')
  const address = [line1, city].filter(Boolean).join(', ')
  return address || null
}

// PVM mokėtojo kodas iš VMI mokesčių mokėtojų registro pagal įmonės kodą.
// Grąžina pvz. "LT100009579210" arba null jei įmonė nėra PVM mokėtoja.
async function fetchVatCode(jaKodas: number): Promise<string | null> {
  const data = await fetchJson(
    `${API}/datasets/gov/vmi/mm_registras/MokesciuMoketojas?ja_kodas=${jaKodas}&limit(20)`
  )
  const rows = data?._data || []
  // Aktyvus PVM mokėtojas: turi kodą ir nėra išregistruotas
  const active = rows.find(
    (r: { pvm_kodas?: string; pvm_isregistruota?: string | null }) =>
      r.pvm_kodas && !r.pvm_isregistruota
  )
  if (!active) return null
  return `${active.pvm_kodas_pref || 'LT'}${active.pvm_kodas}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, query, ja_id, ja_kodas } = await req.json()

    if (action === 'search') {
      const companies = await searchCompanies(query || '')
      return new Response(JSON.stringify({ companies }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'address') {
      const [address, vat_code] = await Promise.all([
        fetchAddress(ja_id || ''),
        ja_kodas ? fetchVatCode(ja_kodas) : Promise.resolve(null),
      ])
      return new Response(JSON.stringify({ address, vat_code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Nežinomas action')
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
