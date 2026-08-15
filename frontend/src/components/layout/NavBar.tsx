import { ChevronDownIcon, MenuIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { HsbKeyLogo } from "@/components/common/HsbKeyLogo"
import { LanguageToggle } from "@/components/common/LanguageToggle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

/*
 * Der Fokusring der Grundregel zeigt auf --ring, also blau/600. Auf der
 * Verlaufsleiste liegt derselbe Blauton auf blauem Grund und erreicht die
 * 3:1 aus SC 1.4.11 nicht. Innerhalb der Leiste zeichnet der Ring deshalb in
 * nav-foreground; ausserhalb bleibt alles wie gehabt.
 *
 * outline-solid ist der Kern und keine Zugabe. Fast alle Ziele hier tragen
 * ueber buttonVariants oder navigationMenuTriggerStyle ein unbedingtes
 * outline-none, und das setzt --tw-outline-style auf none. Eine Klasse, die
 * nur die Farbe (oder nur die Breite) setzt, zeichnet dann gar nichts: die
 * Utility-Ebene schlaegt die Grundregel aus @layer base, und uebrig bliebe
 * allein der ring in --ring, also genau der Blauton, dessen Kontrast auf der
 * Leiste nicht reicht. outline-solid stellt den Stil wieder her.
 * Nachgeprueft wird das im gebauten CSS, nicht im Kopf: eine wirkungslose
 * Fokusregel erzeugt weder Fehler noch Warnung noch roten Test.
 */
const navFocus =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-foreground"

/**
 * Kopfleiste der Anwendung (Figma "Nav Bar").
 *
 * Sie unterscheidet angemeldet und nicht angemeldet (API-Contract 2.1):
 * ohne Nutzer erscheinen die oeffentlichen Eintraege und die Anmeldung, mit
 * Nutzer zusaetzlich das Portfolio und das Nutzermenue. PUBLIC ist dabei
 * keine Rolle, sondern genau dieser Zustand; welche Rolle der Nutzer hat,
 * entscheidet hier nichts, das ist Sache der Seiten und der Rechtematrix.
 *
 * Reine Darstellung: wer angemeldet ist und welcher Eintrag der aktuelle
 * ist, sagt der Aufrufer ueber Props (KAN-7 bindet die Leiste an den
 * Anwendungsrahmen an und kennt dort die Route). Auf schmalen Bildschirmen
 * uebernimmt das Sheet die Navigation; die Menueschaltflaeche traegt einen
 * zugaenglichen Namen, weil sie nur ein Symbol zeigt.
 */
export function NavBar({
  user = null,
  activeHref,
  onLogout,
}: {
  user?: NavBarUser | null
  activeHref?: string
  onLogout?: () => void
}) {
  const { t } = useTranslation()
  /* Die Pfade folgen dem Routenbaum aus KAN-7 (englisch, dort verbindlich
     festgelegt); die Routen selbst entstehen erst mit KAN-7. */
  const links = [
    { key: "home", href: "/" },
    { key: "projects", href: "/projects" },
    ...(user ? [{ key: "myPortfolio", href: "/my-portfolio" }] : []),
  ]

  return (
    <header className="surface-nav">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        {/* Ein Link mit zwei Zeilen, aber einem Namen: vorgelesen wird der
            Projektname, sichtbar bleibt die Zweiteilung aus dem Design. */}
        <a
          href="/"
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
        </a>

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
                    href={link.href}
                    /* aria-current traegt die Markierung fuer alle, die die
                       Unterstreichung nicht sehen (SC 1.4.1). */
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "type-nav-item flex flex-col gap-1 bg-transparent font-semibold text-nav-foreground hover:bg-transparent",
                      active ? "opacity-100" : "opacity-80 hover:opacity-100",
                      navFocus
                    )}
                  >
                    {t(`common.nav.${link.key}`)}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-0.75 rounded-pill bg-nav-foreground",
                        !active && "invisible"
                      )}
                    />
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )
            })}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2">
          <LanguageToggle
            className={cn(
              "text-nav-foreground hover:bg-nav-foreground/10 hover:text-nav-foreground max-md:hidden",
              navFocus
            )}
          />
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
                    className={cn(
                      "gap-2.5 text-nav-foreground hover:bg-nav-foreground/10 hover:text-nav-foreground",
                      navFocus
                    )}
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
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{fullNameOf(user)}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<a href="/my-portfolio/profile" />}>
                    {t("common.nav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout}>
                    {t("common.nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            /* Ein Link, der wie ein Button aussieht, bleibt ein Link: die
               Anmeldung fuehrt auf eine Seite und faellt fuer Screenreader
               in die Linkliste. secondary statt default, weil die blaue
               Primaerfarbe auf der blauen Leiste kaum absteht. */
            <a
              href="/login"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "max-md:hidden",
                navFocus
              )}
            >
              {t("common.nav.login")}
            </a>
          )}

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.nav.openMenu")}
                  className={cn(
                    "text-nav-foreground hover:bg-nav-foreground/10 hover:text-nav-foreground md:hidden",
                    navFocus
                  )}
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
                {links.map((link) => (
                  <a
                    key={link.key}
                    href={link.href}
                    aria-current={link.href === activeHref ? "page" : undefined}
                    className="rounded-control px-2 py-2 hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
                  >
                    {t(`common.nav.${link.key}`)}
                  </a>
                ))}
              </nav>
              <Separator />
              <div className="flex items-center justify-between gap-2 px-4">
                <LanguageToggle />
                {!user && (
                  <a href="/login" className={cn(buttonVariants(), "flex-1")}>
                    {t("common.nav.login")}
                  </a>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
