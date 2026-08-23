import {
  ALLOWED_EMBED_HOSTS,
  EMBED_PATH_PATTERNS,
  VIDEO_HASH_PATTERN,
  isValidVideoId,
  type EmbedProvider,
  type VideoProvider,
} from "@/features/project-content/providers"

/**
 * Aus dem, was jemand in der Zwischenablage hat, die eine Adresse machen,
 * die sich einbetten laesst (KAN-36).
 *
 * <p><strong>Warum das noetig ist.</strong> Jeder Anbieter gibt drei bis
 * vier verschiedene Adressen heraus, und keine davon ist die, die in ein
 * {@code iframe} gehoert: die Adresszeile des Browsers
 * ({@code youtube.com/watch?v=…}), der Teilen-Knopf
 * ({@code youtu.be/…?si=…}) und der Einbettungscode (ein ganzer
 * {@code iframe}-Schnipsel). Zu verlangen, dass die Autor:in die richtige
 * heraussucht, hiesse, ihr eine Aufgabe zu geben, die die Maschine besser
 * kann. Erst recht, weil der Unterschied unsichtbar ist: eine
 * {@code watch}-Adresse wird anstandslos angenommen und ergibt danach
 * einen leeren Rahmen, weil YouTube das Einbetten dieser Seite per
 * {@code X-Frame-Options} verbietet.
 *
 * <p><strong>Gespeichert wird trotzdem nur die kanonische Form.</strong>
 * Diese Datei liest und rechnet um; was in die Datenbank geht, prueft
 * danach unveraendert {@code providers.ts} und danach noch einmal der
 * Server (Contract 2.5). Die Eingabe wird also grosszuegig genommen und
 * eng gespeichert, nicht umgekehrt.
 *
 * <p><strong>Kein HTML-Parser.</strong> Aus einem eingefuegten Schnipsel
 * werden schlicht alle Zeichenketten gelesen, die wie eine https-Adresse
 * aussehen, und danach der Reihe nach durch dieselbe Umrechnung geschickt
 * wie eine einzeln eingefuegte Adresse. Das kommt ohne
 * {@code DOMParser} aus, laeuft damit auch im Test ohne DOM, und es kann
 * nichts ausfuehren: gelesen wird Text, ausgewertet wird nur, was danach
 * durch die Allowlist kommt.
 */

/** Was der Schnipsel von CodePen statt einer Adresse mitbringt. */
const CODEPEN_SLUG = /data-slug-hash\s*=\s*["']([A-Za-z0-9]+)["']/
const CODEPEN_USER = /data-user\s*=\s*["']([^"']+)["']/

/** https-Adressen in einem Text, samt Attribut-Anfuehrungszeichen als Grenze. */
const URL_IN_TEXT = /https:\/\/[^\s"'<>()]+/g

/**
 * Alle Adressen, die in der Eingabe stecken, in der Reihenfolge ihres
 * Auftretens; eine allein eingefuegte Adresse ergibt genau einen Eintrag.
 */
function candidates(input: string): string[] {
  const trimmed = input.trim()
  const found = trimmed.match(URL_IN_TEXT) ?? []
  /* Die ganze Eingabe zuerst: eine einzeln eingefuegte Adresse mit
     Klammern im Pfad wuerde von der Suche sonst beschnitten. */
  return trimmed.startsWith("https://") ? [trimmed, ...found] : found
}

function parsedUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol.toLowerCase() === "https:" ? url : null
  } catch {
    return null
  }
}

/** Host ohne fuehrendes {@code www.}, kleingeschrieben. */
function bareHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "")
}

function segments(url: URL): string[] {
  return url.pathname.split("/").filter((part) => part !== "")
}

// ---------------------------------------------------------------- Video

export type VideoSource = {
  provider: VideoProvider
  videoId: string
  /** Nur bei nicht gelisteten Vimeo-Videos (Contract 2.5 seit v64). */
  hash?: string
}

/**
 * Liest Anbieter, Kennung und, bei Vimeo, den Freigabe-Hash aus allem, was
 * eine Autor:in einfuegen kann.
 *
 * <p><strong>Zum Hash.</strong> Ein nicht gelistetes Vimeo-Video ist ohne
 * ihn nicht abspielbar: {@code player.vimeo.com/video/123} antwortet dann
 * mit einer Fehlerseite. Er steht je nach Herkunft als zweites
 * Pfadsegment ({@code vimeo.com/123/abc}) oder als Parameter {@code h}
 * ({@code player.vimeo.com/video/123?h=abc}).
 */
export function parseVideoInput(input: string): VideoSource | null {
  for (const candidate of candidates(input)) {
    const source = videoFromUrl(candidate)
    if (source !== null) {
      return source
    }
  }
  return null
}

function videoFromUrl(value: string): VideoSource | null {
  const url = parsedUrl(value)
  if (url === null) {
    return null
  }
  const host = bareHost(url)
  const path = segments(url)

  if (host === "youtu.be") {
    return youtube(path[0])
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (path[0] === "embed" || path[0] === "shorts" || path[0] === "live") {
      return youtube(path[1])
    }
    return youtube(url.searchParams.get("v") ?? undefined)
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    /* player.vimeo.com/video/123 und vimeo.com/123 */
    const withoutVideo = path[0] === "video" ? path.slice(1) : path
    return vimeo(withoutVideo[0], url.searchParams.get("h") ?? withoutVideo[1])
  }
  return null
}

function youtube(candidate: string | undefined): VideoSource | null {
  return isValidVideoId("youtube", candidate)
    ? { provider: "youtube", videoId: candidate }
    : null
}

function vimeo(
  candidate: string | undefined,
  hash: string | undefined
): VideoSource | null {
  if (!isValidVideoId("vimeo", candidate)) {
    return null
  }
  return hash !== undefined && VIDEO_HASH_PATTERN.test(hash)
    ? { provider: "vimeo", videoId: candidate, hash }
    : { provider: "vimeo", videoId: candidate }
}

// ---------------------------------------------------------------- Embed

export type EmbedSource = { provider: EmbedProvider; embedUrl: string }

/**
 * Rechnet alles, was eine Autor:in einfuegen kann, in die eine Adresse um,
 * die sich einbetten laesst.
 *
 * <p>Das Ergebnis erfuellt {@code ALLOWED_EMBED_HOSTS} und
 * {@code EMBED_PATH_PATTERNS} und wird vor der Rueckgabe noch einmal
 * dagegen geprueft: was hier herauskommt, geht ungeprueft in die Datenbank
 * und danach in ein {@code iframe}.
 */
export function parseEmbedInput(input: string): EmbedSource | null {
  const fromCodepenSnippet = codepenFromSnippet(input)
  if (fromCodepenSnippet !== null) {
    return fromCodepenSnippet
  }
  for (const candidate of candidates(input)) {
    const source = embedFromUrl(candidate)
    if (source !== null) {
      return source
    }
  }
  return null
}

function embedFromUrl(value: string): EmbedSource | null {
  const url = parsedUrl(value)
  if (url === null) {
    return null
  }
  const host = bareHost(url)

  if (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const video = videoFromUrl(value)
    return video === null
      ? null
      : checked("youtube", `https://www.youtube.com/embed/${video.videoId}`)
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const video = videoFromUrl(value)
    if (video === null) {
      return null
    }
    const base = `https://player.vimeo.com/video/${video.videoId}`
    return checked(
      "vimeo",
      video.hash === undefined ? base : `${base}?h=${video.hash}`
    )
  }
  if (host === "figma.com" || host === "embed.figma.com") {
    return figma(url)
  }
  if (host === "codepen.io") {
    return codepen(segments(url))
  }
  return null
}

/**
 * Figma bettet ueber einen eigenen Host ein.
 *
 * <p>Aus {@code figma.com/design/KEY/Name?node-id=…} wird
 * {@code embed.figma.com/design/KEY/Name?node-id=…&embed-host=share}. Der
 * Pfad bleibt, weil er den Dateityp und den Schluessel traegt;
 * {@code node-id} bleibt, weil es den gezeigten Rahmen bestimmt, und ohne
 * {@code embed-host} weist Figma die Einbettung ab.
 */
function figma(url: URL): EmbedSource | null {
  const path = segments(url)
  const kind = path[0] ?? ""
  if (!/^(design|file|board|proto|slides|deck)$/.test(kind)) {
    return null
  }
  const target = new URL(`https://embed.figma.com/${path.join("/")}`)
  const node = url.searchParams.get("node-id")
  if (node !== null) {
    target.searchParams.set("node-id", node)
  }
  target.searchParams.set("embed-host", "share")
  return checked("figma", target.toString())
}

/**
 * CodePen zeigt unter {@code /pen/} eine ganze Seite und unter
 * {@code /embed/} den einbettbaren Ausschnitt. {@code /details/} und
 * {@code /full/} sind zwei weitere Ansichten derselben Kennung.
 */
function codepen(path: string[]): EmbedSource | null {
  const [user, view, slug] = path
  if (
    user === undefined ||
    slug === undefined ||
    !/^(pen|embed|details|full)$/.test(view ?? "")
  ) {
    return null
  }
  return checked("codepen", `https://codepen.io/${user}/embed/${slug}`)
}

/**
 * Der Schnipsel von CodePen ist kein {@code iframe}, sondern ein
 * {@code p}-Element mit Datenattributen und ein nachgeladenes Skript. Die
 * Kennung steht deshalb nicht in einer Adresse, sondern in
 * {@code data-slug-hash} und {@code data-user}.
 */
function codepenFromSnippet(input: string): EmbedSource | null {
  const slug = CODEPEN_SLUG.exec(input)?.[1]
  const user = CODEPEN_USER.exec(input)?.[1]
  if (slug === undefined || user === undefined) {
    return null
  }
  return codepen([user, "embed", slug])
}

/** Letzte Kontrolle: nur zurueckgeben, was die Allowlist auch annimmt. */
function checked(
  provider: EmbedProvider,
  embedUrl: string
): EmbedSource | null {
  const url = parsedUrl(embedUrl)
  if (
    url === null ||
    !ALLOWED_EMBED_HOSTS[provider].includes(url.hostname.toLowerCase()) ||
    !EMBED_PATH_PATTERNS[provider].test(url.pathname)
  ) {
    return null
  }
  return { provider, embedUrl }
}
