import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it } from "vitest"

import type { ProjectDetailResponse } from "@/api/types"
import { ProjectSidePanels } from "@/components/common/ProjectSidePanels"
import i18n from "@/i18n"
import { projectDetail } from "@/tests/fixtures"
import {
  currentUserHandler,
  projectCommentsHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/**
 * Das Akkordeon aus Projektinformationen und Kommentaren (KAN-83), mit der
 * Vorgabe aus KAN-104: offen stehen die Kommentare, bei PUBLISHED die
 * Angaben.
 *
 * <p>Geprueft wird ueber {@code aria-expanded} der beiden Ausloeser, wie
 * Base UI ihn setzt, und nicht ueber den Inhalt: ein zugeklappter Kasten
 * haelt seinen Inhalt je nach Primitive noch einen Augenblick im Baum.
 */

function infoTrigger(): HTMLElement {
  return screen.getByRole("button", {
    name: i18n.t("projectContent.sidebar.projectInfo"),
  })
}

function commentsTrigger(): HTMLElement | null {
  return screen.queryByRole("button", {
    name: new RegExp(`^${i18n.t("comment.panel.title")}`),
  })
}

/**
 * Die Huelle haelt das Projekt im Zustand, damit ein Test den Status
 * waehrend der Anzeige wechseln kann: genau das passiert, wenn die
 * Reviewansicht an Ort und Stelle veroeffentlicht.
 */
function setUp(
  initial: ProjectDetailResponse,
  context: "editor" | "review" = "review"
) {
  let setProject: (next: ProjectDetailResponse) => void = () => undefined

  function Harness() {
    const [project, set] = useState(initial)
    setProject = set
    return <ProjectSidePanels project={project} context={context} />
  }

  renderWithProviders(<Harness />)
  return {
    setProject: (next: ProjectDetailResponse) => {
      act(() => setProject(next))
    },
  }
}

describe("ProjectSidePanels", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("EDITOR")
    server.use(currentUserHandler({ role: "EDITOR" }), projectCommentsHandler())
  })

  it("oeffnet ohne Vorgabe die Kommentare und laesst die Angaben zu", async () => {
    setUp(projectDetail({ status: "SUBMITTED" }))

    expect(
      await screen.findByRole("region", { name: i18n.t("comment.panel.label") })
    ).toBeInTheDocument()
    expect(commentsTrigger()).toHaveAttribute("aria-expanded", "true")
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("oeffnet im Editor auch im Entwurf die Kommentare (KAN-104)", async () => {
    /* Bis KAN-104 oeffnete der Editor die Angaben und nur in REVISION die
       Kommentare. */
    setUp(projectDetail({ status: "DRAFT" }), "editor")

    await screen.findByRole("region", { name: i18n.t("comment.panel.label") })
    expect(commentsTrigger()).toHaveAttribute("aria-expanded", "true")
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("oeffnet bei PUBLISHED die Projektinformationen", () => {
    /* Dort gibt es keine Kommentarspalte; sonst stuende eine Karte ohne
       offenen Kasten da. */
    setUp(projectDetail({ status: "PUBLISHED" }))

    expect(commentsTrigger()).toBeNull()
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "true")
  })

  it("oeffnet die Angaben, wenn der Status waehrend der Anzeige auf PUBLISHED wechselt", async () => {
    const project = projectDetail({ status: "APPROVED" })
    const { setProject } = setUp(project)

    await screen.findByRole("region", { name: i18n.t("comment.panel.label") })
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")

    setProject({ ...project, status: "PUBLISHED" })

    expect(commentsTrigger()).toBeNull()
    expect(infoTrigger()).toHaveAttribute("aria-expanded", "true")
  })

  it("laesst die Angaben bei PUBLISHED zuklappen", async () => {
    const user = userEvent.setup()
    setUp(projectDetail({ status: "PUBLISHED" }))

    await user.click(infoTrigger())

    expect(infoTrigger()).toHaveAttribute("aria-expanded", "false")
  })
})
