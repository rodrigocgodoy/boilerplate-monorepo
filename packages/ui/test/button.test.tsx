import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../src/components/button'

describe('Button', () => {
  it('renderiza o texto do filho', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })

  it('dispara onClick ao clicar', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Clique</Button>)
    screen.getByRole('button', { name: 'Clique' }).click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('fica desabilitado com a prop disabled', () => {
    render(<Button disabled>Desabilitado</Button>)
    expect(screen.getByRole('button', { name: 'Desabilitado' })).toBeDisabled()
  })
})
