import type {
  ApiSchemas,
  OwnPortfolioResponse,
  ProjectCardResponse,
  ProjectDetailResponse,
  ProjectReference,
  StatusHistoryResponse,
  Top10EntryResponse,
  UserResponse,
} from "@/api/types"

/*
 * Vollstaendige Antwortobjekte fuer Tests, jeweils mit einer Handvoll
 * Ueberschreibungen (KAN-76).
 *
 * Warum es diese Datei gibt: seit die generierten Antworttypen ihre
 * Pflichtfelder fuehren, ist ein Teilobjekt kein gueltiges
 * ProjectCardResponse mehr. Ohne Fabrik zaehlte jeder Testfall fuenfzehn bis
 * dreiundzwanzig Felder auf, von denen ihn eines interessiert, und die
 * Aussage des Tests ginge im Rauschen unter. Die Alternative waere ein
 * "as ProjectCardResponse" ueber einem Teilobjekt gewesen; das haette die
 * Zusage genau dort wieder abgeschaltet, wo sie gerade erst entstanden ist.
 *
 * Die Werte sind bewusst unauffaellig und stabil. Was ein Test zeigen will,
 * setzt er selbst, und dann steht es als einzige Abweichung sichtbar da.
 */

export function person(
  overrides: Partial<ApiSchemas["PersonResponse"]> = {}
): ApiSchemas["PersonResponse"] {
  return {
    id: "p-1",
    firstName: "Mira",
    lastName: "Beispiel",
    avatarUrl: null,
    ...overrides,
  }
}

export function reference(
  overrides: Partial<ProjectReference> = {}
): ProjectReference {
  return { id: "r-1", name: "Fakultät 4", abbreviation: "FK4", ...overrides }
}

export function user(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: "u-1",
    email: "mira@example.org",
    pendingEmail: null,
    hsbEmail: "mira@stud.hs-bremen.de",
    firstName: "Mira",
    lastName: "Beispiel",
    role: "STUDENT",
    status: "ACTIVE",
    ...overrides,
  }
}

export function ownPortfolio(
  overrides: Partial<OwnPortfolioResponse> = {}
): OwnPortfolioResponse {
  return {
    biography: null,
    avatarUrl: null,
    mayEditPortfolio: true,
    ...overrides,
  }
}

export function projectCard(
  overrides: Partial<ProjectCardResponse> = {}
): ProjectCardResponse {
  return {
    id: "1",
    title: "Campus-Garten",
    summary: null,
    coverImageUrl: null,
    status: "PUBLISHED",
    projectType: null,
    degree: null,
    semester: null,
    category: null,
    faculty: null,
    studyProgram: null,
    author: person(),
    tags: [],
    reactionCount: 0,
    publishedAt: null,
    ...overrides,
  }
}

export function top10Entry(
  overrides: Partial<Top10EntryResponse> = {}
): Top10EntryResponse {
  return {
    position: 1,
    addedAt: "2026-01-01T10:00:00Z",
    project: projectCard(),
    ...overrides,
  }
}

export function statusHistoryEntry(
  overrides: Partial<StatusHistoryResponse> = {}
): StatusHistoryResponse {
  return {
    fromStatus: null,
    toStatus: "DRAFT",
    changedBy: person(),
    timestamp: "2026-01-01T10:00:00Z",
    ...overrides,
  }
}

/*
 * Das Detail traegt die Felder der Kachel und darueber hinaus Mitwirkende,
 * Bloecke, Verlauf und die Version fuer das optimistische Sperren (§3.3,
 * §3.12). editors und statusHistory sind null und nicht leer: so sendet der
 * Server sie fuer alle, die den Kreis der Beteiligten nicht sehen duerfen.
 */
export function projectDetail(
  overrides: Partial<ProjectDetailResponse> = {}
): ProjectDetailResponse {
  return {
    ...projectCard(),
    module: null,
    /* Freiwillig seit Contract v66; die Autor:in bleibt Autor:in und wird
       kein Mitglied (§3.13.1). */
    authorRole: null,
    members: [],
    blocks: [],
    editors: null,
    statusHistory: null,
    version: 1,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
    ...overrides,
  }
}
