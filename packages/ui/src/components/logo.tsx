import { cn } from '@repo/ui/lib/utils'

interface LogoProps {
  /** Variante do logo: 'large' para telas de login/cadastro, 'small' para o header */
  variant?: 'large' | 'small'
  /** URL/caminho da imagem do logo. Quando ausente exibe um placeholder. */
  // TODO: importar imagem .webp via prop quando os assets estiverem prontos
  src?: string
  /** Texto alternativo para acessibilidade */
  alt?: string
  /** Classe CSS adicional */
  className?: string
}

/**
 * Componente de Logo centralizado.
 * Garante que a identidade visual seja consistente em todas as páginas.
 *
 * Quando `src` não é fornecido, renderiza um placeholder estilizado para
 * que o layout não quebre durante o desenvolvimento.
 */
function Logo({ variant = 'large', src, alt = 'Logo', className }: LogoProps) {
  const isSmall = variant === 'small'
  const sizeClass = isSmall ? 'h-8' : 'h-16'

  return (
    <img
      data-slot="logo"
      data-variant={variant}
      alt={alt}
      src={src}
      className={cn('relative shrink-0', sizeClass, className)}
    />
  )
}

export { Logo }
