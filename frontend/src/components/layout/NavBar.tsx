import {
  ChartColumnIcon,
  ChevronDownIcon,
  CircleUserIcon,
  LifeBuoyIcon,
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
 * Symbol je Menuepunkt (Figma "Nav Bar", Dropdown). Dieselbe Tabelle bedient
 * das Nutzermenue der breiten Leiste und das Sheet, damit ein Eintrag in
 * beiden Breiten gleich aussieht. Die Zuordnung ist Darstellung und liegt
 * deshalb hier und nicht in navLinks.ts; ein Eintrag ohne Zeile erscheint
 * schlicht ohne Symbol.
 */
const menuIcons: Record<string, LucideIcon> = {
  reviews: ChartColumnIcon,
  myPortfolio: CircleUserIcon,
  newProject: PlusIcon,
  administration: ShieldCheckIcon,
  support: LifeBuoyIcon,
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

/*
 * Die Ghost-Variante bringt aus der Registry hover:bg-muted und
 * aria-expanded:bg-muted mit. Die Hover-Zeile faengt tailwind-merge ab, die
 * zweite nicht: es ist eine eigene Variante, und ohne Gegenstueck blieb die
 * Schaltflaeche hell und der Text dunkel, solange das Nutzermenue offen war
 * (Befund aus dem Review). Auf der blauen Leiste sah das aus wie ein
 * weisser Kasten, der erst beim Schliessen verschwindet. Beide Zustaende
 * zeigen deshalb dieselbe leichte Aufhellung wie der Hover.
 */
const navGhost =
  "text-nav-foreground hover:bg-nav-foreground/10 hover:text-nav-foreground aria-expanded:bg-nav-foreground/10 aria-expanded:text-nav-foreground"

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
 * die Primitiven nehmen den Link ueber ihre render-Prop auf.
 *
 * Zwei Breiten, zwei Anordnungen, und die schmale kennt genau ein Menue:
 * unterhalb von md verschwinden Nutzermenue und Anmeldung aus der Leiste,
 * das Sheet fuehrt dann alles, also Navigationseintraege, Nutzermenuepunkte,
 * die angemeldete Person und Abmelden. Zwei aufklappbare Ebenen
 * nebeneinander waren der Befund; welcher der beiden Knoepfe welchen Teil
 * der Anwendung oeffnet, ist ohne Ausprobieren nicht zu erkennen.
 *
 * Sprache und Modus bleiben in beiden Breiten aussen an derselben Stelle
 * stehen. Sie sind Umschalter mit sofortiger Wirkung und keine
 * Navigationsziele; laegen sie im Sheet, kostete ein Moduswechsel zwei
 * Klicks und das Schliessen.
 *
 * Das Sheet ist kontrolliert, weil ein SPA-Link die Seite nicht neu laedt
 * und es sonst offen stehen bliebe. Die Menueschaltflaeche traegt einen
 * zugaenglichen Namen, weil sie nur ein Symbol zeigt.
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
     nicht als zweite Ebene neben dem Sheet. Eintraege, die in beiden Listen
     stehen (Mein Portfolio), erscheinen dabei nur einmal. */
  const sheetLinks = [
    ...links,
    ...menuItems.filter((item) => links.every((link) => link.key !== item.key)),
  ]

  return (
    <header className="surface-nav">
      {/* h-nav statt h-16: dieselbe Hoehe steht auf der Startseite noch
          einmal, dort als Abzug von der Fensterhoehe (KAN-80). Das Mass
          liegt deshalb als --spacing-nav in index.css und nicht als Zahl an
          zwei Orten. */}
      <div className="mx-auto flex h-nav max-w-6xl items-center justify-between gap-4 px-4">
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
                    /* items-stretch hebt das items-center der Registry auf,
                       und daran haengt der ganze Balken: quer zur Spalte
                       zentriert schrumpft ein leeres span auf Breite null,
                       die Linie war also da und nur unsichtbar (Befund aus
                       dem Review). Erst gestreckt nimmt sie die Breite der
                       Beschriftung an. */
                    className={cn(
                      "group/navlink type-nav-item flex flex-col items-stretch gap-1 bg-transparent font-semibold text-nav-foreground hover:bg-transparent hover:text-nav-foreground focus:bg-transparent focus:text-nav-foreground focus-visible:ring-0 focus-visible:outline-none",
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
                        "group-focus-visible/navlink:outline-2 group-focus-visible/navlink:outline-offset-2 group-focus-visible/navlink:outline-nav-foreground group-focus-visible/navlink:outline-solid",
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
          {/* Sprache und Modus stehen in jeder Breite an derselben Stelle,
              also links neben dem Nutzermenue bzw. neben der
              Menueschaltflaeche, und wandern nicht ins Sheet: es sind
              Umschalter mit sofortiger Wirkung, keine Navigationsziele, und
              zwei Klicks (Menue oeffnen, dann umschalten) fuer einen
              Moduswechsel waren der Befund. */}
          <LanguageToggle className={cn(navGhost, navFocus)} />
          <ThemeToggle className={cn(navGhost, navFocus)} />
          {/* data-vertical:self-center hebt das self-stretch der Primitive
              auf, und ohne diese Zeile sitzt der Strich sichtbar zu hoch:
              align-self: stretch verhaelt sich wie flex-start, sobald das
              Element eine feste Hoehe hat, und h-5 ist genau das. Der Strich
              haengt dann am oberen Rand der Zeile statt in ihrer Mitte
              (Befund aus dem Review). Dieselbe Variante wie in der Registry
              ist noetig, damit tailwind-merge die beiden als denselben
              Konflikt erkennt; ein blosses self-center stuende daneben und
              verloere gegen das Attributselektor. */}
          <Separator
            orientation="vertical"
            className="h-5 bg-nav-foreground/40 data-vertical:self-center"
          />

          {/* Auf schmalen Bildschirmen fuehrt genau ein Menue: das Sheet.
              Das Nutzermenue und die Anmeldung liegen deshalb dort und
              nicht zusaetzlich als zweite Ebene in der Leiste. */}
          <div className="max-md:hidden">
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
                      vollstaendig von Bild oder Initialenflaeche verdeckt,
                      eine Hintergrundfarbe dort ist nie zu sehen. 28px nach
                      Template (Figma-Knoten der NavBar). */}
                  <UserAvatar
                    person={user}
                    imageUrl={user.avatarUrl}
                    size="md"
                  />
                  <span>{fullNameOf(user)}</span>
                  <ChevronDownIcon aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56 p-2">
                  <DropdownMenuGroup>
                    {/* Das Template beschriftet das Menue mit der Rolle,
                        nicht mit dem Namen: der steht schon auf der
                        Schaltflaeche. */}
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
                  navFocus
                )}
              >
                {t("common.nav.login")}
              </Link>
            )}
          </div>

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

              {/* Wer angemeldet ist, steht im Sheet und nicht mehr daneben in
                  der Leiste: auf schmalen Bildschirmen fuehrt genau ein
                  Menue. Der Name ist hier eine Angabe und keine
                  Schaltflaeche, deshalb steht er als Text und nicht als
                  Ausloeser einer zweiten Ebene. */}
              {user && (
                <div className="flex items-center gap-2.5 px-4">
                  {/* Dieselbe Stufe wie in der Leiste darueber. */}
                  <UserAvatar
                    person={user}
                    imageUrl={user.avatarUrl}
                    size="md"
                  />
                  <span className="flex flex-col">
                    <span className="type-body-sm font-medium">
                      {fullNameOf(user)}
                    </span>
                    {role && (
                      <span className="type-label-xs tracking-widest text-muted-foreground uppercase">
                        {t(`user.role.${role}`)}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <nav
                aria-label={t("common.nav.label")}
                className="flex flex-col gap-1 px-4"
              >
                {sheetLinks.map((link) => {
                  const Icon = menuIcons[link.key]
                  return (
                    <Link
                      key={link.key}
                      to={link.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={
                        link.href === activeHref ? "page" : undefined
                      }
                      className="flex items-center gap-2 rounded-control px-2 py-2 hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
                    >
                      {Icon && <Icon aria-hidden="true" />}
                      {t(`common.nav.${link.key}`)}
                    </Link>
                  )
                })}
              </nav>

              <Separator />

              {/* Abmelden ist eine Aktion und kein Routenziel, steht deshalb
                  unter dem Trenner und nicht in der Navigationsliste. */}
              <div className="flex flex-col gap-3 px-4">
                {user ? (
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout?.()
                    }}
                  >
                    <LogOutIcon aria-hidden="true" />
                    {t("common.nav.logout")}
                  </Button>
                ) : (
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
