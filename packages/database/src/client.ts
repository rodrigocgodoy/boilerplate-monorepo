import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/client/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from monorepo root when DATABASE_URL is not set (e.g. scripts, migrations)
if (!process.env.DATABASE_URL) {
  config({ path: path.resolve(__dirname, '../../../.env') })
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// 1. Create the Pool specifically for the adapter
const connectionString = process.env.DATABASE_URL

const pool = new Pool({
  connectionString,
})

// 2. Pass the pool to the adapter
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    // Optional: Log queries to see if connection works
    // log: ['query', 'info', 'warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '../generated/client/index.js'
export { PrismaClient } from '../generated/client/index.js'
