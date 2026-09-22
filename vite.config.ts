import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// En dev, sert la fonction Vercel api/calendar-proxy.ts (sinon Vite renvoie le fichier source)
function calendarProxyDev(): Plugin {
  return {
    name: 'calendar-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/calendar-proxy', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/calendar-proxy.ts')
        const query = Object.fromEntries(new URL(req.url ?? '', 'http://localhost').searchParams)
        const vres: any = {
          status(code: number) { res.statusCode = code; return vres },
          setHeader(name: string, value: string) { res.setHeader(name, value); return vres },
          send(body: string) { res.end(body); return vres },
        }
        await handler({ query } as any, vres)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), calendarProxyDev()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
