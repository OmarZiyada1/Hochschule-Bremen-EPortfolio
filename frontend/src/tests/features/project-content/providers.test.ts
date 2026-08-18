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

  it("kennt fuer EMBED fuenf Anbieter, jeden mit eigener Hostliste", () => {
    expect([...EMBED_PROVIDERS]).toEqual([
      "youtube",
      "vimeo",
      "figma",
      "codepen",
      "gist",
    ])
    expect(ALLOWED_EMBED_HOSTS).toEqual({
      youtube: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"],
      vimeo: ["player.vimeo.com"],
      figma: ["www.figma.com"],
      codepen: ["codepen.io"],
      gist: ["gist.github.com"],
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

describe("isAllowedEmbedUrl", () => {
  it("laesst nur https und nur den Host des Anbieters durch", () => {
    expect(isAllowedEmbedUrl("figma", "https://www.figma.com/embed?x=1")).toBe(
      true
    )
    expect(isAllowedEmbedUrl("figma", "http://www.figma.com/embed")).toBe(false)
    expect(isAllowedEmbedUrl("figma", "https://figma.com/embed")).toBe(false)
    expect(
      isAllowedEmbedUrl("figma", "https://www.figma.com.fremde.tld/x")
    ).toBe(false)
    expect(isAllowedEmbedUrl("codepen", "https://www.figma.com/embed")).toBe(
      false
    )
  })

  it("vergleicht Schema und Host ohne Beachtung der Schreibweise", () => {
    expect(isAllowedEmbedUrl("codepen", "HTTPS://CODEPEN.IO/pen/embed/a")).toBe(
      true
    )
  })

  it("laesst einen angehaengten Port nicht als Host durchgehen", () => {
    expect(isAllowedEmbedUrl("codepen", "https://codepen.io:8443/pen")).toBe(
      true
    )
    expect(
      isAllowedEmbedUrl("codepen", "https://codepen.io.fremde.tld/pen")
    ).toBe(false)
  })

  it("weist eine unlesbare Adresse ab, statt zu werfen", () => {
    for (const url of ["", "nicht mal eine url", null, undefined, 7]) {
      expect(isAllowedEmbedUrl("gist", url), String(url)).toBe(false)
    }
  })
})
