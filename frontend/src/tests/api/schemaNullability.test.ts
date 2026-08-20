import { describe, expect, it } from "vitest"

import type { ProjectDetailResponse } from "@/api/types"
import { person, projectDetail, statusHistoryEntry } from "@/tests/fixtures"

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

    const personId = (author: ProjectDetailResponse["author"]) => author.id

    /* Ohne NonNullable: tags ist seit KAN-76 Pflicht und nicht nullbar, die
       Huelle waere hier wirkungslos. Bei statusHistory oben bleibt sie
       noetig, weil das Feld weiterhin null sein darf. */
    const tag = (value: ProjectDetailResponse["tags"][number]) => value.length

    expect(entryStatus(statusHistoryEntry({ toStatus: "PUBLISHED" }))).toBe(
      "PUBLISHED"
    )
    expect(personId(person({ id: "u-1" }))).toBe("u-1")
    expect(tag("IoT")).toBe(3)
  })
})

/*
 * Was die generierte schema.d.ts ueber Anwesenheit aussagt (KAN-76).
 *
 * Die Gegenprobe zum Block darueber: dort geht es um den Wert null, hier um
 * den fehlenden Schluessel. Beide Aussagen sind unabhaengig, und beide sind
 * schon einmal verloren gegangen.
 */
describe("generierte Typen: Pflichtfelder", () => {
  it("fuehrt die immer gelieferten Felder ohne Fragezeichen", () => {
    /*
     * Zugriff ohne Absicherung. Waeren die Felder optional, meldete tsc
     * hier TS18048; genau so stand es bis KAN-76 im Code, und die Seiten
     * glichen es mit Pruefungen wie `title ?? ""` aus.
     */
    const detail = projectDetail()

    const laenge = (project: ProjectDetailResponse) =>
      project.title.length + project.tags.length + project.author.id.length

    expect(laenge(detail)).toBeGreaterThan(0)
    expect(detail.version).toBe(1)
  })

  it("laesst nullbare Felder trotzdem als Schluessel stehen", () => {
    /*
     * Jackson steht auf Include.ALWAYS: ein nullbares Feld fehlt nie, es
     * traegt dann den Wert null. Der Typ sagt deshalb `T | null` und nicht
     * `T | null | undefined`, und eine Pruefung auf undefined waere hier
     * die ueberfluessige Sorte.
     */
    const detail = projectDetail()

    expect(detail).toHaveProperty("statusHistory")
    expect(detail.statusHistory).toBeNull()
    expect(detail.summary).toBeNull()
  })
})
