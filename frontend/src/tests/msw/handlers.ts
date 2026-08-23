import { http, HttpResponse } from "msw"

import type { ErrorCode } from "@/api/errors"
import { emptyPage } from "@/api/page"
import type {
  BlockResponse,
  OwnPortfolioResponse,
  ProjectDetailResponse,
  UserResponse,
} from "@/api/types"
import { ownPortfolio, projectDetail } from "@/tests/fixtures"

/**
 * Baut eine Fehlerantwort im Envelope aus Contract 6.2, damit Tests nicht
 * je Datei ein eigenes, womoeglich abweichendes Envelope zusammensetzen.
 * Die Feldnamen sind die des Servers; wer hier ein Feld umbenennt, testet
 * ein Backend, das es nicht gibt.
 */
export function apiErrorResponse(
  status: number,
  errorCode: ErrorCode,
  path: string,
  message = "Testmeldung."
) {
  return HttpResponse.json(
    {
      timestamp: "2026-08-15T12:00:00Z",
      status,
      errorCode,
      message,
      path,
    },
    { status }
  )
}

/**
 * GET /api/portfolio/me (KAN-34). Ohne Argument die Antwort eines Kontos
 * ohne Portfolio-Zeile: 200 mit leeren Feldern, kein 404 (§3.2.1).
 */
export function ownPortfolioHandler(
  overrides: Partial<OwnPortfolioResponse> = {}
) {
  return http.get("*/api/portfolio/me", () =>
    HttpResponse.json(ownPortfolio(overrides))
  )
}

/**
 * GET /api/auth/me mit den Daten, die {@code signInAs} in die Sitzung legt
 * (KAN-69). Seiten, die ihre Sitzung beim Betreten auffrischen, brauchen
 * den Handler auch dann, wenn sie sich fuer die Antwort nicht weiter
 * interessieren; sonst laeuft der Aufruf in {@code onUnhandledRequest}.
 * Ueberschreibungen fuer den Einzelfall gehen als Argument mit.
 */
export function currentUserHandler(overrides: Partial<UserResponse> = {}) {
  return http.get("*/api/auth/me", () =>
    HttpResponse.json({
      id: "00000000-0000-0000-0000-000000000001",
      email: "mira.beispiel@example.org",
      pendingEmail: null,
      hsbEmail: "mira.beispiel@stud.hs-bremen.de",
      firstName: "Mira",
      lastName: "Beispiel",
      role: "STUDENT",
      status: "ACTIVE",
      ...overrides,
    })
  )
}

/**
 * GET /api/projects mit leerer Seite im Format aus §6.6. Fuer Tests, die
 * eine Seite nur erreichen wollen und sich fuer die Liste nicht
 * interessieren.
 */
export function emptyProjectsHandler() {
  return http.get("*/api/projects", () => HttpResponse.json(emptyPage()))
}

/**
 * GET /api/projects/{id} (§6.1). Ohne Argument ein Entwurf mit Titel und
 * ohne Bloecke, also der Zustand, in dem der Editor gewoehnlich geoeffnet
 * wird.
 */
export function projectDetailHandler(
  overrides: Partial<ProjectDetailResponse> = {}
) {
  return http.get("*/api/projects/:projectId", ({ params }) =>
    HttpResponse.json(
      projectDetail({ id: String(params.projectId), ...overrides })
    )
  )
}

/**
 * GET /api/projects/{id}/blocks (§6.1, KAN-36). Die Antwort traegt neben
 * den Bloecken die {@code version} des Projekts; sie ist der Stand fuer den
 * naechsten schreibenden Request (§6.4).
 *
 * <p>Steht vor {@link projectDetailHandler} in einer Liste, sonst faengt
 * dessen Muster {@code /projects/:projectId} den Pfad zuerst ab.
 */
export function projectBlocksHandler(
  blocks: BlockResponse[] = [],
  version = 1
) {
  return http.get("*/api/projects/:projectId/blocks", () =>
    HttpResponse.json({ version, blocks })
  )
}

/**
 * GET /api/files/{id}: die Bytes einer Datei (§3.15.1).
 *
 * <p>Gebraucht ueberall dort, wo ein Bild eines <strong>nicht
 * veroeffentlichten</strong> Projekts erscheint, also im Editor und in der
 * Vorschau eines Entwurfs: dort laeuft der Abruf mit Token ueber den
 * Client und nicht ueber das {@code src} des {@code img} (§5, Zeile
 * „Datei lesen"). Der Inhalt spielt keine Rolle, jsdom laedt ohnehin kein
 * Bild; gebraucht wird, dass die Antwort ein Blob ist.
 */
export function fileBlobHandler() {
  return http.get("*/api/files/:fileId", () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), {
      headers: { "Content-Type": "image/png" },
    })
  )
}
