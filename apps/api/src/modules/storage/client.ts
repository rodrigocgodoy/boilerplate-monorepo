import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/utils/environment.js'

/**
 * Storage S3/MinIO **opcional**. Habilitado só quando o bucket e as credenciais
 * estão configurados — senão as rotas de upload respondem 503 (mesmo padrão de
 * AbacatePay). Ver UPGRADES.md → "MinIO / S3".
 */
export const isStorageEnabled = Boolean(
  env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY,
)

let client: S3Client | null = null

/** Cliente S3 (lazy). `forcePathStyle` quando há endpoint custom (MinIO/R2). */
export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    })
  }
  return client
}

/** URL pública de um objeto. Usa `S3_PUBLIC_URL` ou deriva do endpoint/bucket. */
export function publicUrlFor(key: string): string {
  const base =
    env.S3_PUBLIC_URL ||
    (env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}`
      : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`)
  return `${base.replace(/\/$/, '')}/${key}`
}
