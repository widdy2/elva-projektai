import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function PublicQuote() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Trūksta pasiūlymo rakto')
      setLoading(false)
      return
    }

    const fetchQuote = async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*, price_items(item_type))')
        .eq('public_token', token)
        .single()

      if (error) {
        setError('Pasiūlymas nerastas')
        setLoading(false)
        return
      }

      setQuote(data)
      setLoading(false)
    }

    fetchQuote()
  }, [token])

  const handleAccept = async () => {
    if (!quote) return

    console.log('Starting quote acceptance, quote:', quote)

    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_ip: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip),
      })
      .eq('id', quote.id)

    if (updateError) {
      console.error('Error updating quote:', updateError)
      alert('Klaida atnaujinant pasiūlymą')
      return
    }

    // Sukurti klientą
    console.log('Creating client with organization_id:', quote.organization_id)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        organization_id: quote.organization_id,
        name: quote.client_name || quote.clients?.name || 'Klientas',
        email: quote.client_email || quote.clients?.email,
        phone: quote.client_phone || quote.clients?.phone,
        address: quote.address,
      })
      .select()
      .single()

    if (clientError) {
      console.error('Error creating client:', clientError)
      alert('Klaida sukuriant klientą')
      return
    }

    console.log('Client created:', client)

    // Sukurti projektą
    console.log('Creating project with organization_id:', quote.organization_id, 'client_id:', client.id)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        organization_id: quote.organization_id,
        client_id: client.id,
        name: `${client.name} - ${quote.address}`,
        address: quote.address,
        status: 'planning',
        budget: quote.total,
      })
      .select()
      .single()

    if (projectError) {
      console.error('Error creating project:', projectError)
      alert('Klaida sukuriant projektą')
      return
    }

    console.log('Project created:', project)

    // Sukurti project_works iš quote_items
    console.log('Creating project works from quote items:', quote.quote_items)
    for (const item of quote.quote_items || []) {
      await supabase
        .from('project_works')
        .insert({
          project_id: project.id,
          name: item.name,
          status: 'pending',
          quantity: item.quantity || 1,
          work_price: item.work_price || 0,
          material_price: item.material_price || 0,
        })

      // Sandėlio prekės - sukurti project_materials įrašą
      if (item.warehouse_item_id) {
        await supabase
          .from('project_materials')
          .insert({
            project_id: project.id,
            warehouse_item_id: item.warehouse_item_id,
            name: item.name,
            unit: 'vnt',
            planned_quantity: item.quantity || 1,
            purchased_quantity: item.quantity || 1,
            used_quantity: 0,
            unit_price: item.material_price || 0,
          })
      }
    }

    alert('Pasiūlymas priimtas, sukurtas klientas ir objektas!')
    navigate('/')
  }

  const handleReject = async () => {
    if (!quote) return

    const { error } = await supabase
      .from('quotes')
      .update({ status: 'rejected' })
      .eq('id', quote.id)

    if (error) {
      alert('Klaida atnaujinant pasiūlymą')
      return
    }

    alert('Pasiūlymas atmestas')
    navigate('/')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Kraunama...</div>
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Klaida</h2>
          <p className="text-gray-600">{error || 'Pasiūlymas nerastas'}</p>
        </div>
      </div>
    )
  }

  const isService = (item: any) => {
    if (item.price_items?.item_type) return item.price_items.item_type === 'service'
    return (item.work_price || 0) > 0
  }

  const serviceItems = quote.quote_items?.filter(isService) || []
  const productItems = quote.quote_items?.filter((item: any) => !isService(item)) || []

  const servicesTotal = serviceItems.reduce((sum: number, item: any) => sum + (item.work_price || 0) * item.quantity, 0)
  const productsTotal = productItems.reduce((sum: number, item: any) => sum + (item.material_price || 0) * item.quantity, 0)
  const subtotal = servicesTotal + productsTotal
  const totalVat = subtotal * 0.21
  const total = subtotal + totalVat

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pasiūlymas</h1>
              <p className="text-gray-600">Data: {new Date(quote.created_at).toLocaleDateString('lt-LT')}</p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                {quote.status === 'draft' && 'Juodraštis'}
                {quote.status === 'sent' && 'Išsiųstas'}
                {quote.status === 'pending' && 'Laukiama'}
                {quote.status === 'accepted' && 'Priimtas'}
                {quote.status === 'rejected' && 'Atmestas'}
                {quote.status === 'cancelled' && 'Atšauktas'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Klientas</h2>
              <p className="text-gray-700">{quote.client_name || quote.clients?.name || 'Klientas'}</p>
              <p className="text-gray-600">{quote.client_email || quote.clients?.email}</p>
              <p className="text-gray-600">{quote.client_phone || quote.clients?.phone}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Adresas</h2>
              <p className="text-gray-700">{quote.address}</p>
            </div>
          </div>

          {serviceItems.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Paslaugos</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Pavadinimas</th>
                    <th className="text-right py-2">Kiekis</th>
                    <th className="text-right py-2">Kaina</th>
                    <th className="text-right py-2">Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceItems.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.name}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">€{(item.work_price || 0).toFixed(2)}</td>
                      <td className="text-right py-2">€{((item.work_price || 0) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2" colSpan={3}>Paslaugų suma (be PVM):</td>
                    <td className="text-right py-2">€{servicesTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {productItems.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Prekės</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Pavadinimas</th>
                    <th className="text-right py-2">Kiekis</th>
                    <th className="text-right py-2">Kaina</th>
                    <th className="text-right py-2">Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {productItems.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.name}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">€{(item.material_price || 0).toFixed(2)}</td>
                      <td className="text-right py-2">€{((item.material_price || 0) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2" colSpan={3}>Prekių suma (be PVM):</td>
                    <td className="text-right py-2">€{productsTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Suma be PVM:</span>
                <span className="text-gray-900">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PVM (21%):</span>
                <span className="text-gray-900">€{totalVat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span className="text-gray-700">Viso:</span>
                <span className="text-gray-900">€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {quote.status === 'pending' && (
            <div className="flex space-x-4">
              <button
                onClick={handleAccept}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded hover:bg-green-700 font-semibold"
              >
                Priimti
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded hover:bg-red-700 font-semibold"
              >
                Atmesti
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
