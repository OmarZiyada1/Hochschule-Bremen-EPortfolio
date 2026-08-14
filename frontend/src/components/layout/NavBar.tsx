import { MenuIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { cn } from "@/lib/utils"

export interface NavBarUser {
  firstName: string
  lastName: string
  avatarUrl?: string
}

function initialsOf(user: NavBarUser): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

/**
 * Kopfleiste der Anwendung. Sie unterscheidet angemeldet und nicht
 * angemeldet (API-Contract 2.1): ohne Nutzer erscheinen die oeffentlichen
 * Eintraege und die Anmeldung, mit Nutzer zusaetzlich das Portfolio und das
 * Nutzermenue. PUBLIC ist dabei keine Rolle, sondern genau dieser Zustand;
 * welche Rolle der Nutzer hat, entscheidet hier nichts, das ist Sache der
 * Seiten und der Rechtematrix.
 *
 * Reine Darstellung: wer angemeldet ist, sagt der Aufrufer ueber Props
 * (KAN-7 bindet die Leiste an den Anwendungsrahmen an). Auf schmalen
 * Bildschirmen uebernimmt das Sheet die Navigation; die Menueschaltflaeche
 * traegt einen zugaenglichen Namen, weil sie nur ein Symbol zeigt.
 */
export function NavBar({
  user = null,
  onLogout,
}: {
  user?: NavBarUser | null
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
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="/" className="type-h3 whitespace-nowrap">
          {t("app.name")}
        </a>

        <NavigationMenu
          aria-label={t("common.nav.label")}
          className="max-md:hidden"
        >
          <NavigationMenuList>
            {links.map((link) => (
              <NavigationMenuItem key={link.key}>
                <NavigationMenuLink href={link.href}>
                  {t(`common.nav.${link.key}`)}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("common.nav.userMenu")}
                  />
                }
              >
                {/* radius-card statt der Kreisform der Registry: der offene
                    Punkt aus Foundation 7 ist im Ticket auf 12px entschieden.
                    Der Eingriff laeuft ueber className, die generierte Datei
                    bleibt unveraendert. */}
                <Avatar className="rounded-card after:rounded-card">
                  {user.avatarUrl && (
                    /* alt bleibt leer: der zugaengliche Name kommt von der
                       Schaltflaeche, ein zweiter Name daneben wuerde doppelt
                       vorgelesen. */
                    <AvatarImage
                      className="rounded-card"
                      src={user.avatarUrl}
                      alt=""
                    />
                  )}
                  <AvatarFallback className="rounded-card">
                    {initialsOf(user)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {user.firstName} {user.lastName}
                  </DropdownMenuLabel>
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
               in die Linkliste. */
            <a
              href="/login"
              className={cn(buttonVariants(), "max-md:hidden")}
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
                  className="md:hidden"
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
                    className="rounded-control px-2 py-2 hover:bg-muted"
                  >
                    {t(`common.nav.${link.key}`)}
                  </a>
                ))}
              </nav>
              {!user && (
                <>
                  <Separator />
                  <div className="px-4">
                    <a
                      href="/login"
                      className={cn(buttonVariants(), "w-full")}
                    >
                      {t("common.nav.login")}
                    </a>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
