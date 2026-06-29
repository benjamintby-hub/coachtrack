export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const calendarUrl = url.searchParams.get('url')

  if (!calendarUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  const httpsUrl = calendarUrl.replace('webcal://', 'https://')

  try {
    const response = await fetch(httpsUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalendarSync/1.0)',
        'Accept': 'text/calendar, application/ics, */*',
      },
    })

    if (!response.ok) {
      return new Response(`iCloud error: ${response.status} ${response.statusText}`, { status: 502 })
    }

    const text = await response.text()

    if (!text.includes('BEGIN:VCALENDAR')) {
      return new Response(`Invalid calendar data received`, { status: 502 })
    }

    return new Response(text, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e: any) {
    return new Response(`Fetch error: ${e.message}`, { status: 500 })
  }
}
