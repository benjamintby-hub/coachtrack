export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const calendarUrl = url.searchParams.get('url')

  if (!calendarUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  const httpsUrl = calendarUrl.replace('webcal://', 'https://')

  try {
    const response = await fetch(httpsUrl)
    if (!response.ok) {
      return new Response('Failed to fetch calendar', { status: response.status })
    }
    const text = await response.text()
    return new Response(text, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new Response('Error fetching calendar', { status: 500 })
  }
}
