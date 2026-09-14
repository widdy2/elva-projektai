import jsPDF from 'jspdf'

// DejaVu Sans palaiko lietuviškas raides (ą č ę ė į š ų ū ž)
// Šriftai kraunami iš public/fonts vieną kartą ir kešuojami
let fontsPromise: Promise<{ regular: string; bold: string }> | null = null

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fetchAsBase64('/fonts/DejaVuSans.ttf'),
      fetchAsBase64('/fonts/DejaVuSans-Bold.ttf'),
    ]).then(([regular, bold]) => ({ regular, bold }))
  }
  return fontsPromise
}

/**
 * Įregistruoja DejaVuSans šriftą jsPDF dokumente (normal + bold)
 * ir nustato jį kaip aktyvų. Kviesti prieš rašant tekstą.
 */
export async function registerPdfFonts(doc: jsPDF): Promise<void> {
  try {
    const { regular, bold } = await loadFonts()
    doc.addFileToVFS('DejaVuSans.ttf', regular)
    doc.addFileToVFS('DejaVuSans-Bold.ttf', bold)
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold')
    doc.setFont('DejaVuSans', 'normal')
  } catch {
    // Jei šrifto nepavyko užkrauti — lieka helvetica (be LT raidžių)
  }
}
