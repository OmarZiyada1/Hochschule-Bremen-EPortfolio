import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Rollen nach API-Contract 2.1: genau drei Werte. PUBLIC ist keine Rolle,
 * sondern der Zustand "nicht angemeldet", und hat deshalb weder einen
 * Enum-Wert noch ein Token noch einen Zweig in dieser Komponente.
 * Sobald KAN-30 die generierte schema.d.ts liefert, kommt der Typ von dort.
 */
export type Role = "STUDENT" | "EDITOR" | "ADMIN"

/*
 * Record ueber den Enum-Typ ohne Standardzweig, aus demselben Grund wie im
 * StatusBadge: eine vierte Rolle im Contract bricht den Typecheck.
 */
const roleClasses: Record<Role, string> = {
  STUDENT: "bg-role-student-bg text-role-student-fg",
  EDITOR: "bg-role-editor-bg text-role-editor-fg",
  ADMIN: "bg-role-admin-bg text-role-admin-fg",
}

export function RoleBadge({
  role,
  className,
}: {
  role: Role
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Badge className={cn(roleClasses[role], className)}>
      {t(`user.role.${role}`)}
    </Badge>
  )
}
