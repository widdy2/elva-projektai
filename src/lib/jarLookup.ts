// Lietuvos juridinių asmenų registro (JAR) atvirų duomenų paieška.
// Tiesioginis get.data.gov.lt kvietimas iš naršyklės neveikia (API neteikia
// CORS headerių), todėl visa logika vykdoma Supabase edge funkcijoje
// 'jar-lookup' — ji serveryje atlieka paiešką ir adreso grandinę.

import { supabase } from './supabase'

export interface JarCompany {
  _id: string
  ja_kodas: number
  ja_pavadinimas: string
}

// Įmonių paieška pagal pavadinimo fragmentą
export async function searchJarCompanies(query: string): Promise<JarCompany[]> {
  if (query.trim().length < 3) return []
  try {
    const { data, error } = await supabase.functions.invoke('jar-lookup', {
      body: { action: 'search', query },
    })
    if (error) return []
    return data?.companies || []
  } catch {
    return []
  }
}

// Pilnas registruotos buveinės adresas pagal JuridinisAsmuo._id
export async function fetchJarAddress(jaId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('jar-lookup', {
      body: { action: 'address', ja_id: jaId },
    })
    if (error) return null
    return data?.address || null
  } catch {
    return null
  }
}
