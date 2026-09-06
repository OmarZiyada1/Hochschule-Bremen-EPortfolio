import { MenuIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router-dom"

import { CountBadge } from "@/components/common/CountBadge"
import { Sidebar, SidebarItem } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ADMIN_NAV, isAdminNavActive } from "@/features/administration/adminNav"
import { useOpenSupportRequestCount } from "@/features/administration/hooks/useAdminSupport"

/**
 * Der Rahmen der Administrationsseite (Template „Dashboard" und „Admin
 * Projects", KAN-38): links die Seitennavigation, rechts der Seiteninhalt.
 *
 * <p><strong>Der Bereich heisst Administrationsseite</strong>, in jedem Text
 * und in jeder Beschriftung; „Cockpit" kommt nicht vor (CLAUDE.md).
 *
 * <p><strong>Er liegt im Anwendungsrahmen, nicht daneben.</strong> Beide
 * Frames zeichnen NavBar und Fusszeile; anders als der Editor (KAN-36) fuehrt
 * die Administrationsseite keine eigene Kopfzeile. Sie ist deshalb eine
 * Layout-Route unter {@code AppLayout} und nicht neben ihr.
 *
 * <p><strong>Die Rollenschranke liegt darueber</strong>, im Routenbaum
 * ({@code RequireRole roles={["ADMIN"]}}). Sie ist Bequemlichkeit: verbindlich
 * prueft die Filterkette des Servers, und ein trotzdem eintreffendes 403
 * behandelt jede Seite sichtbar (§5).
 *
 * <p><strong>Zwei Breiten, zwei Anordnungen.</strong> Ab {@code xl} steht die
 * Leiste als Spalte neben dem Inhalt, wie im Template. Darunter steht an
 * ihrer Stelle eine schmale Zeile mit dem Namen der aktuellen Seite, und die
 * Eintraege liegen in einer Schublade dahinter.
 *
 * <p><strong>Die Grenze liegt bei {@code xl} und nicht bei {@code lg}</strong>
 * (Vorgabe zur Nacharbeit). Ein Tablet im Querformat misst rund 1024 bis
 * 1180 Pixel und faellt damit genau zwischen die beiden Marken. Bei
 * {@code lg} bekam es die Spalte, und die zog vom ohnehin knappen Platz
 * weitere 240 Pixel ab, obwohl rechts daneben die breiten Tabellen der
 * Verwaltung stehen. Die Schublade kostet dort einen Klick und gibt die
 * ganze Breite zurueck.
 *
 * <p>Bis zur Nacharbeit lief die Leiste im schmalen Fenster stattdessen
 * <em>waagerecht scrollbar</em> ueber dem Inhalt. Das war die schlechtere
 * Loesung, und zwar aus drei Gruenden: von acht Eintraegen waren drei zu
 * sehen und die uebrigen nur durch Wischen zu finden, ohne dass etwas darauf
 * hinwies; die Zeile kostete oben Platz, obwohl man sie fast nie braucht;
 * und der aktuelle Ort war nur zu erkennen, wenn er zufaellig im sichtbaren
 * Ausschnitt lag. Die Zeile sagt jetzt, wo man ist, und die Schublade zeigt
 * alle acht Eintraege untereinander (Skill frontend-design, Abschnitt 6).
 *
 * <p><strong>Die Schublade ist kontrolliert</strong> und schliesst beim
 * Klick auf einen Eintrag: ein Link im SPA laedt die Seite nicht neu, sie
 * bliebe sonst ueber der neuen Ansicht stehen. Dasselbe Muster wie im
 * Menue der {@code NavBar}.
 *
 * <p><strong>Die Eintraege entstehen einmal</strong> ({@code navItems}) und
 * werden von beiden Anordnungen gelesen. Zwei Abschriften liefen beim
 * naechsten Eintrag auseinander, und genau das ist die Art Doppelung, die
 * hier schon einmal aufgefallen ist.
 *
 * <p><strong>„Support" traegt die Zahl der offenen Anfragen</strong> (Vorgabe
 * zur Nacharbeit). Sie ist der einzige Handlungsbedarf, der von aussen in die
 * Administrationsseite kommt (§2.15, §6.1); bis dahin stand sie nur auf der
 * Support-Seite selbst, also genau dort, wo man sie erst sieht, wenn man
 * ohnehin schon nachgesehen hat. Die Abfrage ist dieselbe wie dort und teilt
 * sich mit ihr den Cache-Ast; sie kostet die Leiste also keinen zweiten
 * Aufruf, sobald jemand die Seite oeffnet. Im schmalen Fenster steht sie
 * zusaetzlich an der Zeile selbst: hinter der geschlossenen Schublade waere
 * sie sonst unsichtbar, und damit waere die Auskunft genau dort weg, wo man
 * am wenigsten nachsieht.
 */
export function AdministrationLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const openSupport = useOpenSupportRequestCount()
  const [menuOpen, setMenuOpen] = useState(false)

  /*
   * Nur ein Zaehler ueber null: „0 offen" ist keine Auskunft, die eine
   * dauerhafte Flaeche verdient, und ein Punkt ohne Anlass gewoehnt das Auge
   * daran, ihn zu uebersehen. Solange die Abfrage laeuft, steht dort
   * ebenfalls nichts; eine 0, die gleich zu 3 wird, ist schlechter als ein
   * Moment Leere (dieselbe Entscheidung wie im Kopf der Support-Seite).
   */
  const openRequests = openSupport.data ?? 0

  /* Wo man gerade ist, fuer die Zeile im schmalen Fenster. Ohne Treffer
     bleibt die zweite Zeile leer statt zu raten; erreichbar ist dieser Fall
     nicht, jede Admin-Route liegt unter einem Eintrag. */
  const current = ADMIN_NAV.find((entry) =>
    isAdminNavActive(entry, location.pathname)
  )

  /**
   * Die acht Eintraege, einmal gebaut.
   *
   * @param onNavigate wird nach dem Klick gerufen; die Schublade schliesst
   *                   sich damit, die Spalte gibt nichts herein
   */
  const navItems = (onNavigate?: () => void) =>
    ADMIN_NAV.map((entry) => {
      const Icon = entry.icon
      const active = isAdminNavActive(entry, location.pathname)
      const count = entry.badge === "openSupportRequests" ? openRequests : 0
      return (
        <SidebarItem
          key={entry.to}
          render={<Link to={entry.to} onClick={onNavigate} />}
          active={active}
          icon={<Icon aria-hidden="true" className="size-4" />}
          badge={
            count > 0 ? (
              <CountBadge
                count={count}
                label={t("administration.nav.openSupportCount", { count })}
                /* Der aktive Eintrag traegt selbst bg-primary; ein Zaehler
                   in derselben Rolle verschwaende darauf. */
                tone={active ? "inverted" : "default"}
              />
            ) : undefined
          }
          className="shrink-0"
        >
          {t(entry.labelKey)}
        </SidebarItem>
      )
    })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 xl:flex-row xl:items-start">
      {/* Schmales Fenster und Tablet: die Zeile mit dem Ausloeser. Sie traegt dieselbe
          Flaeche wie die Spalte darueber hinaus, damit beide Anordnungen als
          dasselbe Bedienelement erkennbar bleiben. */}
      <div className="flex items-center gap-3 rounded-modal border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground xl:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("administration.nav.open")}
              />
            }
          >
            <MenuIcon aria-hidden="true" />
          </SheetTrigger>
          {/* gap-0 und eigene Innenabstaende: die Primitive setzt zwischen
              Kopf und Inhalt einen Abstand, der hier eine Luecke zwischen
              Ueberschrift und erstem Eintrag ergaebe. */}
          <SheetContent side="left" className="gap-0">
            <SheetHeader className="pb-2">
              <SheetTitle className="type-label-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {t("administration.nav.label")}
              </SheetTitle>
            </SheetHeader>
            {/* Eigene nav-Landmarke, wie in der Spalte: die beiden bestehen
                nie gleichzeitig, weil die Spalte unterhalb von xl auf
                display:none steht und damit aus dem Baum faellt. */}
            <nav
              aria-label={t("administration.nav.label")}
              className="flex scrollbar-slim flex-col gap-0.5 overflow-y-auto px-4 pb-4"
            >
              {navItems(() => setMenuOpen(false))}
            </nav>
          </SheetContent>
        </Sheet>

        <span className="flex min-w-0 flex-col">
          <span className="type-label-xs tracking-widest text-muted-foreground uppercase">
            {t("administration.label")}
          </span>
          {/* truncate und nicht umbrechen: die Zeile soll eine Zeile hoch
              bleiben, sonst springt der Seitenanfang je nach Eintrag. */}
          <span className="type-body-sm truncate font-semibold text-primary">
            {current === undefined ? "" : t(current.labelKey)}
          </span>
        </span>

        {openRequests > 0 && (
          <CountBadge
            className="ml-auto"
            count={openRequests}
            label={t("administration.nav.openSupportCount", {
              count: openRequests,
            })}
          />
        )}
      </div>

      {/* shrink-0 haelt die Spalte auf ihrer Breite: ohne sie zieht eine
          breite Tabelle rechts die Leiste zusammen, bis die Beschriftungen
          umbrechen. */}
      <Sidebar
        label={t("administration.nav.label")}
        className="hidden xl:sticky xl:top-6 xl:flex xl:w-60 xl:shrink-0"
      >
        {navItems()}
      </Sidebar>

      {/* min-w-0 ist Pflicht, nicht Kosmetik: ohne sie waechst dieser
          Flex-Kasten mit der breitesten Tabellenzeile mit, statt sie in
          ihrem eigenen overflow-x scrollen zu lassen, und die ganze Seite
          bekommt eine waagerechte Leiste. */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Outlet />
      </div>
    </div>
  )
}
