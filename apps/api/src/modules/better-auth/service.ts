import { betterAuth } from 'better-auth'
import { type Auth, createAuthConfig } from './configs.js'

export class BetterAuthService {
  public readonly auth: Auth

  constructor() {
    const authConfig = createAuthConfig()
    this.auth = betterAuth(authConfig)
  }
}
