import { getToken } from "@/api/auth/authStore"
import { ApiError, apiErrorFromBody, transportError } from "@/api/errors"

/**
 * Der eine HTTP-Client des Frontends. Ausserhalb von src/api/ steht kein
 * fetch (Frontend-Regel 3): Hooks und Komponenten rufen api.get, api.post
 * und so weiter, und jeder Fehler erreicht sie als ApiError.
 *
 * Basis-URL aus import.meta.env; ohne gesetzte Variable bleibt sie leer und
 * die Requests laufen gegen den eigenen Ursprung. Im Entwicklungsbetrieb
 * proxyt der Vite-Server /api auf das Backend (vite.config.ts), es gibt
 * also kein CORS und keine URL, die zur Bauzeit ins Bundle wandert; nur ein
 * Betrieb mit getrenntem API-Ursprung setzt VITE_API_BASE_URL.
 */
// Ohne Schluss-Schraegstrich, sonst ergibt "https://api.example.org/" plus
// "/api/..." einen Doppelslash im Pfad.
const BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  ""
)

/**
 * Array-Werte werden wiederholt angehaengt (?sort=a&sort=b), wie Spring
 * mehrwertige Parameter liest; die generierte schema.d.ts deklariert etwa
 * sort als string[].
 */
export type QueryParamValue = string | number | boolean
export type QueryParams = Record<
  string,
  QueryParamValue | readonly QueryParamValue[] | undefined
>

type RequestOptions = {
  body?: unknown
  query?: QueryParams
  signal?: AbortSignal
}

function buildUrl(path: string, query?: QueryParams): string {
  let url = BASE_URL + path
  if (query !== undefined) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue
      }
      if (Array.isArray(value)) {
        for (const entry of value) {
          params.append(key, String(entry))
        }
      } else {
        params.append(key, String(value))
      }
    }
    const encoded = params.toString()
    if (encoded !== "") {
      url = `${url}?${encoded}`
    }
  }
  /*
   * Gegen den eigenen Ursprung aufloesen: im Browser aendert das nichts,
   * aber das fetch des Testlaufs (Node) verlangt absolute URLs. Eine
   * absolute BASE_URL gewinnt gegen die Basis, so funktioniert auch ein
   * Betrieb mit getrenntem API-Ursprung.
   */
  return new URL(url, window.location.origin).toString()
}

/**
 * Macht eine vom Server gelieferte Referenz abrufbar, etwa das
 * /api/files/{id} eines Avatars (§3.15.1). Solche Adressen landen im src
 * eines img und laufen deshalb nie durch request(); ohne diese Aufloesung
 * zeigte das Bild ins Leere, sobald die API auf einem eigenen Ursprung
 * liegt. Die Basis-URL steht damit weiterhin an genau einer Stelle.
 */
export function resolveApiUrl(path: string): string {
  return buildUrl(path)
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers = new Headers()
  const token = getToken()
  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  /*
   * FormData traegt seinen Content-Type selbst, samt der Grenzmarke, die
   * nur fetch kennt (multipart/form-data; boundary=…). Wird der Header hier
   * gesetzt, fehlt dem Server die Grenzmarke und der Upload scheitert mit
   * 400, ohne dass etwas am Body falsch waere.
   */
  const isMultipart = options.body instanceof FormData
  if (options.body !== undefined && !isMultipart) {
    headers.set("Content-Type", "application/json")
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : isMultipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    // Ein Abbruch durch den Aufrufer (AbortSignal) ist kein Fehlerfall des
    // Servers und laeuft unveraendert weiter, etwa an TanStack Query.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }
    throw transportError(path)
  }

  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // kein JSON: apiErrorFromBody faellt auf den Transportfehler zurueck
    }
    throw apiErrorFromBody(body, response.status, path)
  }

  // 204 und leere Koerper: der Aufrufer typisiert T dann als void/undefined.
  if (response.status === 204) {
    return undefined as T
  }
  const text = await response.text()
  if (text === "") {
    return undefined as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError({
      timestamp: new Date().toISOString(),
      status: response.status,
      errorCode: "INTERNAL_ERROR",
      message: "Die Antwort des Servers ist kein gueltiges JSON.",
      path,
    })
  }
}

export const api = {
  get<T>(path: string, options?: Omit<RequestOptions, "body">): Promise<T> {
    return request<T>("GET", path, options)
  },
  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body">
  ): Promise<T> {
    return request<T>("POST", path, { ...options, body })
  },
  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body">
  ): Promise<T> {
    return request<T>("PUT", path, { ...options, body })
  },
  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body">
  ): Promise<T> {
    return request<T>("PATCH", path, { ...options, body })
  },
  delete<T>(path: string, options?: Omit<RequestOptions, "body">): Promise<T> {
    return request<T>("DELETE", path, options)
  },
}
