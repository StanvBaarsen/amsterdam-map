import { defineConfig } from 'vite'
import type { PluginOption, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {

  const dataDir = path.resolve(__dirname, 'data')
  let hasLocalData = false
  let hasLocalBasemap = false
  let hasLocalTiles = false

  try {
    if (fs.existsSync(dataDir)) {
      if (fs.readdirSync(dataDir).length > 0) {
        hasLocalData = true
      }
      if (fs.existsSync(path.join(dataDir, 'basemap'))) {
        hasLocalBasemap = true
      }
      if (fs.existsSync(path.join(dataDir, 'amsterdam_3dtiles_lod12'))) {
        hasLocalTiles = true
      }    }
  } catch (e) {
    console.warn("Could not check local data directory:", e)
  }
  const plugins: PluginOption[] = [react()]

  if (mode === 'development' && hasLocalData) {
    console.log('Local data folder detected, serving from /data')
    plugins.push({
      name: 'serve-local-data',
      configureServer(server: ViteDevServer) {
        server.middlewares.use('/data', (req: IncomingMessage, res: ServerResponse, next: any) => {
          const url = req.url?.split('?')[0] || ''
          if (url.includes('..')) {
            res.statusCode = 403
            res.end('Forbidden')
            return
          }

          const filePath = path.join(dataDir, url)

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            const mimeTypes: Record<string, string> = {
              '.html': 'text/html',
              '.js': 'text/javascript',
              '.css': 'text/css',
              '.json': 'application/json',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.xml': 'application/xml',
              '.b3dm': 'application/octet-stream',
              '.cmpt': 'application/octet-stream',
            }
            const type = mimeTypes[ext] || 'application/octet-stream'

            res.setHeader('Content-Type', type)
            const fileStream = fs.createReadStream(filePath)
            fileStream.pipe(res)
          } else {
            next()
          }
        })
      }
    })
  }

  return {
    plugins,
    define: {
      __USE_LOCAL_DATA__: mode === 'development' && hasLocalData,
      __USE_LOCAL_BASEMAP__: mode === 'development' && hasLocalBasemap,
      __USE_LOCAL_TILES__: mode === 'development' && hasLocalTiles
    },
    build: {
      chunkSizeWarningLimit: 1500
    }
  }
})
