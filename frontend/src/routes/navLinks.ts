import type { Role } from "@/api/types"
import type { NavBarLink } from "@/components/layout/NavBar"

/**
 * Navigationseintraege je Zugriffsebene (Ticket KAN-7, Umfang 5). Die
 * Entscheidung faellt im Anwendungsrahmen und nicht in der NavBar: die
 * Leiste stellt nur dar, was der Rahmen ihr gibt.
 *
 * Aufteilung nach dem Figma-Template (Review zu KAN-8): oben in der Leiste
 * stehen Startseite und Projekte fuer alle, dazu je Rolle der eigene
 * Bereich (Mein Portfolio, Meine Reviews, Administration). "Neues Projekt"
 * ist kein Leisteneintrag, sondern liegt im Nutzermenue (userMenuFor).
 *
 * Sichtbarkeit ist Bequemlichkeit, keine Sicherheitsmassnahme (Contract 5):
 * ein Admin-Konto sieht kein "Neues Projekt", weil POST /projects ihm mit
 * 403 antwortet (Fussnote 10). Redakteur:innen sehen beides, Reviews und
 * den eigenen Bereich, denn die Ebenen schliessen einander nicht aus.
 */
export function navLinksFor(role: Role | null): NavBarLink[] {
  const links: NavBarLink[] = [
    { key: "home", href: "/" },
    { key: "projects", href: "/projects" },
  ]
  if (role === "EDITOR") {
    links.push({ key: "reviews", href: "/reviews" })
  }
  if (role === "STUDENT" || role === "EDITOR") {
    links.push({ key: "myPortfolio", href: "/my-portfolio" })
  }
  if (role === "ADMIN") {
    links.push({ key: "administration", href: "/administration" })
  }
  return links
}

/**
 * Eintraege des Nutzermenues in der Kopfleiste, in der Reihenfolge des
 * Figma-Templates. Abmelden haengt nicht hier, sondern fest in der NavBar:
 * es ist eine Aktion und kein Routenziel.
 *
 * "Mein Portfolio" ersetzt den frueheren Eintrag "Profil": das Template
 * kennt keinen eigenen Profil-Punkt, das Profil wird im Portfolio gepflegt.
 */
export function userMenuFor(role: Role | null): NavBarLink[] {
  switch (role) {
    case "STUDENT":
      return [
        { key: "myPortfolio", href: "/my-portfolio" },
        { key: "newProject", href: "/projects/new" },
      ]
    case "EDITOR":
      return [
        { key: "reviews", href: "/reviews" },
        { key: "myPortfolio", href: "/my-portfolio" },
        { key: "newProject", href: "/projects/new" },
      ]
    case "ADMIN":
      return [{ key: "administration", href: "/administration" }]
    default:
      return []
  }
}
