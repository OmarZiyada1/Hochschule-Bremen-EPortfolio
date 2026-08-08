import { Check } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ThemeToggle } from "@/components/common/ThemeToggle"
import { Button } from "@/components/ui/button"

import {
  buttonIconSizeNames,
  buttonSizeNames,
  buttonVariantNames,
  colorGroups,
  flattenColorTokens,
  radiusTokens,
  typographyRoles,
} from "./tokenCatalog"

/**
 * Liest die aufgeloesten Werte der Tokenschicht am Wurzelelement.
 *
 * Beobachtet wird die Klasse an <html>, nicht der Zustand des
 * ThemeProviders: die Klasse setzt der Provider in seinem eigenen Effekt,
 * und der laeuft als Elternkomponente nach dem Effekt dieser Seite. Wer
 * stattdessen auf den Moduswert hoert, zeigt nach jedem Umschalten die
 * Werte des vorigen Modus.
 */
function useResolvedTokens(tokens: readonly string[]) {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const root = document.documentElement

    const read = () => {
      const styles = window.getComputedStyle(root)
      setValues(
        Object.fromEntries(
          tokens.map((token) => [
            token,
            styles.getPropertyValue(`--${token}`).trim(),
          ])
        )
      )
    }

    read()

    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [tokens])

  return values
}

/**
 * Pruefflaeche der Tokenschicht (KAN-6, Abschnitt 8) unter /dev/tokens.
 *
 * Sie ist die Abnahmegrundlage dieses Tickets und bleibt danach bestehen:
 * jede spaetere Aenderung an der Tokenschicht ist hier sofort sichtbar.
 * Die Seite existiert nur im Entwicklungs-Build (siehe routes/index.tsx).
 */
export default function TokenGalleryPage() {
  const { t } = useTranslation()
  const colorTokens = useMemo(() => flattenColorTokens(), [])
  const colorValues = useResolvedTokens(colorTokens)
  const radiusValues = useResolvedTokens(radiusTokens)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="type-title">{t("tokens.title")}</h1>
          <p className="type-body max-w-prose text-muted-foreground">
            {t("tokens.intro")}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="type-h1">{t("tokens.colors.title")}</h2>
          <p className="type-body-sm text-muted-foreground">
            {t("tokens.colors.count", { count: colorTokens.length })}
          </p>
        </div>

        {colorGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-3">
            <h3 className="type-h2">{t(`tokens.colors.group.${group.id}`)}</h3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
              {group.tokens.map((token) => (
                <li
                  key={token}
                  className="flex flex-col gap-2 rounded-card border bg-card p-3 text-card-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="h-10 w-full rounded-selection border"
                    style={{ backgroundColor: `var(--${token})` }}
                  />
                  <code className="type-caption break-all">--{token}</code>
                  <code className="type-caption text-muted-foreground">
                    {colorValues[token]}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-h1">{t("tokens.radius.title")}</h2>
          <p className="type-body-sm text-muted-foreground">
            {t("tokens.radius.intro")}
          </p>
        </div>
        <ul className="flex flex-wrap gap-4">
          {radiusTokens.map((token) => (
            <li key={token} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className="block size-20 border bg-accent"
                style={{ borderRadius: `var(--${token})` }}
              />
              <code className="type-caption">--{token}</code>
              <code className="type-caption text-muted-foreground">
                {radiusValues[token]}
              </code>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-h1">{t("tokens.typography.title")}</h2>
          <p className="type-body-sm text-muted-foreground">
            {t("tokens.typography.intro")}
          </p>
        </div>
        <ul className="flex flex-col gap-6">
          {typographyRoles.map((role) => (
            <li key={role} className="flex flex-col gap-1">
              <code className="type-caption text-muted-foreground">
                .{role}
              </code>
              {/* Bewusst schmal: der Beispieltext muss umbrechen, sonst
                  bleibt eine zu enge Zeilenhoehe unsichtbar. */}
              <p className={`${role} max-w-md`}>
                {t("tokens.typography.sample")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-h1">{t("tokens.button.title")}</h2>
          <p className="type-body-sm text-muted-foreground">
            {t("tokens.button.intro")}
          </p>
        </div>

        {/* Varianten und Groessen teilen sich den Namen "default". Die
            beiden Reihen sind deshalb als Gruppe ausgezeichnet, damit
            Bildschirmleser und Test denselben Button auseinanderhalten. */}
        <h3 className="type-h2" id="button-variants">
          {t("tokens.button.variants")}
        </h3>
        <div
          aria-labelledby="button-variants"
          className="flex flex-wrap items-center gap-3"
          role="group"
        >
          {buttonVariantNames.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>

        <h3 className="type-h2" id="button-sizes">
          {t("tokens.button.sizes")}
        </h3>
        <div
          aria-labelledby="button-sizes"
          className="flex flex-wrap items-center gap-3"
          role="group"
        >
          {buttonSizeNames.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
          {buttonIconSizeNames.map((size) => (
            <Button
              key={size}
              size={size}
              aria-label={`${t("tokens.button.label")} ${size}`}
            >
              <Check aria-hidden="true" />
            </Button>
          ))}
        </div>
      </section>
    </main>
  )
}
