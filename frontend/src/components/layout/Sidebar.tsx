import type { ReactNode } from "react"

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
 */
export function SidebarItem({
  href,
  icon,
  active = false,
  className,
  children,
}: {
  href: string
  icon?: ReactNode
  active?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "type-body-sm flex items-center gap-3 rounded-card px-3 py-2.5 font-semibold",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
        className
      )}
    >
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center">
        {icon}
      </span>
      {children}
    </a>
  )
}
