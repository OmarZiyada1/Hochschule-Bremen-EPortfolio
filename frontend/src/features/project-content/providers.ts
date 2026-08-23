/**
 * Provider- und Host-Allowlist fuer VIDEO und EMBED (Contract 2.5, seit
 * v52 samt Hosts im Contract) und die eine Ableitung der Einbettungs-URL.
 *
 * <p><strong>Zweigeteilt, und das hat einen Grund.</strong> VIDEO kennt nur
 * youtube und vimeo, EMBED zusaetzlich figma und codepen: bei VIDEO
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

/**
 * Anbieter fuer EMBED: die beiden Videoanbieter plus zwei Werkzeuge.
 *
 * <p><strong>Ohne GitHub Gist seit Contract v64.</strong> Gist bietet
 * keinen einbettbaren Rahmen an, sondern ausschliesslich ein Skript, das
 * die Seite selbst nachlaedt; die Seite {@code gist.github.com} selbst
 * verbietet das Einbetten per {@code X-Frame-Options}. Der Anbieter stand
 * also in der Liste, ohne je funktionieren zu koennen: jede Gist-Adresse
 * wurde angenommen und ergab danach einen leeren Rahmen. Was nicht
 * zugesichert werden kann, steht nicht im Angebot.
 */
export const EMBED_PROVIDERS = ["youtube", "vimeo", "figma", "codepen"] as const

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
  /* Seit Contract v64 embed.figma.com statt www.figma.com: die Designseite
     selbst verbietet das Einbetten, Figma sieht dafuer einen eigenen Host
     vor. */
  figma: ["embed.figma.com"],
  codepen: ["codepen.io"],
}

/**
 * Der Pfad, unter dem ein Anbieter tatsaechlich einbettet.
 *
 * <p><strong>Der Host allein genuegt nicht.</strong> Genau daran lag der
 * haeufigste Fehlschlag: {@code www.youtube.com/watch?v=…} traegt einen
 * erlaubten Host, ist aber die Zuschauerseite und verbietet das Einbetten
 * per {@code X-Frame-Options}; sie wurde angenommen und ergab einen leeren
 * Rahmen ohne jede Meldung. Dasselbe gilt fuer {@code codepen.io/…/pen/…}.
 * Geprueft wird deshalb Host <em>und</em> Pfad, und die Eingabe wird
 * vorher in genau diese Form umgerechnet
 * ({@code providerInput.parseEmbedInput}).
 */
export const EMBED_PATH_PATTERNS: Record<EmbedProvider, RegExp> = {
  youtube: /^\/embed\/[A-Za-z0-9_-]{1,64}$/,
  vimeo: /^\/video\/\d{1,32}$/,
  figma:
    /^\/(design|file|board|proto|slides|deck)\/[A-Za-z0-9]{10,128}(\/.*)?$/,
  codepen: /^\/[^/]+\/embed\/[A-Za-z0-9]+\/?$/,
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

/**
 * Der Freigabe-Hash eines nicht gelisteten Vimeo-Videos (Contract 2.5 seit
 * v64).
 *
 * <p><strong>Warum es ihn braucht.</strong> Vimeo kennt neben oeffentlich
 * und privat den Zustand „nicht gelistet": abspielbar, aber nur mit einem
 * Hash in der Adresse. Ohne ihn antwortet
 * {@code player.vimeo.com/video/123} mit einer Fehlerseite im Rahmen. Der
 * Block speichert ihn deshalb neben der Kennung; er ist optional und fehlt
 * bei jedem oeffentlichen Video. Ebenso restriktiv wie die Kennung, denn
 * er wird in die Adresse eingesetzt.
 */
export const VIDEO_HASH_PATTERN = /^[A-Za-z0-9]{1,32}$/

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
export function embedUrlFor(
  provider: VideoProvider,
  videoId: string,
  hash?: string | null
): string {
  switch (provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${videoId}`
    case "vimeo":
      /* Der Hash gehoert nur an ein nicht gelistetes Video und wird vorher
         gegen VIDEO_HASH_PATTERN geprueft; ungeprueft eingesetzt waere er
         die eine Stelle, an der Eingabetext in die Adresse gelangt. */
      return hash != null && VIDEO_HASH_PATTERN.test(hash)
        ? `https://player.vimeo.com/video/${videoId}?h=${hash}`
        : `https://player.vimeo.com/video/${videoId}`
  }
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
  return (
    ALLOWED_EMBED_HOSTS[provider].includes(parsed.hostname.toLowerCase()) &&
    /* Seit v64 auch der Pfad: ein erlaubter Host mit der Zuschauerseite
       statt der Einbettung ergab bisher einen leeren Rahmen. */
    EMBED_PATH_PATTERNS[provider].test(parsed.pathname)
  )
}
