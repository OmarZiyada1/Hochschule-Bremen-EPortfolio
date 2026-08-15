import type { Role } from "@/api/types"
import type { NavBarLink } from "@/components/layout/NavBar"

/**
 * Navigationseintraege je Zugriffsebene (Ticket KAN-7, Umfang 5). Die
 * Entscheidung faellt im Anwendungsrahmen und nicht in der NavBar: die
 * Leiste stellt nur dar, was der Rahmen ihr gibt.
 *
 * Sichtbarkeit ist Bequemlichkeit, keine Sicherheitsmassnahme (Contract 5):
 * ein Admin-Konto sieht kein "Neues Projekt", weil POST /projects ihm mit
 * 403 antwortet (Fussnote 10); sein Profil pflegt es weiter ueber das
 * Nutzermenue. Redakteur:innen sehen beides, Reviews und den eigenen
 * Bereich, denn die Ebenen schliessen einander nicht aus.
 */
export function navLinksFor(role: Role | null): NavBarLink[] {
  const links: NavBarLink[] = [
    { key: "home", href: "/" },
    { key: "projects", href: "/projects" },
  ]
  if (role === "STUDENT" || role === "EDITOR") {
    links.push({ key: "myPortfolio", href: "/my-portfolio" })
  }
  if (role === "EDITOR") {
    links.push({ key: "reviews", href: "/reviews" })
  }
  if (role === "STUDENT" || role === "EDITOR") {
    links.push({ key: "newProject", href: "/projects/new" })
  }
  if (role === "ADMIN") {
    links.push({ key: "administration", href: "/administration" })
  }
  return links
}
