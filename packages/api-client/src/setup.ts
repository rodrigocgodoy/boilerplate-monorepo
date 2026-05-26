import { axiosInstance } from '@kubb/plugin-client/clients/axios'
import { getApiBaseUrl } from '@repo/utils/api-url'

/**
 * Configures the Kubb-generated axios instance with the correct
 * baseURL and withCredentials for cookie-based auth.
 *
 * Call this once in your app's entry point (main.tsx) before rendering.
 */
export function setupApiClient() {
  axiosInstance.defaults.baseURL = getApiBaseUrl()
  axiosInstance.defaults.withCredentials = true
}

export { axiosInstance }
