export interface Client {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

export interface PriceItem {
  id: string
  category: string
  name: string
  workPrice: number
  materialPrice: number
}

export interface QuoteItem {
  id: string
  priceItemId: string
  name: string
  quantity: number
  workPrice: number
  materialPrice: number
}

export interface Quote {
  id: string
  clientId: string
  clientName: string
  address: string
  status: 'draft' | 'sent' | 'pending' | 'accepted' | 'rejected' | 'cancelled'
  items: QuoteItem[]
  totalWork: number
  totalMaterial: number
  totalVat: number
  total: number
  createdAt: string
}

export interface ProjectWork {
  id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  assignee: string
  deadline: string
  comments: string
}

export interface Project {
  id: string
  clientId: string
  clientName: string
  address: string
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold'
  startDate: string
  endDate: string
  budget: number
  works: ProjectWork[]
  createdAt: string
}

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Jonas Petraitis',
    email: 'jonas.petraitis@email.lt',
    phone: '+370 600 12345',
    address: 'Vilnius, Gedimino pr. 1-5',
  },
  {
    id: '2',
    name: 'UAB "Tech Solutions"',
    email: 'info@techsolutions.lt',
    phone: '+370 5 212 3456',
    address: 'Kaunas, Laisvės al. 101',
  },
]

export const mockPriceItems: PriceItem[] = [
  {
    id: '1',
    category: 'Elektra',
    name: 'Elektros instaliacijos montavimas',
    workPrice: 50,
    materialPrice: 20,
  },
  {
    id: '2',
    category: 'Elektra',
    name: 'Šviestuvų montavimas',
    workPrice: 30,
    materialPrice: 15,
  },
  {
    id: '3',
    category: 'Išmanus namas',
    name: 'Smart Home sistemos įdiegimas',
    workPrice: 200,
    materialPrice: 500,
  },
  {
    id: '4',
    category: 'Apsauga',
    name: 'Vaizdo kamerų montavimas',
    workPrice: 80,
    materialPrice: 150,
  },
  {
    id: '5',
    category: 'Apsauga',
    name: 'Signalizacijos sistemos montavimas',
    workPrice: 100,
    materialPrice: 200,
  },
]

export const mockQuotes: Quote[] = [
  {
    id: '1',
    clientId: '1',
    clientName: 'Jonas Petraitis',
    address: 'Vilnius, Gedimino pr. 1-5',
    status: 'accepted',
    items: [
      {
        id: '1',
        priceItemId: '1',
        name: 'Elektros instaliacijos montavimas',
        quantity: 10,
        workPrice: 50,
        materialPrice: 20,
      },
      {
        id: '2',
        priceItemId: '2',
        name: 'Šviestuvų montavimas',
        quantity: 5,
        workPrice: 30,
        materialPrice: 15,
      },
    ],
    totalWork: 650,
    totalMaterial: 275,
    totalVat: 185.25,
    total: 1110.25,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    clientId: '2',
    clientName: 'UAB "Tech Solutions"',
    address: 'Kaunas, Laisvės al. 101',
    status: 'pending',
    items: [
      {
        id: '3',
        priceItemId: '3',
        name: 'Smart Home sistemos įdiegimas',
        quantity: 1,
        workPrice: 200,
        materialPrice: 500,
      },
      {
        id: '4',
        priceItemId: '4',
        name: 'Vaizdo kamerų montavimas',
        quantity: 4,
        workPrice: 80,
        materialPrice: 150,
      },
    ],
    totalWork: 520,
    totalMaterial: 1100,
    totalVat: 390.6,
    total: 2010.6,
    createdAt: '2024-01-20',
  },
]

export const mockProjects: Project[] = [
  {
    id: '1',
    clientId: '1',
    clientName: 'Jonas Petraitis',
    address: 'Vilnius, Gedimino pr. 1-5',
    status: 'in_progress',
    startDate: '2024-01-16',
    endDate: '2024-02-15',
    budget: 1110.25,
    works: [
      {
        id: '1',
        name: 'Elektros instaliacijos montavimas',
        status: 'completed',
        assignee: 'Petras Svirskis',
        deadline: '2024-01-20',
        comments: 'Baigta be problemų',
      },
      {
        id: '2',
        name: 'Šviestuvų montavimas',
        status: 'in_progress',
        assignee: 'Petras Svirskis',
        deadline: '2024-01-25',
        comments: 'Laukiama šviestuvų',
      },
    ],
    createdAt: '2024-01-16',
  },
  {
    id: '2',
    clientId: '2',
    clientName: 'UAB "Tech Solutions"',
    address: 'Kaunas, Laisvės al. 101',
    status: 'planning',
    startDate: '2024-02-01',
    endDate: '2024-03-01',
    budget: 2010.6,
    works: [
      {
        id: '3',
        name: 'Smart Home sistemos įdiegimas',
        status: 'pending',
        assignee: 'Antanas Kazlauskas',
        deadline: '2024-02-15',
        comments: '',
      },
      {
        id: '4',
        name: 'Vaizdo kamerų montavimas',
        status: 'pending',
        assignee: 'Antanas Kazlauskas',
        deadline: '2024-02-20',
        comments: '',
      },
    ],
    createdAt: '2024-01-21',
  },
]
