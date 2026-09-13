import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedWork {
  name: string
  unit: string
  quantity: number
  work_price: number
  material_price: number
}

interface ParsedMaterial {
  name: string
  unit: string
  quantity: number
  unit_price: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      throw new Error('Trūksta teksto')
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY nenustatytas Supabase secrets')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: `Tu esi statybos darbų asistentas Lietuvoje. Iš vartotojo teksto išskirk atliktus DARBUS ir sunaudotas MEDŽIAGAS kaip du atskirus sąrašus.

DARBAI (works) — tai atlikti darbai/paslaugos. Kiekvienam:
- name: trumpas pavadinimas lietuviškai (pvz. "Sienų dažymas", "Laminato klojimas")
- unit: mato vienetas — TIK vienas iš: "vnt", "m", "val", "kpl"
- quantity: kiekis (skaičius). Jei vartotojas nenurodė — įvertink pagal kontekstą arba naudok 1
- work_price: darbo kaina EUR už vieną vienetą pagal dabartines Lietuvos rinkos kainas (2024-2025)
- material_price: 0 (medžiagos išskiriamos atskirai — čia visada 0)

MEDŽIAGOS (materials) — tai fizinės medžiagos/prekės, kurias vartotojas paminėjo (dažai, laminatas, plytelės, vamzdžiai, kabeliai ir t.t.). Kiekvienai:
- name: medžiagos pavadinimas lietuviškai
- unit: mato vienetas — "vnt", "m", "m²", "kpl", "l", "kg"
- quantity: kiekis (skaičius)
- unit_price: kaina EUR už vienetą pagal Lietuvos rinkos kainas

Jei vartotojas paminėjo tik darbus be konkrečių medžiagų — materials gali būti tuščias masyvas. Jei paminėjo tik medžiagas — works gali būti tuščias.

Orientacinės Lietuvos kainos darbams:
- Dažymas: 5-10 €/m² darbas
- Laminato klojimas: 8-15 €/m² darbas
- Plytelių klojimas: 25-45 €/m² darbas
- Gipso kartono montavimas: 15-25 €/m² darbas
- Elektros darbai: 25-40 €/val darbas
- Santechnikos darbai: 30-50 €/val darbas
- Vidaus durų montavimas: 50-80 €/vnt darbas
- Grindų parketo klojimas: 15-25 €/m² darbas

Grąžink TIK JSON objektą, be jokio paaiškinimo ar markdown:
{"works":[{"name":"...","unit":"m","quantity":10,"work_price":15,"material_price":0}],"materials":[{"name":"...","unit":"l","quantity":5,"unit_price":12}]}`,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`Claude API klaida: ${response.status} ${errBody}`)
    }

    const result = await response.json()
    const content = result.content?.[0]?.text || '{}'

    // Išvalome markdown jei Claude vis tiek pridėjo
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const works: ParsedWork[] = Array.isArray(parsed) ? parsed : (parsed.works || [])
    const materials: ParsedMaterial[] = Array.isArray(parsed) ? [] : (parsed.materials || [])

    // Validacija
    const validWorks = works.map(w => ({
      name: String(w.name || 'Darbas'),
      unit: ['vnt', 'm', 'val', 'kpl'].includes(w.unit) ? w.unit : 'vnt',
      quantity: Math.max(0, Number(w.quantity) || 1),
      work_price: Math.max(0, Number(w.work_price) || 0),
      material_price: Math.max(0, Number(w.material_price) || 0),
    }))

    const validMaterials = materials.map(m => ({
      name: String(m.name || 'Medžiaga'),
      unit: String(m.unit || 'vnt'),
      quantity: Math.max(0, Number(m.quantity) || 1),
      unit_price: Math.max(0, Number(m.unit_price) || 0),
    }))

    return new Response(JSON.stringify({ works: validWorks, materials: validMaterials }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
