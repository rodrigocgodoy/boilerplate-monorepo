export const es = {
  common: {
    language: 'Idioma',
    languages: {
      'pt-BR': 'Português (BR)',
      en: 'English',
      es: 'Español',
    },
    signOut: 'Salir',
    loading: 'Cargando...',
  },
  auth: {
    welcome: 'Bienvenido',
    subtitle: 'Inicia sesión o crea tu cuenta para continuar',
    tabs: {
      signIn: 'Entrar',
      signUp: 'Crear cuenta',
    },
    fields: {
      name: 'Nombre',
      email: 'Email',
      password: 'Contraseña',
    },
    actions: {
      signIn: 'Entrar',
      signingIn: 'Entrando...',
      signUp: 'Crear cuenta',
      signingUp: 'Creando...',
    },
    or: 'o',
    google: 'Continuar con Google',
    googleLoading: 'Conectando...',
    googleNotConfigured: 'Google no está configurado. Mira UPGRADES.md.',
    errors: {
      signInFailed: 'Error al iniciar sesión',
      signUpFailed: 'Error al crear la cuenta',
    },
    unauthorized: 'No autorizado',
  },
  validation: {
    email: 'Email inválido',
    passwordMin: 'Mínimo de {{count}} caracteres',
    nameMin: 'Ingresa tu nombre',
  },
  dashboard: {
    title: 'Panel',
    authenticatedUser: 'Usuario autenticado',
    description:
      'Datos de GET /me mediante el hook generado por Kubb (useGetMe).',
    fields: {
      name: 'Nombre',
      email: 'Email',
      id: 'ID',
      createdAt: 'Creado el',
    },
  },
} as const
