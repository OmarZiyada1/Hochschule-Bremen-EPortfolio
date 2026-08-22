import { describe, expect, it } from "vitest"

import {
  ALLOWED_EMBED_HOSTS,
  EMBED_PROVIDERS,
  VIDEO_PROVIDERS,
  embedUrlFor,
  isAllowedEmbedUrl,
  isValidVideoId,
} from "@/features/project-content/providers"

/*
 * Die Listen sind gegen BlockValidationService verifiziert. Verstoesst
 * jemand dagegen, antwortet der Server mit 400
 * EMBED_PROVIDER_NOT_ALLOWED; diese Datei haelt fest, dass der Client
 * dieselbe Grenze zieht und nicht eine engere oder weitere.
 */

describe("Provider-Allowlist (Contract 2.5, seit v52 zweigeteilt)", () => {
  it("kennt fuer VIDEO nur die beiden Videoanbieter", () => {
    expect([...VIDEO_PROVIDERS]).toEqual(["youtube", "vimeo"])
  })

  it("kennt fuer EMBED vier Anbieter, jeden mit eigener Hostliste", () => {
    /* Seit v64 ohne gist: GitHub bietet fuer Gists keinen einbettbaren
       Rahmen an. Und figma bettet ueber einen eigenen Host ein, weil die
       Designseite selbst das Einbetten verbietet. */
    expect([...EMBED_PROVIDERS]).toEqual([
      "youtube",
      "vimeo",
      "figma",
      "codepen",
    ])
    expect(ALLOWED_EMBED_HOSTS).toEqual({
      youtube: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"],
      vimeo: ["player.vimeo.com"],
      figma: ["embed.figma.com"],
      codepen: ["codepen.io"],
    })
  })
})

describe("embedUrlFor", () => {
  it("baut die Adresse aus fester Vorlage, wortgleich mit dem Server", () => {
    expect(embedUrlFor("youtube", "dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    )
    expect(embedUrlFor("vimeo", "123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    )
  })

  it("ergibt eine Adresse, die die eigene Hostpruefung besteht", () => {
    expect(
      isAllowedEmbedUrl("youtube", embedUrlFor("youtube", "abc_DEF-123"))
    ).toBe(true)
    expect(isAllowedEmbedUrl("vimeo", embedUrlFor("vimeo", "42"))).toBe(true)
  })
})

describe("isValidVideoId", () => {
  it("nimmt bei YouTube nur Buchstaben, Ziffern, Unter- und Bindestrich", () => {
    expect(isValidVideoId("youtube", "dQw4w9WgXcQ")).toBe(true)
    expect(isValidVideoId("youtube", "a_b-C9")).toBe(true)
    for (const id of ["", "abc/def", "abc?x=1", "abc def", "a".repeat(65)]) {
      expect(isValidVideoId("youtube", id), id).toBe(false)
    }
  })

  it("nimmt bei Vimeo nur Ziffern", () => {
    expect(isValidVideoId("vimeo", "123456789")).toBe(true)
    for (const id of ["", "abc", "12a", "12/3"]) {
      expect(isValidVideoId("vimeo", id), id).toBe(false)
    }
  })
})

const FIGMA_EMBED =
  "https://embed.figma.com/design/o6SECXRMKGOzCfG5xZebPV/Name?embed-host=share"

describe("isAllowedEmbedUrl", () => {
  it("laesst nur https und nur den Host des Anbieters durch", () => {
    expect(isAllowedEmbedUrl("figma", FIGMA_EMBED)).toBe(true)
    expect(
      isAllowedEmbedUrl("figma", FIGMA_EMBED.replace("https", "http"))
    ).toBe(false)
    expect(
      isAllowedEmbedUrl(
        "figma",
        FIGMA_EMBED.replace("embed.figma.com", "figma.com")
      )
    ).toBe(false)
    expect(
      isAllowedEmbedUrl(
        "figma",
        FIGMA_EMBED.replace("embed.figma.com", "embed.figma.com.fremde.tld")
      )
    ).toBe(false)
    expect(isAllowedEmbedUrl("codepen", FIGMA_EMBED)).toBe(false)
  })

  /*
   * Seit v64 zaehlt auch der Pfad. Genau hier lag der haeufigste
   * Fehlschlag: die Zuschauerseite traegt einen erlaubten Host, verbietet
   * das Einbetten aber, und heraus kam ein leerer Rahmen ohne Meldung.
   */
  it("weist einen erlaubten Host mit fremdem Pfad ab", () => {
    expect(
      isAllowedEmbedUrl(
        "youtube",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      )
    ).toBe(false)
    expect(
      isAllowedEmbedUrl("youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ")
    ).toBe(true)
    expect(isAllowedEmbedUrl("codepen", "https://codepen.io/a/pen/b")).toBe(
      false
    )
    expect(isAllowedEmbedUrl("codepen", "https://codepen.io/a/embed/b")).toBe(
      true
    )
  })

  it("vergleicht Schema und Host ohne Beachtung der Schreibweise", () => {
    expect(isAllowedEmbedUrl("codepen", "HTTPS://CODEPEN.IO/a/embed/b")).toBe(
      true
    )
  })

  it("laesst einen angehaengten Port nicht als Host durchgehen", () => {
    expect(
      isAllowedEmbedUrl("codepen", "https://codepen.io:8443/a/embed/b")
    ).toBe(true)
    expect(
      isAllowedEmbedUrl("codepen", "https://codepen.io.fremde.tld/a/embed/b")
    ).toBe(false)
  })

  it("weist eine unlesbare Adresse ab, statt zu werfen", () => {
    for (const url of ["", "nicht mal eine url", null, undefined, 7]) {
      expect(isAllowedEmbedUrl("codepen", url), String(url)).toBe(false)
    }
  })
})
