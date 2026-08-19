import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { BreadcrumbBar } from "@/components/common/BreadcrumbBar"
import { Card } from "@/components/ui/card"

/**
 * Rahmen aller Auth-Karten (KAN-33): Brotkrumenleiste wie im Template,
 * darunter mittig die Karte mit 460px Breite und 40px Innenabstand, wie sie
 * die Login-Seite aus KAN-8 vorgibt. Die Seiten liegen im rahmenlosen
 * AuthLayout; diese Huelle traegt deshalb die komplette sichtbare Struktur.
 */
export function AuthPageShell({
  breadcrumbLabel,
  children,
}: {
  /** Beschriftung der aktuellen Ebene, bereits uebersetzt. */
  breadcrumbLabel: string
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <>
      <BreadcrumbBar
        items={[
          { label: t("common.nav.home"), to: "/" },
          { label: breadcrumbLabel },
        ]}
      />

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-115 gap-4.5 px-10 py-10">{children}</Card>
      </div>
    </>
  )
}
