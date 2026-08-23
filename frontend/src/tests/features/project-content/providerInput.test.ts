import { describe, expect, it } from "vitest"

import {
  parseEmbedInput,
  parseVideoInput,
} from "@/features/project-content/providerInput"
import {
  embedUrlFor,
  isAllowedEmbedUrl,
} from "@/features/project-content/providers"

/*
 * Die Faelle stammen aus dem Bericht zu KAN-36: es sind genau die Adressen,
 * die eine Autor:in in der Zwischenablage hat, wenn sie ein Video oder eine
 * Einbettung einfuegen will. Sie stehen hier als Test und nicht als Beispiel
 * in einem Kommentar, weil jeder einzelne von ihnen zuvor entweder abgewiesen
 * wurde oder einen leeren Rahmen ergab.
 */

const YT = "hP3utZi3N6M"
const VIMEO = "1212836492"
const VIMEO_HASH = "3ace684330"
const FIGMA = "o6SECXRMKGOzCfG5xZebPV"

describe("parseVideoInput", () => {
  it("liest YouTube aus Adresszeile, Teilen-Link und Einbettungscode", () => {
    const forms = [
      `https://www.youtube.com/watch?v=${YT}`,
      `https://youtu.be/${YT}?si=z1_w1053Zi1Wbr4t`,
      `https://www.youtube.com/embed/${YT}?si=F6ko9QKx_yg2C6Xd`,
      `https://www.youtube.com/shorts/${YT}`,
      `<iframe width="560" height="315" src="https://www.youtube.com/embed/${YT}?si=F6ko9QKx_yg2C6Xd" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`,
    ]
    for (const form of forms) {
      expect(parseVideoInput(form), form).toEqual({
        provider: "youtube",
        videoId: YT,
      })
    }
  })

  it("liest Vimeo und nimmt den Freigabe-Hash mit, wo es ihn gibt", () => {
    expect(parseVideoInput(`https://vimeo.com/${VIMEO}?fl=pl&fe=sh`)).toEqual({
      provider: "vimeo",
      videoId: VIMEO,
    })
    /* Nicht gelistet: ohne den Hash ist das Video nicht abspielbar. */
    expect(
      parseVideoInput(`https://player.vimeo.com/video/${VIMEO}?h=${VIMEO_HASH}`)
    ).toEqual({ provider: "vimeo", videoId: VIMEO, hash: VIMEO_HASH })
    expect(parseVideoInput(`https://vimeo.com/${VIMEO}/${VIMEO_HASH}`)).toEqual(
      { provider: "vimeo", videoId: VIMEO, hash: VIMEO_HASH }
    )
    expect(
      parseVideoInput(
        `<iframe title="vimeo-player" src="https://player.vimeo.com/video/${VIMEO}?h=${VIMEO_HASH}" width="640" height="360"></iframe>`
      )
    ).toEqual({ provider: "vimeo", videoId: VIMEO, hash: VIMEO_HASH })
  })

  it("baut aus dem Hash die Adresse und laesst ihn sonst weg", () => {
    expect(embedUrlFor("vimeo", VIMEO, VIMEO_HASH)).toBe(
      `https://player.vimeo.com/video/${VIMEO}?h=${VIMEO_HASH}`
    )
    expect(embedUrlFor("vimeo", VIMEO)).toBe(
      `https://player.vimeo.com/video/${VIMEO}`
    )
    /* Ein unbrauchbarer Hash wird nicht eingesetzt: er landete sonst
       ungeprueft in der Adresse eines iframe. */
    expect(embedUrlFor("vimeo", VIMEO, "a b&c")).toBe(
      `https://player.vimeo.com/video/${VIMEO}`
    )
  })

  it("nimmt nichts an, woraus sich kein Video ablesen laesst", () => {
    for (const value of [
      "https://example.org/video/1",
      "http://www.youtube.com/watch?v=abc",
      "kein Text mit Adresse",
      "",
    ]) {
      expect(parseVideoInput(value), value).toBeNull()
    }
  })
})

describe("parseEmbedInput", () => {
  it("rechnet die YouTube-Zuschauerseite in die Einbettung um", () => {
    /* Der haeufigste Fehlschlag: der Host ist erlaubt, die Seite verbietet
       das Einbetten aber, und heraus kam ein leerer Rahmen. */
    expect(parseEmbedInput(`https://www.youtube.com/watch?v=${YT}`)).toEqual({
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${YT}`,
    })
    expect(parseEmbedInput(`https://youtu.be/${YT}?si=abc`)).toEqual({
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${YT}`,
    })
  })

  it("rechnet Vimeo um und behaelt den Freigabe-Hash", () => {
    expect(parseEmbedInput(`https://vimeo.com/${VIMEO}?fl=pl&fe=sh`)).toEqual({
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${VIMEO}`,
    })
    expect(
      parseEmbedInput(`https://player.vimeo.com/video/${VIMEO}?h=${VIMEO_HASH}`)
    ).toEqual({
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${VIMEO}?h=${VIMEO_HASH}`,
    })
  })

  it("fuehrt Figma auf den Einbettungshost und behaelt den Rahmen", () => {
    const parsed = parseEmbedInput(
      `https://www.figma.com/design/${FIGMA}/HSB_E-Portfolio?node-id=839-3273&t=abc`
    )
    expect(parsed?.provider).toBe("figma")
    const url = new URL(parsed?.embedUrl ?? "")
    expect(url.hostname).toBe("embed.figma.com")
    expect(url.pathname).toBe(`/design/${FIGMA}/HSB_E-Portfolio`)
    /* node-id bestimmt, welcher Rahmen gezeigt wird; ohne embed-host weist
       Figma die Einbettung ab. */
    expect(url.searchParams.get("node-id")).toBe("839-3273")
    expect(url.searchParams.get("embed-host")).toBe("share")
    /* Die fertige Adresse aus dem Teilen-Dialog geht ebenso durch. */
    expect(
      parseEmbedInput(
        `<iframe width="800" height="450" src="https://embed.figma.com/design/${FIGMA}/HSB_E-Portfolio?node-id=839-3273&embed-host=share" allowfullscreen></iframe>`
      )?.provider
    ).toBe("figma")
  })

  it("rechnet CodePen um, auch aus dem Schnipsel ohne Adresse", () => {
    expect(parseEmbedInput("https://codepen.io/VoXelo/pen/VYKMNwE")).toEqual({
      provider: "codepen",
      embedUrl: "https://codepen.io/VoXelo/embed/VYKMNwE",
    })
    /* CodePen gibt kein iframe heraus, sondern ein p-Element mit
       Datenattributen und ein nachgeladenes Skript. */
    const snippet = `<p class="codepen" data-height="300" data-default-tab="html,result" data-slug-hash="VYKMNwE" data-user="VoXelo"><span>See the Pen</span></p>
<script async src="https://public.codepenassets.com/embed/index.js"></script>`
    expect(parseEmbedInput(snippet)).toEqual({
      provider: "codepen",
      embedUrl: "https://codepen.io/VoXelo/embed/VYKMNwE",
    })
  })

  it("nimmt GitHub Gist nicht mehr an", () => {
    /* Seit Contract v64 kein Anbieter mehr: GitHub bietet fuer Gists keinen
       einbettbaren Rahmen an, sondern nur ein nachgeladenes Skript. */
    for (const value of [
      "https://gist.github.com/tomfun/d6f4f1faeac1aed9493c425e9cfe8fa5",
      "https://gist.github.com/tomfun/d6f4f1faeac1aed9493c425e9cfe8fa5.js",
      '<script src="https://gist.github.com/tomfun/d6f4f1faeac1aed9493c425e9cfe8fa5.js"></script>',
    ]) {
      expect(parseEmbedInput(value), value).toBeNull()
    }
  })

  it("gibt nur zurueck, was die Allowlist danach auch annimmt", () => {
    for (const value of [
      `https://www.youtube.com/watch?v=${YT}`,
      `https://vimeo.com/${VIMEO}`,
      `https://www.figma.com/design/${FIGMA}/Name`,
      "https://codepen.io/VoXelo/pen/VYKMNwE",
    ]) {
      const parsed = parseEmbedInput(value)
      expect(parsed, value).not.toBeNull()
      expect(
        isAllowedEmbedUrl(parsed!.provider, parsed!.embedUrl),
        parsed!.embedUrl
      ).toBe(true)
    }
  })

  it("weist eine fremde Adresse ab, auch mit passend klingendem Host", () => {
    for (const value of [
      "https://www.youtube.com.fremde.tld/embed/abc",
      "http://www.youtube.com/embed/abc",
      "https://example.org/embed/abc",
      "https://codepen.io/nur-ein-segment",
    ]) {
      expect(parseEmbedInput(value), value).toBeNull()
    }
  })
})
