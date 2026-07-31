import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Avatar, AvatarFallback } from '../src/components/avatar'
import { Badge } from '../src/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../src/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../src/components/dialog'
import { Input } from '../src/components/input'
import { Label } from '../src/components/label'
import { Separator } from '../src/components/separator'
import { Skeleton } from '../src/components/skeleton'
import { Spinner } from '../src/components/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../src/components/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../src/components/tabs'
import { Textarea } from '../src/components/textarea'

/**
 * Testes de render dos primitivos. O objetivo não é reprovar o Radix — é travar
 * o que o **app** depende: que cada primitivo renderize, aceite `className`
 * sem perder o próprio estilo, exponha o papel de acessibilidade certo e
 * repasse as props para o elemento nativo.
 *
 * Cobrir aparência (cores, espaçamento) aqui seria testar o Tailwind; isso é
 * trabalho de revisão visual, não de teste unitário.
 */

describe('Input', () => {
  it('aceita digitação e repassa o type', async () => {
    const user = userEvent.setup()
    render(<Input type="email" placeholder="seu@email.com" />)

    const input = screen.getByPlaceholderText('seu@email.com')
    expect(input).toHaveAttribute('type', 'email')

    await user.type(input, 'ana@test.dev')
    expect(input).toHaveValue('ana@test.dev')
  })

  it('fica desabilitado e não recebe texto', async () => {
    const user = userEvent.setup()
    render(<Input disabled placeholder="bloqueado" />)

    const input = screen.getByPlaceholderText('bloqueado')
    await user.type(input, 'nada')

    expect(input).toBeDisabled()
    expect(input).toHaveValue('')
  })

  it('mantém as classes do primitivo ao receber className', () => {
    render(<Input className="w-64" placeholder="custom" />)

    const input = screen.getByPlaceholderText('custom')
    expect(input).toHaveClass('w-64')
    expect(input).toHaveAttribute('data-slot', 'input')
  })
})

describe('Label', () => {
  it('associa o texto ao campo pelo htmlFor', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    )

    // `getByLabelText` só encontra se a associação existir de verdade — é a
    // mesma resolução que um leitor de tela faz.
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email')
  })
})

describe('Textarea', () => {
  it('aceita múltiplas linhas', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="mensagem" />)

    const textarea = screen.getByPlaceholderText('mensagem')
    await user.type(textarea, 'linha 1{enter}linha 2')

    expect(textarea).toHaveValue('linha 1\nlinha 2')
  })
})

describe('Card', () => {
  it('renderiza título, descrição e conteúdo', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Usuário autenticado</CardTitle>
          <CardDescription>Dados de GET /me</CardDescription>
        </CardHeader>
        <CardContent>ana@test.dev</CardContent>
      </Card>,
    )

    expect(screen.getByText('Usuário autenticado')).toBeInTheDocument()
    expect(screen.getByText('Dados de GET /me')).toBeInTheDocument()
    expect(screen.getByText('ana@test.dev')).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('renderiza o conteúdo e aplica a variante', () => {
    render(<Badge variant="secondary">Beta</Badge>)

    const badge = screen.getByText('Beta')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-slot', 'badge')
  })

  it('vira o elemento filho com asChild', () => {
    render(
      <Badge asChild>
        <a href="/planos">Pro</a>
      </Badge>,
    )

    expect(screen.getByRole('link', { name: 'Pro' })).toHaveAttribute(
      'href',
      '/planos',
    )
  })
})

describe('Avatar', () => {
  it('mostra o fallback quando não há imagem', () => {
    render(
      <Avatar>
        <AvatarFallback>AT</AvatarFallback>
      </Avatar>,
    )

    expect(screen.getByText('AT')).toBeInTheDocument()
  })
})

describe('Skeleton, Spinner e Separator', () => {
  it('Skeleton marca o slot usado pelas telas em carregamento', () => {
    const { container } = render(<Skeleton className="h-5 w-48" />)

    expect(container.querySelector('[data-slot="skeleton"]')).toBeVisible()
  })

  it('Spinner se anuncia como status para leitores de tela', () => {
    render(<Spinner />)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('Separator é decorativo por padrão (não polui a árvore de acessibilidade)', () => {
    const { container } = render(<Separator />)

    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })
})

describe('Tabs', () => {
  it('troca o painel visível ao clicar na aba', async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="signin">
        <TabsList>
          <TabsTrigger value="signin">Entrar</TabsTrigger>
          <TabsTrigger value="signup">Criar conta</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">painel de login</TabsContent>
        <TabsContent value="signup">painel de cadastro</TabsContent>
      </Tabs>,
    )

    expect(screen.getByText('painel de login')).toBeInTheDocument()
    expect(screen.queryByText('painel de cadastro')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Criar conta' }))

    expect(screen.getByText('painel de cadastro')).toBeInTheDocument()
    expect(screen.queryByText('painel de login')).not.toBeInTheDocument()
  })
})

describe('Dialog', () => {
  it('abre pelo trigger e fecha no Escape', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger>Criar organização</DialogTrigger>
        <DialogContent>
          <DialogTitle>Nova organização</DialogTitle>
          {/* O Radix avisa em runtime se faltar: sem descrição, o leitor de
              tela anuncia o diálogo sem dizer para que ele serve. */}
          <DialogDescription>Dê um nome para a organização.</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Criar organização' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Table', () => {
  it('renderiza cabeçalho e linhas com a semântica de tabela', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ana Tester</TableCell>
            <TableCell>ana@test.dev</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getByRole('cell', { name: 'Ana Tester' })).toBeInTheDocument()
  })
})

describe('composição com asChild', () => {
  it('o Button com asChild não cria botão dentro de link', async () => {
    // Padrão usado no dashboard (`<Button asChild><Link/></Button>`): o Radix
    // Slot funde as props no filho. Botão aninhado em link seria HTML inválido
    // e quebra navegação por teclado.
    const { Button } = await import('../src/components/button')
    const onClick = vi.fn()

    render(
      <Button asChild onClick={onClick}>
        {/* Âncora de hash: o jsdom não navega entre documentos, e um href
            absoluto só geraria ruído de "Not implemented" no output. */}
        <a href="#dashboard">Ir para o dashboard</a>
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'Ir para o dashboard' })
    expect(link.querySelector('button')).toBeNull()

    await userEvent.setup().click(link)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
