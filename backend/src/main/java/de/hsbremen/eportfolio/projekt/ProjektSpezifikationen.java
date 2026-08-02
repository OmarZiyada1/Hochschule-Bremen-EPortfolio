package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.auth.AngemeldeterBenutzer;
import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.common.enums.Abschluss;
import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.common.enums.Projekttyp;
import de.hsbremen.eportfolio.common.enums.Rolle;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * Bausteine der Where-Bedingung von {@code GET /api/projekte} (§6.1).
 *
 * <p>Jede Methode liefert eine eigenstaendige Bedingung; der
 * {@code ProjektLeseService} verknuepft die tatsaechlich gesetzten Filter mit
 * UND. Die Aufteilung in Bausteine statt einer grossen Abfrage hat einen
 * praktischen Grund: neun optionale Filter ergeben mehrere hundert
 * Kombinationen, die sich weder als abgeleitete Methodennamen noch als eine
 * JPQL-Abfrage mit lauter {@code (:x is null or …)}-Zweigen noch lesbar
 * ausdruecken liessen.
 *
 * <p><strong>Die Sichtbarkeit ist kein Filter, sondern eine Schranke.</strong>
 * {@link #sichtbarFuer(AngemeldeterBenutzer)} steht in jeder Abfrage und wird
 * immer mit UND angehaengt. Damit kann kein Filterwert je mehr sichtbar machen,
 * als die Rechtematrix erlaubt: im schlechtesten Fall bleibt die Liste leer.
 */
public final class ProjektSpezifikationen {

	private ProjektSpezifikationen() {
		// Nur statische Bausteine.
	}

	// ------------------------------------------------------------------
	// Sichtbarkeit (§5, Zeilen „Veroeffentlichte" und „Nicht-veroeffentlichte
	// Projekte lesen")
	// ------------------------------------------------------------------

	/**
	 * Schraenkt die Liste auf das ein, was diese:r Aufrufer:in ueberhaupt sehen
	 * darf. Entspricht {@link ProjektBerechtigungService#darfProjektLesen} in
	 * Mengenform: was dort je Projekt entschieden wird, muss hier als
	 * SQL-Bedingung stehen, weil sich eine Liste nicht projektweise filtern
	 * laesst, ohne die Paginierung zu zerstoeren.
	 *
	 * <ul>
	 * <li>PUBLIC: nur {@code VEROEFFENTLICHT}</li>
	 * <li>STUDIERENDE: zusaetzlich die eigenen, also Projekte, in denen die
	 * Person Autor:in oder Mitglied ist</li>
	 * <li>REDAKTEUR und ADMIN: alle Projekte in allen Status</li>
	 * </ul>
	 *
	 * <p>Dass REDAKTEUR alles sieht und nicht nur die zugewiesenen Projekte,
	 * steht so in §5: die Zeile traegt einen vollen Haken, kein {@code (✓)}.
	 * „Meine Reviews" entsteht daraus ueber den Filter {@code redakteur=me} und
	 * nicht ueber eine engere Grundsichtbarkeit.
	 *
	 * @param benutzer angemeldete Person; {@code null} bedeutet PUBLIC (§2.1)
	 */
	public static Specification<Projekt> sichtbarFuer(AngemeldeterBenutzer benutzer) {
		return (root, query, cb) -> {
			if (!angemeldet(benutzer)) {
				return istVeroeffentlicht(root, cb);
			}
			if (benutzer.hatRolle(Rolle.REDAKTEUR, Rolle.ADMIN)) {
				return cb.conjunction();
			}
			return cb.or(
					istVeroeffentlicht(root, cb),
					cb.equal(root.get("autor").get("id"), benutzer.getId()),
					istMitglied(root, query, cb, benutzer.getId()));
		};
	}

	// ------------------------------------------------------------------
	// Filter aus §6.1
	// ------------------------------------------------------------------

	/** Filter {@code kategorie} (§3.6). */
	public static Specification<Projekt> kategorie(UUID kategorieId) {
		return bezug("kategorie", kategorieId);
	}

	/** Filter {@code fakultaet} (§3.8). */
	public static Specification<Projekt> fakultaet(UUID fakultaetId) {
		return bezug("fakultaet", fakultaetId);
	}

	/** Filter {@code studiengang} (§3.7). */
	public static Specification<Projekt> studiengang(UUID studiengangId) {
		return bezug("studiengang", studiengangId);
	}

	/** Filter {@code modul} (§3.9). */
	public static Specification<Projekt> modul(UUID modulId) {
		return bezug("modul", modulId);
	}

	/** Filter {@code autor}: Projekte, deren Eigentuemer:in diese Person ist. */
	public static Specification<Projekt> autor(UUID autorId) {
		return bezug("autor", autorId);
	}

	/** Filter {@code abschluss} (§2.7). */
	public static Specification<Projekt> abschluss(Abschluss abschluss) {
		return (root, query, cb) -> cb.equal(root.get("abschluss"), abschluss);
	}

	/** Filter {@code typ} (§2.6). */
	public static Specification<Projekt> typ(Projekttyp projekttyp) {
		return (root, query, cb) -> cb.equal(root.get("projekttyp"), projekttyp);
	}

	/** Filter {@code status} (§2.2), nur zusammen mit der Sichtbarkeitsschranke sinnvoll. */
	public static Specification<Projekt> status(ProjektStatus status) {
		return (root, query, cb) -> cb.equal(root.get("status"), status);
	}

	/**
	 * Filter {@code semester}, exakter Vergleich auf die gespeicherte
	 * Schreibweise (z. B. „WS 2025/26").
	 *
	 * <p>Bewusst kein unscharfer Vergleich: das Feld ist eine freie
	 * Zeichenkette, die im Frontend aus einer Auswahlliste kommt. Ein
	 * {@code like} wuerde „WS 2025/26" auch bei der Eingabe „2025" treffen und
	 * damit stillschweigend ein zweites, undokumentiertes Filterverhalten
	 * einfuehren.
	 */
	public static Specification<Projekt> semester(String semester) {
		return (root, query, cb) -> cb.equal(root.get("semester"), semester);
	}

	/**
	 * Filter {@code q}: Volltextsuche ueber Titel und Kurzbeschreibung,
	 * unabhaengig von Gross- und Kleinschreibung.
	 *
	 * <p>Die Platzhalter {@code %} und {@code _} im Suchbegriff werden
	 * maskiert. Ohne das koennte eine Eingabe von {@code %} die gesamte Liste
	 * zurueckgeben, obwohl der Aufrufer nach einem Prozentzeichen gesucht hat.
	 *
	 * <p>{@code kurzbeschreibung} ist nullable; ein Vergleich gegen NULL ergibt
	 * in SQL weder wahr noch falsch, das ODER bleibt also korrekt und Projekte
	 * ohne Teaser fallen nur aus diesem einen Zweig heraus.
	 */
	public static Specification<Projekt> suchtext(String q) {
		return (root, query, cb) -> {
			String muster = "%" + maskierePlatzhalter(q.toLowerCase(Locale.ROOT)) + "%";
			return cb.or(
					cb.like(cb.lower(root.get("titel")), muster, MASKIERZEICHEN),
					cb.like(cb.lower(root.get("kurzbeschreibung")), muster, MASKIERZEICHEN));
		};
	}

	/**
	 * Filter {@code redakteur}: Projekte, die dieser Person zur Betreuung
	 * zugewiesen sind (Join-Tabelle {@code projekt_redakteur}, §3.3). Mit der
	 * eigenen ID ist das „Meine Reviews" aus §6.1.
	 *
	 * <p>Ein einfacher Join genuegt und erzeugt keine Doppeltreffer, weil je
	 * Projekt hoechstens eine Zeile auf genau diese Redakteur:in passt. Ohne die
	 * ID-Einschraenkung waere ein {@code distinct} noetig.
	 */
	public static Specification<Projekt> redakteur(UUID redakteurId) {
		return (root, query, cb) -> {
			Join<Projekt, User> redaktion = root.join("redakteure", JoinType.INNER);
			return cb.equal(redaktion.get("id"), redakteurId);
		};
	}

	// ------------------------------------------------------------------

	/** Maskierzeichen fuer {@code like}, siehe {@link #suchtext(String)}. */
	private static final char MASKIERZEICHEN = '\\';

	/** Gleichheit auf der ID eines {@code @ManyToOne}-Bezugs, ohne Join. */
	private static Specification<Projekt> bezug(String feld, UUID id) {
		// root.get(feld).get("id") liest den Fremdschluessel aus der
		// Projekt-Zeile und loest den Bezug nicht auf; ein Join entsteht dabei
		// nicht.
		return (root, query, cb) -> cb.equal(root.get(feld).get("id"), id);
	}

	private static Predicate istVeroeffentlicht(Root<Projekt> root, CriteriaBuilder cb) {
		return cb.equal(root.get("status"), ProjektStatus.VEROEFFENTLICHT);
	}

	/**
	 * „Diese Person ist Projektmitglied" als Unterabfrage.
	 *
	 * <p>Bewusst {@code exists} und kein Join: ein innerer Join wuerde Projekte
	 * ohne Mitglieder aus dem ODER-Zweig werfen, ein aeusserer Join wuerde
	 * Projekte mit mehreren Mitgliedern mehrfach zaehlen und damit sowohl die
	 * Trefferzahl als auch die Seitenaufteilung verfaelschen.
	 */
	private static Predicate istMitglied(Root<Projekt> root, CriteriaQuery<?> query, CriteriaBuilder cb,
			UUID benutzerId) {
		Subquery<UUID> mitgliedschaft = query.subquery(UUID.class);
		Root<Projektmitglied> mitglied = mitgliedschaft.from(Projektmitglied.class);
		mitgliedschaft.select(mitglied.get("id"))
				.where(cb.and(
						cb.equal(mitglied.get("projekt").get("id"), root.get("id")),
						cb.equal(mitglied.get("user").get("id"), benutzerId)));
		return cb.exists(mitgliedschaft);
	}

	/**
	 * Entwertet die {@code like}-Platzhalter einer Nutzereingabe. Das
	 * Maskierzeichen selbst zuerst, sonst wuerde die zweite Ersetzung die
	 * Maskierung der ersten erneut maskieren.
	 */
	private static String maskierePlatzhalter(String eingabe) {
		return eingabe
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}

	/** Wie im {@code ProjektBerechtigungService}: angemeldet heisst auch AKTIV (§2.9). */
	private static boolean angemeldet(AngemeldeterBenutzer benutzer) {
		return benutzer != null && benutzer.getStatus() == UserStatus.AKTIV;
	}
}
