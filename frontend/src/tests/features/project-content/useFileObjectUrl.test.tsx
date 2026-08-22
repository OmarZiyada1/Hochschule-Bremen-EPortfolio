import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/api/queryClient"
import { useFileObjectUrl } from "@/features/project-content/hooks/useFileObjectUrl"
import { server } from "@/tests/msw/server"

/*
 * Befund aus KAN-36: hochgeladene Bilder wurden nicht angezeigt.
 *
 * Die Adresse eines Bildes entstand frueher in einem useMemo und wurde im
 * Aufraeumen eines Effekts freigegeben. Unter StrictMode ruft React beim
 * Montieren Aufbau, Abbau, Aufbau; der Abbau gab damit genau die Adresse
 * frei, die das img in derselben Runde schon trug. Zu sehen war das
 * ueberall dort, wo die Datei beim Montieren bereits im Cache lag, also
 * nach jedem Verschieben eines Blocks, nach jedem Zuruecksetzen des
 * Dokuments und bei zwei Galeriebildern derselben Datei.
 *
 * Die Faelle stehen deshalb ausdruecklich unter StrictMode, denn nur dort
 * faellt der Fehler ueberhaupt an.
 */

const FILE = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"

const created: string[] = []
const revoked: string[] = []
let originalCreate: typeof URL.createObjectURL
let originalRevoke: typeof URL.revokeObjectURL

function Probe({ fileId }: { fileId: string }) {
  const image = useFileObjectUrl(fileId)
  if (image.isError) {
    return <p>fehler</p>
  }
  return image.url === null ? (
    <p>laedt</p>
  ) : (
    <img src={image.url} alt={`Bild ${fileId}`} />
  )
}

function serveFile(id: string) {
  server.use(
    http.get(`*/api/files/${id}`, () =>
      HttpResponse.arrayBuffer(new ArrayBuffer(8), {
        headers: { "Content-Type": "image/png" },
      })
    )
  )
}

beforeEach(() => {
  created.length = 0
  revoked.length = 0
  originalCreate = URL.createObjectURL
  originalRevoke = URL.revokeObjectURL
  let n = 0
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${n++}`
    created.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url)
  })
})

afterEach(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

describe("useFileObjectUrl", () => {
  it("haelt die Adresse, wenn die Datei beim Montieren schon im Cache liegt", async () => {
    serveFile(FILE)
    const client = createQueryClient()
    const tree = (
      <StrictMode>
        <QueryClientProvider client={client}>
          <Probe fileId={FILE} />
        </QueryClientProvider>
      </StrictMode>
    )

    const first = render(tree)
    const img = await first.findByRole("img")
    expect(img.getAttribute("src")).toMatch(/^blob:/)
    first.unmount()

    /* Zweite Montage: der Eintrag liegt im Cache, die Adresse steht also
       schon im ersten Rendern. Genau hier blieb der Rahmen zuvor leer. */
    const second = render(tree)
    const again = await second.findByRole("img")
    expect(again.getAttribute("src")).toMatch(/^blob:/)
    expect(revoked).not.toContain(again.getAttribute("src"))
  })

  it("legt je Datei genau eine Adresse an, auch fuer zwei Anzeigen", async () => {
    serveFile(FILE)
    const client = createQueryClient()
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Probe fileId={FILE} />
          <Probe fileId={FILE} />
        </QueryClientProvider>
      </StrictMode>
    )

    const images = await screen.findAllByRole("img")
    expect(images).toHaveLength(2)
    expect(images[0].getAttribute("src")).toBe(images[1].getAttribute("src"))
    /* Das doppelte Rendern von StrictMode legte zuvor je Anzeige eine
       eigene Adresse an, von denen keine je freigegeben wurde. */
    expect(created).toHaveLength(1)
    expect(revoked).toHaveLength(0)
  })

  it("gibt die Adresse frei, wenn der Eintrag aus dem Cache faellt", async () => {
    serveFile(FILE)
    const client = createQueryClient()
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Probe fileId={FILE} />
        </QueryClientProvider>
      </StrictMode>
    )
    const img = await screen.findByRole("img")
    const url = img.getAttribute("src")

    client.clear()
    await waitFor(() => expect(revoked).toContain(url))
  })

  it("meldet einen Fehlschlag, statt dauerhaft zu laden", async () => {
    server.use(
      http.get(`*/api/files/${OTHER}`, () =>
        HttpResponse.json(
          {
            timestamp: "2026-08-22T12:00:00Z",
            status: 403,
            errorCode: "NO_PERMISSION",
            message: "Kein Zugriff",
            path: `/api/files/${OTHER}`,
          },
          { status: 403 }
        )
      )
    )
    const client = createQueryClient()
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Probe fileId={OTHER} />
        </QueryClientProvider>
      </StrictMode>
    )
    expect(await screen.findByText("fehler")).toBeInTheDocument()
  })
})
