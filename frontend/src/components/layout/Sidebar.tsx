import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

/**
 * Seitennavigation der Administrationsseite (Figma "Sidebar" und
 * "Sidebar Item").
 *
 * Die Eintraege kommen als Kinder und nicht als Datenliste: die Routen
 * entstehen erst mit ihren Seiten-Tickets, und eine hier fest verdrahtete
 * Liste waere ein zweiter Ort, an dem sie stehen. Die Ueberschrift benennt
 * den Bereich und ist zugleich der zugaengliche Name der Navigation, damit
 * eine zweite Navigation auf derselben Seite unterscheidbar bleibt
 * (SC 1.3.1).
 */
export function Sidebar({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-col gap-0.5 rounded-modal border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground",
        className
      )}
    >
      <p className="type-label-xs px-3 pt-1 pb-2 font-semibold text-muted-foreground">
        {label}
      </p>
      {children}
    </nav>
  )
}

/**
 * Ein Eintrag der Seitennavigation.
 *
 * Der aktive Eintrag traegt aria-current="page" und nicht nur eine andere
 * Farbe: sonst ist die Markierung fuer alle weg, die die Flaeche nicht
 * sehen (SC 1.4.1). Das Symbol ist Beiwerk zur Beschriftung und deshalb
 * aria-hidden.
 *
 * <p><strong>{@code render} statt {@code href}, sobald die Route echt
 * ist</strong> (KAN-38). Ein blankes {@code <a href>} laedt im SPA die ganze
 * Anwendung neu: React-Zustand, Auth-Kontext und der Query-Cache entstehen
 * bei jedem Wechsel zwischen zwei Admin-Seiten von vorn. Der Aufrufer reicht
 * deshalb sein eigenes Element herein ({@code render={<Link to="…" />}}),
 * genau wie es die Registry-Primitiven halten und wie es die NavBar mit
 * {@code NavigationMenuLink} tut; Klassen und {@code aria-current} legt diese
 * Huelle darauf. {@code href} bleibt fuer Ziele ausserhalb des Routers und
 * fuer die Pruefflaeche aus KAN-29.
 */
export function SidebarItem({
  href,
  render,
  icon,
  active = false,
  className,
  children,
}: {
  href?: string
  /**
   * Das Element, das den Eintrag traegt, etwa ein {@code Link} des Routers.
   * Hat Vorrang vor {@code href}; genau eines von beiden gehoert gesetzt.
   */
  render?: ReactElement<{ className?: string; "aria-current"?: string }>
  icon?: ReactNode
  active?: boolean
  className?: string
  children: ReactNode
}) {
  const classes = cn(
    "type-body-sm flex items-center gap-3 rounded-card px-3 py-2.5 font-semibold",
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
    className
  )

  const content = (
    <>
      {/* Nur wenn es ein Symbol gibt: der Wrapper belegt sonst 16px plus die
          12px des gap, und ein Eintrag ohne Symbol saesse um 28px eingerueckt
          neben nichts. */}
      {icon && (
        <span aria-hidden="true" className="flex size-4 shrink-0 items-center">
          {icon}
        </span>
      )}
      {children}
    </>
  )

  if (render !== undefined && isValidElement(render)) {
    return cloneElement(
      render,
      {
        className: cn(classes, render.props.className),
        "aria-current": active ? "page" : undefined,
      },
      content
    )
  }

  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={classes}
    >
      {content}
    </a>
  )
}
