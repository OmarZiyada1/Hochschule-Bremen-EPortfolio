import { useEditorState, type Editor } from "@tiptap/react"
import {
  ArrowLeftIcon,
  InfoIcon,
  ListTreeIcon,
  MenuIcon,
  PrinterIcon,
  Redo2Icon,
  SendIcon,
  Undo2Icon,
} from "lucide-react"
import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectStatus } from "@/api/types"
import {
  PreviewModeButton,
  PreviewModeLabel,
} from "@/components/common/PreviewModeButton"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import {
  applyTableOfContents,
  findTableOfContents,
} from "@/features/project-content/tableOfContents"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AutosaveStatus } from "@/features/project-content/components/AutosaveStatus"
import { SelectionToolbarBar } from "@/features/project-content/components/SelectionToolbar"
import type { AutosaveState } from "@/features/project-content/hooks/useAutosave"

/**
 * Die beiden Ansichten des Editors (KAN-104): die Schreibflaeche und die
 * Vorschau an derselben Stelle.
 */
export type EditorMode = "edit" | "preview"

/**
 * Die Kopfzeile des Editors: Zurueck ganz links, dann Rueckgaengig und
 * Wiederholen, ein Trenner, die Formatierungsleiste, rechts Speicherzustand,
 * der Umschalter Vorschau/Bearbeiten und die Workflow-Aktion.
 *
 * <p><strong>Die Formatierungsleiste steht dauerhaft hier</strong> statt als
 * Blase ueber markiertem Text: die Werkzeuge sind immer sichtbar, die
 * Funktionen und ihre aktiven Zustaende kommen unveraendert aus
 * {@code SelectionToolbarBar} und folgen Textmarke und Auswahl. Ohne
 * Schreibrecht (§4.1, dazu zaehlt der read-only Blick auf eingereichte und
 * veroeffentlichte Beitraege) ist sie deaktiviert und nicht versteckt
 * (SC 3.2.4). Alt+F10 fuehrt weiter aus dem Text in die Leiste, Escape
 * zurueck; den Sprung faengt die Seite ab und trifft die Leiste ueber
 * {@code data-selection-toolbar}, egal wo sie steht.
 *
 * <p><strong>Der Umschalter in die Vorschau stand in der
 * Seitenleiste</strong> und steht hier, zwischen Formatierung und
 * Workflow-Aktion: er gehoert zur Bedienung des Editors, nicht zu den
 * Projektinformationen. Seit KAN-104 fuehrt er nicht mehr auf die
 * oeffentliche Detailseite, sondern wechselt an Ort und Stelle: die Seite
 * bleibt auf ihrer Adresse und ihrer Scrollposition, und der Beitrag
 * erscheint durch den Read-Only-Renderer an der Stelle der Schreibflaeche
 * ({@code EditorPage}). Welcher Modus gilt, haelt die Seite; diese
 * Komponente zeigt ihn und meldet den Wechsel.
 *
 * <p><strong>Im Vorschau-Modus traegt die Werkzeugzeile nur, was nicht
 * schreibt</strong> (KAN-104, Entscheidung). Rueckgaengig, Wiederholen,
 * Formatierung und Inhaltsverzeichnis entfallen samt ihren Trennern, denn
 * es gibt nichts, worauf sie wirken koennten; ein Trenner ohne linken
 * Nachbarn bliebe als Strich vor dem Ausdruck stehen. Anders als ohne
 * Schreibrecht (gesperrt und nicht versteckt, siehe oben) ist das keine
 * Frage des Rechts, sondern die gewaehlte Ansicht, und derselbe Knopf nimmt
 * sie zurueck. Drucken und Hell/Dunkel bleiben an ihrem Platz, ebenso
 * Zurueck, Speicherzustand und Workflow-Aktion.
 *
 * <p><strong>Der Speicherzustand bleibt in der Kopfzeile.</strong> Die
 * gewuenschte Reihenfolge nennt ihn nicht, aber er muss sichtbar bleiben
 * (ein stiller Fehlschlag des Autosave waere Datenverlust mit Ansage);
 * sein Platz ist vor dem Umschalter im rechten Block.
 *
 * <p><strong>Die PDF-Schaltflaeche steht bei den Werkzeugen</strong>
 * (KAN-41, Nutzerentscheidung). Das Template zeichnet sie rechts neben
 * „Einreichen"; sie steht stattdessen am Ende der Werkzeugzeile, hinter der
 * Formatierung und durch einen Trenner davon abgesetzt. Der Grund ist die
 * Nachbarschaft: Rueckgaengig, Wiederholen und Formatierung wirken auf den
 * Beitrag, „Einreichen" und „Zurueckziehen" auf seinen Status (§4.1). Der
 * Ausdruck gehoert zur ersten Gruppe, und er steht damit auch schmal in der
 * sichtbaren Zeile statt im Menue: er ist keine Workflow-Aktion, die nur
 * die Autor:in sieht, sondern fuer jede Person da, die den Beitrag lesen
 * darf. Genau deshalb ist er nicht an {@code mayWrite} gebunden.
 *
 * <p>Gedruckt wird nicht die Schreibflaeche, sondern der Bereich aus
 * {@code print/ProjectPrintView}: dort steht der Beitrag durch den
 * Read-Only-Renderer, also mit Bild und Galerie statt der Bedienkarten, die
 * die Schreibflaeche fuer Video, Ton, Dokument und Einbettung zeigt.
 *
 * <p><strong>Einreichen und Zurueckziehen teilen sich den Platz.</strong>
 * Welche der beiden erscheint, entscheidet der Status (§4.1): aus
 * {@code DRAFT} und {@code REVISION} wird eingereicht, aus
 * {@code SUBMITTED} zurueckgezogen. In {@code APPROVED} und
 * {@code PUBLISHED} steht dort nichts, beide Uebergaenge liegen dann bei der
 * Redaktion.
 *
 * <p><strong>Und nur die Projektseite sieht sie ueberhaupt.</strong> §5
 * fuehrt beide Aktionen als eigene Ressource, §4.1 nennt in der Spalte
 * „Ausfuehrende Rolle" seit Contract v85 die Projektseite, also Autor:in und
 * Projektmitglieder (Fussnote 14, KAN-86). Bis v84 stand dort allein die
 * Autor:in, und ein Mitglied sah im eigenen Editor keinen Weg nach vorn.
 * Einer Person ausserhalb des Projekts eine Schaltflaeche zu zeigen, die mit
 * 403 endet, waere dagegen weiterhin ein Weg ins Leere.
 *
 * <p><strong>Einreichen fuehrt zuerst in die Metadaten.</strong> §3.3
 * verlangt sieben Angaben, die im Editor gar nicht sichtbar sind; blind zu
 * senden hiesse, die Autor:in mit einer Liste fehlender Felder
 * zurueckzuschicken, statt sie dorthin zu fuehren, wo sie sie eintraegt.
 * Diese Komponente meldet nur die Absicht; den Weg fuehrt {@code EditorPage}.
 *
 * <p><strong>Die Kopfzeile bleibt beim Scrollen oben stehen.</strong> Sie
 * traegt seit dem Umzug der Formatierungsleiste die Werkzeuge, mit denen
 * waehrend des Schreibens gearbeitet wird; scrollte sie weg, muesste fuer
 * jedes Fettstellen erst zurueckgescrollt werden. Der Rahmen der Route
 * ({@code EditorLayout}) setzt bewusst keinen eigenen Scrollbereich, deshalb
 * klebt sie am Ansichtsfenster.
 *
 * <p>{@code z-30} ist mit Bedacht gewaehlt: ueber der Schreibflaeche und
 * ueber der Ablegelinie des Ziehens ({@code z-20}), aber unter den
 * Ueberlagerungen aus {@code components/ui} ({@code z-50}), damit ein Menue
 * dieser Leiste nicht hinter ihr verschwindet.
 *
 * <p><strong>Schmal wird aus der einen Zeile eine zweite.</strong> Oben
 * bleiben Zurueck, der Speicherzustand und ein Menue mit den uebrigen
 * Aktionen; darunter steht die Formatierung mit Rueckgaengig und
 * Wiederholen und rollt bei Bedarf waagerecht. Beide Zeilen kleben
 * gemeinsam, weil sie ein Element sind.
 *
 * <p><strong>Die Werkzeuge stehen genau einmal im DOM.</strong> Welche
 * Zeile sie tragen, entscheidet ein Raster ({@code .editor-header} in
 * project-content.css) und keine zweite Fassung: ein Duplikat haette zwei
 * gleich benannte Werkzeugleisten ergeben, und der Sprung mit Alt+F10
 * traefe womoeglich die unsichtbare. Nur die Aktionen rechts gibt es
 * zweimal, denn ein Menueeintrag ist kein versteckter Schalter; die
 * jeweils andere Fassung ist mit {@code display: none} auch fuer
 * Screenreader fort.
 */
export function EditorHeader({
  editor,
  status,
  autosaveState,
  busy,
  mayRunWorkflow,
  mayWrite,
  onSubmit,
  onWithdraw,
  onBack,
  mode,
  onModeToggle,
  onPrint,
  printing,
  onShowInfo,
  onAnnounce,
  backButtonRef,
  menuButtonRef,
}: {
  editor: Editor | null
  status: ProjectStatus
  autosaveState: AutosaveState
  busy: boolean
  /**
   * Ob die anfragende Person zur Projektseite gehoert, also Autor:in oder
   * Projektmitglied ist (§5, §4.1; seit Contract v85 nicht mehr allein die
   * Autor:in).
   */
  mayRunWorkflow: boolean
  /** Ob die Schreibflaeche beschreibbar ist; sonst ist die Leiste gesperrt. */
  mayWrite: boolean
  onSubmit: () => void
  onWithdraw: () => void
  /**
   * Der Weg zurueck. Als Handler und nicht als Link, weil die Seite vorher
   * den Speichertakt leeren muss.
   */
  onBack: () => void
  /** Die Ansicht der Seite: Schreibflaeche oder Vorschau (KAN-104). */
  mode: EditorMode
  /**
   * Wechselt zwischen Schreibflaeche und Vorschau (KAN-104). Ohne Speichern
   * vorher: die Vorschau nimmt ihren Stand aus dem Dokument, und der
   * Speichertakt laeuft unveraendert weiter.
   */
  onModeToggle: () => void
  /** Druckt den Beitrag (KAN-41); die Seite besorgt den Druckbereich. */
  onPrint: () => void
  /** Solange der Ausdruck vorbereitet wird, ist die Schaltflaeche gesperrt. */
  printing: boolean
  /**
   * Sagt eine rein visuelle Aenderung ueber die Live-Region der Seite an
   * (SC 4.1.3), hier das Einfuegen oder Nachziehen des Inhaltsverzeichnisses.
   *
   * <p>Als Eigenschaft und nicht ueber {@code useEditorContext}, obwohl die
   * Kopfzeile innerhalb des Providers liegt: dieselbe Bauform fuehrt
   * {@code BlockControls}, und die Komponente bleibt damit ohne Kontext
   * pruefbar.
   */
  onAnnounce?: (message: string) => void
  /**
   * Oeffnet die Projektinformationen als Schublade.
   *
   * <p>Nur auf schmalen Ansichten gebraucht: dort steht die Seitenleiste
   * nicht neben der Schreibflaeche, weil sie ihr die Breite naehme.
   */
  onShowInfo: () => void
  /**
   * Der Weg aus der Seite, als Rueckgabeziel des Konfliktdialogs: er ist
   * das einzige Bedienelement der Kopfzeile, das in jeder Breite sichtbar
   * ist.
   */
  backButtonRef?: RefObject<HTMLButtonElement | null>
  /**
   * Der Ausloeser des Menues, als Rueckgabeziel fuer die Schublade der
   * Projektinformationen: sie hat keinen eigenen Trigger mehr, sobald das
   * Menue geschlossen ist, und ohne Ziel fiele der Fokus beim Schliessen
   * auf den Seitenanfang (SC 2.4.3).
   */
  menuButtonRef?: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation()

  /*
   * Ueber useEditorState und nicht durch blosses Lesen beim Rendern.
   *
   * <p><strong>Seit Tiptap v3 rendert der Editor die Seite bei einer
   * Transaktion nicht mehr neu</strong> ({@code shouldRerenderOnTransaction}
   * ist standardmaessig {@code false}). Ein {@code editor.can().undo()} im
   * Rendern lieferte deshalb den Stand des letzten Renderns: die
   * Schaltflaeche blieb waehrend des ganzen Tippens deaktiviert und wurde
   * erst wieder richtig, wenn irgendetwas anderes ein Rendern ausloeste,
   * in der Praxis der Speichertakt gut eine Sekunde spaeter. Genau das war
   * das „es dauert, bis es richtig angezeigt wird".
   *
   * <p>{@code can()} greift ausserdem auf die View zu. Nach dem Abraeumen
   * des Editors gibt es das Objekt noch, seine View aber nicht mehr, daher
   * die Pruefung auf {@code isDestroyed}.
   */
  const history = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current === null || current.isDestroyed
        ? { canUndo: false, canRedo: false, hasToc: false }
        : {
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
            /* Aus demselben Grund hier und nicht beim Rendern: sonst sagte
               der Knopf nach dem Einfuegen weiter „Inhaltsverzeichnis
               einfuegen", bis irgendetwas anderes ein Rendern ausloest
               (Befund des frontend-reviewers). */
            hasToc: findTableOfContents(current.state.doc) !== null,
          },
  })
  const canUndo = history?.canUndo ?? false
  const canRedo = history?.canRedo ?? false

  /*
   * Ein Knopf, zwei Beschriftungen: gibt es noch kein Verzeichnis, fuegt er
   * eines ein, sonst zieht er es nach. Welche gilt, entscheidet das
   * Dokument.
   */
  const tocLabel =
    history?.hasToc === true
      ? t("projectContent.toc.refresh")
      : t("projectContent.toc.insert")

  const canSubmit = status === "DRAFT" || status === "REVISION"
  const canWithdraw = status === "SUBMITTED"
  /* Die Schreibwerkzeuge stehen nur auf der Schreibflaeche (Javadoc oben). */
  const editing = mode === "edit"

  return (
    <header className="editor-header sticky top-0 z-30 items-center gap-x-3 gap-y-2 border-b border-border bg-card">
      <div
        data-header-area="back"
        className="flex items-center px-4 py-3 sm:px-8 lg:pe-0"
      >
        <Button ref={backButtonRef} variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon aria-hidden="true" />
          {t("projectContent.header.back")}
        </Button>
      </div>

      {/*
       * Rueckgaengig, Wiederholen und die Formatierung stehen zusammen: auf
       * breiten Ansichten in der einen Zeile, auf schmalen in der zweiten
       * darunter. Es ist dieselbe Leiste und nicht eine zweite Fassung; ein
       * Duplikat im DOM haette zwei gleich benannte Werkzeugleisten ergeben,
       * und der Sprung mit Alt+F10 traefe womoeglich die unsichtbare.
       *
       * <p>Schmal wird waagerecht gescrollt statt umgebrochen
       * (Nutzerentscheidung): eine Leiste, die auf drei Zeilen waechst,
       * schiebt die Schreibflaeche aus dem Bild. Die Knoepfe bleiben dabei
       * erreichbar, weil der Fokus den Bereich beim Tabben mitrollt.
       *
       * <p><strong>{@code shrink-0} an jedem Eintrag ist die Bedingung
       * dafuer, dass ueberhaupt gerollt wird.</strong> Die Schaltflaechen
       * der Leiste tragen {@code min-w-0}; ohne den Riegel staucht ein
       * Flex-Container sie, statt ueberzulaufen, und bei 390 px blieben von
       * 32 Pixeln knapp 18 uebrig: keine Rolle, dafuer Tippziele unter der
       * Mindestgroesse von 24 mal 24 (SC 2.5.8, Befund des
       * Frontend-Reviews). Dasselbe Muster steht in
       * {@code BlockInsertBar}, die ebenso rollt.
       */}
      {/*
       * relative ist hier keine Kosmetik, sondern die Bedingung dafuer, dass
       * overflow-x-auto ueberhaupt greift (Befund des 320-Pixel-Laufs zu
       * KAN-42). Jede Schaltflaeche der Leiste traegt ihren zugaenglichen
       * Namen als sr-only-Span, und sr-only ist position:absolute. Ein
       * absolut positioniertes Element wird nicht von einem Rollbereich
       * beschnitten, dessen Kasten nicht sein Bezugsrahmen ist: die Spannen
       * hingen deshalb an einem Vorfahren weiter oben, standen bei 756px und
       * schoben die ganze Seite auf 757px Breite, obwohl die Leiste selbst
       * sauber rollte. Sichtbar war nur, dass sich die Seite quer schieben
       * liess (SC 1.4.10), und keines der sichtbaren Elemente stand dort
       * draussen. Mit relative wird dieser Kasten der Bezugsrahmen, und die
       * Spannen rollen mit, statt zu entkommen.
       */}
      <div
        data-header-area="tools"
        className="relative flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 *:shrink-0 sm:px-8 lg:gap-3 lg:overflow-x-visible lg:border-t-0 lg:px-0 lg:py-3"
      >
        {/* Die beiden dichter beieinander als die Gruppen untereinander,
            wie vor dem Umbruch in zwei Zeilen. Im Vorschau-Modus entfallen
            sie, wie Formatierung und Inhaltsverzeichnis dahinter (KAN-104,
            Javadoc oben). */}
        {editing && (
          <div className="flex items-center gap-1 *:shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!canUndo}
                    onClick={() => editor?.chain().focus().undo().run()}
                  />
                }
              >
                <Undo2Icon aria-hidden="true" />
                <span className="sr-only">
                  {t("projectContent.header.undo")}
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("projectContent.header.undo")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!canRedo}
                    onClick={() => editor?.chain().focus().redo().run()}
                  />
                }
              >
                <Redo2Icon aria-hidden="true" />
                <span className="sr-only">
                  {t("projectContent.header.redo")}
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("projectContent.header.redo")}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Dieselbe Leiste wie zuvor in der Blase, nur ohne Rahmen und
            Flaeche: Rand und Schatten gehoeren zur schwebenden Fassung, in
            der Kopfzeile traegt der Header beides. Der Trenner steht bei der
            Leiste und entfaellt mit ihr. */}
        {editing && editor !== null && (
          <>
            <Separator
              orientation="vertical"
              className="h-5 self-center"
              aria-hidden="true"
            />
            <SelectionToolbarBar
              editor={editor}
              disabled={!mayWrite}
              className="flex-nowrap rounded-none border-0 bg-transparent p-0 shadow-none *:shrink-0 lg:flex-wrap"
            />
          </>
        )}

        {/*
         * Das Inhaltsverzeichnis, hinter der Formatierung und durch einen
         * Trenner davon abgesetzt (KAN-83). Es steht wie der Ausdruck
         * ausserhalb der Formatierungsleiste: die ist ein Tabstopp mit
         * Roving-Tabindex ueber ihre Werkzeuge, und ein Eintrag, der nichts
         * formatiert, gehoerte dort nicht hinein.
         *
         * Ein Knopf und zwei Bedeutungen: gibt es noch keinen Block, fuegt
         * er einen ein, sonst zieht er ihn nach. Das ist keine versteckte
         * zweite Funktion, sondern dieselbe Absicht („ich will ein
         * aktuelles Verzeichnis"); die Beschriftung sagt jeweils, was
         * geschieht. Eingefuegt wird am Anfang des Beitrags, dort steht ein
         * Inhaltsverzeichnis.
         */}
        {editing && mayWrite && (
          <>
            <Separator
              orientation="vertical"
              className="h-5 self-center"
              aria-hidden="true"
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={editor === null}
                    onClick={() => {
                      if (editor === null) {
                        return
                      }
                      /* Die Aenderung ist rein visuell, deshalb sagt die
                         Live-Region sie an, wie an der Schaltflaeche im
                         Block selbst (SC 4.1.3). */
                      onAnnounce?.(
                        applyTableOfContents(editor)
                          ? t("projectContent.toc.inserted")
                          : t("projectContent.toc.refreshed")
                      )
                    }}
                  />
                }
              >
                <ListTreeIcon aria-hidden="true" />
                <span className="sr-only">{tocLabel}</span>
              </TooltipTrigger>
              <TooltipContent>{tocLabel}</TooltipContent>
            </Tooltip>
          </>
        )}

        {/*
         * Der Ausdruck, hinter der Formatierung und durch einen Trenner
         * davon abgesetzt (KAN-41). Er steht ausserhalb der
         * Formatierungsleiste und nicht darin: die Leiste ist ein
         * Tabstopp mit Roving-Tabindex ueber ihre Werkzeuge, und ein
         * Eintrag, der nichts formatiert, gehoerte dort nicht hinein.
         * Dieselbe Bauform wie Rueckgaengig und Wiederholen daneben,
         * Symbol mit Tooltip und Text fuer Hilfsmittel: auf Touch
         * erscheint kein Tooltip, der Name muss also im Element stehen.
         *
         * <p>Waehrend der Vorbereitung meldet sie {@code aria-disabled} und
         * nicht {@code disabled}, wie die Ausrichtung im {@code AlignMenu}:
         * eine Schaltflaeche, die im Augenblick des Klicks {@code disabled}
         * wird, verliert den Fokus an den Seitenanfang (SC 2.4.3). Das
         * zweite Ausloesen faengt der Handler ab.
         *
         * <p>Der Trenner davor steht nur, wo links etwas steht: im
         * Vorschau-Modus ist der Ausdruck der erste Eintrag der Zeile
         * (KAN-104).
         */}
        {editing && (
          <Separator
            orientation="vertical"
            className="h-5 self-center"
            aria-hidden="true"
          />
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-disabled={printing}
                className={printing ? "opacity-50" : undefined}
                onClick={(event) => {
                  if (printing) {
                    event.preventDefault()
                    return
                  }
                  onPrint()
                }}
              />
            }
          >
            <PrinterIcon aria-hidden="true" />
            <span className="sr-only">
              {t("projectContent.print.actionLabel")}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t("projectContent.print.actionLabel")}
          </TooltipContent>
        </Tooltip>

        {/*
         * Hell und Dunkel (KAN-86). Der Editor liegt ausserhalb des
         * Anwendungsrahmens, NavBar und Fusszeile entfallen dort
         * (routes/EditorLayout); der Umschalter der NavBar ist auf dieser
         * einen Route also nicht erreichbar, und wer lange schreibt, will
         * genau hier wechseln koennen.
         *
         * <p>In der Werkzeugzeile und nicht bei den Aktionen rechts: die
         * Werkzeuge stehen genau einmal im DOM, die Aktionen dagegen doppelt
         * (breit sichtbar, schmal im Menue). Ein Umschalter dort muesste
         * zweimal stehen oder waere schmal nicht erreichbar.
         *
         * <p>Ohne Tooltip, anders als die Nachbarn: die vorhandene
         * Domaenenkomponente traegt ihren Namen als aria-label und wechselt
         * ihn mit dem Modus. Ein TooltipTrigger darum herum reichte seine
         * Props nicht durch und naehme dem Knopf genau diesen Namen.
         *
         * <p>Haengt bewusst weder an mayWrite noch an mayRunWorkflow: die
         * Darstellung ist keine Frage des Schreibrechts, wie beim Drucken
         * daneben.
         */}
        <ThemeToggle size="icon-sm" />
      </div>

      <div
        data-header-area="actions"
        className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-8 lg:ms-auto lg:ps-0"
      >
        <AutosaveStatus state={autosaveState} />

        {/* Breit: jede Aktion sichtbar. */}
        <div className="hidden items-center gap-3 lg:flex">
          {/*
           * Ein Knopf mit wechselnder Beschriftung und kein Schiebeschalter
           * (KAN-104, Entscheidung): auf der Schreibflaeche „Vorschau", in
           * der Vorschau „Bearbeiten", an derselben Stelle. Er nennt, wohin
           * der Druck fuehrt; ein Schalter nennt zwei Richtungen und lud
           * dazu ein, „Bearbeiten" anzuklicken, obwohl man laengst darin
           * war. Er steht in jedem Status, bei SUBMITTED also neben
           * „Zurueckziehen".
           *
           * <p>Derselbe Knoten in beiden Modi, der Fokus bleibt nach dem
           * Druck auf ihm (SC 2.4.3). Beschriftung und Symbol kommen aus
           * derselben Komponente wie in der Reviewansicht.
           */}
          <PreviewModeButton
            previewing={!editing}
            counterpart="edit"
            onToggle={onModeToggle}
            variant="link"
            size="sm"
          />
          {mayRunWorkflow && canSubmit && (
            <Button onClick={onSubmit} disabled={busy}>
              {t("projectContent.header.submit")}
            </Button>
          )}
          {mayRunWorkflow && canWithdraw && (
            <Button variant="secondary" onClick={onWithdraw} disabled={busy}>
              {t("projectContent.header.withdraw")}
            </Button>
          )}
        </div>

        {/*
         * Schmal: dieselben Aktionen in einem Menue. Zurueck und der
         * Speicherzustand bleiben ausserhalb (Nutzerentscheidung): der eine
         * ist der Weg aus der Seite, der andere eine Anzeige, die niemand
         * erst aufklappen soll, um zu sehen, ob sein Text gesichert ist.
         */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                ref={menuButtonRef}
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
              />
            }
          >
            <MenuIcon aria-hidden="true" />
            <span className="sr-only">{t("projectContent.header.menu")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Dieselbe Beschriftung wie der breite Knopf (KAN-104). Das
                Menue gibt den Fokus beim Schliessen an seinen Ausloeser
                zurueck, und der steht in beiden Modi (SC 2.4.3). */}
            <DropdownMenuItem onClick={onModeToggle}>
              <PreviewModeLabel previewing={!editing} counterpart="edit" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowInfo}>
              <InfoIcon aria-hidden="true" />
              {t("projectContent.sidebar.projectInfo")}
            </DropdownMenuItem>
            {mayRunWorkflow && (canSubmit || canWithdraw) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={busy}
                  onClick={canSubmit ? onSubmit : onWithdraw}
                >
                  <SendIcon aria-hidden="true" />
                  {canSubmit
                    ? t("projectContent.header.submit")
                    : t("projectContent.header.withdraw")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
