import { useTranslation } from "react-i18next"

import type { Role } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/*
 * PUBLIC ist keine Rolle, sondern der Zustand "nicht angemeldet"
 * (Contract 2.1), und hat deshalb weder einen Enum-Wert noch ein Token noch
 * einen Zweig in dieser Komponente.
 *
 * Record ueber den Enum-Typ ohne Standardzweig, aus demselben Grund wie im
 * StatusBadge: eine vierte Rolle bricht den Typecheck, sobald sie im Typ
 * steht. Der Typ kommt seit KAN-30 aus der generierten schema.d.ts.
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
