package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
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
 * Bausteine der Where-Bedingung von {@code GET /api/projects} (§6.1).
 *
 * <p>Jede Methode liefert eine eigenstaendige Bedingung; der
 * {@code ProjectReadService} verknuepft die tatsaechlich gesetzten Filter mit
 * UND. Die Aufteilung in Bausteine statt einer grossen Abfrage hat einen
 * praktischen Grund: neun optionale Filter ergeben mehrere hundert
 * Kombinationen, die sich weder als abgeleitete Methodennamen noch als eine
 * JPQL-Abfrage mit lauter {@code (:x is null or …)}-Zweigen noch lesbar
 * ausdruecken liessen.
 *
 * <p><strong>Die Sichtbarkeit ist kein Filter, sondern eine Schranke.</strong>
 * {@link #visibleFor(AuthenticatedUser)} steht in jeder Abfrage und wird immer
 * mit UND angehaengt. Damit kann kein Filterwert je mehr sichtbar machen, als
 * die Rechtematrix erlaubt: im schlechtesten Fall bleibt die Liste leer.
 */
public final class ProjectSpecifications {

	private ProjectSpecifications() {
		// Nur statische Bausteine.
	}

	// ------------------------------------------------------------------
	// Sichtbarkeit (§5, Zeilen „Veroeffentlichte" und „Nicht-veroeffentlichte
	// Projekte lesen")
	// ------------------------------------------------------------------

	/**
	 * Schraenkt die Liste auf das ein, was diese:r Aufrufer:in ueberhaupt sehen
	 * darf. Entspricht {@link ProjectPermissionService#mayReadProject} in
	 * Mengenform: was dort je Projekt entschieden wird, muss hier als
	 * SQL-Bedingung stehen, weil sich eine Liste nicht projektweise filtern
	 * laesst, ohne die Paginierung zu zerstoeren.
	 *
	 * <ul>
	 * <li>PUBLIC: nur {@code PUBLISHED}</li>
	 * <li>STUDENT: zusaetzlich die eigenen, also Projekte, in denen die Person
	 * Autor:in oder Mitglied ist</li>
	 * <li>EDITOR und ADMIN: alle Projekte in allen Status</li>
	 * </ul>
	 *
	 * <p>Dass EDITOR alles sieht und nicht nur die zugewiesenen Projekte, steht
	 * so in §5: die Zeile traegt einen vollen Haken, kein {@code (✓)}. „Meine
	 * Reviews" entsteht daraus ueber den Filter {@code editor=me} und nicht
	 * ueber eine engere Grundsichtbarkeit.
	 *
	 * @param user angemeldete Person; {@code null} bedeutet PUBLIC (§2.1)
	 */
	public static Specification<Project> visibleFor(AuthenticatedUser user) {
		return (root, query, cb) -> {
			if (!isLoggedIn(user)) {
				return isPublished(root, cb);
			}
			if (user.hasRole(Role.EDITOR, Role.ADMIN)) {
				return cb.conjunction();
			}
			return cb.or(
					isPublished(root, cb),
					cb.equal(root.get("author").get("id"), user.getId()),
					isMember(root, query, cb, user.getId()));
		};
	}

	// ------------------------------------------------------------------
	// Filter aus §6.1
	// ------------------------------------------------------------------

	/** Filter {@code category} (§3.6). */
	public static Specification<Project> category(UUID categoryId) {
		return reference("category", categoryId);
	}

	/** Filter {@code faculty} (§3.8). */
	public static Specification<Project> faculty(UUID facultyId) {
		return reference("faculty", facultyId);
	}

	/** Filter {@code studyProgram} (§3.7). */
	public static Specification<Project> studyProgram(UUID studyProgramId) {
		return reference("studyProgram", studyProgramId);
	}

	/** Filter {@code module} (§3.9). */
	public static Specification<Project> module(UUID moduleId) {
		return reference("module", moduleId);
	}

	/** Filter {@code author}: Projekte, deren Eigentuemer:in diese Person ist. */
	public static Specification<Project> author(UUID authorId) {
		return reference("author", authorId);
	}

	/** Filter {@code degree} (§2.7). */
	public static Specification<Project> degree(Degree degree) {
		return (root, query, cb) -> cb.equal(root.get("degree"), degree);
	}

	/** Filter {@code type} (§2.6). */
	public static Specification<Project> type(ProjectType projectType) {
		return (root, query, cb) -> cb.equal(root.get("projectType"), projectType);
	}

	/** Filter {@code status} (§2.2), nur zusammen mit der Sichtbarkeitsschranke sinnvoll. */
	public static Specification<Project> status(ProjectStatus status) {
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
	public static Specification<Project> semester(String semester) {
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
	 * <p>{@code summary} ist nullable; ein Vergleich gegen NULL ergibt in SQL
	 * weder wahr noch falsch, das ODER bleibt also korrekt und Projekte ohne
	 * Teaser fallen nur aus diesem einen Zweig heraus.
	 */
	public static Specification<Project> searchText(String q) {
		return (root, query, cb) -> {
			String pattern = "%" + escapeWildcards(q.toLowerCase(Locale.ROOT)) + "%";
			return cb.or(
					cb.like(cb.lower(root.get("title")), pattern, ESCAPE_CHARACTER),
					cb.like(cb.lower(root.get("summary")), pattern, ESCAPE_CHARACTER));
		};
	}

	/**
	 * Filter {@code editor}: Projekte, die dieser Person zur Betreuung
	 * zugewiesen sind (Join-Tabelle {@code project_editor}, §3.3). Mit der
	 * eigenen ID ist das „Meine Reviews" aus §6.1.
	 *
	 * <p>Ein einfacher Join genuegt und erzeugt keine Doppeltreffer, weil je
	 * Projekt hoechstens eine Zeile auf genau diese Redakteur:in passt. Ohne die
	 * ID-Einschraenkung waere ein {@code distinct} noetig.
	 */
	public static Specification<Project> editor(UUID editorId) {
		return (root, query, cb) -> {
			Join<Project, User> editors = root.join("editors", JoinType.INNER);
			return cb.equal(editors.get("id"), editorId);
		};
	}

	// ------------------------------------------------------------------

	/** Maskierzeichen fuer {@code like}, siehe {@link #searchText(String)}. */
	private static final char ESCAPE_CHARACTER = '\\';

	/** Gleichheit auf der ID eines {@code @ManyToOne}-Bezugs, ohne Join. */
	private static Specification<Project> reference(String field, UUID id) {
		// root.get(field).get("id") liest den Fremdschluessel aus der
		// Projekt-Zeile und loest den Bezug nicht auf; ein Join entsteht dabei
		// nicht.
		return (root, query, cb) -> cb.equal(root.get(field).get("id"), id);
	}

	private static Predicate isPublished(Root<Project> root, CriteriaBuilder cb) {
		return cb.equal(root.get("status"), ProjectStatus.PUBLISHED);
	}

	/**
	 * „Diese Person ist Projektmitglied" als Unterabfrage.
	 *
	 * <p>Bewusst {@code exists} und kein Join: ein innerer Join wuerde Projekte
	 * ohne Mitglieder aus dem ODER-Zweig werfen, ein aeusserer Join wuerde
	 * Projekte mit mehreren Mitgliedern mehrfach zaehlen und damit sowohl die
	 * Trefferzahl als auch die Seitenaufteilung verfaelschen.
	 */
	private static Predicate isMember(Root<Project> root, CriteriaQuery<?> query, CriteriaBuilder cb,
			UUID userId) {
		Subquery<UUID> membership = query.subquery(UUID.class);
		Root<ProjectMember> member = membership.from(ProjectMember.class);
		membership.select(member.get("id"))
				.where(cb.and(
						cb.equal(member.get("project").get("id"), root.get("id")),
						cb.equal(member.get("user").get("id"), userId)));
		return cb.exists(membership);
	}

	/**
	 * Entwertet die {@code like}-Platzhalter einer Nutzereingabe. Das
	 * Maskierzeichen selbst zuerst, sonst wuerde die zweite Ersetzung die
	 * Maskierung der ersten erneut maskieren.
	 */
	private static String escapeWildcards(String input) {
		return input
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}

	/** Wie im {@code ProjectPermissionService}: angemeldet heisst auch ACTIVE (§2.9). */
	private static boolean isLoggedIn(AuthenticatedUser user) {
		return user != null && user.getStatus() == UserStatus.ACTIVE;
	}
}
