import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import type {
  ProjectDetailResponse,
  ProjectUpdateRequest,
  Role,
  TagResponse,
  UserLookupResponse,
} from "@/api/types"
import { ApiError } from "@/api/errors"
import { ProjectMetadataForm } from "@/features/projects/ProjectMetadataForm"
import i18n from "@/i18n"
import { projectDetail } from "@/tests/fixtures"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/*
 * Der Exportvertrag aus KAN-35: die Komponente traegt keine Seitenhuelle und
 * setzt keine eigene Mutation ab. Beides wird hier geprueft, weil KAN-36
 * genau darauf baut, wenn es dieselben Felder als Dialog oeffnet.
 */

/** Die Kennung, die signInAs in die Sitzung legt. */
const SIGNED_IN_ID = "00000000-0000-0000-0000-000000000001"

const TAGS: TagResponse[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Nachhaltigkeit",
    usageCount: 12,
  },
]

function masterDataHandlers() {
  return [
    http.get("*/api/faculties", () => HttpResponse.json([])),
    http.get("*/api/categories", () => HttpResponse.json([])),
    http.get("*/api/semesters", () => HttpResponse.json([])),
    http.get("*/api/study-programs", () => HttpResponse.json([])),
    http.get("*/api/modules", () => HttpResponse.json([])),
    http.get("*/api/users/lookup", () => HttpResponse.json([])),
    http.get("*/api/tags", () => HttpResponse.json(TAGS)),
  ]
}

function renderForm(
  overrides: Partial<ProjectDetailResponse> = {},
  onSubmit: (
    request: ProjectUpdateRequest
  ) => Promise<ProjectDetailResponse> = (request) =>
    Promise.resolve(projectDetail({ ...overrides, version: request.version })),
  role: Role = "STUDENT"
) {
  server.use(...masterDataHandlers())
  signInAs(role)
  const project = projectDetail({
    id: "p-1",
    title: "Campus-Garten",
    status: "DRAFT",
    editors: [],
    /* Die angemeldete Person ist die Autor:in. Sonst greift die Schranke
       aus §5 Fussnote 3 („die Redaktion bestimmt die Autor:in"), und das
       Feld staende schreibgeschuetzt da. */
    author: {
      id: SIGNED_IN_ID,
      firstName: "Mira",
      lastName: "Beispiel",
      avatarUrl: null,
    },
    version: 3,
    ...overrides,
  })
  renderWithProviders(
    <ProjectMetadataForm
      project={project}
      onSubmit={onSubmit}
      onCancel={() => {}}
      onUploadCoverImage={() => Promise.resolve("/api/files/neu")}
    />
  )
  return project
}

describe("ProjectMetadataForm", () => {
  it("bringt weder Brotkrume noch Seitenueberschrift mit", async () => {
    renderForm()

    /* Die Huelle ist Sache der Route. Braechte die Komponente sie mit,
       stuende die Brotkrume spaeter im Editor-Dialog (KAN-36). */
    expect(await screen.findByLabelText("Projekttitel")).toBeVisible()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  /*
   * Wie in der Kopfpartie des Editors liegt die Bedienung des Titelbilds auf
   * der Flaeche und nicht als Verweiszeile darunter. Der Standard von
   * CoverImageField ist das Gegenteil ("below"), ein Rueckfall faellt ohne
   * diese Zusicherung also nirgends auf.
   */
  it("legt die Bedienung des Titelbilds als Icon-Leiste auf die Flaeche", async () => {
    renderForm()

    const chooser = await screen.findByLabelText("Titelbild wählen")
    const preview = document.querySelector('[data-slot="cover-image-preview"]')

    expect(preview).not.toBeNull()
    expect(preview).toContainElement(chooser)
    /* Nur Icons: der Name steht unsichtbar im Bedienelement. */
    expect(screen.getByText("Titelbild wählen")).toHaveClass("sr-only")
  })

  it("kommt ohne Abschnittsueberschriften aus, die Feldbeschriftungen tragen alles", async () => {
    renderForm()

    await screen.findByLabelText("Projekttitel")
    /*
     * Eine Ueberschrift ueber einer Gruppe beschrifteter Felder wiederholt
     * nur, was die Beschriftungen schon sagen (Rueckmeldung zu KAN-35).
     * Geblieben ist allein "Vorschau": sie benennt die linke Spalte, deren
     * Felder etwas anderes zeigen als sie heissen.
     */
    for (const name of [
      "Klassifikation",
      "Tags",
      "Redaktion",
      "Projektmitglieder",
    ]) {
      expect(
        screen.queryByRole("heading", { name }),
        name
      ).not.toBeInTheDocument()
    }
    expect(
      screen.getByRole("heading", { level: 2, name: "Vorschau" })
    ).toBeVisible()

    /* Die Felder selbst bleiben beschriftet. */
    expect(screen.getByLabelText(/^Fakultät/)).toBeVisible()
    expect(screen.getByLabelText("Schlagwörter")).toBeVisible()
    expect(screen.getByLabelText(/^Redakteur:in/)).toBeVisible()
    expect(screen.getByLabelText(/^Mitglied/)).toBeVisible()
  })

  it("setzt keine eigene Mutation ab, sondern reicht den Body an onSubmit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (request: ProjectUpdateRequest): Promise<ProjectDetailResponse> =>
        Promise.resolve(projectDetail({ version: request.version + 1 }))
    )
    renderForm({}, onSubmit)

    await user.click(
      await screen.findByRole("button", {
        name: "Speichern & weiter zum Editor",
      })
    )

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    /* version kommt aus dem Projekt, nie aus dem Formular (§6.4). */
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ version: 3 })
  })

  it("nutzt fuer die Tags die TagCombobox und sendet sie als Namen", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (request: ProjectUpdateRequest): Promise<ProjectDetailResponse> =>
        Promise.resolve(projectDetail({ version: request.version + 1 }))
    )
    renderForm({}, onSubmit)

    await user.click(await screen.findByLabelText("Schlagwörter"))
    await user.click(
      await screen.findByRole("option", { name: "Nachhaltigkeit" })
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Nachhaltigkeit entfernen" })
      ).toBeVisible()
    )

    await user.click(
      screen.getByRole("button", { name: "Speichern & weiter zum Editor" })
    )

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    /* Seit KAN-75 steht hinter jedem Tag eine Stammdatenzeile; die Anfrage
       traegt trotzdem Namen, das Aufloesen macht der Server (§3.19). */
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      tags: ["Nachhaltigkeit"],
    })
  })

  it("kennzeichnet die Pflichtfelder des Einreichens, ohne das Speichern zu sperren", async () => {
    renderForm()

    /* §3.3, seit Contract v59 einschliesslich editorIds. Text und Symbol,
       nicht Farbe allein (SC 1.4.1). */
    expect(
      await screen.findByText(
        "Mit * markierte Angaben brauchen Sie erst zum Einreichen, nicht zum Speichern."
      )
    ).toBeVisible()

    /*
     * Der Marker steht als Text im Label, nicht nur als Symbol, und er ist
     * erreichbar: ein sr-only-Text unter aria-hidden besteht getByText
     * anstandslos und wird trotzdem nie vorgelesen (Befund aus KAN-29).
     */
    const markers = screen.getAllByText("erforderlich zum Einreichen")
    expect(markers).toHaveLength(7)
    for (const marker of markers) {
      expect(marker.closest("[aria-hidden]")).toBeNull()
    }

    for (const label of [
      "Fakultät",
      "Studiengang",
      "Abschluss",
      "Semester",
      "Typ",
      "Kategorie",
      "Redakteur:in",
    ]) {
      expect(
        screen.getByLabelText(`${label}* erforderlich zum Einreichen`),
        label
      ).toBeVisible()
    }

    /* Das Fach traegt keinen Stern: §3.3 fuehrt es als dauerhaft
       freiwilligen Bezug. */
    expect(screen.getByLabelText("Fach")).toBeVisible()

    /* Gespeichert wird trotzdem. */
    expect(
      screen.getByRole("button", { name: "Speichern & weiter zum Editor" })
    ).toBeEnabled()
  })

  it("laesst auch eine Autor:in mit der Rolle EDITOR ihre Redaktion waehlen", async () => {
    /*
     * §5 Fussnote 3 in der Fassung von Contract v60 (KAN-77): die eigene
     * Systemrolle sperrt die Zuweisung am eigenen Entwurf nicht. Bis dahin
     * stand hier ein Hinweis statt eines Suchfelds, und weil editorIds seit
     * v59 zum Einreichen gehoert, waere ihr Projekt unzustellbar gewesen.
     */
    renderForm({}, undefined, "EDITOR")

    expect(await screen.findByLabelText(/^Redakteur:in/)).toBeEnabled()
    expect(
      screen.queryByText(
        /Die zuständige Redaktion wird von der Autor:in|Die Redaktion lässt sich nur während der Bearbeitung ändern/
      )
    ).toBeNull()
  })

  it("blendet die Projektseite aus der Vorschlagsliste der Redaktion aus", async () => {
    /*
     * §5 Fussnote 3 seit v61: zugewiesene Redaktion und Projektseite
     * schliessen einander aus. Der Server weist einen solchen Schreibvorgang
     * mit 400 ab; ein Vorschlag, der dort endet, gehoert nicht in die Liste.
     * Die Oberflaeche ersetzt die Pruefung nicht, sie nimmt ihr die
     * Ueberraschung.
     */
    const user = userEvent.setup()
    const candidates: UserLookupResponse[] = [
      /* Die Autor:in, hier zugleich die angemeldete Person. */
      { id: SIGNED_IN_ID, firstName: "Mira", lastName: "Beispiel" },
      { id: "m-1", firstName: "Jonas", lastName: "Kern" },
      { id: "e-1", firstName: "Rana", lastName: "Adler" },
    ]
    renderForm(
      {
        members: [
          {
            userId: "m-1",
            avatarUrl: null,
            firstName: "Jonas",
            lastName: "Kern",
            projectRole: "Frontend",
          },
        ],
      },
      undefined,
      "EDITOR"
    )
    /* Nach renderForm: dessen masterDataHandlers legen eine leere
       Auswahlliste an, und MSW nimmt den zuletzt registrierten Handler. */
    server.use(
      http.get("*/api/users/lookup", () => HttpResponse.json(candidates))
    )

    /* Getippt statt nur geklickt: die leere Suche steht schon im Cache, und
       erst ein neues q laesst die Abfrage erneut laufen. */
    await user.type(await screen.findByLabelText(/^Redakteur:in/), "e")

    expect(
      await screen.findByRole(
        "option",
        { name: "Rana Adler" },
        { timeout: 3000 }
      )
    ).toBeVisible()
    expect(screen.queryByRole("option", { name: "Mira Beispiel" })).toBeNull()
    expect(screen.queryByRole("option", { name: "Jonas Kern" })).toBeNull()
  })

  it("blendet auch eine fremde Autor:in aus, nicht nur die eigene Person", async () => {
    /*
     * Gegenprobe zum Test darueber: dort sind Autor:in und angemeldete Person
     * dieselbe, die Ausblendung koennte also allein an currentUserId haengen.
     * Hier ist die Autor:in eine andere und die angemeldete Person
     * Projektmitglied; damit bleibt authorId die einzige moegliche Ursache.
     *
     * Mitglied und nicht Admin: seit der Nacharbeit spiegelt das Formular die
     * Endpoint-Zeile aus §6.1 („Autor:in und Mitglieder") und steht fuer alle
     * anderen schreibgeschuetzt da, ein Admin-Konto eingeschlossen. Das
     * Redaktionsfeld haette dann gar kein Suchfeld mehr, und der Test pruefte
     * nichts.
     */
    const user = userEvent.setup()
    renderForm({
      author: {
        id: "a-fremd",
        firstName: "Lea",
        lastName: "Fremd",
        avatarUrl: null,
      },
      members: [
        {
          userId: SIGNED_IN_ID,
          firstName: "Mira",
          lastName: "Beispiel",
          avatarUrl: null,
          projectRole: "Frontend",
        },
      ],
    })
    server.use(
      http.get("*/api/users/lookup", () =>
        HttpResponse.json([
          { id: "a-fremd", firstName: "Lea", lastName: "Fremd" },
          { id: "e-1", firstName: "Rana", lastName: "Adler" },
        ] satisfies UserLookupResponse[])
      )
    )

    await user.type(await screen.findByLabelText(/^Redakteur:in/), "e")

    expect(
      await screen.findByRole(
        "option",
        { name: "Rana Adler" },
        { timeout: 3000 }
      )
    ).toBeVisible()
    expect(screen.queryByRole("option", { name: "Lea Fremd" })).toBeNull()
  })

  it("blendet die zugewiesene Redaktion aus der Mitgliedersuche aus", async () => {
    /*
     * Die Gegenrichtung derselben Trennung (§5 Fussnote 3): der Server weist
     * auch den Weg ab, auf dem ein Redaktionskonto neu zum Mitglied wird, und
     * antwortet mit 400 am Feld members. Hier waere der Preis besonders hoch,
     * weil der Fehler den gesamten PUT verwirft.
     */
    const user = userEvent.setup()
    renderForm({
      editors: [
        { id: "e-1", firstName: "Rana", lastName: "Adler", avatarUrl: null },
      ],
    })
    server.use(
      http.get("*/api/users/lookup", () =>
        HttpResponse.json([
          { id: "e-1", firstName: "Rana", lastName: "Adler" },
          { id: "s-1", firstName: "Jonas", lastName: "Kern" },
        ] satisfies UserLookupResponse[])
      )
    )

    await user.type(await screen.findByLabelText(/^Mitglied/), "e")

    expect(
      await screen.findByRole(
        "option",
        { name: "Jonas Kern" },
        { timeout: 3000 }
      )
    ).toBeVisible()
    expect(screen.queryByRole("option", { name: "Rana Adler" })).toBeNull()
  })

  it("fuehrt die Funktionsbezeichnung in der Liste als Text und nicht als Eingabefeld", async () => {
    /*
     * Dieselbe Angabe soll nicht in zwei Formen dastehen: die Projektseite
     * schreibt "Name · Rolle" (ProjectMetaSidebar), also schreibt das
     * Formular es genauso. Getippt wird die Bezeichnung allein oben in der
     * Eingabezeile, eine Korrektur laeuft ueber Entfernen und erneutes
     * Aufnehmen.
     */
    renderForm({
      members: [
        {
          userId: "m-1",
          avatarUrl: null,
          firstName: "Mem",
          lastName: "Eins",
          projectRole: "Frontend",
        },
        {
          userId: "m-2",
          avatarUrl: null,
          firstName: "Mem",
          lastName: "Zwei",
          projectRole: null,
        },
      ],
    })

    const withRole = (
      await screen.findByRole("button", {
        name: "Mem Eins aus den Projektmitgliedern entfernen",
      })
    ).closest("[role='listitem']")
    expect(withRole).not.toBeNull()
    expect(withRole).toHaveTextContent("Mem Eins · Frontend")
    expect(within(withRole as HTMLElement).queryByRole("textbox")).toBeNull()

    /* Ohne Bezeichnung steht der Name allein da, ohne Trennzeichen. */
    const withoutRole = screen
      .getByRole("button", {
        name: "Mem Zwei aus den Projektmitgliedern entfernen",
      })
      .closest("[role='listitem']")
    expect(withoutRole).toHaveTextContent("Mem Zwei")
    expect(withoutRole?.textContent).not.toContain("·")

    /* Genau ein Rollenfeld im ganzen Feld: das der Eingabezeile. */
    expect(screen.getAllByLabelText("Rolle")).toHaveLength(1)
  })

  it("nimmt mit der Eingabetaste im Rollenfeld auf, statt das Formular abzuschicken", async () => {
    /*
     * Ohne diesen Handler loeste die Eingabetaste die implizite Absendung
     * des umgebenden Formulars aus ("Speichern & weiter zum Editor"), und
     * die gewaehlte Person ginge als lokaler Zustand dabei verloren: das
     * Mitglied waere weg, ohne je gespeichert zu sein. Ein eigenes <form>
     * wie im NameCreateForm scheidet aus, Formulare lassen sich nicht
     * schachteln (Befund des frontend-reviewers).
     */
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (request: ProjectUpdateRequest): Promise<ProjectDetailResponse> =>
        Promise.resolve(projectDetail({ version: request.version + 1 }))
    )
    renderForm({}, onSubmit)
    server.use(
      http.get("*/api/users/lookup", () =>
        HttpResponse.json([
          { id: "s-1", firstName: "Jonas", lastName: "Kern" },
        ] satisfies UserLookupResponse[])
      )
    )

    await user.type(await screen.findByLabelText(/^Mitglied/), "j")
    await user.click(
      await screen.findByRole(
        "option",
        { name: "Jonas Kern" },
        { timeout: 3000 }
      )
    )

    const role = screen.getByLabelText("Rolle")
    /*
     * Die Servergrenze steht schon am Feld (MemberRequest, @Size(max = 255)).
     * Ein zu langer Wert liesse sich in der Liste nicht mehr berichtigen,
     * dort steht die Bezeichnung nur noch als Text.
     */
    expect(role).toHaveAttribute("maxlength", "255")

    await user.type(role, "Frontend{Enter}")

    expect(
      await screen.findByRole("button", {
        name: "Jonas Kern aus den Projektmitgliedern entfernen",
      })
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()

    /*
     * Der Knopf sperrt sich mit dem Aufnehmen selbst; ohne diesen Griff
     * fiele der Fokus auf body. Die Personensuche ist ohnehin der naechste
     * Schritt, und die Aufnahme steht als Ansage da (SC 4.1.3).
     */
    expect(screen.getByLabelText(/^Mitglied/)).toHaveFocus()
    expect(screen.getByText("Jonas Kern aufgenommen.")).toBeInTheDocument()
  })

  it("laesst ein Projektmitglied die Redaktion zuweisen (§3.13.1, seit Contract v85)", async () => {
    /*
     * Bis v84 stand das Feld fuer Mitglieder schreibgeschuetzt da, weil
     * §3.13.1 ihnen editorIds ausdruecklich wegnahm. Mit dem geoeffneten
     * Einreichen (KAN-86) waere daraus eine Sackgasse geworden: editorIds
     * ist Pflichtfeld des Einreichens (§3.3), das Mitglied bekaeme 400
     * PROJECT_INCOMPLETE und koennte die Redaktion nicht nachtragen.
     */
    renderForm({
      author: {
        id: "a-fremd",
        firstName: "Lea",
        lastName: "Fremd",
        avatarUrl: null,
      },
      /* Die angemeldete Person ist hier wirklich Mitglied und nicht nur
         irgendjemand Fremdes: nur so kommt sie überhaupt auf die Seite. */
      members: [
        {
          userId: SIGNED_IN_ID,
          avatarUrl: null,
          firstName: "Mira",
          lastName: "Beispiel",
          projectRole: "Frontend",
        },
      ],
    })

    /* Das Suchfeld steht da, und keine Begruendung daneben: gesperrt ist
       hier nichts mehr. */
    expect(await screen.findByLabelText(/^Redakteur:in/)).toBeVisible()
    expect(
      screen.queryByText(
        "Die Redaktion lässt sich nur während der Bearbeitung ändern, also im Entwurf und in der Überarbeitung. Ab der Einreichung nimmt die Administration die Zuweisung vor."
      )
    ).not.toBeInTheDocument()
  })

  it("zeigt den Fachfehler der Trennung am Feld und nicht am Formularfuss", async () => {
    /*
     * Die Servermeldung beginnt mit "editorIds: ", damit
     * applyValidationErrors sie genau diesem Feld zuordnet; im Formular
     * heisst es "editors", die Bruecke dafuer steht in der Komponente.
     * Ohne das Praefix laege die Meldung als anonymer Text am Formularende.
     */
    const user = userEvent.setup()
    const message =
      "editorIds: Zugewiesene Redaktion und Projektseite schliessen einander " +
      "aus, die angegebene Person gehoert bereits zur anderen Seite desselben " +
      "Projekts (§5, Fussnote 3)."
    renderForm({}, () =>
      Promise.reject(
        new ApiError({
          timestamp: "2026-08-20T12:00:00Z",
          status: 400,
          errorCode: "VALIDATION_FAILED",
          message,
          path: "/api/projects/p-1",
        })
      )
    )

    await user.click(
      await screen.findByRole("button", {
        name: "Speichern & weiter zum Editor",
      })
    )

    const shown = await screen.findByText(message.slice("editorIds: ".length))
    expect(shown).toBeVisible()
    /* Am Feld heisst: in derselben Gruppe wie die Redaktionsauswahl. */
    expect(shown.closest("div")?.parentElement?.textContent).toContain(
      "Redakteur:in"
    )
    /* Und programmatisch verbunden, nicht nur raeumlich daneben: sonst ist
       die Meldung beim Zuruecknavigieren zum Feld nicht mehr auffindbar
       (SC 3.3.1). */
    const search = screen.getByLabelText(/^Redakteur:in/)
    expect(search).toHaveAttribute("aria-invalid", "true")
    expect(search).toHaveAccessibleDescription(
      message.slice("editorIds: ".length)
    )
  })

  /*
   * Der Riegel, der bis zur Nacharbeit fehlte: §6.1 laesst an
   * {@code PUT /projects/{id}} allein „Autor:in und Mitglieder, in DRAFT und
   * REVISION" ({@code ProjectPermissionService.mayEditMetadata}). Eine
   * zugewiesene Redaktion darf ein Projekt in REVISION lesen (§5, Fussnote
   * 11) und bekam deshalb hier ein voll beschreibbares Formular, dessen
   * Speichern der Server mit 403 NO_PERMISSION beantwortete: „Dafuer fehlt
   * Ihnen die Berechtigung", und zwar erst nach dem Ausfuellen. Der Editor
   * traegt denselben Riegel seit KAN-86.
   */
  describe("nur die Projektseite schreibt", () => {
    it("sperrt das Formular fuer eine zugewiesene Redaktion und nennt den Grund", async () => {
      renderForm(
        {
          status: "REVISION",
          author: {
            id: "a-fremd",
            firstName: "Lea",
            lastName: "Fremd",
            avatarUrl: null,
          },
          members: [],
          editors: [
            {
              id: SIGNED_IN_ID,
              firstName: "Mira",
              lastName: "Beispiel",
              avatarUrl: null,
            },
          ],
        },
        undefined,
        "EDITOR"
      )

      expect(await screen.findByLabelText("Projekttitel")).toBeDisabled()
      expect(
        screen.getByText(i18n.t("project.metadata.readOnlyForeign"))
      ).toBeVisible()
      /* Der Status ist bearbeitbar; die andere Meldung waere also falsch. */
      expect(
        screen.queryByText(
          i18n.t("project.metadata.readOnly", {
            status: i18n.t("project.status.REVISION"),
          })
        )
      ).toBeNull()
    })

    it("sperrt es auch fuer ein Admin-Konto ausserhalb des Projekts", async () => {
      /* §6.1 nennt an der Zeile PUT /projects/{id} allein „Autor:in und
         Mitglieder", und die ADMIN-Zelle in §5 traegt fuer das Bearbeiten
         einen Klammerhaken, also nur eigene Ressourcen. Sein PUT endet
         deshalb ebenso mit 403. §7 fuehrt dazu keinen offenen Punkt: Punkt 2
         dort betrifft den Inhalt fremder Projekte, nicht die Metadaten. */
      renderForm(
        {
          author: {
            id: "a-fremd",
            firstName: "Lea",
            lastName: "Fremd",
            avatarUrl: null,
          },
          members: [],
        },
        undefined,
        "ADMIN"
      )

      expect(await screen.findByLabelText("Projekttitel")).toBeDisabled()
      expect(
        screen.getByText(i18n.t("project.metadata.readOnlyForeign"))
      ).toBeVisible()
    })

    it("laesst ein Projektmitglied schreiben, nicht nur die Autor:in", async () => {
      renderForm({
        author: {
          id: "a-fremd",
          firstName: "Lea",
          lastName: "Fremd",
          avatarUrl: null,
        },
        members: [
          {
            userId: SIGNED_IN_ID,
            firstName: "Mira",
            lastName: "Beispiel",
            avatarUrl: null,
            projectRole: "Frontend",
          },
        ],
      })

      expect(await screen.findByLabelText("Projekttitel")).toBeEnabled()
      expect(
        screen.queryByText(i18n.t("project.metadata.readOnlyForeign"))
      ).toBeNull()
    })
  })
})
