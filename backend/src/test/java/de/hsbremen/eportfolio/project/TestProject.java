package de.hsbremen.eportfolio.project;

import com.fasterxml.jackson.databind.JsonNode;
import de.hsbremen.eportfolio.common.enums.BlockType;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.user.User;
import java.time.Instant;
import java.util.UUID;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Baut {@link Project}-Instanzen fuer Tests des
 * {@link ProjectPermissionService}.
 *
 * <p>Liegt in diesem Paket, weil der Projekt-Konstruktor JPA vorbehalten ist.
 */
public final class TestProject {

	public static Project withAuthor(User author, ProjectStatus status) {
		Project project = new Project();
		ReflectionTestUtils.setField(project, "id", UUID.randomUUID());
		project.setTitle("Testprojekt");
		project.setAuthor(author);
		project.setStatus(status);
		return project;
	}

	/** Fuegt eine:n betreuende:n Redakteur:in hinzu (Join-Tabelle project_editor, §3.3). */
	public static Project withEditor(Project project, User editor) {
		project.getEditors().add(editor);
		return project;
	}

	/** Fuegt ein Projektmitglied hinzu (Co-Autor:in, §3.13). */
	public static Project withMember(Project project, User user) {
		ProjectMember member = new ProjectMember();
		ReflectionTestUtils.setField(member, "id", UUID.randomUUID());
		member.setProject(project);
		member.setUser(user);
		member.setProjectRole("Frontend");
		project.getMembers().add(member);
		return project;
	}

	/**
	 * Ein {@code DRAFT} ohne vorbelegte ID: fuer Tests, die das Projekt
	 * tatsaechlich speichern (Begruendung wie bei
	 * {@code TestUser.activeWithoutId}).
	 */
	public static Project draftWithoutId(User author) {
		Project project = withAuthor(author, ProjectStatus.DRAFT);
		ReflectionTestUtils.setField(project, "id", null);
		return project;
	}

	/**
	 * Wie {@link #draftWithoutId(User)}, aber mit frei waehlbarem Status und
	 * Titel: fuer Tests, die mehrere Projekte unterscheiden muessen, etwa die
	 * Sichtbarkeits- und Sortierpruefungen der Projektliste.
	 */
	public static Project withoutId(User author, ProjectStatus status, String title) {
		Project project = withAuthor(author, status);
		project.setTitle(title);
		ReflectionTestUtils.setField(project, "id", null);
		return project;
	}

	/**
	 * Ein Projektmitglied ohne vorbelegte ID, zum Speichern ueber das
	 * Repository. Anders als {@link #withMember} haengt es die Zeile nicht in
	 * die Sammlung des Projekts, weil die beim naechsten Laden ohnehin aus der
	 * Datenbank kommt.
	 */
	public static ProjectMember memberWithoutId(Project project, User user, String projectRole) {
		ProjectMember member = new ProjectMember();
		member.setProject(project);
		member.setUser(user);
		member.setProjectRole(projectRole);
		return member;
	}

	/** Ein Inhaltsblock ohne vorbelegte ID (§3.4), zum Speichern ueber das Repository. */
	public static Block blockWithoutId(Project project, BlockType type, int orderIndex, JsonNode content) {
		Block block = new Block();
		block.setProject(project);
		block.setType(type);
		block.setOrderIndex(orderIndex);
		block.setContent(content);
		return block;
	}

	/** Ein Statusuebergang ohne vorbelegte ID (§3.12), zum Speichern ueber das Repository. */
	public static ProjectStatusHistory historyWithoutId(Project project, ProjectStatus from,
			ProjectStatus to, User changedBy, Instant timestamp) {
		ProjectStatusHistory entry = new ProjectStatusHistory();
		entry.setProject(project);
		entry.setFromStatus(from);
		entry.setToStatus(to);
		entry.setChangedBy(changedBy);
		entry.setTimestamp(timestamp);
		return entry;
	}

	private TestProject() {
	}
}
