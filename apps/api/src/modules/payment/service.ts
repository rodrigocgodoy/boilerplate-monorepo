import { type Payments, prisma } from '@repo/database'
import { getAbacatePay, PaymentError } from './client.js'
import type {
  CreateCheckoutBody,
  CreatePixBody,
  PaymentStatus,
} from './schemas.js'

const VALID_STATUSES: PaymentStatus[] = [
  'PENDING',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
]

function normalizeStatus(value: unknown): PaymentStatus | null {
  if (
    typeof value === 'string' &&
    VALID_STATUSES.includes(value as PaymentStatus)
  ) {
    return value as PaymentStatus
  }
  return null
}

export class PaymentService {
  /**
   * Cria um QR Code PIX (checkout transparente: você renderiza o `brCode`/QR
   * na sua própria UI) e persiste a cobrança localmente.
   */
  async createPixQrCode(input: CreatePixBody, userId: string | null) {
    const abacate = getAbacatePay()

    const res = await abacate.pixQrCode.create({
      amount: input.amount,
      description: input.description,
      expiresIn: input.expiresIn,
      customer: input.customer,
    })

    if (res.error !== null) {
      throw new PaymentError(res.error)
    }
    const pix = res.data

    await prisma.payments.upsert({
      where: { externalId: pix.id },
      create: {
        externalId: pix.id,
        kind: 'PIX_QRCODE',
        status: pix.status,
        amount: pix.amount,
        method: 'PIX',
        description: pix.description,
        brCode: pix.brCode,
        userId,
        metadata: pix as object,
      },
      update: { status: pix.status },
    })

    return {
      id: pix.id,
      amount: pix.amount,
      status: pix.status,
      brCode: pix.brCode,
      brCodeBase64: pix.brCodeBase64,
      expiresAt: pix.expiresAt,
    }
  }

  /**
   * Cria um checkout hospedado com PIX + cartão (`billing.create`) e devolve a
   * URL de pagamento. Persiste a cobrança localmente.
   */
  async createCheckout(input: CreateCheckoutBody, userId: string | null) {
    const abacate = getAbacatePay()

    const res = await abacate.billing.create({
      frequency: 'ONE_TIME',
      methods: input.methods,
      products: input.products,
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
      // `customer` é opcional aqui; se ausente, o cliente informa na tela do AbacatePay.
      ...(input.customer ? { customer: input.customer } : {}),
    } as Parameters<typeof abacate.billing.create>[0])

    if (res.error !== null) {
      throw new PaymentError(res.error)
    }
    const billing = res.data

    await prisma.payments.upsert({
      where: { externalId: billing.id },
      create: {
        externalId: billing.id,
        kind: 'BILLING',
        status: billing.status,
        amount: billing.amount,
        method: billing.methods.join(','),
        url: billing.url,
        userId,
        metadata: billing as object,
      },
      update: { status: billing.status },
    })

    return {
      id: billing.id,
      url: billing.url,
      amount: billing.amount,
      status: billing.status,
    }
  }

  /**
   * Busca uma cobrança local pelo `externalId`. Para PIX, reconsulta o status
   * no AbacatePay (a fonte da verdade é o webhook, mas isto cobre polling).
   */
  async getPayment(
    externalId: string,
    userId: string | null,
  ): Promise<Payments | null> {
    const payment = await prisma.payments.findUnique({ where: { externalId } })
    if (!payment) return null
    // Não vaza cobranças de outros usuários.
    if (payment.userId && userId && payment.userId !== userId) return null

    if (payment.kind === 'PIX_QRCODE' && payment.status === 'PENDING') {
      try {
        const res = await getAbacatePay().pixQrCode.check({ id: externalId })
        if (res.error === null && res.data.status !== payment.status) {
          return prisma.payments.update({
            where: { externalId },
            data: { status: res.data.status },
          })
        }
      } catch {
        // mantém o status local em caso de falha de rede
      }
    }

    return payment
  }

  /** Histórico de cobranças do usuário (mais recentes primeiro). */
  listForUser(userId: string): Promise<Payments[]> {
    return prisma.payments.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  /**
   * Processa eventos de cobrança avulsa (pix / billing.*). O segredo do webhook
   * já foi validado pela rota. O shape varia por evento, então extraímos
   * id/status de forma defensiva e atualizamos o status local pelo externalId.
   */
  async handleBillingEvent(body: {
    event?: string
    data?: Record<string, unknown>
  }): Promise<void> {
    const data = (body.data ?? {}) as Record<
      string,
      Record<string, unknown> | undefined
    >
    const entity =
      data.pixQrCode ?? data.billing ?? data.payment ?? body.data ?? {}

    const externalId = typeof entity.id === 'string' ? entity.id : undefined
    if (!externalId) return

    let status = normalizeStatus(entity.status)
    // Fallback: deriva do nome do evento (ex.: "billing.paid").
    if (!status && body.event?.toLowerCase().includes('paid')) status = 'PAID'

    if (status) {
      await prisma.payments.updateMany({
        where: { externalId },
        data: { status },
      })
    }
  }
}
