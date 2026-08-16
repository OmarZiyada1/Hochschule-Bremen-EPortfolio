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
import java.util.List;
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
	 * <li>EDITOR: wie STUDENT, dazu die als Redaktion zugewiesenen Projekte ab
	 * der Einreichung (alle Status ausser {@code DRAFT})</li>
	 * <li>ADMIN: alle Projekte in allen Status</li>
	 * </ul>
	 *
	 * <p>Bis Contract v41 trug die EDITOR-Zelle in §5 einen vollen Haken und
	 * die Redaktion sah alles. Seit v42 ist ein Entwurf Privatsache der
	 * Projektseite: die zugewiesene Redaktion sieht ihr Projekt erst, wenn die
	 * Autor:in es eingereicht hat. „Meine Reviews" bleibt der Filter
	 * {@code editor=me}; er liegt jetzt innerhalb dieser engeren Schranke.
	 *
	 * @param user angemeldete Person; {@code null} bedeutet PUBLIC (§2.1)
	 */
	public static Specification<Project> visibleFor(AuthenticatedUser user) {
		return (root, query, cb) -> {
			if (!isLoggedIn(user)) {
				return isPublished(root, cb);
			}
			if (user.hasRole(Role.ADMIN)) {
				return cb.conjunction();
			}
			Predicate visible = cb.or(
					isPublished(root, cb),
					cb.equal(root.get("author").get("id"), user.getId()),
					isMember(root, query, cb, user.getId()));
			if (user.hasRole(Role.EDITOR)) {
				visible = cb.or(visible, cb.and(
						isAssignedEditor(root, query, cb, user.getId()),
						cb.notEqual(root.get("status"), ProjectStatus.DRAFT)));
			}
			return visible;
		};
	}

	// ------------------------------------------------------------------
	// Filter aus §6.1
	//
	// Die sieben Sachfilter nehmen seit Contract v43 mehrere Werte an
	// (KAN-64): ein in-Praedikat statt equal, die Werte desselben Parameters
	// sind damit ODER-verknuepft. Ein einzelner Wert verhaelt sich exakt wie
	// zuvor, denn ein in mit einem Element ist die Gleichheit. Leere Listen
	// kommen hier nie an; das stellt der ProjectReadService sicher.
	// ------------------------------------------------------------------

	/** Filter {@code category} (§3.6). */
	public static Specification<Project> category(List<UUID> categoryIds) {
		return references("category", categoryIds);
	}

	/** Filter {@code faculty} (§3.8). */
	public static Specification<Project> faculty(List<UUID> facultyIds) {
		return references("faculty", facultyIds);
	}

	/** Filter {@code studyProgram} (§3.7). */
	public static Specification<Project> studyProgram(List<UUID> studyProgramIds) {
		return references("studyProgram", studyProgramIds);
	}

	/** Filter {@code module} (§3.9). */
	public static Specification<Project> module(List<UUID> moduleIds) {
		return references("module", moduleIds);
	}

	/** Filter {@code author}: Projekte, deren Eigentuemer:in diese Person ist. */
	public static Specification<Project> author(UUID authorId) {
		return (root, query, cb) -> cb.equal(root.get("author").get("id"), authorId);
	}

	/** Filter {@code degree} (§2.7). */
	public static Specification<Project> degree(List<Degree> degrees) {
		return (root, query, cb) -> root.get("degree").in(degrees);
	}

	/** Filter {@code type} (§2.6). */
	public static Specification<Project> type(List<ProjectType> projectTypes) {
		return (root, query, cb) -> root.get("projectType").in(projectTypes);
	}

	/** Filter {@code status} (§2.2), nur zusammen mit der Sichtbarkeitsschranke sinnvoll. */
	public static Specification<Project> status(ProjectStatus status) {
		return (root, query, cb) -> cb.equal(root.get("status"), status);
	}

	/**
	 * Filter {@code semester} (§3.18).
	 *
	 * <p>Seit Contract v45 die ID der Stammdatenzeile und nicht mehr die
	 * getippte Schreibweise: der Vergleich lief zuvor exakt gegen ein
	 * Freitextfeld, sodass „WiSe 2025/26" und „WS 25/26" zwei verschiedene
	 * Semester waren und eine verlaessliche Optionsliste nicht zu bilden war.
	 * Damit verhaelt sich der Parameter wie {@code category}, {@code faculty},
	 * {@code studyProgram} und {@code module}.
	 */
	public static Specification<Project> semester(List<UUID> semesterIds) {
		return references("semester", semesterIds);
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

	/** Mitgliedschaft auf der ID eines {@code @ManyToOne}-Bezugs, ohne Join. */
	private static Specification<Project> references(String field, List<UUID> ids) {
		// root.get(field).get("id") liest den Fremdschluessel aus der
		// Projekt-Zeile und loest den Bezug nicht auf; ein Join entsteht dabei
		// nicht.
		return (root, query, cb) -> root.get(field).get("id").in(ids);
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
	 * „Diese Person ist diesem Projekt als Redaktion zugewiesen" als
	 * Unterabfrage auf die Join-Tabelle {@code project_editor} (§3.3).
	 *
	 * <p>Aus demselben Grund {@code exists} statt Join wie bei
	 * {@link #isMember}: die Zuweisung haengt als ODER-Zweig an der
	 * Sichtbarkeitsschranke, ein innerer Join wuerfe alle Projekte ohne
	 * Redaktion aus den uebrigen Zweigen.
	 */
	private static Predicate isAssignedEditor(Root<Project> root, CriteriaQuery<?> query,
			CriteriaBuilder cb, UUID userId) {
		Subquery<UUID> assignment = query.subquery(UUID.class);
		Root<Project> assigned = assignment.from(Project.class);
		Join<Project, User> editors = assigned.join("editors", JoinType.INNER);
		assignment.select(assigned.get("id"))
				.where(cb.and(
						cb.equal(assigned.get("id"), root.get("id")),
						cb.equal(editors.get("id"), userId)));
		return cb.exists(assignment);
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
