import {
  BracesIcon,
  CodeIcon,
  FileTextIcon,
  ImageIcon,
  ImagePlusIcon,
  MinusIcon,
  MusicIcon,
  PlusIcon,
  SigmaIcon,
  TableIcon,
  VideoIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Die Einfuegeleiste am Plus der Blockbedienung: welche Blocktypen sich
 * hinter dem aktuellen Block einfuegen lassen (Contract 2.5).
 *
 * <p><strong>Zwei Sorten Eintrag, und der Unterschied ist keine
 * Geschmacksfrage.</strong> {@code CODE} und {@code DIVIDER} entstehen
 * unmittelbar, denn sie haben keine Pflichtattribute. Alle uebrigen oeffnen
 * einen Dialog, der erst alles Noetige erhebt. Der Grund:
 * {@code BlockService.replace} prueft die <em>gesamte</em> Blockliste, bevor
 * es die erste Zeile schreibt. Ein leerer Medienknoten ohne {@code fileId}
 * machte damit jeden weiteren Autosave des ganzen Projekts unmoeglich, und
 * zwar bis jemand ihn wieder loescht: der Beitrag liesse sich nicht mehr
 * speichern, und niemand saehe, warum.
 *
 * <p><strong>Warum {@code command} und nicht eine blosse Liste.</strong>
 * Vierzehn Blocktypen sind mehr, als sich mit den Pfeiltasten bequem
 * durchgehen laesst; das Eingabefeld filtert sie. Das Menue drumherum ist
 * ein {@code dropdown-menu}, damit Oeffnen, Schliessen und die Fokusrueckgabe
 * an das Plus dieselben sind wie ueberall.
 *
 * <p>Die Symbole kommen aus {@code lucide-react}, also aus derselben Quelle
 * wie die Figma-Zeichnung {@code sec:Icon/Editor}; nachgebaut wird keines.
 */

/**
 * Was hinter dem Plus steht. {@code kind} entscheidet ueber den Weg:
 * {@code direct} legt den Knoten sofort an, {@code dialog} oeffnet den
 * zugehoerigen Dialog.
 */
export type InsertKind =
  | "code"
  | "divider"
  | "table"
  | "image"
  | "gallery"
  | "video"
  | "audio"
  | "document"
  | "embed"
  | "formula"

const ENTRIES: readonly { kind: InsertKind; icon: ReactNode }[] = [
  { kind: "image", icon: <ImageIcon aria-hidden="true" /> },
  { kind: "gallery", icon: <ImagePlusIcon aria-hidden="true" /> },
  { kind: "video", icon: <VideoIcon aria-hidden="true" /> },
  { kind: "audio", icon: <MusicIcon aria-hidden="true" /> },
  { kind: "document", icon: <FileTextIcon aria-hidden="true" /> },
  { kind: "embed", icon: <BracesIcon aria-hidden="true" /> },
  { kind: "formula", icon: <SigmaIcon aria-hidden="true" /> },
  { kind: "table", icon: <TableIcon aria-hidden="true" /> },
  { kind: "code", icon: <CodeIcon aria-hidden="true" /> },
  { kind: "divider", icon: <MinusIcon aria-hidden="true" /> },
]

export function InsertMenu({
  onSelect,
  disabled = false,
}: {
  onSelect: (kind: InsertKind) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              disabled={disabled}
              className="flex size-6 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            />
          }
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("projectContent.insert.label")}</span>
        </TooltipTrigger>
        <TooltipContent>{t("projectContent.insert.label")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-auto min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t("projectContent.insert.search")} />
          <CommandList>
            <CommandEmpty>{t("projectContent.insert.empty")}</CommandEmpty>
            <CommandGroup heading={t("projectContent.insert.group")}>
              {ENTRIES.map((entry) => (
                <CommandItem
                  key={entry.kind}
                  value={t(`projectContent.insert.type.${entry.kind}`)}
                  onSelect={() => onSelect(entry.kind)}
                >
                  {entry.icon}
                  {t(`projectContent.insert.type.${entry.kind}`)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
