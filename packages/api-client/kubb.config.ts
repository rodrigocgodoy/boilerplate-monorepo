import { defineConfig, type UserConfig } from '@kubb/core'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'

export default defineConfig({
  input: {
    path: '../../apps/api/openapi.yaml',
  },
  output: {
    path: './gen',
    clean: true,
    format: false,
  },
  hooks: {
    done: ['npm run typecheck', 'biome format --write ./', 'biome lint --fix --unsafe ./src'],
  },
  plugins: [
    pluginOas({ generators: [] }),
    pluginTs({
      output: {
        path: 'models',
        banner(oas) {
          return `// version: ${oas.api.info.version}`
        },
      },
    }),
    pluginReactQuery({
      output: {
        path: './hooks',
      },
      group: {
        type: 'tag',
        name: ({ group }) => `${group}Hooks`,
      },
      client: {
        dataReturnType: 'full',
      },
      mutation: {
        methods: [ 'post', 'put', 'patch', 'delete' ],
      },
      infinite: false,
      query: {
        methods: [ 'get' ],
        importPath: "@tanstack/react-query"
      },
      suspense: {},
    }),
  ],
}) as UserConfig
