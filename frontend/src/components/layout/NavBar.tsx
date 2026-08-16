import {
  ChartColumnIcon,
  ChevronDownIcon,
  CircleUserIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { Role } from "@/api/types"
import { HsbKeyLogo } from "@/components/common/HsbKeyLogo"
import { LanguageToggle } from "@/components/common/LanguageToggle"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { fullNameOf, type PersonName } from "@/lib/name"
import { cn } from "@/lib/utils"

export interface NavBarUser extends PersonName {
  avatarUrl?: string
}

/**
 * Ein Navigationseintrag: der key adressiert die Beschriftung unter
 * common.nav.*, der href den Routenbaum aus KAN-7.
 */
export interface NavBarLink {
  key: string
  href: string
}

/**
 * Symbol je Menuepunkt des Nutzermenues (Figma "Nav Bar", Dropdown). Die
 * Zuordnung ist Darstellung und liegt deshalb hier und nicht in navLinks.ts;
 * ein Eintrag ohne Zeile erscheint schlicht ohne Symbol.
 */
const menuIcons: Record<string, LucideIcon> = {
  reviews: ChartColumnIcon,
  myPortfolio: CircleUserIcon,
  newProject: PlusIcon,
  administration: ShieldCheckIcon,
}

/*
 * Der Fokusring der Grundregel zeigt auf --ring, also blau/600. Auf der
 * Verlaufsleiste liegt derselbe Blauton auf blauem Grund und erreicht die
 * 3:1 aus SC 1.4.11 nicht. Fuer Logo, Umschalter und Schaltflaechen zeichnet
 * der Ring deshalb in nav-foreground; die Textlinks der Navigation zeigen
 * ihren Fokus stattdessen ueber die Unterstreichung (siehe unten), ein
 * weisser Kasten um weissen Text war der Befund aus dem Review zu KAN-8.
 *
 * outline-solid ist der Kern und keine Zugabe. Fast alle Ziele hier tragen
 * ueber buttonVariants ein unbedingtes outline-none, und das setzt
 * --tw-outline-style auf none. Eine Klasse, die nur die Farbe (oder nur die
 * Breite) setzt, zeichnet dann gar nichts: die Utility-Ebene schlaegt die
 * Grundregel aus @layer base, und uebrig bliebe allein der ring in --ring,
 * also genau der Blauton, dessen Kontrast auf der Leiste nicht reicht.
 * Nachgeprueft wird das im gebauten CSS, nicht im Kopf: eine wirkungslose
 * Fokusregel erzeugt weder Fehler noch Warnung noch roten Test.
 */
const navFocus =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-foreground"

const navGhost =
  "text-nav-foreground hover:bg-nav-foreground/10 hover:text-nav-foreground"

/**
 * Kopfleiste der Anwendung (Figma "Nav Bar").
 *
 * Sie unterscheidet angemeldet und nicht angemeldet (API-Contract 2.1):
 * ohne Nutzer erscheint nach Template allein "Anmelden" (der Weg zur
 * Registrierung fuehrt ueber die Login-Seite), mit Nutzer das Nutzermenue
 * aus Rollenbeschriftung, rollenabhaengigen Eintraegen und Abmelden.
 * PUBLIC ist dabei keine Rolle, sondern genau dieser Zustand.
 *
 * Der Umschalter fuer den dunklen Modus bleibt bewusst stehen, obwohl das
 * Template ihn nicht fuehrt (Entscheidung im Review zu KAN-8).
 *
 * Reine Darstellung: welche Eintraege zur Rolle passen, entscheidet der
 * Anwendungsrahmen (KAN-7, Umfang 5) und gibt sie als links und menuItems
 * herein; die Leiste waehlt nicht selbst. Navigiert wird ueber react-router,
 * die Primitiven nehmen den Link ueber ihre render-Prop auf. Auf schmalen
 * Bildschirmen uebernimmt das Sheet die Navigation; es ist kontrolliert,
 * weil ein SPA-Link die Seite nicht neu laedt und das Sheet sonst offen
 * stehen bliebe. Die Menueschaltflaeche traegt einen zugaenglichen Namen,
 * weil sie nur ein Symbol zeigt.
 */
export function NavBar({
  user = null,
  role = null,
  links,
  menuItems = [],
  activeHref,
  onLogout,
}: {
  user?: NavBarUser | null
  /** Rolle der angemeldeten Person, fuer die Beschriftung des Nutzermenues. */
  role?: Role | null
  links: NavBarLink[]
  /** Eintraege des Nutzermenues (userMenuFor); ohne Nutzer ohne Wirkung. */
  menuItems?: NavBarLink[]
  activeHref?: string
  onLogout?: () => void
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  /* Das Sheet zeigt zusaetzlich die Menuepunkte, die oben nur im Dropdown
     liegen (Neues Projekt): auf schmalen Bildschirmen gibt es das Dropdown
     nicht als zweite Ebene neben dem Sheet. */
  const sheetLinks = [
    ...links,
    ...menuItems.filter((item) => links.every((link) => link.key !== item.key)),
  ]

  return (
    <header className="surface-nav">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        {/* Ein Link mit zwei Zeilen, aber einem Namen: vorgelesen wird der
            Projektname, sichtbar bleibt die Zweiteilung aus dem Design. */}
        <Link
          to="/"
          aria-label={t("app.name")}
          className={cn("flex items-center gap-3", navFocus)}
        >
          <HsbKeyLogo className="h-8 w-auto shrink-0" />
          <span aria-hidden="true" className="flex flex-col">
            <span className="type-nav-brand font-semibold">
              {t("app.institution")}
            </span>
            <span className="type-label-xs font-semibold uppercase opacity-80">
              {t("app.productLabel")}
            </span>
          </span>
        </Link>

        <NavigationMenu
          aria-label={t("common.nav.label")}
          className="max-md:hidden"
        >
          <NavigationMenuList className="gap-6">
            {links.map((link) => {
              const active = link.href === activeHref
              return (
                <NavigationMenuItem key={link.key}>
                  <NavigationMenuLink
                    render={<Link to={link.href} />}
                    /* aria-current traegt die Markierung fuer alle, die die
                       Unterstreichung nicht sehen (SC 1.4.1). */
                    aria-current={active ? "page" : undefined}
                    /* focus:bg-transparent hebt das focus:bg-muted der
                       Registry auf: nach einem Klick stuende sonst eine
                       helle Pille hinter weissem Text (Befund im Review zu
                       KAN-8). Den Tastaturfokus zeigt die Unterstreichung,
                       wie beim aktiven Eintrag im Template (SC 2.4.7); der
                       Ring der Registry faellt deshalb hier weg. */
                    className={cn(
                      "group/navlink type-nav-item flex flex-col gap-1 bg-transparent font-semibold text-nav-foreground hover:bg-transparent hover:text-nav-foreground focus:bg-transparent focus:text-nav-foreground focus-visible:ring-0 focus-visible:outline-none",
                      active ? "opacity-100" : "opacity-80 hover:opacity-100"
                    )}
                  >
                    {t(`common.nav.${link.key}`)}
                    {/* Der Balken ist zugleich der Fokusindikator: bei nicht
                        aktiven Eintraegen erscheint er mit dem Fokus, beim
                        aktiven steht er ohnehin da und bekaeme sonst keinerlei
                        sichtbare Aenderung (SC 2.4.7, Befund aus dem Review).
                        Deshalb zeichnet der Fokus zusaetzlich einen schmalen
                        Rahmen um den Balken selbst, keinen Kasten um den
                        weissen Text. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-0.75 rounded-pill bg-nav-foreground",
                        "group-focus-visible/navlink:outline-solid group-focus-visible/navlink:outline-2 group-focus-visible/navlink:outline-offset-2 group-focus-visible/navlink:outline-nav-foreground",
                        !active &&
                          "invisible group-focus-visible/navlink:visible"
                      )}
                    />
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )
            })}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2">
          <LanguageToggle className={cn(navGhost, "max-md:hidden", navFocus)} />
          <ThemeToggle className={cn(navGhost, "max-md:hidden", navFocus)} />
          <Separator
            orientation="vertical"
            className="h-5 bg-nav-foreground/40 max-md:hidden"
          />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className={cn("gap-2.5", navGhost, navFocus)}
                  />
                }
              >
                {/* Ohne bg-card: die Wurzel des Avatars ist immer
                    vollstaendig von Bild oder Initialenflaeche verdeckt, eine
                    Hintergrundfarbe dort ist nie zu sehen. */}
                <UserAvatar person={user} imageUrl={user.avatarUrl} />
                {/* sr-only statt hidden: auf schmalen Bildschirmen bleibt
                    sichtbar nur das Kuerzel, aber der Name muss im
                    zugaenglichen Namen der Schaltflaeche stehen. Sonst
                    hiesse sie dort nur "Pfeil nach unten". */}
                <span className="max-sm:sr-only">{fullNameOf(user)}</span>
                <ChevronDownIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56 p-2">
                <DropdownMenuGroup>
                  {/* Das Template beschriftet das Menue mit der Rolle, nicht
                      mit dem Namen: der steht schon auf der Schaltflaeche. */}
                  {role && (
                    <DropdownMenuLabel className="type-label-xs tracking-widest uppercase">
                      {t(`user.role.${role}`)}
                    </DropdownMenuLabel>
                  )}
                  {menuItems.map((item) => {
                    const Icon = menuIcons[item.key]
                    return (
                      <DropdownMenuItem
                        key={item.key}
                        render={<Link to={item.href} />}
                        className="gap-2 py-2"
                      >
                        {Icon && <Icon aria-hidden="true" />}
                        {t(`common.nav.${item.key}`)}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={onLogout}
                    className="gap-2 py-2"
                  >
                    <LogOutIcon aria-hidden="true" />
                    {t("common.nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            /* Ein Link, der wie ein Button aussieht, bleibt ein Link: die
               Anmeldung fuehrt auf eine Seite und faellt fuer Screenreader
               in die Linkliste. secondary statt default, weil die blaue
               Primaerfarbe auf der blauen Leiste kaum absteht. Die
               Registrierung hat nach Template keinen eigenen Button mehr;
               ihr Weg fuehrt ueber die Login-Seite. */
            <Link
              to="/login"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "max-md:hidden",
                navFocus
              )}
            >
              {t("common.nav.login")}
            </Link>
          )}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.nav.openMenu")}
                  className={cn(navGhost, "md:hidden", navFocus)}
                />
              }
            >
              <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>{t("app.name")}</SheetTitle>
              </SheetHeader>
              <nav
                aria-label={t("common.nav.label")}
                className="flex flex-col gap-1 px-4"
              >
                {sheetLinks.map((link) => (
                  <Link
                    key={link.key}
                    to={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={link.href === activeHref ? "page" : undefined}
                    className="rounded-control px-2 py-2 hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
                  >
                    {t(`common.nav.${link.key}`)}
                  </Link>
                ))}
              </nav>
              <Separator />
              <div className="flex flex-col gap-3 px-4">
                <div className="flex items-center gap-2">
                  <LanguageToggle />
                  <ThemeToggle />
                </div>
                {!user && (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className={cn(buttonVariants(), "w-full")}
                  >
                    {t("common.nav.login")}
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
