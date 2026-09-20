export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD'].includes(method)) {
    const token = await api<{ headerName: string; token: string }>('/auth/csrf')
    headers.set(token.headerName, token.token)
  }
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(10000),
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(
      0,
      'SIN_CONEXION',
      'No se pudo conectar con el servidor. Comprueba la conexión y que el backend esté iniciado.',
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      body.code ?? 'ERROR_SERVIDOR',
      body.message ?? 'El servidor no pudo completar la operación.',
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export type User = {
  id: string
  nombre: string
  correo: string
  rol: 'ADMINISTRADOR' | 'COLABORADOR'
  activo: boolean
  googleVinculado: boolean
  revision: number
}
export type Project = {
  id: string
  nombre: string
  descripcion: string
  fechaCreacion: string
  permiso: 'ADMINISTRACION' | 'CONSULTA' | 'EDICION'
  revision: number
}
export type Member = {
  id: string
  usuario: User
  permiso: 'CONSULTA' | 'EDICION'
  revision: number
}
export type PageResult<T> = { items: T[]; total: number; page: number; size: number }
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}
