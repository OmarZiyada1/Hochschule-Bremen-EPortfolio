import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type {
  AdminPasswordResetResponse,
  AdminUserCreateRequest,
  AdminUserResponse,
  AdminUserUpdateRequest,
  DashboardResponse,
  ProjectBulkStatusRequest,
  ProjectBulkStatusResponse,
  Role,
  UserStatus,
} from "@/api/types"

/**
 * queryOptions-Fabrik der Administrationsseite (§6.1, Abschnitt
 * „Administration (ADMIN)", KAN-38): Pfad, Response-Typ und Query-Key stehen
 * hier an genau einer Stelle, die Pfade selbst in api/endpoints.ts.
 *
 * <p>Eine eigene Datei neben projects.ts, obwohl beide Ansichten der
 * Administrationsseite Projekte zeigen: der Zuschnitt ist die Ressource.
 * {@code /api/admin/**} ist ein geschlossener Bereich der Filterkette (§5),
 * und die Projektverwaltung liest bewusst dieselbe Projektliste wie alle
 * anderen, nur ohne festen Statusfilter. Sie steht deshalb weiter unter
 * {@code projectQueries}, hier steht allein, was es nur fuer ADMIN gibt.
 */
export const adminQueries = {
  /**
   * Die Kennzahlen der Startansicht (§6.1).
   *
   * <p><strong>Bestandsgroessen, kein Verlauf.</strong> Alle Zahlen gelten
   * zum Zeitpunkt des Aufrufs; §6.1 sieht keine Zeitreihe vor, eine Kachel
   * mit Trendpfeil haette also keine Datenquelle.
   *
   * <p><strong>Jede Aufschluesselung ist vollstaendig.</strong> Der Server
   * fuellt fehlende Enum-Werte mit 0 auf (Contract v26), und seit v76 gilt
   * dasselbe fuer die Fakultaeten. Die Oberflaeche fuehrt die Wertelisten
   * aus §2 deshalb nicht ein zweites Mal und deutet einen fehlenden
   * Schluessel nicht als Null: er waere ein Fehler.
   *
   * <p>Der Key traegt keine Parameter, weil der Endpoint keine kennt.
   */
  dashboard: () =>
    queryOptions({
      queryKey: ["admin", "dashboard"] as const,
      queryFn: () => api.get<DashboardResponse>(apiPaths.admin.dashboard),
    }),
}

/**
 * POST /api/admin/projects/status (§6.1, seit Contract v17, Koerper seit
 * v32): fuehrt fuer jedes Projekt der Auswahl denselben Uebergang aus.
 *
 * <p><strong>Die Antwort ist 200 mit einer Ergebnisliste, kein
 * Sammelerfolg.</strong> Je angefragter ID steht genau eine Zeile darin, in
 * der Reihenfolge des Bodys; ein Projekt, das nach §4.1 gerade nicht
 * uebergehen darf, traegt seinen Fehlercode in seiner Zeile und blockiert
 * die uebrigen nicht. Die Oberflaeche stellt genau diese Liste dar, statt
 * einen Gesamterfolg zu behaupten.
 *
 * <p><strong>reason ist an die Aktion gebunden.</strong> Pflicht bei
 * {@code request-revision}, weil der Text je Projekt ein eigener
 * CHANGE_REQUEST-Kommentar wird und die Autor:in sonst ohne Arbeitsauftrag
 * bliebe; bei {@code publish} unzulaessig und nicht bloss wirkungslos. Ein
 * Verstoss ergibt <strong>400</strong> {@code VALIDATION_FAILED} fuer die
 * ganze Anfrage und keine Ergebnisliste. Das zod-Schema des Dialogs prueft
 * dieselbe Bedingung vorab; verbindlich bleibt der Server.
 */
export function changeProjectStatusInBulk(
  request: ProjectBulkStatusRequest
): Promise<ProjectBulkStatusResponse> {
  return api.post<ProjectBulkStatusResponse>(apiPaths.admin.bulkStatus, request)
}

/**
 * Die Parameter der Kontoliste (§6.1, §6.6). Alle optional; was fehlt,
 * schraenkt nicht ein.
 *
 * <p>page ist 0-basiert wie im Seitenformat (§6.6). Die Adresse der Seite
 * zaehlt ab 1, umgerechnet wird beim Zusammenbauen der Parameter und nicht
 * hier: der Typ beschreibt den Request und nicht die Oberflaeche.
 */
export interface AdminUserListParams {
  role?: Role
  status?: UserStatus
  q?: string
  page?: number
}

/**
 * queryOptions-Fabriken der Nutzerverwaltung (§6.1, KAN-39).
 *
 * <p><strong>Hier und nicht in users.ts.</strong> Jene Datei traegt die
 * schmale Personensuche fuer Auswahlfelder, die jede angemeldete Person
 * aufrufen darf. Dies ist die Kontoverwaltung: sie ist ADMIN vorbehalten und
 * ihr Antworttyp fuehrt als einziger die fremde hsbEmail (§3.1). Zwei
 * Ressourcen mit verschiedenem Zuschnitt, also zwei Dateien.
 */
export const adminUserQueries = {
  /**
   * Die paginierte Liste (§6.6).
   *
   * <p>Der Key traegt alle vier Parameter: ohne sie zeigte die Liste nach
   * einem Filterwechsel das Ergebnis des vorigen Filters.
   *
   * <p><strong>Ohne sort bleibt es beim Serverstandard</strong>, also
   * alphabetisch nach Nachname und Vorname (§6.6, Contract v26). Die
   * Oberflaeche bietet keine Sortierung an und schickt deshalb auch keine;
   * ein unbekanntes Sortierfeld ergaebe 400 VALIDATION_FAILED.
   */
  list: (params: AdminUserListParams = {}) =>
    queryOptions({
      queryKey: ["admin", "users", params] as const,
      queryFn: () =>
        api.get<PageResponse<AdminUserResponse>>(apiPaths.admin.users, {
          query: {
            role: params.role,
            status: params.status,
            q: params.q === "" ? undefined : params.q,
            page: params.page,
          },
        }),
    }),

  /**
   * Ein einzelnes Konto (§6.1). Dieselben Felder wie in der Liste, dazu die
   * beiden Verifizierungsflags und updatedAt, die keine Tabellenspalte
   * traegt. Eine unbekannte ID ergibt 404 RESOURCE_NOT_FOUND.
   */
  detail: (userId: string) =>
    queryOptions({
      queryKey: ["admin", "users", "detail", userId] as const,
      queryFn: () => api.get<AdminUserResponse>(apiPaths.admin.user(userId)),
    }),
}

/**
 * POST /api/admin/users (§6.1, §6.7): legt ein sofort nutzbares Konto samt
 * Portfolio an, Antwort <strong>201</strong>.
 *
 * <p><strong>Das Initialpasswort geht hin und kommt nicht zurueck</strong>
 * (Contract v27). Der Client erzeugt es, der Server nimmt es entgegen und
 * antwortet mit {@code AdminUserResponse} ohne Passwortfeld. Wer es nach
 * dem Anlegen noch braucht, hat es aus dem Formular; der Dialog gibt es
 * deshalb in der Bestaetigung aus und nicht aus der Antwort.
 *
 * <p>Ein bereits vergebenes {@code email} oder {@code hsbEmail} ergibt
 * <strong>409</strong> RESOURCE_IN_USE, eine fremde Domain der HSB-Adresse
 * <strong>400</strong> VALIDATION_FAILED. Beide nennen das betroffene Feld
 * im Format {@code feld: Text} (§6.2) und erscheinen deshalb am Feld.
 */
export function createUser(
  request: AdminUserCreateRequest
): Promise<AdminUserResponse> {
  return api.post<AdminUserResponse>(apiPaths.admin.users, request)
}

/**
 * PATCH /api/admin/users/{id} (§6.1): aendert Name, Rolle oder Status.
 *
 * <p>Ein fehlendes Feld heisst „unveraendert". Am eigenen Konto weist der
 * Server {@code role} und {@code status} mit <strong>400</strong>
 * VALIDATION_FAILED ab (Contract v26): beides wirkt beim naechsten Request
 * (§6.5) und liesse sich danach nicht mehr zuruecknehmen.
 */
export function updateUser(
  userId: string,
  request: AdminUserUpdateRequest
): Promise<AdminUserResponse> {
  return api.patch<AdminUserResponse>(apiPaths.admin.user(userId), request)
}

/**
 * DELETE /api/admin/users/{id} (§6.1): <strong>deaktiviert</strong>, es
 * loescht nicht. Der Server setzt {@code status = DEACTIVATED} und
 * antwortet <strong>204</strong>; die Zeile bleibt in der Liste stehen.
 *
 * <p>Ein zweiter Aufruf ergibt wieder 204 und keinen Konflikt. Auf die
 * eigene ID ergibt er <strong>400</strong> VALIDATION_FAILED.
 */
export function deactivateUser(userId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.user(userId))
}

/**
 * POST /api/admin/users/{id}/reset-password (§6.1, §6.7, KAN-43): setzt ein
 * neues Initialpasswort, Antwort <strong>200</strong> mit
 * {@code { initialPassword }} und {@code passwordChangeRequired = true}.
 *
 * <p><strong>Hier erzeugt der Server</strong>, anders als beim Anlegen: es
 * gibt kein Formular, in das ein Passwort einzutragen waere. Der Endpoint
 * prueft den Status des Zielkontos nicht und funktioniert auch am eigenen
 * Konto (Contract v35).
 */
export function resetUserPassword(
  userId: string
): Promise<AdminPasswordResetResponse> {
  return api.post<AdminPasswordResetResponse>(
    apiPaths.admin.userResetPassword(userId)
  )
}
