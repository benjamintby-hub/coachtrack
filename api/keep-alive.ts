import type { VercelRequest, VercelResponse } from '@vercel/node'

// Appelée chaque jour par le cron Vercel (voir vercel.json).
// Fait une petite lecture en base pour que Supabase ne mette pas le projet
// en pause après 7 jours sans activité (plan gratuit).
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return res.status(500).send('Supabase env vars missing')
  }

  try {
    const response = await fetch(`${url}/rest/v1/clients?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })

    if (!response.ok) {
      return res.status(502).send(`Supabase error: ${response.status}`)
    }

    return res.status(200).send('ok')
  } catch {
    return res.status(502).send('Supabase unreachable')
  }
}
