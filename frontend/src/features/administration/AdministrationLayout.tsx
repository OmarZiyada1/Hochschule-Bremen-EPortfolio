import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router-dom"

import { Sidebar, SidebarItem } from "@/components/layout/Sidebar"
import { ADMIN_NAV, isAdminNavActive } from "@/features/administration/adminNav"

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
 * <p><strong>Die Leiste wird ab {@code lg} zur Spalte.</strong> Darunter
 * steht sie ueber dem Inhalt und laeuft waagerecht, statt eine 240px-Spalte
 * von einem 360px-Fenster abzuziehen. Die Templates sind Desktop-Ansichten
 * und sagen dazu nichts; bedienbar bleiben muss es trotzdem (Skill
 * frontend-design, Abschnitt 6).
 */
export function AdministrationLayout() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start">
      {/* shrink-0 haelt die Spalte auf ihrer Breite: ohne sie zieht eine
          breite Tabelle rechts die Leiste zusammen, bis die Beschriftungen
          umbrechen. */}
      <Sidebar
        label={t("administration.nav.label")}
        className="w-full lg:sticky lg:top-6 lg:w-60 lg:shrink-0"
      >
        {/* Waagerecht scrollbar nur im schmalen Fenster; ab lg ist es
            wieder die Spalte aus dem Template. */}
        <div className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
          {ADMIN_NAV.map((entry) => {
            const Icon = entry.icon
            const active = isAdminNavActive(entry, location.pathname)
            return (
              <SidebarItem
                key={entry.to}
                render={<Link to={entry.to} />}
                active={active}
                icon={<Icon aria-hidden="true" className="size-4" />}
                className="shrink-0"
              >
                {t(entry.labelKey)}
              </SidebarItem>
            )
          })}
        </div>
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
