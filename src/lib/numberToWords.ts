// Skaičiaus užrašymas žodžiais lietuvių kalba (sumoms sąskaitose)

const ONES = [
  'nulis', 'vienas', 'du', 'trys', 'keturi',
  'penki', 'šeši', 'septyni', 'aštuoni', 'devyni',
]

const TEENS = [
  'dešimt', 'vienuolika', 'dvylika', 'trylika', 'keturiolika',
  'penkiolika', 'šešiolika', 'septyniolika', 'aštuoniolika', 'devyniolika',
]

const TENS = [
  '', 'dešimt', 'dvidešimt', 'trisdešimt', 'keturiasdešimt',
  'penkiasdešimt', 'šešiasdešimt', 'septyniasdešimt', 'aštuoniasdešimt', 'devyniasdešimt',
]

const HUNDREDS = [
  '', 'šimtas', 'du šimtai', 'trys šimtai', 'keturi šimtai',
  'penki šimtai', 'šeši šimtai', 'septyni šimtai', 'aštuoni šimtai', 'devyni šimtai',
]

function underThousand(n: number): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h > 0) parts.push(HUNDREDS[h])
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10])
  } else {
    const t = Math.floor(rest / 10)
    const o = rest % 10
    if (t > 0) parts.push(TENS[t])
    if (o > 0) parts.push(ONES[o])
  }
  return parts.join(' ')
}

// Linksniavimas: 1 euras, 2-9 eurai, 10-19/0 eurų
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100
  if (mod100 >= 10 && mod100 <= 19) return many
  const mod10 = Math.abs(n) % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 9) return few
  return many
}

function intToWords(n: number): string {
  if (n === 0) return 'nulis'
  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  if (millions > 0) {
    parts.push(`${underThousand(millions)} ${plural(millions, 'milijonas', 'milijonai', 'milijonų')}`)
  }
  if (thousands > 0) {
    parts.push(`${underThousand(thousands)} ${plural(thousands, 'tūkstantis', 'tūkstančiai', 'tūkstančių')}`)
  }
  if (rest > 0) parts.push(underThousand(rest))
  return parts.join(' ')
}

/**
 * Suma eurais žodžiais, pvz. 1234.56 -> "Vienas tūkstantis du šimtai trisdešimt keturi eurai 56 ct"
 */
export function amountToWords(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100
  const eur = Math.floor(rounded)
  const ct = Math.round((rounded - eur) * 100)
  const words = intToWords(eur)
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1)
  return `${capitalized} ${plural(eur, 'euras', 'eurai', 'eurų')} ${String(ct).padStart(2, '0')} ct`
}
