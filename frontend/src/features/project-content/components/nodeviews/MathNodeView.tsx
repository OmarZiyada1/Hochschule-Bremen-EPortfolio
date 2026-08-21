import type { ReactNodeViewProps } from "@tiptap/react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { MediaShell } from "@/features/project-content/components/MediaShell"
import { LazyMathBlock } from "@/features/project-content/renderer/LazyMathBlock"

/**
 * FORMULA auf der Schreibflaeche (Contract 2.5, Template „Editor").
 *
 * <p><strong>Getippt wird in ein Feld, angezeigt wird darueber.</strong>
 * Die Eingabe ist ein {@code textarea} mit KaTeX-Syntax, die Vorschau
 * derselbe Renderer wie auf der oeffentlichen Seite. Der Zwischenschritt
 * „Rendern" ist Absicht: waehrend des Tippens ist jede halbfertige Formel
 * fehlerhaft, und eine Fehlermeldung, die bei jedem Zeichen aufblitzt,
 * liest sich wie ein Defekt.
 *
 * <p>Ctrl beziehungsweise Cmd und Enter tut dasselbe wie die Schaltflaeche,
 * so steht es im Template.
 *
 * <p>KaTeX kommt ueber {@code LazyMathBlock} und wird erst beim ersten
 * Rendern nachgeladen: die Bibliothek ist gross, und die meisten Beitraege
 * enthalten keine Formel.
 */
export function MathNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const fieldId = useId()
  const latex = (node.attrs as { latex: string | null }).latex ?? ""
  const [draft, setDraft] = useState(latex)

  const render = () => updateAttributes({ latex: draft })

  return (
    <MediaShell
      label={t("projectContent.blockName.mathBlock")}
      incompleteHint={
        latex.trim() === "" ? t("projectContent.formula.incomplete") : null
      }
    >
      {latex.trim() !== "" && <LazyMathBlock latex={latex} />}

      <Field contentEditable={false}>
        <FieldLabel htmlFor={fieldId}>
          {t("projectContent.formula.label")}
        </FieldLabel>
        <Textarea
          id={fieldId}
          value={draft}
          rows={3}
          spellCheck={false}
          placeholder={t("projectContent.formula.placeholder")}
          aria-describedby={`${fieldId}-hint`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              render()
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription id={`${fieldId}-hint`}>
            {t("projectContent.formula.hint")}
          </FieldDescription>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={render}
            disabled={draft === latex}
          >
            {t("projectContent.formula.render")}
          </Button>
        </div>
      </Field>
    </MediaShell>
  )
}
