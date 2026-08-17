import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
      <div className="border-b bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-3.5">
          <Breadcrumb className="inline-flex rounded-control border px-3 py-2">
            <BreadcrumbList className="type-body-sm">
              <BreadcrumbItem>
                {/* Der Weg zurueck steht im Template in primary, die
                    aktuelle Ebene in muted-foreground; die Registry haelt
                    es genau umgekehrt (Kommentar aus KAN-8). */}
                <BreadcrumbLink
                  render={<Link to="/" />}
                  className="font-medium text-primary hover:text-primary-hover"
                >
                  {t("common.nav.home")}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-muted-foreground">
                  {breadcrumbLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-115 gap-4.5 px-10 py-10">{children}</Card>
      </div>
    </>
  )
}
