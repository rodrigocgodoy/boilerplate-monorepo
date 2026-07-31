// Setup compartilhado dos workspaces de UI.

// Matchers do jest-dom no `expect` do Vitest (toBeInTheDocument, toBeDisabled…).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Desmonta o que sobrou no DOM entre testes. O Testing Library só faz isso
// sozinho com `globals: true`; aqui os testes importam `describe/it/expect`
// explicitamente, então o cleanup precisa ser registrado à mão — sem ele,
// `screen.getBy*` encontra elementos do teste anterior.
afterEach(() => {
  cleanup()
})
