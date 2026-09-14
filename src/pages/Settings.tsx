import { useEffect, useRef, useState } from 'react'
import { useOrganizationDetails, useUpdateOrganization, useUploadOrgLogo } from '../hooks/useOrganizationDetails'

export function Settings() {
  const { data: org, isLoading, error } = useOrganizationDetails()
  const updateOrg = useUpdateOrganization()
  const uploadLogo = useUploadOrgLogo()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [vatCode, setVatCode] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [brandColor, setBrandColor] = useState('#3b82f6')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (org) {
      setName(org.name || '')
      setCode(org.code || '')
      setVatCode(org.vat_code || '')
      setAddress(org.address || '')
      setPhone(org.phone || '')
      setEmail(org.email || '')
      setBankName(org.bank_name || '')
      setBankAccount(org.bank_account || '')
      setBrandColor(org.brand_color || '#3b82f6')
    }
  }, [org])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateOrg.mutateAsync({
        name,
        code: code || null,
        vat_code: vatCode || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        bank_name: bankName || null,
        bank_account: bankAccount || null,
        brand_color: brandColor,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert(`Klaida išsaugant: ${(err as Error).message}`)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadLogo.mutateAsync(file)
    } catch (err) {
      alert(`Klaida įkeliant logo: ${(err as Error).message}`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveLogo = async () => {
    try {
      await updateOrg.mutateAsync({ logo_url: null })
    } catch (err) {
      alert(`Klaida: ${(err as Error).message}`)
    }
  }

  if (isLoading) {
    return <div className="text-gray-600">Kraunama...</div>
  }

  if (error) {
    return <div className="text-red-600">Klaida: {(error as Error).message}</div>
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Nustatymai</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizacijos rekvizitai</h3>
        <p className="text-sm text-gray-500 mb-4">Šie duomenys bus naudojami PDF dokumentuose (sąskaitos, aktai).</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pavadinimas *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Įmonės kodas</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PVM kodas</label>
            <input
              type="text"
              value={vatCode}
              onChange={(e) => setVatCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresas</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefonas</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">El. paštas</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bankas</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Pvz.: AB SEB bankas"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banko sąskaita (IBAN)</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Pvz.: LT00 0000 0000 0000 0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Prekės ženklas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagrindinė spalva</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Naudojama PDF antraštėse.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logotipas</label>
            <div className="flex items-center gap-3">
              {org?.logo_url ? (
                <img src={org.logo_url} alt="Logo" className="h-12 max-w-[160px] object-contain border border-gray-200 rounded" />
              ) : (
                <div className="h-12 w-24 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                  Nėra logo
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLogo.isPending}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm disabled:opacity-50"
              >
                {uploadLogo.isPending ? 'Įkeliama...' : 'Įkelti'}
              </button>
              {org?.logo_url && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="px-3 py-2 text-red-600 hover:text-red-800 text-sm"
                >
                  Pašalinti
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={updateOrg.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {updateOrg.isPending ? 'Saugoma...' : 'Išsaugoti'}
          </button>
          {saved && <span className="text-sm text-green-600">Išsaugota</span>}
        </div>
      </form>
    </div>
  )
}
