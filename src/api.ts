if (!import.meta.env.VITE_ROOT_URL) {
  throw new Error('VITE_ROOT_URL is required')
}

export async function api(path: string, opts: RequestInit = {}) {
  const url = new URL(import.meta.env.VITE_ROOT_URL)
  url.pathname = '/api' + path
  const req = await fetch(url, opts)
  if (!req.ok) {
    return {
      ok: false,
      status: req.status,
      headers: req.headers,
      error: await req.json(),
    }
  }
  return {
    ok: true,
    status: req.status,
    headers: req.headers,
    data: await req.json(),
  }
}
