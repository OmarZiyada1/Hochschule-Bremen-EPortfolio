import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { BlockResponse } from "@/api/types"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { renderWithProviders } from "@/tests/render"

/*
 * Das Inhaltsverzeichnis im Lesepfad (Contract 2.5, seit v84, KAN-83): eine
 * gespeicherte Momentaufnahme, keine Ableitung. Geprueft wird deshalb, dass
 * der Renderer die Eintraege des Blocks zeigt und die Sprungmarken an den
 * Ueberschriften dazu passen.
 */

function blocksOf(...contents: unknown[]): BlockResponse[] {
  return contents.map((content, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    type: "TEXT",
    orderIndex: index,
    schemaVersion: 1,
    content: content as BlockResponse["content"],
  }))
}

function heading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  }
}

function toc(entries: { level: number; text: string; index: number }[]) {
  return { type: "tableOfContents", attrs: { entries } }
}

describe("Inhaltsverzeichnis im Lesepfad", () => {
  it("verweist auf die Ueberschriften, und die tragen die passende Kennung", async () => {
    renderWithProviders(
      <ProjectContent
        blocks={blocksOf(
          toc([
            { level: 1, text: "Einleitung", index: 0 },
            { level: 2, text: "Vorgehen", index: 1 },
          ]),
          heading(1, "Einleitung"),
          { type: "paragraph", content: [{ type: "text", text: "Text" }] },
          heading(2, "Vorgehen")
        )}
      />
    )

    const first = screen.getByRole("link", { name: "Einleitung" })
    const target = first.getAttribute("href")?.slice(1) ?? ""

    /*
     * Der Anker wird nicht gespeichert, sondern von Anzeige und Druck
     * einheitlich vergeben. Geprueft wird deshalb der Zusammenhang und nicht
     * eine feste Zeichenkette: das Ziel muss die Ueberschrift sein, auf die
     * der Eintrag zeigt.
     */
    expect(target).not.toBe("")
    expect(document.getElementById(target)?.textContent).toBe("Einleitung")

    const second = screen.getByRole("link", { name: "Vorgehen" })
    const secondTarget = second.getAttribute("href")?.slice(1) ?? ""
    expect(document.getElementById(secondTarget)?.textContent).toBe("Vorgehen")
  })

  it("steht am Bildschirm offen und laesst sich zuklappen", async () => {
    renderWithProviders(
      <ProjectContent
        blocks={blocksOf(
          toc([{ level: 1, text: "Einleitung", index: 0 }]),
          heading(1, "Einleitung")
        )}
      />
    )

    const details = document.querySelector('details[data-block="toc"]')
    expect(details).not.toBeNull()
    expect((details as HTMLDetailsElement).open).toBe(true)

    await userEvent.click(screen.getByText("Inhaltsverzeichnis"))
    expect((details as HTMLDetailsElement).open).toBe(false)
  })

  it("steht im Druck von vornherein offen", () => {
    /* Ein Blatt kann nichts aufklappen; deshalb die Eigenschaft und keine
       CSS-Regel (ein zugeklapptes details verbirgt seinen Inhalt ueber den
       eigenen Mechanismus des Browsers). */
    renderWithProviders(
      <ProjectContent
        forPrint
        blocks={blocksOf(
          toc([{ level: 1, text: "Einleitung", index: 0 }]),
          heading(1, "Einleitung")
        )}
      />
    )

    const details = document.querySelector('details[data-block="toc"]')
    expect((details as HTMLDetailsElement).open).toBe(true)
  })

  it("sagt es, wenn der Beitrag noch keine Ueberschriften hat", () => {
    renderWithProviders(<ProjectContent blocks={blocksOf(toc([]))} />)

    expect(
      screen.getByText("Dieser Beitrag hat noch keine Überschriften.")
    ).toBeInTheDocument()
  })

  /*
   * Gemeldet zu KAN-83: eine Ueberschrift ohne Leerzeichen (eine lange Kette
   * von Buchstaben, wie sie beim Tippen entsteht) schob sich aus dem Kasten
   * des Verzeichnisses heraus. Ursache war der nackte Textknoten im
   * Flex-Kasten: er wird zu einem anonymen Kind mit min-width auto und kann
   * deshalb nicht schrumpfen. Geprueft wird die Huelle samt Umbruchregel,
   * denn die Breite selbst misst jsdom nicht.
   */
  it("laesst eine Ueberschrift ohne Leerzeichen umbrechen", () => {
    const chain = "a".repeat(120)
    renderWithProviders(
      <ProjectContent
        blocks={blocksOf(
          toc([{ level: 1, text: chain, index: 0 }]),
          heading(1, chain)
        )}
      />
    )

    const entry = screen
      .getAllByText(chain)
      .find((element) => element.tagName === "SPAN")
    expect(entry).toBeDefined()
    expect(entry).toHaveClass("wrap-anywhere")
    expect(entry).toHaveClass("min-w-0")
  })
})
