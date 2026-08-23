import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar"

import { cn } from "@/lib/utils"

/**
 * Werkzeugleiste auf Base UI.
 *
 * <p><strong>Warum diese Datei von Hand entsteht.</strong> Die
 * shadcn-Registry fuehrt zum Stil {@code base-nova} kein Element
 * {@code toolbar}; {@code pnpm dlx shadcn@latest view toolbar} antwortet mit
 * 404. Base UI bringt die Primitive dagegen mit, samt Roving-Tabindex,
 * Pfeiltasten, {@code Home} und {@code End} und der Behandlung
 * deaktivierter, aber weiterhin fokussierbarer Eintraege. Diese Huelle ist
 * deshalb kein Nachbau, sondern die Bruecke zur vorhandenen Primitive:
 * ausserhalb von {@code components/ui/} wird weiterhin nicht direkt aus
 * {@code @base-ui/react} importiert (Frontend-Regel 11).
 *
 * <p>Was sie ersetzt: der zuvor in {@code SelectionToolbar} von Hand
 * gefuehrte Roving-Tabindex, der bei jedem Rendern die Leiste per
 * {@code querySelectorAll} durchsuchte und {@code tabIndex} an jedem
 * Element neu setzte.
 */
function Toolbar({ className, ...props }: ToolbarPrimitive.Root.Props) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  )
}

/**
 * Ein Eintrag der Leiste. Ueber {@code render} nimmt er die Gestalt einer
 * anderen Primitive an, etwa eines {@code Toggle}; der Tabstopp bleibt
 * dabei bei der Leiste.
 */
function ToolbarButton({ className, ...props }: ToolbarPrimitive.Button.Props) {
  return (
    <ToolbarPrimitive.Button
      data-slot="toolbar-button"
      className={cn(className)}
      {...props}
    />
  )
}

/**
 * Eine Gruppe innerhalb der Leiste, rein zur Auszeichnung: sie fasst
 * zusammengehoerige Eintraege zusammen, ohne einen eigenen Fokusbereich
 * aufzumachen.
 */
function ToolbarGroup({ className, ...props }: ToolbarPrimitive.Group.Props) {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  )
}

function ToolbarSeparator({
  className,
  orientation = "vertical",
  ...props
}: ToolbarPrimitive.Separator.Props) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      orientation={orientation}
      className={cn(
        "mx-1 shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:h-5 data-vertical:w-px data-vertical:self-center",
        className
      )}
      {...props}
    />
  )
}

export { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator }
