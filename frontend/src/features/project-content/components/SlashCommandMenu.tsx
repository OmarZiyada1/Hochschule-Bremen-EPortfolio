import type { Editor, Range } from "@tiptap/react"
import { useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import {
  INSERT_ENTRIES,
  type InsertKind,
} from "@/features/project-content/blockInsert"

/**
 * Die Liste hinter dem Slash-Befehl (KAN-36).
 *
 * <p><strong>Warum es sie neben der Pille gibt.</strong> Die Pille am Plus
 * verlangt, dass die Hand die Tastatur verlaesst und den Zeiger an den Rand
 * des Blocks fuehrt. Der Slash-Befehl fuegt an der Stelle ein, an der
 * geschrieben wird, ohne die Schreibhaltung zu verlassen; beide Wege fuehren
 * dieselbe Liste ({@code blockInsert.INSERT_ENTRIES}) und legen denselben
 * Knoten an.
 *
 * <p><strong>Die Tastaturfuehrung liegt hier und nicht beim Plugin.</strong>
 * {@code Suggestion} reicht jeden Tastendruck an {@code onKeyDown} durch und
 * erwartet ein {@code true}, wenn er verbraucht wurde; die Auswahl selbst
 * fuehrt die Liste. Ohne das Verbrauchen liefe der Pfeil nach unten
 * gleichzeitig durch den Text.
 *
 * <p><strong>Der Fokus bleibt im Text, die Auswahl wird trotzdem
 * angesagt.</strong> Wer weitertippt, filtert; der Fokus darf die
 * Schreibflaeche deshalb nicht verlassen. Damit ein Screenreader dennoch
 * erfaehrt, welcher Eintrag gerade dran ist, traegt die Schreibflaeche
 * solange {@code aria-activedescendant} auf die aktive Zeile. Das Fenster
 * haengt per Portal ausserhalb des Editors, deshalb kommt
 * {@code aria-owns} dazu: ohne diese Klammer waere der Verweis nach ARIA
 * ungueltig, weil die Zeile kein Nachfahre der Schreibflaeche ist.
 */

export type SlashCommandMenuHandle = {
  /** Meldet, ob der Tastendruck verbraucht wurde. */
  onKeyDown: (event: KeyboardEvent) => boolean
}

export type SlashCommandMenuProps = {
  editor: Editor
  range: Range
  query: string
  ref?: React.Ref<SlashCommandMenuHandle>
  onSelect: (kind: InsertKind, range: Range) => void
}

export function SlashCommandMenu({
  editor,
  range,
  query,
  ref,
  onSelect,
}: SlashCommandMenuProps) {
  const { t } = useTranslation()
  const listboxId = useId()
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const entries = INSERT_ENTRIES.filter(({ kind }) =>
    t(`projectContent.insert.type.${kind}`)
      .toLocaleLowerCase("de")
      .includes(query.toLocaleLowerCase("de"))
  )

  /*
   * Ein neuer Suchbegriff faengt oben an; sonst zeigte die Markierung auf
   * eine Zeile, die es nach dem Filtern nicht mehr gibt.
   *
   * <p>Beim Rendern zurueckgesetzt und nicht in einem Effekt: ein
   * {@code setState} im Effektkoerper laeuft erst nach dem Zeichnen und
   * ergibt einen zweiten Durchgang, in dem fuer einen Bildaufbau die
   * falsche Zeile hervorgehoben ist (React, "You Might Not Need an
   * Effect").
   */
  const [seenQuery, setSeenQuery] = useState(query)
  if (seenQuery !== query) {
    setSeenQuery(query)
    setActive(0)
  }

  const activeId =
    entries[active] === undefined
      ? undefined
      : `${listboxId}-${entries[active].kind}`

  /* Die Schreibflaeche ist ein fremdes System (ProseMirror verwaltet ihr
     DOM), deshalb laeuft die Verknuepfung ueber einen Effekt. */
  useEffect(() => {
    const dom = editor.view.dom
    dom.setAttribute("aria-expanded", "true")
    dom.setAttribute("aria-owns", listboxId)
    dom.setAttribute("aria-controls", listboxId)
    dom.setAttribute("aria-autocomplete", "list")
    return () => {
      dom.removeAttribute("aria-expanded")
      dom.removeAttribute("aria-owns")
      dom.removeAttribute("aria-controls")
      dom.removeAttribute("aria-autocomplete")
      dom.removeAttribute("aria-activedescendant")
    }
  }, [editor, listboxId])

  useEffect(() => {
    const dom = editor.view.dom
    if (activeId === undefined) {
      dom.removeAttribute("aria-activedescendant")
      return
    }
    dom.setAttribute("aria-activedescendant", activeId)
  }, [activeId, editor])

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (entries.length === 0) {
          return false
        }
        if (event.key === "ArrowDown") {
          setActive((current) => (current + 1) % entries.length)
          return true
        }
        if (event.key === "ArrowUp") {
          setActive(
            (current) => (current - 1 + entries.length) % entries.length
          )
          return true
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const entry = entries[active]
          if (entry === undefined) {
            return false
          }
          onSelect(entry.kind, range)
          return true
        }
        return false
      },
    }),
    [active, entries, onSelect, range]
  )

  if (entries.length === 0) {
    return (
      <div
        id={listboxId}
        role="listbox"
        aria-label={t("projectContent.insert.label")}
        className="rounded-card border border-border bg-popover p-3 text-muted-foreground shadow-md"
      >
        <p className="type-body-sm">{t("projectContent.insert.noMatch")}</p>
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label={t("projectContent.insert.label")}
      className="max-h-72 w-64 overflow-y-auto rounded-card border border-border bg-popover p-1 shadow-md"
    >
      {entries.map(({ kind, icon: Icon }, index) => {
        const label = t(`projectContent.insert.type.${kind}`)
        return (
          <div
            key={kind}
            id={`${listboxId}-${kind}`}
            role="option"
            aria-selected={index === active}
            data-active={index === active}
            /*
             * Bewusst ohne tabIndex: der Fokus bleibt im Text, damit
             * Weitertippen filtert. Welche Zeile dran ist, meldet
             * aria-activedescendant an der Schreibflaeche.
             */
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => {
              /* Nicht den Fokus aus dem Text nehmen, sonst schliesst die
                 Auswahl, bevor der Klick ankommt. */
              event.preventDefault()
              onSelect(kind, range)
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5",
              index === active && "bg-accent text-accent-foreground"
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="type-body-sm">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
