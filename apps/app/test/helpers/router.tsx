import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { vi } from 'vitest'

/**
 * Mock do `@tanstack/react-router` para testes de componente.
 *
 * Montar o router de verdade exigiria a `routeTree.gen.ts` (gerada pelo plugin
 * do Vite) e um histórico em memória — muito aparato para verificar que um
 * clique navegou. Aqui o router vira uma superfície pequena e observável; o
 * roteamento real é responsabilidade do E2E, que exercita o router de verdade.
 */

/** Espiões de navegação, inspecionáveis nos testes. */
export const navigation = {
  push: vi.fn<(to: string) => void>(),
  navigate: vi.fn<(opts: { to: string }) => void>(),
  /** Usado por componentes que refazem os loaders após mutar dados. */
  invalidate: vi.fn<() => void>(),
}

/** Search params devolvidos por `useSearch`. Ajuste no teste quando importar. */
export const search: Record<string, unknown> = {}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string
  children?: ReactNode
}

/**
 * Fábrica passada ao `vi.mock`. Uso:
 *
 * ```ts
 * vi.mock('@tanstack/react-router', async () =>
 *   (await import('./helpers/router')).routerMock(),
 * )
 * ```
 */
export function routerMock() {
  return {
    Link: ({ to, children, ...rest }: LinkProps) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    useRouter: () => ({
      history: { push: navigation.push },
      navigate: navigation.navigate,
      invalidate: navigation.invalidate,
    }),
    useNavigate: () => navigation.navigate,
    useSearch: () => search,
    // Espelha a forma real da `Route` (`Route.options.component`), e não um
    // atalho conveniente: assim o teste alcança o componente sem que o arquivo
    // de rota precise exportá-lo só para ser testável, e continua batendo com
    // os tipos do TanStack Router — o `tsc` do build valida os dois lados.
    createFileRoute:
      () =>
      <T,>(options: T) => ({ options }),
  }
}
