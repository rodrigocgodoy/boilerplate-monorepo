// Âncora de tipos dos matchers do jest-dom (toBeInTheDocument, toBeDisabled…).
// O import em runtime vive no setup compartilhado (`@repo/vitest-config`), que
// está fora do programa do TypeScript deste workspace — sem esta linha, o
// `tsc` daqui não enxerga a augmentação do `expect`.
import '@testing-library/jest-dom/vitest'
