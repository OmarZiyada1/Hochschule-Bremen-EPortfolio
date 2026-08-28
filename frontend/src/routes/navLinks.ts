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
 * Sichtbarkeit ist Bequemlichkeit, keine Sicherheitsmassnahme (Contract 5);
 * verbindlich prueft der Server. Die Ebenen schliessen einander nicht aus:
 * seit KAN-82 ist ADMIN die Obermenge und traegt deshalb alles, was ein
 * Konto mit EDITOR traegt, dazu die Administration. Ein Konto, das
 * redaktionell arbeitet und zusaetzlich verwaltet, verliert damit beim
 * Rollenwechsel weder sein Portfolio noch die Reviews. Der Preis ist
 * bewusst in Kauf genommen: auch ein reines Verwaltungskonto sieht die
 * beiden Eintraege, ohne sie je zu benutzen.
 */
export function navLinksFor(role: Role | null): NavBarLink[] {
  const links: NavBarLink[] = [
    { key: "home", href: "/" },
    { key: "projects", href: "/projects" },
  ]
  if (role === "EDITOR" || role === "ADMIN") {
    links.push({ key: "reviews", href: "/reviews" })
  }
  if (role !== null) {
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
 * Das ist zugleich der einzige Weg, auf dem ein Konto seinen eigenen Namen
 * und Avatar pflegt (§3.2), und er steht seit KAN-82 auch einem
 * Admin-Konto offen.
 *
 * "Kontakt & Support" steht seit KAN-85 als letzter Eintrag in jeder Rolle.
 * Bewusst am Ende und bewusst ueberall: Hilfe ist kein Arbeitsziel, das man
 * oben sucht, aber sie darf keiner Rolle fehlen. Der zweite Einstieg liegt
 * in der Fusszeile und erreicht auch, wer nicht angemeldet ist.
 */
const SUPPORT_ENTRY: NavBarLink = { key: "support", href: "/support" }

export function userMenuFor(role: Role | null): NavBarLink[] {
  switch (role) {
    case "STUDENT":
      return [
        { key: "myPortfolio", href: "/my-portfolio" },
        { key: "newProject", href: "/projects/new" },
        SUPPORT_ENTRY,
      ]
    case "EDITOR":
      return [
        { key: "reviews", href: "/reviews" },
        { key: "myPortfolio", href: "/my-portfolio" },
        { key: "newProject", href: "/projects/new" },
        SUPPORT_ENTRY,
      ]
    case "ADMIN":
      return [
        { key: "reviews", href: "/reviews" },
        { key: "myPortfolio", href: "/my-portfolio" },
        { key: "newProject", href: "/projects/new" },
        { key: "administration", href: "/administration" },
        SUPPORT_ENTRY,
      ]
    default:
      return []
  }
}
