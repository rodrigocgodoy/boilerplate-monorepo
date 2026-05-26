export const getApiBaseUrl = () => {
  const apiUrl = process.env.VITE_API_URL

  if (!apiUrl) {
    throw new Error('VITE_API_URL is not defined')
  }

  const withProtocol = apiUrl.includes('http') ? apiUrl : `https://${apiUrl}`

  try {
    const url = new URL(withProtocol)
    if (!url.host) throw new Error('empty host')
    return withProtocol
  } catch {
    throw new Error(
      `VITE_API_URL is invalid: "${apiUrl}". Make sure the env var is set at build time and resolves to a complete URL (e.g. https://api.example.com).`,
    )
  }
}
