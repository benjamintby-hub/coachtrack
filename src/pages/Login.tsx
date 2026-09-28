import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await signIn(email, password)

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="bg-card p-8 rounded-xl shadow-sm w-full max-w-sm border border-hair">
        <h1 className="text-2xl font-bold text-ink mb-1 text-center">CoachTrack</h1>
        <p className="text-muted text-sm text-center mb-6">Gestion comptable du coach</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink2 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="ton@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink2 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-late text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-accent-ink rounded-lg py-2 text-sm font-medium hover:bg-accent2 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
