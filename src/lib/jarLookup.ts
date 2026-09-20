// Lietuvos juridinių asmenų registro (JAR) atvirų duomenų paieška.
// Naudoja viešą get.data.gov.lt (Spinta) API — API rakto nereikia.
// Adresas gaunamas grandine: JuridinisAsmuo → Buveine → Adresas (aob_kodas)
// → Pastatas/Patalpa → Gatve + GyvenamojiVietove.

const API = 'https://get.data.gov.lt'

export interface JarCompany {
  _id: string
  ja_kodas: number
  ja_pavadinimas: string
}

async function fetchJson(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Įmonių paieška pagal pavadinimo fragmentą.
// JAR pavadinimai dažniausiai DIDŽIOSIOMIS — jei nieko neranda, bandoma uppercase.
export async function searchJarCompanies(query: string): Promise<JarCompany[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const url = (v: string) =>
    `${API}/datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo?ja_pavadinimas.contains(${encodeURIComponent(JSON.stringify(v))})&limit(8)`

  let data = await fetchJson(url(q))
  let rows: JarCompany[] = data?._data || []
  if (rows.length === 0 && q !== q.toUpperCase()) {
    data = await fetchJson(url(q.toUpperCase()))
    rows = data?._data || []
  }
  return rows
}

// Pilnas registruotos buveinės adresas pagal JuridinisAsmuo._id
export async function fetchJarAddress(jaId: string): Promise<string | null> {
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

  // 4. Sulipdyti adresą: "Naugarduko g. 84-42, LT-03160 Vilnius"
  const street = [gatve?.pavadinimas, gatve?.tipo_santrumpa].filter(Boolean).join(' ')
  const building = [pastatas.nr, pastatas.korpuso_nr ? `-${pastatas.korpuso_nr}` : ''].join('')
  let line1 = [street, building].filter(Boolean).join(' ')
  if (patalposNr) line1 += `-${patalposNr}`
  const city = [pastatas.pasto_kodas, gyvenviete?.pavadinimas].filter(Boolean).join(' ')
  const address = [line1, city].filter(Boolean).join(', ')
  return address || null
}
