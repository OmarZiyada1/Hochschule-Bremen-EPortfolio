import { useTranslation } from "react-i18next"

import { ThemeToggle } from "@/components/common/ThemeToggle"

import { ComponentGallery } from "./components/ComponentGallery"

/**
 * Pruefflaeche der Komponentenbibliothek (KAN-29, Abschnitt 3) unter
 * /dev/components. Sie ist von der Tokenschicht unter /dev/tokens
 * getrennt, damit beide Seiten uebersichtlich bleiben; wie diese existiert
 * sie nur im Entwicklungs-Build (siehe routes/index.tsx).
 */
export default function ComponentGalleryPage() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="type-title">{t("tokens.components.title")}</h1>
          <p className="type-body max-w-prose text-muted-foreground">
            {t("tokens.components.intro")}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <ComponentGallery />
    </main>
  )
}
