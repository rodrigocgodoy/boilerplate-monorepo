import { randomUUID } from 'node:crypto'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { env } from '@/utils/environment.js'
import { getS3Client, publicUrlFor } from './client.js'

/** Tipos de imagem aceitos para avatar → extensão do arquivo. */
const AVATAR_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export type AvatarPresign = {
  /** URL do bucket para o POST multipart. */
  url: string
  /** Campos que devem ir no form-data (inclui a policy assinada). */
  fields: Record<string, string>
  /** URL pública final do objeto (salve em `user.image` após o upload). */
  publicUrl: string
}

export class StorageService {
  /** `true` se o `contentType` é uma imagem aceita para avatar. */
  isAllowedAvatarType(contentType: string): boolean {
    return contentType in AVATAR_TYPES
  }

  /**
   * Gera um POST pré-assinado para o upload **direto** do avatar pro S3. A
   * policy força o tipo de conteúdo e limita o tamanho (`AVATAR_MAX_BYTES`) —
   * validação do lado do storage, não só do client.
   */
  async presignAvatar(
    userId: string,
    contentType: string,
  ): Promise<AvatarPresign> {
    const ext = AVATAR_TYPES[contentType]
    const key = `avatars/${userId}/${randomUUID()}.${ext}`
    const { url, fields } = await createPresignedPost(getS3Client(), {
      Bucket: env.S3_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 1, env.AVATAR_MAX_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: 120,
    })
    return { url, fields, publicUrl: publicUrlFor(key) }
  }
}
