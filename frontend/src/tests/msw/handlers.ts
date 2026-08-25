import { http, HttpResponse } from "msw"

import type { ErrorCode } from "@/api/errors"
import { emptyPage } from "@/api/page"
import type {
  BlockResponse,
  CommentResponse,
  DashboardResponse,
  OwnPortfolioResponse,
  ProjectDetailResponse,
  Top10AuditEntryResponse,
  Top10EntryResponse,
  Top10NominationResponse,
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
 * GET /api/admin/dashboard (§6.1, KAN-38), als Grundantwort fuer Tests, die
 * das Dashboard nur streifen.
 *
 * <p>Vollstaendig sind hier die drei Aufschluesselungen, auf die sich die
 * Oberflaeche stuetzt: projectsByStatus, usersByRole und usersByStatus tragen
 * jeden Wert ihres Enums, auch die mit 0, genau wie der Server es seit
 * Contract v26 zusagt. blocksByType bleibt dagegen leer und projectsByFaculty
 * ebenso: keine Ansicht liest sie in dieser Grundform, und vierzehn
 * Blocktypen in jeder Attrappe waeren Ballast. Wer sie braucht, reicht sie
 * als Ueberschreibung herein.
 */
export function dashboardHandler(overrides: Partial<DashboardResponse> = {}) {
  return http.get("*/api/admin/dashboard", () =>
    HttpResponse.json({
      projectsByStatus: {
        DRAFT: 0,
        SUBMITTED: 0,
        APPROVED: 0,
        PUBLISHED: 0,
        REVISION: 0,
      },
      projectsByFaculty: [],
      usersTotal: 0,
      usersByRole: { STUDENT: 0, EDITOR: 0, ADMIN: 0 },
      usersByStatus: { REGISTRATION_PENDING: 0, ACTIVE: 0, DEACTIVATED: 0 },
      openNominations: 0,
      blocksByType: {},
      ...overrides,
    } satisfies DashboardResponse)
  )
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
 * GET /api/projects/{id}/comments (§6.1, KAN-37). Ohne Argument eine leere
 * Liste.
 *
 * <p>Gebraucht ueberall dort, wo die Kommentarspalte mitrendert, also im
 * Editor und im Review-Modus. Ohne den Handler laeuft ihr Aufruf in
 * {@code onUnhandledRequest}, und die Spalte zeigt still ihren Fehlerzweig;
 * der Standardreporter blendet die Meldung aus.
 *
 * <p>Steht vor {@code projectDetailHandler} in einer Liste, sonst faengt
 * dessen Muster {@code /projects/:projectId} den Pfad zuerst ab.
 */
export function projectCommentsHandler(comments: CommentResponse[] = []) {
  return http.get("*/api/projects/:projectId/comments", () =>
    HttpResponse.json(comments)
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

/**
 * Die drei lesenden Antworten der Top-10-Verwaltung (§6.1, KAN-40), als
 * Grundantwort fuer Tests, die den Bereich nur streifen.
 *
 * <p>Sie stehen zusammen, weil die Seite alle drei zugleich braucht: die
 * besetzten Plaetze aus der oeffentlichen Liste, den Spiegel der
 * Nominierungen und das Protokoll. Ein Test, der nur einen davon anmeldet,
 * laeuft in {@code onUnhandledRequest}.
 */
export function top10AdminHandlers({
  entries = [],
  nominations = [],
  audit = [],
}: {
  entries?: Top10EntryResponse[]
  nominations?: Top10NominationResponse[]
  audit?: Top10AuditEntryResponse[]
} = {}) {
  return [
    http.get("*/api/top10", () => HttpResponse.json(entries)),
    /* Eine blanke Liste ohne PageResponse: der Endpoint paginiert nicht
       (§6.1). Der Statusfilter wird hier bewusst nicht nachgebildet, wer
       ihn prueft, meldet einen eigenen Handler an. */
    http.get("*/api/admin/top10-nominations", () =>
      HttpResponse.json(nominations)
    ),
    http.get("*/api/admin/top10-audit", () =>
      HttpResponse.json({
        content: audit,
        page: 0,
        size: 20,
        totalElements: audit.length,
        totalPages: audit.length === 0 ? 0 : 1,
      })
    ),
  ]
}
