import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const calendarUrl = req.query.url as string

  if (!calendarUrl) {
    return res.status(400).send('Missing url parameter')
  }

  const httpsUrl = calendarUrl.replace('webcal://', 'https://')

  let host: string
  try {
    const parsed = new URL(httpsUrl)
    if (parsed.protocol !== 'https:') throw new Error()
    host = parsed.hostname
  } catch {
    return res.status(400).send('Invalid url parameter')
  }

  if (host !== 'icloud.com' && !host.endsWith('.icloud.com')) {
    return res.status(403).send('Only iCloud calendar URLs are allowed')
  }

  try {
    const response = await fetch(httpsUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'DAVdroid/2.0 (compatible; iCal)',
        'Accept': 'text/calendar',
      },
    })

    if (!response.ok) {
      return res.status(502).send(`iCloud error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    return res.send(text)
  } catch (e: any) {
    return res.status(500).send(`Fetch error: ${e.message}`)
  }
}
