import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Toene der generischen Pille (Figma "Pill"). Sie beschreiben eine
 * Einordnung, keinen Projektstatus und keine Rolle: dafuer gibt es
 * StatusBadge und RoleBadge, die ihre Werte aus dem Contract beziehen und
 * deshalb keine freie Farbwahl zulassen.
 */
export type PillTone = "neutral" | "info" | "success" | "warning" | "danger"

/*
 * Record ueber den Ton-Typ ohne Standardzweig, wie im StatusBadge: ein
 * sechster Ton bricht den Typecheck, statt still auf Grau zu fallen. Jeder
 * Ton nutzt sein eigenes -fg und nie muted-foreground.
 */
const toneClasses: Record<PillTone, string> = {
  neutral: "bg-badge-neutral-bg text-badge-neutral-fg",
  info: "bg-pill-info-bg text-pill-info-fg",
  success: "bg-pill-success-bg text-pill-success-fg",
  warning: "bg-pill-warning-bg text-pill-warning-fg",
  danger: "bg-pill-danger-bg text-pill-danger-fg",
}

/**
 * Pille fuer eine kurze Einordnung ohne festen Contract-Bezug, etwa in der
 * Administrationsseite.
 *
 * Der Ton ist Zugabe und nie die Aussage: die Bedeutung steht immer in der
 * Beschriftung. Waere sie nur in der Farbe, verlieren sie alle, die Farben
 * nicht unterscheiden koennen (SC 1.4.1).
 */
export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone
  className?: string
  children: ReactNode
}) {
  return <Badge className={cn(toneClasses[tone], className)}>{children}</Badge>
}
