export const ptBR = {
  common: {
    language: 'Idioma',
    languages: {
      'pt-BR': 'Português (BR)',
      en: 'English',
      es: 'Español',
    },
    signOut: 'Sair',
    loading: 'Carregando...',
  },
  auth: {
    welcome: 'Bem-vindo',
    subtitle: 'Entre ou crie sua conta para continuar',
    tabs: {
      signIn: 'Entrar',
      signUp: 'Criar conta',
    },
    fields: {
      name: 'Nome',
      email: 'Email',
      password: 'Senha',
    },
    actions: {
      signIn: 'Entrar',
      signingIn: 'Entrando...',
      signUp: 'Criar conta',
      signingUp: 'Criando...',
    },
    or: 'ou',
    google: 'Continuar com Google',
    googleLoading: 'Conectando...',
    googleNotConfigured: 'Google não configurado. Veja UPGRADES.md.',
    errors: {
      signInFailed: 'Falha ao entrar',
      signUpFailed: 'Falha ao criar conta',
    },
    unauthorized: 'Não autorizado',
  },
  validation: {
    email: 'Email inválido',
    passwordMin: 'Mínimo de {{count}} caracteres',
    nameMin: 'Informe seu nome',
  },
  dashboard: {
    title: 'Dashboard',
    authenticatedUser: 'Usuário autenticado',
    description: 'Dados de GET /me via hook gerado pelo Kubb (useGetMe).',
    fields: {
      name: 'Nome',
      email: 'Email',
      id: 'ID',
      createdAt: 'Criado em',
    },
  },
} as const
