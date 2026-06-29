import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const calendarUrl = req.query.url as string

  if (!calendarUrl) {
    return res.status(400).send('Missing url parameter')
  }

  const httpsUrl = calendarUrl.replace('webcal://', 'https://')

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
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.send(text)
  } catch (e: any) {
    return res.status(500).send(`Fetch error: ${e.message}`)
  }
}
