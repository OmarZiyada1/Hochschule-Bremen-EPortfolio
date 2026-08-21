/**
 * Provider- und Host-Allowlist fuer VIDEO und EMBED (Contract 2.5, seit
 * v52 samt Hosts im Contract) und die eine Ableitung der Einbettungs-URL.
 *
 * <p><strong>Zweigeteilt, und das hat einen Grund.</strong> VIDEO kennt nur
 * youtube und vimeo, EMBED zusaetzlich figma, codepen und gist: bei VIDEO
 * wird die Einbettungs-URL aus provider und videoId abgeleitet, und diese
 * Ableitung gibt es nur fuer die beiden Videoanbieter. Ein VIDEO-Block
 * speichert deshalb nie eine URL (Contract 2.5 woertlich), ein EMBED-Block
 * dagegen fuehrt seine {@code embedUrl} mit und der Host wird geprueft.
 *
 * <p><strong>Die Clientpruefung ist Vorabhinweis und kein Ersatz.</strong>
 * Verbindlich prueft der Server (BlockValidationService); ein Verstoss
 * ergibt 400 EMBED_PROVIDER_NOT_ALLOWED (Contract 6.2). Eine reine
 * Frontend-Pruefung liesse sich ueber direkte API-Aufrufe umgehen. Sie steht
 * hier, weil der Lesepfad kein iframe auf einen fremden Host oeffnen darf
 * und die Editor-Oberflaeche eine Eingabe vorpruefen koennen muss.
 *
 * <p>Diese Datei ist die einzige Stelle dieser Listen im Frontend; KAN-73
 * (Video- und Einbettungsdialog) und der Renderer lesen sie von hier.
 */

/** Anbieter, deren Einbettungs-URL aus provider und videoId entsteht (VIDEO). */
export const VIDEO_PROVIDERS = ["youtube", "vimeo"] as const

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number]

/** Anbieter fuer EMBED: die beiden Videoanbieter plus drei Werkzeuge. */
export const EMBED_PROVIDERS = [
  "youtube",
  "vimeo",
  "figma",
  "codepen",
  "gist",
] as const

export type EmbedProvider = (typeof EMBED_PROVIDERS)[number]

/**
 * Erlaubte Hosts je Anbieter, wortgleich mit
 * {@code BlockValidationService.ALLOWED_EMBED_HOSTS}. Zulaessig ist
 * ausschliesslich https. Ein passender Providername mit fremdem Host waere
 * sonst der bequeme Weg an der Allowlist vorbei (Contract 2.5).
 */
export const ALLOWED_EMBED_HOSTS: Record<EmbedProvider, readonly string[]> = {
  youtube: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"],
  vimeo: ["player.vimeo.com"],
  figma: ["www.figma.com"],
  codepen: ["codepen.io"],
  gist: ["gist.github.com"],
}

/**
 * Zulaessige videoId-Formate je Anbieter, uebernommen aus
 * {@code BlockValidationService.VIDEO_ID_PATTERNS}. Bewusst restriktiv,
 * weil die Einbettungs-URL aus der videoId zusammengesetzt wird und kein
 * URL-Metazeichen enthalten darf. Die Anker sind noetig, weil der Server
 * mit {@code Matcher.matches()} auf die ganze Zeichenkette prueft und
 * {@code RegExp.test} das nicht tut.
 */
export const VIDEO_ID_PATTERNS: Record<VideoProvider, RegExp> = {
  youtube: /^[A-Za-z0-9_-]{1,64}$/,
  vimeo: /^\d{1,32}$/,
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return (
    typeof value === "string" &&
    (VIDEO_PROVIDERS as readonly string[]).includes(value)
  )
}

export function isEmbedProvider(value: unknown): value is EmbedProvider {
  return (
    typeof value === "string" &&
    (EMBED_PROVIDERS as readonly string[]).includes(value)
  )
}

/** Prueft die videoId gegen das Muster ihres Anbieters. */
export function isValidVideoId(
  provider: VideoProvider,
  videoId: unknown
): videoId is string {
  return (
    typeof videoId === "string" && VIDEO_ID_PATTERNS[provider].test(videoId)
  )
}

/**
 * Die Einbettungs-URL eines VIDEO-Blocks, aus fester Vorlage und nie aus
 * Eingabetext. Sie entsteht erst zur Anzeige; in der Datenbank stehen
 * ausschliesslich provider und videoId (Contract 2.5).
 *
 * <p><strong>Wortgleich mit {@code BlockValidationService.embedUrlForVideo}.</strong>
 * Das Backend fuehrt dieselbe Ableitung als die verbindliche Fassung, ohne
 * heute einen Aufrufer zu haben; zwei auseinanderlaufende Vorlagen waeren
 * genau der Zustand, den Contract v52 mit der Host-Allowlist beendet hat.
 * Entschieden in der Klaerungsrunde zu KAN-10: die datenschutzfreundlichere
 * Adresse www.youtube-nocookie.com steht zwar in der Host-Allowlist, wird
 * aber erst uebernommen, wenn Backend und Contract sie gemeinsam fuehren.
 */
export function embedUrlFor(provider: VideoProvider, videoId: string): string {
  switch (provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${videoId}`
    case "vimeo":
      return `https://player.vimeo.com/video/${videoId}`
  }
}

/**
 * Liest Anbieter und {@code videoId} aus einer eingefuegten Adresse
 * (KAN-36).
 *
 * <p><strong>Warum der Editor eine Adresse annimmt und trotzdem keine
 * speichert.</strong> Eine Autor:in hat die Adresse ihres Videos in der
 * Zwischenablage, nicht dessen ID; nach der ID zu fragen hiesse, sie aus
 * der Adresse heraussuchen zu lassen. Gespeichert werden gleichwohl nur
 * {@code provider} und {@code videoId} (Contract 2.5): die Adresse wird
 * hier zerlegt und danach fallengelassen.
 *
 * <p>Erkannt werden die Formen, die Menschen tatsaechlich kopieren:
 * {@code youtube.com/watch?v=…}, {@code youtu.be/…},
 * {@code youtube.com/embed/…} und {@code vimeo.com/…}, jeweils mit oder
 * ohne {@code www}. {@code youtu.be} steht bewusst nicht in
 * {@link ALLOWED_EMBED_HOSTS}: diese Liste gilt fuer die gespeicherte
 * {@code embedUrl} eines EMBED-Blocks, hier wird die Adresse nur gelesen
 * und ihre ID danach gegen {@link VIDEO_ID_PATTERNS} geprueft.
 *
 * @returns Anbieter und ID, oder {@code null}, wenn beides nicht sicher
 *          ablesbar ist
 */
export function parseVideoUrl(
  value: string
): { provider: VideoProvider; videoId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    return null
  }
  if (parsed.protocol.toLowerCase() !== "https:") {
    return null
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  const segments = parsed.pathname.split("/").filter((part) => part !== "")

  if (host === "youtu.be") {
    return videoIdOrNull("youtube", segments[0])
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (segments[0] === "embed" || segments[0] === "shorts") {
      return videoIdOrNull("youtube", segments[1])
    }
    return videoIdOrNull("youtube", parsed.searchParams.get("v") ?? undefined)
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    /* player.vimeo.com/video/123456 und vimeo.com/123456 */
    const candidate = segments[0] === "video" ? segments[1] : segments[0]
    return videoIdOrNull("vimeo", candidate)
  }
  return null
}

function videoIdOrNull(
  provider: VideoProvider,
  candidate: string | undefined
): { provider: VideoProvider; videoId: string } | null {
  return isValidVideoId(provider, candidate)
    ? { provider, videoId: candidate }
    : null
}

/**
 * Liest den Anbieter aus der Adresse einer Einbettung (KAN-36).
 *
 * <p>Der EMBED-Block speichert {@code provider} <em>und</em>
 * {@code embedUrl} (Contract 2.5). Nach dem Anbieter zusaetzlich zu fragen
 * waere eine Angabe, die schon in der Adresse steht: er ergibt sich
 * eindeutig aus dem Host, und genau diese Zuordnung prueft der Server
 * anschliessend noch einmal.
 */
export function embedProviderFor(value: string): EmbedProvider | null {
  for (const provider of EMBED_PROVIDERS) {
    if (isAllowedEmbedUrl(provider, value.trim())) {
      return provider
    }
  }
  return null
}

/**
 * Prueft eine mitgelieferte {@code embedUrl} eines EMBED-Blocks gegen
 * Schema und Host seines Anbieters. Eine unlesbare Adresse gilt als nicht
 * erlaubt; im Lesepfad entsteht dann kein iframe, sondern ein Platzhalter
 * mit der Adresse als reinem Text (Contract 2.5).
 */
export function isAllowedEmbedUrl(
  provider: EmbedProvider,
  embedUrl: unknown
): embedUrl is string {
  if (typeof embedUrl !== "string") {
    return false
  }
  let parsed: URL
  try {
    parsed = new URL(embedUrl)
  } catch {
    return false
  }
  /* Kleingeschrieben verglichen wie im Server: RFC 3986 erklaert Schema und
     Host fuer schreibweisenunabhaengig, und ohne das Kleinschreiben faellt
     HTTPS://WWW.YOUTUBE.COM/... durch, obwohl 2.5 genau diesen Host fuehrt.
     hostname und nicht host, damit ein angehaengter Port nicht Teil des
     Vergleichs wird. */
  if (parsed.protocol.toLowerCase() !== "https:") {
    return false
  }
  return ALLOWED_EMBED_HOSTS[provider].includes(parsed.hostname.toLowerCase())
}
