import type {
  AdminUserResponse,
  ApiSchemas,
  CommentResponse,
  OwnPortfolioResponse,
  ProjectCardResponse,
  ProjectDetailResponse,
  ProjectReference,
  StatusHistoryResponse,
  Top10EntryResponse,
  Top10NominationResponse,
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
    module: null,
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

/**
 * Ein Kommentar (§3.5, §6.1). Ohne Ueberschreibung eine Antwort einer
 * studentischen Person; {@code status} ist {@code null}, weil nur ein
 * {@code CHANGE_REQUEST} einen Stand traegt (§2.4).
 */
export function comment(
  overrides: Partial<CommentResponse> = {}
): CommentResponse {
  return {
    id: "c-1",
    author: {
      id: "p-1",
      firstName: "Mira",
      lastName: "Beispiel",
      role: "STUDENT",
    },
    type: "REPLY",
    text: "Danke fuer die Rueckmeldung.",
    status: null,
    createdAt: "2026-01-02T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
    ...overrides,
  }
}

/**
 * Eine Nominierung (§3.11, §6.1). Ohne Ueberschreibung ein offener
 * Vorschlag der Stufe TOP_10; {@code proposedPosition} ist leer, weil der
 * Platz seit Contract v68 erst beim Annehmen entsteht.
 */
export function nomination(
  overrides: Partial<Top10NominationResponse> = {}
): Top10NominationResponse {
  return {
    id: "n-1",
    project: projectCard(),
    nominatedBy: person(),
    proposedTier: "TOP_10",
    proposedPosition: null,
    status: "PENDING",
    decidedBy: null,
    decidedAt: null,
    createdAt: "2026-01-03T10:00:00Z",
    ...overrides,
  }
}

/**
 * Ein Konto der Nutzerverwaltung (§3.1, §6.1; KAN-39). Ohne Ueberschreibung
 * ein aktives studentisches Konto mit beiden bestaetigten Adressen und ohne
 * offenen Passwortwechsel.
 *
 * <p>Es ist der einzige Antworttyp mit fremder hsbEmail; die Fabrik fuehrt
 * sie deshalb ausdruecklich, damit ein Test die Zusage aus §3.1 an genau
 * dieser Stelle pruefen kann.
 */
export function adminUser(
  overrides: Partial<AdminUserResponse> = {}
): AdminUserResponse {
  return {
    id: "au-1",
    email: "lena.mueller@example.org",
    hsbEmail: "lena.mueller@stud.hs-bremen.de",
    emailVerified: true,
    hsbEmailVerified: true,
    passwordChangeRequired: false,
    firstName: "Lena",
    lastName: "Mueller",
    role: "STUDENT",
    status: "ACTIVE",
    createdAt: "2026-03-14T09:00:00Z",
    updatedAt: "2026-03-14T09:00:00Z",
    ...overrides,
  }
}
