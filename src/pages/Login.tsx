import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  
  // Organizacijos ir profilio laukai
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'owner' | 'employee' | 'accountant'>('owner')
  const [hourlyRate, setHourlyRate] = useState('25')
  
  const navigate = useNavigate()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        // 1. Registruoti vartotoją
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (authError) throw authError

        if (authData.user) {
          // 2. Sukurti organizaciją
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert({ name: orgName })
            .select()
            .single()
          if (orgError) throw orgError

          // 3. Sukurti profilį
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              organization_id: orgData.id,
              role,
              full_name: fullName,
              hourly_rate: parseFloat(hourlyRate),
            })
          if (profileError) throw profileError

          setError('Registracija sėkminga! Galite prisijungti.')
          setIsSignUp(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klaida')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          {isSignUp ? 'Registracija' : 'Prisijungimas'}
        </h2>
        
        {error && (
          <div className={`mb-4 p-3 rounded text-sm ${error.includes('sėkminga') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              El. paštas
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slaptažodis
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organizacijos pavadinimas
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vardas ir pavardė
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rolė
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'owner' | 'employee' | 'accountant')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="owner">Vadovas</option>
                  <option value="employee">Darbuotojas</option>
                  <option value="accountant">Buhalteris</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valandinis įkainis (€)
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  required
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Kraunama...' : (isSignUp ? 'Registruotis' : 'Prisijungti')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            {isSignUp ? 'Jau turi paskyrą? Prisijunk' : 'Neturi paskyros? Registruokis'}
          </button>
        </div>
      </div>
    </div>
  )
}
