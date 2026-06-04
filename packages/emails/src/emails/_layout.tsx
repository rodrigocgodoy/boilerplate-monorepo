import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  pixelBasedPreset,
  Tailwind,
} from '@react-email/components'
import type { ReactNode } from 'react'

/** Casca compartilhada dos e-mails (Tailwind + container centralizado). */
export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html lang="pt-BR">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>{preview}</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-10 max-w-xl rounded-lg border border-gray-200 border-solid bg-white p-8">
            {children}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export function CtaButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Button
      href={href}
      className="box-border block rounded-md bg-black px-5 py-3 text-center font-medium text-sm text-white no-underline"
    >
      {children}
    </Button>
  )
}
