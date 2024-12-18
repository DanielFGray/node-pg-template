if (!import.meta.env.VITE_ROOT_URL) {
  throw new Error('VITE_ROOT_URL is required')
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}) {
  const url = new URL(import.meta.env.VITE_ROOT_URL)
  url.pathname = '/api' + path
  const req = await fetch(url, opts)
  return (await req.json()) as T
}
