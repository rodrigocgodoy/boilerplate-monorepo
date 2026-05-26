/**
 * One-off script: bootstrap Fastify in memory, register all routes, dump
 * the resulting OpenAPI spec to apps/api/openapi.yaml. Used by Kubb to
 * regenerate the typed API client without needing to actually start the
 * server (no port binding, no DB connection required).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fastify from 'fastify'
import { backendPlugin } from '@/plugin.js'

const app = fastify({ logger: false })

await app.register(backendPlugin)
await app.ready()

const spec = app.swagger()

const outputPath = path.resolve(process.cwd(), 'openapi.yaml')
await fs.writeFile(outputPath, JSON.stringify(spec, null, 2))

// eslint-disable-next-line no-console
console.log(`Wrote OpenAPI spec to ${outputPath}`)

await app.close()
