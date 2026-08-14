import {
  AlertCircleIcon,
  BoldIcon,
  ChevronDownIcon,
  InfoIcon,
  ItalicIcon,
  SearchIcon,
  Trash2Icon,
  UnderlineIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { de, enUS } from "react-day-picker/locale"
import { useTranslation } from "react-i18next"

import { CharacterCounter } from "@/components/common/CharacterCounter"
import { EmptyState } from "@/components/common/EmptyState"
import { FilterSelect } from "@/components/common/FilterSelect"
import { KpiTile } from "@/components/common/KpiTile"
import { ProjectCard } from "@/components/common/ProjectCard"
import { RoleBadge, type Role } from "@/components/common/RoleBadge"
import { SearchInput } from "@/components/common/SearchInput"
import { StatusBadge, type ProjectStatus } from "@/components/common/StatusBadge"
import { Tag } from "@/components/common/Tag"
import { Footer } from "@/components/layout/Footer"
import { NavBar } from "@/components/layout/NavBar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/*
 * Die Namen der Badge-Varianten stehen in badge.tsx nur innerhalb der
 * cva-Definition; hier gespiegelt wie buttonVariantNames im tokenCatalog.
 */
const badgeVariantNames = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const

const projectStatuses: ProjectStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "PUBLISHED",
  "REVISION",
]

const roles: Role[] = ["STUDENT", "EDITOR", "ADMIN"]

/**
 * Ein Demoblock je Komponente. Der Name ist der technische Bezeichner der
 * Datei bzw. Komponente und wird wie die Tokennamen bewusst nicht
 * uebersetzt; alles Sichtbare darin kommt aus i18n.
 */
function DemoBlock({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border bg-card p-4 text-card-foreground">
      <code className="type-caption text-muted-foreground">{name}</code>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </div>
  )
}

function FormDemos() {
  const { t } = useTranslation()
  return (
    <>
      <DemoBlock name="input · label">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Label htmlFor="demo-input">{t("tokens.components.demo.titleLabel")}</Label>
          <Input
            id="demo-input"
            placeholder={t("tokens.components.demo.titlePlaceholder")}
          />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Label htmlFor="demo-input-disabled">
            {t("tokens.components.demo.disabledLabel")}
          </Label>
          <Input id="demo-input-disabled" disabled />
        </div>
      </DemoBlock>

      <DemoBlock name="field">
        <Field className="max-w-sm">
          <FieldLabel htmlFor="demo-field">
            {t("tokens.components.demo.titleLabel")}
          </FieldLabel>
          <Input
            id="demo-field"
            placeholder={t("tokens.components.demo.titlePlaceholder")}
          />
          <FieldDescription>
            {t("tokens.components.demo.fieldDescription")}
          </FieldDescription>
        </Field>
        <Field className="max-w-sm" data-invalid="true">
          <FieldLabel htmlFor="demo-field-invalid">
            {t("tokens.components.demo.invalidLabel")}
          </FieldLabel>
          <Input id="demo-field-invalid" aria-invalid />
          <FieldError>{t("tokens.components.demo.fieldError")}</FieldError>
        </Field>
      </DemoBlock>

      <DemoBlock name="textarea">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Label htmlFor="demo-textarea">
            {t("tokens.components.demo.summaryLabel")}
          </Label>
          <Textarea id="demo-textarea" />
        </div>
      </DemoBlock>

      <DemoBlock name="checkbox">
        <div className="flex items-center gap-2">
          <Checkbox id="demo-check" />
          <Label htmlFor="demo-check">
            {t("tokens.components.demo.checkboxLabel")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="demo-check-checked" defaultChecked />
          <Label htmlFor="demo-check-checked">
            {t("tokens.components.demo.checkboxCheckedLabel")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="demo-check-disabled" disabled />
          <Label htmlFor="demo-check-disabled">
            {t("tokens.components.demo.checkboxDisabledLabel")}
          </Label>
        </div>
      </DemoBlock>
    </>
  )
}

function ActionDemos() {
  const { t } = useTranslation()
  return (
    <>
      <DemoBlock name="toggle">
        <Toggle aria-label={t("tokens.components.demo.bold")}>
          <BoldIcon aria-hidden="true" />
        </Toggle>
        <Toggle aria-label={t("tokens.components.demo.italic")} defaultPressed>
          <ItalicIcon aria-hidden="true" />
        </Toggle>
        <Toggle aria-label={t("tokens.components.demo.underline")} disabled>
          <UnderlineIcon aria-hidden="true" />
        </Toggle>
      </DemoBlock>

      <DemoBlock name="toggle-group">
        <ToggleGroup defaultValue={["bold"]}>
          <ToggleGroupItem
            value="bold"
            aria-label={t("tokens.components.demo.bold")}
          >
            <BoldIcon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label={t("tokens.components.demo.italic")}
          >
            <ItalicIcon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="underline"
            aria-label={t("tokens.components.demo.underline")}
          >
            <UnderlineIcon aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </DemoBlock>

      <DemoBlock name="tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("tokens.components.demo.tooltipTrigger")}
                />
              }
            >
              <Trash2Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              {t("tokens.components.demo.tooltipTrigger")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DemoBlock>
    </>
  )
}

function AlertDialogDemo() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        {t("tokens.components.demo.delete")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("tokens.components.demo.alertDialogTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("tokens.components.demo.alertDialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("tokens.components.demo.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => setOpen(false)}
          >
            {t("tokens.components.demo.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CalendarDemo() {
  const { t, i18n } = useTranslation()
  const [date, setDate] = useState<Date | undefined>(undefined)
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      locale={i18n.resolvedLanguage?.startsWith("de") ? de : enUS}
      /* Die Locale uebersetzt nur Monats- und Wochentagsnamen; die
         ARIA-Beschriftungen der Navigation kommen aus labels und blieben
         sonst englisch. Derselbe Handgriff gilt beim echten Einsatz im
         Zeitraumfilter (KAN-40). */
      labels={{
        labelPrevious: () => t("common.calendar.previousMonth"),
        labelNext: () => t("common.calendar.nextMonth"),
      }}
      className="rounded-lg border"
    />
  )
}

function OverlayDemos() {
  const { t } = useTranslation()
  return (
    <>
      <DemoBlock name="dialog">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            {t("tokens.components.demo.dialogTrigger")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("tokens.components.demo.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("tokens.components.demo.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {t("tokens.components.demo.cancel")}
              </DialogClose>
              <DialogClose render={<Button />}>
                {t("tokens.components.demo.confirm")}
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DemoBlock>

      <DemoBlock name="alert-dialog">
        <AlertDialogDemo />
      </DemoBlock>

      <DemoBlock name="sheet">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            {t("tokens.components.demo.sheetTrigger")}
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t("tokens.components.demo.sheetTitle")}</SheetTitle>
              <SheetDescription>
                {t("tokens.components.demo.sheetDescription")}
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </DemoBlock>

      <DemoBlock name="popover">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            {t("tokens.components.demo.popoverTrigger")}
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>
                {t("tokens.components.demo.popoverTitle")}
              </PopoverTitle>
              <PopoverDescription>
                {t("tokens.components.demo.popoverBody")}
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </DemoBlock>

      <DemoBlock name="dropdown-menu">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            {t("tokens.components.demo.menuTrigger")}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{t("common.nav.profile")}</DropdownMenuItem>
            <DropdownMenuItem>{t("common.nav.logout")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              {t("tokens.components.demo.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DemoBlock>

      <DemoBlock name="command">
        <Command className="max-w-sm rounded-lg border">
          <CommandInput
            placeholder={t("tokens.components.demo.commandPlaceholder")}
          />
          <CommandList>
            <CommandEmpty>
              {t("tokens.components.demo.commandEmpty")}
            </CommandEmpty>
            <CommandGroup heading={t("tokens.components.demo.commandGroup")}>
              <CommandItem>{t("common.nav.home")}</CommandItem>
              <CommandItem>{t("common.nav.projects")}</CommandItem>
              <CommandItem>{t("common.nav.myPortfolio")}</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DemoBlock>

      <DemoBlock name="calendar">
        <CalendarDemo />
      </DemoBlock>
    </>
  )
}

function NavigationDemos() {
  const { t } = useTranslation()
  return (
    <>
      <DemoBlock name="breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("common.nav.home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/projects">
                {t("common.nav.projects")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {t("tokens.components.demo.projectTitle")}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DemoBlock>

      <DemoBlock name="pagination">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </DemoBlock>

      <DemoBlock name="tabs">
        <Tabs defaultValue="edit" className="w-full max-w-md">
          <TabsList>
            <TabsTrigger value="edit">
              {t("tokens.components.demo.tabEdit")}
            </TabsTrigger>
            <TabsTrigger value="preview">
              {t("tokens.components.demo.tabPreview")}
            </TabsTrigger>
            <TabsTrigger value="history">
              {t("tokens.components.demo.tabHistory")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <p className="type-body-sm text-muted-foreground">
              {t("tokens.components.demo.tabBody", {
                tab: t("tokens.components.demo.tabEdit"),
              })}
            </p>
          </TabsContent>
          <TabsContent value="preview">
            <p className="type-body-sm text-muted-foreground">
              {t("tokens.components.demo.tabBody", {
                tab: t("tokens.components.demo.tabPreview"),
              })}
            </p>
          </TabsContent>
          <TabsContent value="history">
            <p className="type-body-sm text-muted-foreground">
              {t("tokens.components.demo.tabBody", {
                tab: t("tokens.components.demo.tabHistory"),
              })}
            </p>
          </TabsContent>
        </Tabs>
      </DemoBlock>

      <DemoBlock name="collapsible">
        <Collapsible className="w-full max-w-sm">
          <CollapsibleTrigger render={<Button variant="outline" />}>
            {t("tokens.components.demo.collapsibleTrigger")}
            <ChevronDownIcon aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="type-body-sm p-2 text-muted-foreground">
              {t("tokens.components.demo.collapsibleBody")}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </DemoBlock>

      <DemoBlock name="navigation-menu">
        <NavigationMenu aria-label={t("common.nav.label")}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="/">
                {t("common.nav.home")}
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="/projects">
                {t("common.nav.projects")}
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </DemoBlock>
    </>
  )
}

function DataDemos() {
  const { t } = useTranslation()
  return (
    <>
      <DemoBlock name="table">
        <Table>
          <TableCaption>{t("tokens.components.demo.tableCaption")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tokens.components.demo.tableTitle")}</TableHead>
              <TableHead>{t("tokens.components.demo.tableStatus")}</TableHead>
              <TableHead>{t("tokens.components.demo.tableSemester")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{t("tokens.components.demo.projectTitle")}</TableCell>
              <TableCell>
                <StatusBadge status="PUBLISHED" />
              </TableCell>
              <TableCell>{t("tokens.components.demo.semester")}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{t("tokens.components.demo.projectTitle")}</TableCell>
              <TableCell>
                <StatusBadge status="DRAFT" />
              </TableCell>
              <TableCell>{t("tokens.components.demo.semester")}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DemoBlock>

      {/* radius-card statt der Kreisform der Registry: der offene Punkt aus
          Foundation 7 ist im Ticket auf 12px entschieden. Die Pruefflaeche
          zeigt den Avatar so, wie er in der Anwendung erscheint. */}
      <DemoBlock name="avatar">
        <Avatar size="sm" className="rounded-card after:rounded-card">
          <AvatarFallback className="rounded-card">MB</AvatarFallback>
        </Avatar>
        <Avatar className="rounded-card after:rounded-card">
          <AvatarFallback className="rounded-card">MB</AvatarFallback>
        </Avatar>
        <Avatar size="lg" className="rounded-card after:rounded-card">
          <AvatarFallback className="rounded-card">MB</AvatarFallback>
        </Avatar>
        <AvatarGroup>
          <Avatar className="rounded-card after:rounded-card">
            <AvatarFallback className="rounded-card">MB</AvatarFallback>
          </Avatar>
          <Avatar className="rounded-card after:rounded-card">
            <AvatarFallback className="rounded-card">OZ</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
      </DemoBlock>

      <DemoBlock name="badge">
        {badgeVariantNames.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </DemoBlock>

      <DemoBlock name="skeleton">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </DemoBlock>

      <DemoBlock name="scroll-area">
        <ScrollArea className="h-40 w-full max-w-sm rounded-lg border p-3">
          <div className="flex flex-col gap-3">
            <p className="type-body-sm">
              {t("tokens.components.demo.projectSummary")}
            </p>
            <p className="type-body-sm">
              {t("tokens.components.demo.projectSummary")}
            </p>
            <p className="type-body-sm">
              {t("tokens.components.demo.projectSummary")}
            </p>
          </div>
        </ScrollArea>
      </DemoBlock>

      <DemoBlock name="alert">
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertTitle>{t("tokens.components.demo.alertTitle")}</AlertTitle>
          <AlertDescription>
            {t("tokens.components.demo.alertBody")}
          </AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>
            {t("tokens.components.demo.alertDestructiveTitle")}
          </AlertTitle>
          <AlertDescription>
            {t("tokens.components.demo.alertDestructiveBody")}
          </AlertDescription>
        </Alert>
      </DemoBlock>

      <DemoBlock name="separator">
        <div className="flex w-full max-w-sm flex-col gap-3">
          <p className="type-body-sm">{t("common.nav.home")}</p>
          <Separator />
          <div className="flex h-5 items-center gap-3">
            <p className="type-body-sm">{t("common.nav.projects")}</p>
            <Separator orientation="vertical" />
            <p className="type-body-sm">{t("common.nav.myPortfolio")}</p>
          </div>
        </div>
      </DemoBlock>
    </>
  )
}

function SearchInputDemo() {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  return (
    <SearchInput
      className="w-full max-w-sm"
      value={query}
      onValueChange={setQuery}
      placeholder={t("tokens.components.demo.searchPlaceholder")}
    />
  )
}

function FilterSelectDemo() {
  const { t } = useTranslation()
  const [faculty, setFaculty] = useState<string | null>(null)
  return (
    <FilterSelect
      className="w-full max-w-sm"
      label={t("tokens.components.demo.selectLabel")}
      options={[{ value: "4", label: t("tokens.components.demo.faculty") }]}
      value={faculty}
      onValueChange={setFaculty}
    />
  )
}

function CharacterCounterDemo() {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="demo-counter-textarea">
        {t("tokens.components.demo.summaryLabel")}
      </Label>
      <Textarea
        id="demo-counter-textarea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby="demo-counter"
      />
      <CharacterCounter id="demo-counter" value={text} max={200} />
    </div>
  )
}

function DomainDemos() {
  const { t } = useTranslation()
  return (
    <>
      <DemoBlock name="NavBar">
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="type-caption text-muted-foreground">
              {t("tokens.components.demo.navbarSignedOut")}
            </p>
            <NavBar />
          </div>
          <div className="flex flex-col gap-2">
            <p className="type-caption text-muted-foreground">
              {t("tokens.components.demo.navbarSignedIn")}
            </p>
            <NavBar
              user={{
                firstName: t("tokens.components.demo.userFirstName"),
                lastName: t("tokens.components.demo.userLastName"),
              }}
              onLogout={() => {}}
            />
          </div>
        </div>
      </DemoBlock>

      <DemoBlock name="Footer">
        <div className="w-full">
          <Footer />
        </div>
      </DemoBlock>

      <DemoBlock name="SearchInput">
        <SearchInputDemo />
      </DemoBlock>

      <DemoBlock name="FilterSelect">
        <FilterSelectDemo />
      </DemoBlock>

      <DemoBlock name="ProjectCard">
        <ProjectCardDemos />
      </DemoBlock>

      <DemoBlock name="KpiTile">
        <KpiTile
          value={128}
          label={t("tokens.components.demo.kpiPublished")}
          className="w-44"
        />
        <KpiTile
          value={5}
          label={t("tokens.components.demo.kpiFaculties")}
          className="w-44"
        />
      </DemoBlock>

      <DemoBlock name="StatusBadge">
        {projectStatuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </DemoBlock>

      <DemoBlock name="RoleBadge">
        {roles.map((role) => (
          <RoleBadge key={role} role={role} />
        ))}
      </DemoBlock>

      <DemoBlock name="Tag">
        <Tag>{t("tokens.components.demo.category")}</Tag>
        <Tag>{t("tokens.components.demo.module")}</Tag>
        <Tag>{t("tokens.components.demo.program")}</Tag>
        <Tag>{t("tokens.components.demo.faculty")}</Tag>
      </DemoBlock>

      <DemoBlock name="EmptyState">
        <EmptyState
          className="w-full"
          icon={<SearchIcon aria-hidden="true" />}
          title={t("tokens.components.demo.emptyTitle")}
          description={t("tokens.components.demo.emptyDescription")}
          action={
            <Button variant="outline">
              {t("tokens.components.demo.emptyAction")}
            </Button>
          }
        />
      </DemoBlock>

      <DemoBlock name="CharacterCounter">
        <CharacterCounterDemo />
      </DemoBlock>
    </>
  )
}

function ProjectCardDemos() {
  const { t } = useTranslation()
  return (
    <>
      <ProjectCard
        className="w-full max-w-sm"
        title={t("tokens.components.demo.projectTitle")}
        summary={t("tokens.components.demo.projectSummary")}
        status="PUBLISHED"
        faculty={t("tokens.components.demo.faculty")}
        semester={t("tokens.components.demo.semester")}
        href="#"
      />
      <ProjectCard
        className="w-full max-w-sm"
        title={t("tokens.components.demo.projectTitle")}
        summary={t("tokens.components.demo.projectSummary")}
        faculty={t("tokens.components.demo.faculty")}
        semester={t("tokens.components.demo.semester")}
      />
    </>
  )
}

/**
 * Komponentenbibliothek auf der Pruefflaeche (KAN-29, Abschnitt 3): jede
 * per CLI erzeugte Primitive und jede Domaenenkomponente einmal sichtbar,
 * mit Inaktiv-, Fehler- und Ladezustand, wo es sie gibt. Hover und Fokus
 * entstehen beim Bedienen. Titel und Einleitung stellt die Seite
 * (ComponentGalleryPage); hier beginnen die Ueberschriften deshalb bei h2.
 */
export function ComponentGallery() {
  const { t } = useTranslation()
  const groups: { id: string; content: ReactNode }[] = [
    { id: "form", content: <FormDemos /> },
    { id: "actions", content: <ActionDemos /> },
    { id: "overlay", content: <OverlayDemos /> },
    { id: "navigation", content: <NavigationDemos /> },
    { id: "data", content: <DataDemos /> },
    { id: "domain", content: <DomainDemos /> },
  ]
  return (
    <section className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-3">
          <h2 className="type-h1">{t(`tokens.components.group.${group.id}`)}</h2>
          <div className="flex flex-col gap-4">{group.content}</div>
        </div>
      ))}
    </section>
  )
}
