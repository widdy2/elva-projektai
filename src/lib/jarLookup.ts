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

export interface JarDetails {
  address: string | null
  vat_code: string | null
}

// Registruota buveinė + PVM mokėtojo kodas pagal JuridinisAsmuo._id ir ja_kodas
export async function fetchJarDetails(jaId: string, jaKodas: number): Promise<JarDetails> {
  try {
    const { data, error } = await supabase.functions.invoke('jar-lookup', {
      body: { action: 'address', ja_id: jaId, ja_kodas: jaKodas },
    })
    if (error) return { address: null, vat_code: null }
    return { address: data?.address || null, vat_code: data?.vat_code || null }
  } catch {
    return { address: null, vat_code: null }
  }
}
