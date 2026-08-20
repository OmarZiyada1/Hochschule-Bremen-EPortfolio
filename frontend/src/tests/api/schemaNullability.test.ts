import { describe, expect, it } from "vitest"

import type { ApiSchemas, ProjectDetailResponse } from "@/api/types"

/*
 * Was die generierte schema.d.ts ueber null aussagt (KAN-74).
 *
 * Dies ist ein Typtest: die Zusagen stehen in den Typannotationen, und ein
 * Verstoss faellt schon in `pnpm typecheck` auf, nicht erst zur Laufzeit.
 * Die expect-Zeilen darunter machen daraus zusaetzlich einen Testfall, damit
 * die Datei in der Suite auftaucht und niemand sie fuer toten Code haelt.
 *
 * Die Datei existiert, weil dieselbe Aussage schon einmal verloren gegangen
 * ist, ohne dass es jemand bemerkt haette. Bis KAN-74 lieferte springdoc das
 * Dokument als OpenAPI 3.1 aus; dort ist `nullable` kein Schluesselwort mehr,
 * und swagger-core verwarf jedes `@Schema(nullable = true)` ersatzlos. In
 * `schema.d.ts` stand daraufhin kein einziges `| null`, und die
 * Projektdetailseite lief fuer jede unbeteiligte Person in einen TypeError
 * (KAN-32), ohne dass der Typecheck etwas zu bemaengeln gehabt haette.
 *
 * Der Weg dahin fuehrt ueber drei Stellen, die einzeln kippen koennen.
 * Deshalb pruefen die drei Abschnitte unten getrennt.
 */
describe("generierte Typen: Nullbarkeit", () => {
  it("fuehrt gesperrte Listenfelder als nullbar", () => {
    /*
     * §3.3 und §3.12: wer die Redaktion oder den Verlauf nicht sehen darf,
     * bekommt ausdruecklich null und nicht die leere Liste. Das Feld fehlt
     * nie, Jackson steht auf Include.ALWAYS. Genau daran erkennt die
     * Detailseite den Kreis der Beteiligten, ohne aus der Rolle zu raten.
     */
    const statusHistory: ProjectDetailResponse["statusHistory"] = null
    const editors: ProjectDetailResponse["editors"] = null

    expect(statusHistory).toBeNull()
    expect(editors).toBeNull()
  })

  it("fuehrt die Bezuege des Projekts als nullbar", () => {
    /*
     * §3.3: Kategorie, Fakultaet, Studiengang und Semester sind erst beim
     * Einreichen Pflicht, das Modul bleibt dauerhaft freiwillig. Im DRAFT
     * sendet der Server hier null.
     *
     * Diese fuenf haengen an einer eigenen Bedingung: ihr Typ ist ein
     * anderes Schema, und in OpenAPI 3.0 darf neben einem $ref kein weiteres
     * Schluesselwort stehen. Ohne die Huelle allOf aus OpenApiConfig kommt
     * ihre Nullbarkeit hier nicht an, obwohl sie im Java-Code annotiert ist.
     */
    const semester: ProjectDetailResponse["semester"] = null
    const category: ProjectDetailResponse["category"] = null
    const faculty: ProjectDetailResponse["faculty"] = null
    const studyProgram: ProjectDetailResponse["studyProgram"] = null
    const module: ProjectDetailResponse["module"] = null

    expect([semester, category, faculty, studyProgram, module]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it("fuehrt weder Listeneintrag noch benanntes Schema als nullbar", () => {
    /*
     * Die Gegenrichtung, und sie ist nicht weniger wichtig: eine Liste als
     * Ganzes kann null sein, ein Eintrag darin nie, und ein benanntes Schema
     * ist ein Typ und traegt selbst gar keine Nullbarkeit. Beides hat
     * swagger-core zunaechst falsch gemeldet, weil es die Angabe vom Feld an
     * den Eintragstyp und an das gemeinsame Modell unter components
     * weiterreicht (behoben in OpenApiConfig).
     *
     * Die Folge waere nicht harmlos gewesen: PersonResponse haette ueberall
     * null sein koennen, auch als Autor:in eines Projekts, wo der Server
     * immer einen Wert sendet. Der Typecheck haette dann an jeder Namenszeile
     * eine Pruefung verlangt, die es fachlich nicht gibt, und die
     * Gewoehnung an solche Pruefungen ist genau das, was einen echten Fall
     * spaeter untergehen laesst.
     *
     * Geprueft wird durch Zugriff ohne Absicherung: waere der Wert nullbar,
     * meldete tsc hier TS18047.
     */
    const entryStatus = (
      entry: NonNullable<ProjectDetailResponse["statusHistory"]>[number]
    ) => entry.toStatus

    const personId = (person: ApiSchemas["PersonResponse"]) => person.id

    const tag = (value: NonNullable<ProjectDetailResponse["tags"]>[number]) =>
      value.length

    expect(entryStatus({ toStatus: "PUBLISHED" })).toBe("PUBLISHED")
    expect(personId({ id: "u-1" })).toBe("u-1")
    expect(tag("IoT")).toBe(3)
  })
})
