export const en = {
  common: {
    language: 'Language',
    languages: {
      'pt-BR': 'Português (BR)',
      en: 'English',
      es: 'Español',
    },
    signOut: 'Sign out',
    loading: 'Loading...',
  },
  auth: {
    welcome: 'Welcome',
    subtitle: 'Sign in or create your account to continue',
    tabs: {
      signIn: 'Sign in',
      signUp: 'Sign up',
    },
    fields: {
      name: 'Name',
      email: 'Email',
      password: 'Password',
    },
    actions: {
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      signUp: 'Sign up',
      signingUp: 'Creating...',
    },
    or: 'or',
    google: 'Continue with Google',
    googleLoading: 'Connecting...',
    googleNotConfigured: 'Google is not configured. See UPGRADES.md.',
    errors: {
      signInFailed: 'Failed to sign in',
      signUpFailed: 'Failed to create account',
    },
    unauthorized: 'Unauthorized',
  },
  validation: {
    email: 'Invalid email',
    passwordMin: 'At least {{count}} characters',
    nameMin: 'Please enter your name',
  },
  dashboard: {
    title: 'Dashboard',
    authenticatedUser: 'Authenticated user',
    description: 'Data from GET /me via the Kubb-generated hook (useGetMe).',
    fields: {
      name: 'Name',
      email: 'Email',
      id: 'ID',
      createdAt: 'Created at',
    },
  },
} as const
