import { useEffect, useState } from 'react'
import { clientsService } from '@/services/clientsService'
import type { Client } from '@/types'

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await clientsService.getAll()
      setClients(data)
    } catch {
      setError('Impossible de charger les clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
    const newClient = await clientsService.create(client)
    setClients(prev => [...prev, newClient].sort((a, b) => a.nom.localeCompare(b.nom)))
    return newClient
  }

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const updated = await clientsService.update(id, updates)
    setClients(prev => prev.map(c => c.id === id ? updated : c))
    return updated
  }

  const archiveClient = async (id: string) => {
    await clientsService.archive(id)
    setClients(prev => prev.filter(c => c.id !== id))
  }

  return { clients, loading, error, createClient, updateClient, archiveClient }
}
