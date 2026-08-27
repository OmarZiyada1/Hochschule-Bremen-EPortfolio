import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"

import { BreadcrumbBar } from "@/components/common/BreadcrumbBar"
import { breadcrumbTrail } from "@/routes/breadcrumbs"
import {
  BreadcrumbTitleContext,
  type BreadcrumbOriginState,
} from "@/routes/useBreadcrumb"

/**
 * Rahmen um Band und Seiteninhalt (KAN-80).
 *
 * <p>Haelt den Namen der aktuellen Seite und zeichnet das Band darueber. Der
 * Pfad selbst kommt aus {@code breadcrumbTrail}; hier wird nur uebersetzt und
 * dargestellt.
 */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)

  /* Ohne useMemo bekaeme der Kontext bei jedem Rendern des Rahmens einen
     neuen Wert, und der Effekt in jeder Seite liefe erneut. */
  const setter = useMemo(() => setTitle, [])

  return (
    <BreadcrumbTitleContext.Provider value={setter}>
      <AppBreadcrumb title={title} />
      {children}
    </BreadcrumbTitleContext.Provider>
  )
}

/**
 * Das Brotkrumenband der aktuellen Route.
 *
 * <p><strong>Lange Namen werden geklemmt</strong> (KAN-80): Ein Projekttitel
 * mit sechzig Zeichen zwang das Band sonst in die zweite Zeile und schob auf
 * schmalen Fenstern die Seite waagerecht. Betroffen sind allein die Namen von
 * Sachen ({@code truncatable}), nicht die Beschriftungen aus dem
 * Navigationsbaum.
 *
 * <p><strong>Geklemmt wird nicht mehr hier, sondern in der
 * Darstellung</strong> (KAN-83). Bis dahin kuerzte diese Stelle den Text hart
 * und reichte den vollen ueber {@code fullLabel} nach; sichtbares Label und
 * zugaenglicher Name waren dadurch verschiedene Zeichenketten (SC 2.5.3
 * „Label in Name", Stufe A), und der volle Titel liess sich weder markieren
 * noch mit der Browsersuche finden. Das Band bekommt den vollen Text und
 * klemmt ihn per CSS, mit derselben Regel wie die Tabellen
 * ({@code components/common/TruncatedText.tsx}).
 *
 * <p>Kein Band auf der Startseite: ein Pfad mit einer einzigen Ebene sagt
 * nichts, was die markierte Hauptnavigation nicht schon sagt. Ebenso auf einer
 * Route, die im Navigationsbaum nicht steht: dort gibt es nichts abzuleiten.
 */
function AppBreadcrumb({ title }: { title: string | null }) {
  const { t } = useTranslation()
  const location = useLocation()
  const from = (location.state as BreadcrumbOriginState | null)?.breadcrumbFrom

  const trail = breadcrumbTrail(location.pathname, { title, from })
  if (trail.length < 2) {
    return null
  }

  return (
    <BreadcrumbBar
      items={trail.map((crumb) => ({
        label: crumb.label ?? t(crumb.labelKey ?? ""),
        truncatable: crumb.truncatable,
        to: crumb.to,
      }))}
    />
  )
}
