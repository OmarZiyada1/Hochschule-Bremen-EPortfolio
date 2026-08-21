import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react"

import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Die Huelle jeder Werkzeugleiste des Editors: ein
 * {@code role="toolbar"} mit <strong>einem</strong> Tabstopp, Pfeiltasten
 * darin und Pos1/Ende an die Raender (WAI-ARIA Toolbar Pattern, SC 2.1.1;
 * Confluence „Template: Editor (Bearbeiten)", Abschnitt Tastatur und Fokus).
 *
 * <p><strong>Warum hier kein {@code toggle-group} steht, obwohl es die
 * Primitive gibt.</strong> {@code ToggleGroup} aus der Registry ist selbst
 * ein Komposit mit eigenem Roving-Tabindex: es faengt die Pfeiltasten ab und
 * laesst den Fokus die Gruppe nicht verlassen. Vier solcher Gruppen
 * nebeneinander ergaeben vier Tabstopps und vier abgeschlossene
 * Pfeilbereiche, also genau das, was das Muster nicht will. Die Leiste
 * fuehrt den Roving-Tabindex deshalb selbst und setzt darin die einzelne
 * Primitive {@code toggle} ein; die Gruppen bleiben als {@code role="group"}
 * mit eigenem Namen erhalten. Wo eine Gruppe einen eigenen Fokusbereich
 * <em>haben soll</em>, naemlich im Ausrichtungsmenue, steht sehr wohl ein
 * {@code toggle-group} ({@code AlignMenu}).
 *
 * <p><strong>Die Registry fuehrt keine Primitive {@code toolbar}.</strong>
 * Geprueft am 21.08.2026: {@code shadcn@latest view toolbar} antwortet mit
 * „not found". Von Hand entsteht hier deshalb nur, was Domaenenwissen
 * traegt, und das komponiert {@code toggle}, {@code separator} und
 * {@code tooltip}, statt sie nachzubauen (Frontend-Regel 11).
 */

type ToolbarContextValue = {
  /** Kennung des Elements, das gerade den Tabstopp traegt. */
  activeId: string | null
  setActiveId: (id: string) => void
  /** Erstes Element der Leiste beim Betreten fokussieren. */
  claimFirst: (id: string) => void
}

const ToolbarContext = createContext<ToolbarContextValue | null>(null)

function useToolbar(): ToolbarContextValue {
  const context = useContext(ToolbarContext)
  if (context === null) {
    throw new Error("ToolbarButton gehoert in eine EditorToolbar.")
  }
  return context
}

/**
 * Die Leiste selbst.
 *
 * <p>Der Roving-Tabindex laeuft ueber die tatsaechliche DOM-Reihenfolge und
 * nicht ueber eine Liste, die der Aufrufer pflegt: die Reihenfolge steht im
 * Markup, und eine zweite Aufzaehlung daneben liefe bei der ersten
 * Umstellung auseinander.
 *
 * <p>Ein Element mit {@code aria-disabled} bleibt anfokussierbar und wird
 * uebersprungen: das ist der Unterschied zu {@code disabled} und der Grund,
 * warum der Blocksatz bei markierter Ueberschrift sichtbar bleibt statt zu
 * verschwinden (SC 3.2.4).
 *
 * <p><strong>Alt+F10 fuehrt in die Leiste, Escape wieder heraus.</strong>
 * Ohne den Hinweg gibt es fuer eine Tastaturbedienung keinen: die Leiste
 * erscheint erst mit der Auswahl, und wer sie mit Tab suchen wollte,
 * verloere unterwegs die Markierung, an der sie haengt. Alt+F10 ist der
 * Griff, den das WAI-ARIA Toolbar Pattern dafuer vorsieht.
 */
export function EditorToolbar({
  label,
  children,
  onEscape,
  activateOn,
  ref,
  className,
}: {
  /** Zugaenglicher Name der Leiste, aus i18n. */
  label: string
  children: ReactNode
  /**
   * Escape in der Leiste: der Fokus geht an die Auswahl im Text zurueck,
   * ohne die Markierung zu verlieren.
   */
  onEscape?: () => void
  /**
   * Das Element, auf dem Alt+F10 in die Leiste fuehrt, also in aller Regel
   * die Schreibflaeche. Ohne Angabe gibt es den Hinweg nicht; die Leiste
   * bleibt dann ueber Tab erreichbar.
   *
   * <p>Das Element selbst und keine Funktion: die Leiste rendert bei jeder
   * Auswahlaenderung neu, und ein Pfeil an der Aufrufstelle meldete den
   * Zuhoerer bei praktisch jedem Tastendruck ab und wieder an.
   */
  activateOn?: HTMLElement | null
  ref?: Ref<HTMLDivElement>
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const items = useCallback(
    () =>
      Array.from(
        rootRef.current?.querySelectorAll<HTMLElement>("[data-toolbar-item]") ??
          []
      ),
    []
  )

  const focusAt = useCallback(
    (index: number) => {
      const all = items()
      if (all.length === 0) {
        return
      }
      const target = all[Math.min(Math.max(index, 0), all.length - 1)]
      const id = target.getAttribute("data-toolbar-item")
      if (id !== null) {
        setActiveId(id)
      }
      target.focus()
    },
    [items]
  )

  const claimFirst = useCallback(
    (id: string) => {
      setActiveId((current) => current ?? id)
    },
    []
  )

  /**
   * Alt+F10 auf der Schreibflaeche setzt den Fokus auf das erste Element
   * der Leiste.
   *
   * <p>Gehorcht wird dem Element und nicht dem Dokument: ein Zuhoerer am
   * Dokument fienge dieselbe Taste auch in einem Dialog daneben, und dort
   * bedeutet sie nichts.
   */
  useEffect(() => {
    const target = activateOn ?? null
    if (target === null) {
      return
    }
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if (!event.altKey || event.key !== "F10") {
        return
      }
      event.preventDefault()
      focusAt(0)
    }
    target.addEventListener("keydown", onShortcut)
    return () => target.removeEventListener("keydown", onShortcut)
  }, [activateOn, focusAt])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = items()
    const current = all.findIndex((item) => item === document.activeElement)

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault()
        focusAt(current < 0 ? 0 : (current + 1) % all.length)
        return
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault()
        focusAt(current <= 0 ? all.length - 1 : current - 1)
        return
      case "Home":
        event.preventDefault()
        focusAt(0)
        return
      case "End":
        event.preventDefault()
        focusAt(all.length - 1)
        return
      case "Escape":
        if (onEscape !== undefined) {
          event.preventDefault()
          onEscape()
        }
        return
      default:
    }
  }

  return (
    <ToolbarContext.Provider value={{ activeId, setActiveId, claimFirst }}>
      <div
        ref={(node) => {
          rootRef.current = node
          if (typeof ref === "function") {
            ref(node)
          } else if (ref !== null && ref !== undefined) {
            ref.current = node
          }
        }}
        role="toolbar"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-max items-center gap-0.5 rounded-control border border-border bg-popover p-1 shadow-md",
          className
        )}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  )
}

/**
 * Eine Gruppe innerhalb der Leiste, mit eigenem zugaenglichen Namen.
 *
 * <p>Sie bildet <strong>keinen</strong> eigenen Fokusbereich: die
 * Pfeiltasten laufen ueber Gruppengrenzen hinweg, weil die ganze Leiste ein
 * Tabstopp ist. Der Name macht die Gliederung fuer einen Screenreader
 * hoerbar, die die senkrechten Striche fuer das Auge machen.
 */
export function ToolbarGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {children}
    </div>
  )
}

/** Der senkrechte Strich zwischen zwei Gruppen, rein zierend. */
export function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-1 h-6" />
}

/**
 * Eine Schaltflaeche der Leiste.
 *
 * <p><strong>Der zugaengliche Name steht als {@code sr-only}-Text im
 * Element</strong>, nicht als {@code aria-label} und nicht im Tooltip. Der
 * Tooltip ergaenzt ihn und ersetzt ihn nicht: auf einem Touchgeraet
 * erscheint er gar nicht. Ein {@code aria-label} allein braeche ausserdem
 * SC 2.5.3, sobald jemand die Schaltflaeche per Sprache anspricht.
 *
 * <p>Gesetzte Auszeichnungen melden {@code aria-pressed}; das bringt die
 * Primitive {@code toggle} mit.
 */
export function ToolbarButton({
  id,
  label,
  icon,
  pressed = false,
  disabled = false,
  onPressedChange,
}: {
  /** Eindeutig innerhalb der Leiste; traegt den Roving-Tabindex. */
  id: string
  label: string
  icon: ReactNode
  pressed?: boolean
  /**
   * Deaktiviert im Sinne von {@code aria-disabled}: sichtbar, anfokussierbar
   * und erklaerbar, aber ohne Wirkung (SC 3.2.4).
   */
  disabled?: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  const { activeId, setActiveId, claimFirst } = useToolbar()

  useEffect(() => {
    claimFirst(id)
  }, [claimFirst, id])

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            data-toolbar-item={id}
            size="sm"
            pressed={pressed}
            aria-disabled={disabled || undefined}
            tabIndex={activeId === id ? 0 : -1}
            onFocus={() => setActiveId(id)}
            onPressedChange={(next) => {
              if (disabled) {
                return
              }
              onPressedChange(next)
            }}
          />
        }
      >
        {icon}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Ein Auslöser der Leiste, der ein Menue oeffnet statt umzuschalten.
 *
 * <p>Er traegt denselben Roving-Tabindex wie eine Schaltflaeche, aber kein
 * {@code aria-pressed}: was er meldet, ist der Zustand des Menues, und das
 * setzt die Menue-Primitive selbst ({@code aria-expanded},
 * {@code aria-haspopup}). Deshalb reicht diese Komponente ihre Requisiten
 * an ein fremdes Element durch, statt eines zu bauen.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Der Hook gehoert zur Leiste: er reicht ihren Roving-Tabindex an ein fremdes Element durch und ist ausserhalb sinnlos.
export function useToolbarItemProps(id: string): {
  "data-toolbar-item": string
  tabIndex: number
  onFocus: () => void
} {
  const { activeId, setActiveId, claimFirst } = useToolbar()

  useEffect(() => {
    claimFirst(id)
  }, [claimFirst, id])

  return {
    "data-toolbar-item": id,
    tabIndex: activeId === id ? 0 : -1,
    onFocus: () => setActiveId(id),
  }
}
