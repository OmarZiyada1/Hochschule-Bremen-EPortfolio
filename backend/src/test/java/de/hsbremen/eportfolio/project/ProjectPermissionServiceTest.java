package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.config.PermissionProperties;
import de.hsbremen.eportfolio.user.TestUser;
import de.hsbremen.eportfolio.user.User;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Prueft die Rechtematrix aus API-Contract §5 Zeile fuer Zeile, je Rolle,
 * einschliesslich der Statusregeln aus §4.1.
 *
 * <p>{@code null} als Benutzer steht fuer PUBLIC (§2.1).
 */
class ProjectPermissionServiceTest {

	private ProjectPermissionService service;

	private User authorUser;

	private AuthenticatedUser author;

	private AuthenticatedUser otherStudent;

	private AuthenticatedUser editor;

	private AuthenticatedUser otherEditor;

	private AuthenticatedUser admin;

	private User editorUser;

	private static final AuthenticatedUser PUBLIC = null;

	@BeforeEach
	void setUp() {
		service = withProperties(true, false);

		authorUser = TestUser.active(Role.STUDENT, "hash");
		author = AuthenticatedUser.from(authorUser);

		otherStudent = AuthenticatedUser.from(TestUser.active(Role.STUDENT, "hash"));

		editorUser = TestUser.active(Role.EDITOR, "hash");
		editor = AuthenticatedUser.from(editorUser);

		otherEditor = AuthenticatedUser.from(TestUser.active(Role.EDITOR, "hash"));
		admin = AuthenticatedUser.from(TestUser.active(Role.ADMIN, "hash"));
	}

	private static ProjectPermissionService withProperties(boolean fourEyes, boolean adminMayEditContent) {
		return new ProjectPermissionService(new PermissionProperties(fourEyes, adminMayEditContent));
	}

	/** Projekt des Autors, mit {@code editorUser} als betreuender Redaktion. */
	private Project project(ProjectStatus status) {
		return TestProject.withEditor(TestProject.withAuthor(authorUser, status), editorUser);
	}

	// ------------------------------------------------------------------

	@Nested
	@DisplayName("Zeile: Projekte lesen")
	class Reading {

		@Test
		@DisplayName("Veroeffentlichte Projekte darf jede Rolle lesen, auch PUBLIC")
		void readPublished() {
			Project p = project(ProjectStatus.PUBLISHED);

			assertThat(service.mayReadProject(PUBLIC, p)).isTrue();
			assertThat(service.mayReadProject(otherStudent, p)).isTrue();
			assertThat(service.mayReadProject(editor, p)).isTrue();
			assertThat(service.mayReadProject(admin, p)).isTrue();
		}

		@Test
		@DisplayName("Nicht veroeffentlicht: PUBLIC nein, Fremde nein, eigene ja, Redaktion und Admin ja")
		void readUnpublished() {
			Project p = project(ProjectStatus.DRAFT);

			assertThat(service.mayReadProject(PUBLIC, p)).isFalse();
			assertThat(service.mayReadProject(otherStudent, p)).isFalse();
			assertThat(service.mayReadProject(author, p)).isTrue();
			assertThat(service.mayReadProject(otherEditor, p)).isTrue();
			assertThat(service.mayReadProject(admin, p)).isTrue();
		}

		@Test
		@DisplayName("Projektmitglieder duerfen den Entwurf lesen (§3.13)")
		void memberMayRead() {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(ProjectStatus.DRAFT), memberUser);

			assertThat(service.mayReadProject(AuthenticatedUser.from(memberUser), p)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Statushistorie eines Projekts sehen (Fussnote ⁷)")
	class ProjectInternals {

		@Test
		@DisplayName("Projektseite ja, zugewiesene Redaktion ja, Admin ja")
		void participantsMay() {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(ProjectStatus.SUBMITTED), memberUser);

			assertThat(service.maySeeProjectInternals(author, p)).isTrue();
			assertThat(service.maySeeProjectInternals(AuthenticatedUser.from(memberUser), p)).isTrue();
			assertThat(service.maySeeProjectInternals(editor, p)).isTrue();
			assertThat(service.maySeeProjectInternals(admin, p)).isTrue();
		}

		@Test
		@DisplayName("PUBLIC nein und unbeteiligte Angemeldete nein, auch bei veroeffentlichtem Projekt")
		void othersMayNot() {
			Project p = project(ProjectStatus.PUBLISHED);

			assertThat(service.maySeeProjectInternals(PUBLIC, p)).isFalse();
			assertThat(service.maySeeProjectInternals(otherStudent, p)).isFalse();
		}

		@Test
		@DisplayName("Fussnote ⁷ engt den Haken bei EDITOR ein: nicht zugewiesen heisst nein")
		void unassignedEditorMayNot() {
			Project p = project(ProjectStatus.SUBMITTED);

			// Unterschied zu mayReadProject: dort darf jede:r Redakteur:in,
			// hier nur die zugewiesene.
			assertThat(service.mayReadProject(otherEditor, p)).isTrue();
			assertThat(service.maySeeProjectInternals(otherEditor, p)).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeile: Projekt anlegen")
	class Creating {

		@Test
		@DisplayName("PUBLIC nein, STUDENT und EDITOR ja")
		void create() {
			assertThat(service.mayCreateProject(PUBLIC)).isFalse();
			assertThat(service.mayCreateProject(otherStudent)).isTrue();
			assertThat(service.mayCreateProject(editor)).isTrue();
		}

		@Test
		@DisplayName("Fussnote ¹⁰: ein Admin-Konto legt keine Projekte an")
		void adminMayNot() {
			// Nicht der Status sperrt hier, sondern die Rolle: das Konto ist
			// aktiv und darf verwalten, nur eben nicht selbst verfassen.
			assertThat(service.mayCreateProject(admin)).isFalse();
			assertThat(service.mayManageUsers(admin)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Projekt-Inhalt bearbeiten")
	class EditingContent {

		@Test
		@DisplayName("Autor:in ja, Projektmitglied ja, fremde:r Studierende:r nein")
		void projectSide() {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(ProjectStatus.DRAFT), memberUser);

			assertThat(service.mayEditContent(author, p)).isTrue();
			assertThat(service.mayEditContent(AuthenticatedUser.from(memberUser), p)).isTrue();
			assertThat(service.mayEditContent(otherStudent, p)).isFalse();
			assertThat(service.mayEditContent(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Redakteur:in nur beim zugewiesenen Projekt ((✓) = eigene Ressource)")
		void onlyAssignedEditor() {
			Project p = project(ProjectStatus.REVISION);

			assertThat(service.mayEditContent(editor, p)).isTrue();
			assertThat(service.mayEditContent(otherEditor, p)).isFalse();
		}

		@ParameterizedTest
		@EnumSource(value = ProjectStatus.class,
				names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("In gesperrten Status darf niemand den Inhalt aendern (§4.1)")
		void lockedStatuses(ProjectStatus status) {
			Project p = project(status);

			assertThat(service.mayEditContent(author, p)).isFalse();
			assertThat(service.mayEditContent(editor, p)).isFalse();
			assertThat(service.mayEditContent(admin, p)).isFalse();
		}

		@Test
		@DisplayName("Default (OF 2): Admin bearbeitet fremde Inhalte nicht")
		void adminDefaultReadOnly() {
			Project p = project(ProjectStatus.DRAFT);

			assertThat(service.mayEditContent(admin, p)).isFalse();
		}

		@Test
		@DisplayName("Mit umgelegter Property darf der Admin fremde Inhalte bearbeiten")
		void adminWithSwitch() {
			ProjectPermissionService withAdminAccess = withProperties(true, true);
			Project p = project(ProjectStatus.DRAFT);

			assertThat(withAdminAccess.mayEditContent(admin, p)).isTrue();
		}

		@Test
		@DisplayName("Ein Admin, der selbst Autor:in ist, darf unabhaengig von der Property")
		void adminAsAuthor() {
			User adminUser = TestUser.active(Role.ADMIN, "hash");
			Project p = TestProject.withAuthor(adminUser, ProjectStatus.DRAFT);

			assertThat(service.mayEditContent(AuthenticatedUser.from(adminUser), p)).isTrue();
		}
	}

	@Nested
	@DisplayName("Endpoint-Zeile: PUT /projects/{id} (Metadaten, §6.1)")
	class EditingMetadata {

		@Test
		@DisplayName("Autor:in ja, Projektmitglied ja, fremde:r Studierende:r nein")
		void projectSide() {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(ProjectStatus.DRAFT), memberUser);

			assertThat(service.mayEditMetadata(author, p)).isTrue();
			assertThat(service.mayEditMetadata(AuthenticatedUser.from(memberUser), p)).isTrue();
			assertThat(service.mayEditMetadata(otherStudent, p)).isFalse();
			assertThat(service.mayEditMetadata(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Enger als mayEditContent: die zugewiesene Redaktion darf Metadaten nicht "
				+ "aendern, den Inhalt aber schon")
		void editorMayNotEditMetadata() {
			Project p = project(ProjectStatus.REVISION);

			assertThat(service.mayEditContent(editor, p)).isTrue();
			assertThat(service.mayEditMetadata(editor, p)).isFalse();
		}

		@Test
		@DisplayName("Auch der Admin nicht: §6.1 nennt in dieser Zeile nur Autor:in und Mitglieder")
		void adminMayNotEditForeignMetadata() {
			Project p = project(ProjectStatus.DRAFT);

			assertThat(service.mayEditMetadata(admin, p)).isFalse();
			// Auch nicht mit der Property aus OF 2: die betrifft den Inhalt.
			assertThat(withProperties(true, true).mayEditMetadata(admin, p)).isFalse();
		}

		@ParameterizedTest
		@EnumSource(value = ProjectStatus.class, names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("In gesperrten Status aendert auch die Autor:in keine Metadaten (§4.1)")
		void lockedStatuses(ProjectStatus status) {
			Project p = project(status);

			assertThat(service.mayEditMetadata(author, p)).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeile: Projektmitglieder pflegen (Fussnote ⁶, §3.13.1)")
	class ManagingMembers {

		@Test
		@DisplayName("Ein Mitglied darf die Mitgliederliste pflegen, nicht nur die Autor:in")
		void memberMayManage() {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(ProjectStatus.DRAFT), memberUser);

			assertThat(service.mayManageMembers(author, p)).isTrue();
			assertThat(service.mayManageMembers(AuthenticatedUser.from(memberUser), p)).isTrue();
		}

		@Test
		@DisplayName("Unbeteiligte nicht, auch nicht die zugewiesene Redaktion")
		void othersMayNot() {
			Project p = project(ProjectStatus.DRAFT);

			assertThat(service.mayManageMembers(otherStudent, p)).isFalse();
			assertThat(service.mayManageMembers(editor, p)).isFalse();
			assertThat(service.mayManageMembers(PUBLIC, p)).isFalse();
		}

		@ParameterizedTest
		@EnumSource(value = ProjectStatus.class, names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("Nur in DRAFT und REVISION: sobald eingereicht ist, aendert sich nichts mehr")
		void onlyWhileEditable(ProjectStatus status) {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(status), memberUser);

			assertThat(service.mayManageMembers(author, p)).isFalse();
			assertThat(service.mayManageMembers(AuthenticatedUser.from(memberUser), p)).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeile: Projekt einreichen")
	class Submitting {

		@Test
		@DisplayName("Autor:in ja, Redaktion und Admin nein")
		void submit() {
			Project p = project(ProjectStatus.DRAFT);

			assertThat(service.maySubmit(author, p)).isTrue();
			assertThat(service.maySubmit(otherStudent, p)).isFalse();
			assertThat(service.maySubmit(PUBLIC, p)).isFalse();
			// Matrix: ADMIN ausdruecklich ✗.
			assertThat(service.maySubmit(admin, p)).isFalse();
		}

		@Test
		@DisplayName("Auch aus REVISION heraus (§4.1)")
		void submitAgain() {
			assertThat(service.maySubmit(author, project(ProjectStatus.REVISION))).isTrue();
		}

		@Test
		@DisplayName("Nicht aus einem bereits eingereichten Projekt heraus")
		void noDoubleSubmit() {
			assertThat(service.maySubmit(author, project(ProjectStatus.SUBMITTED))).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeile: Genehmigen und Veroeffentlichen (inkl. Vier-Augen-Prinzip)")
	class EditorialDecision {

		@Test
		@DisplayName("Genehmigen: Redaktion und Admin ja, Studierende nein, PUBLIC nein")
		void approve() {
			Project p = project(ProjectStatus.SUBMITTED);

			assertThat(service.mayApprove(editor, p)).isTrue();
			assertThat(service.mayApprove(admin, p)).isTrue();
			assertThat(service.mayApprove(author, p)).isFalse();
			assertThat(service.mayApprove(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Genehmigen nur aus SUBMITTED heraus (§4.1)")
		void approveOnlyFromSubmitted() {
			assertThat(service.mayApprove(editor, project(ProjectStatus.DRAFT))).isFalse();
			assertThat(service.mayApprove(editor, project(ProjectStatus.APPROVED))).isFalse();
		}

		@Test
		@DisplayName("Veroeffentlichen nur aus APPROVED heraus")
		void publish() {
			assertThat(service.mayPublish(editor, project(ProjectStatus.APPROVED))).isTrue();
			assertThat(service.mayPublish(admin, project(ProjectStatus.APPROVED))).isTrue();
			assertThat(service.mayPublish(editor, project(ProjectStatus.SUBMITTED))).isFalse();
		}

		@Test
		@DisplayName("Vier-Augen-Prinzip: Redakteur:in genehmigt das eigene Projekt nicht (OF 1)")
		void fourEyesOnApprove() {
			Project own = TestProject.withAuthor(editorUser, ProjectStatus.SUBMITTED);

			assertThat(service.mayApprove(editor, own)).isFalse();
			// Ein:e andere:r Redakteur:in darf sehr wohl.
			assertThat(service.mayApprove(otherEditor, own)).isTrue();
		}

		@Test
		@DisplayName("Vier-Augen-Prinzip greift auch beim Veroeffentlichen")
		void fourEyesOnPublish() {
			Project own = TestProject.withAuthor(editorUser, ProjectStatus.APPROVED);

			assertThat(service.mayPublish(editor, own)).isFalse();
		}

		@Test
		@DisplayName("Abgeschaltetes Vier-Augen-Prinzip erlaubt die eigene Freigabe")
		void fourEyesSwitchable() {
			ProjectPermissionService withoutFourEyes = withProperties(false, false);
			Project own = TestProject.withAuthor(editorUser, ProjectStatus.SUBMITTED);

			assertThat(withoutFourEyes.mayApprove(editor, own)).isTrue();
		}

		@Test
		@DisplayName("Fussnote ¹ steht nur an den EDITOR-Zellen: der Admin ist nicht gesperrt")
		void adminNotAffectedByFourEyes() {
			User adminUser = TestUser.active(Role.ADMIN, "hash");
			Project own = TestProject.withAuthor(adminUser, ProjectStatus.SUBMITTED);

			assertThat(service.mayApprove(AuthenticatedUser.from(adminUser), own)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeile: Zur Ueberarbeitung zurueckgeben")
	class RequestingRevision {

		@ParameterizedTest
		@EnumSource(value = ProjectStatus.class,
				names = {"SUBMITTED", "APPROVED", "PUBLISHED"})
		@DisplayName("Redaktion und Admin ja, Studierende nein")
		void requestRevision(ProjectStatus status) {
			Project p = project(status);

			assertThat(service.mayRequestRevision(editor, p)).isTrue();
			assertThat(service.mayRequestRevision(admin, p)).isTrue();
			assertThat(service.mayRequestRevision(author, p)).isFalse();
			assertThat(service.mayRequestRevision(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Aus DRAFT heraus gibt es nichts zurueckzugeben")
		void notFromDraft() {
			assertThat(service.mayRequestRevision(editor, project(ProjectStatus.DRAFT))).isFalse();
		}

		@Test
		@DisplayName("Kein Vier-Augen-Prinzip: hier traegt die Matrix keine Fussnote ¹")
		void withoutFourEyes() {
			Project own = TestProject.withAuthor(editorUser, ProjectStatus.SUBMITTED);

			assertThat(service.mayRequestRevision(editor, own)).isTrue();
		}
	}

	/**
	 * Die Trennung, von der die Fehlerpolitik der Workflow-Endpoints lebt:
	 * {@code mayTrigger} beantwortet die Rechtefrage (403), die Statusfrage steht
	 * in {@link ProjectTransition} (409). Ohne diese Trennung koennte der
	 * Workflow-Dienst die beiden Antworten nicht auseinanderhalten (§6.3.1).
	 */
	@Nested
	@DisplayName("Zweistufige Pruefung eines Uebergangs (§4.1, §6.3.1)")
	class TwoStepCheck {

		@ParameterizedTest
		@EnumSource(ProjectStatus.class)
		@DisplayName("mayTrigger ignoriert den Status: die Redaktion darf genehmigen, auch wenn das "
				+ "Projekt gerade im falschen Status steht")
		void triggerIgnoresStatus(ProjectStatus status) {
			Project p = project(status);

			assertThat(service.mayTrigger(editor, p, ProjectTransition.APPROVE)).isTrue();
			// Erst die zweite Stufe weist ab, und genau deshalb kann daraus ein
			// 409 werden statt eines irrefuehrenden 403.
			assertThat(service.mayPerform(editor, p, ProjectTransition.APPROVE))
					.isEqualTo(status == ProjectStatus.SUBMITTED);
		}

		@ParameterizedTest
		@EnumSource(ProjectStatus.class)
		@DisplayName("Wem das Recht fehlt, dem fehlt es in jedem Status: eine fremde Studierende "
				+ "bekommt damit immer 403 und nie 409")
		void missingPermissionIsIndependentOfStatus(ProjectStatus status) {
			Project p = project(status);

			for (ProjectTransition transition : ProjectTransition.values()) {
				assertThat(service.mayTrigger(otherStudent, p, transition)).isFalse();
				assertThat(service.mayTrigger(PUBLIC, p, transition)).isFalse();
			}
		}

		@ParameterizedTest
		@EnumSource(ProjectStatus.class)
		@DisplayName("mayPerform entspricht in jedem Status den vier benannten Methoden")
		void namedMethodsAreTheCombination(ProjectStatus status) {
			Project p = project(status);

			for (AuthenticatedUser user : new AuthenticatedUser[] {author, otherStudent, editor,
					otherEditor, admin, PUBLIC}) {

				assertThat(service.maySubmit(user, p))
						.isEqualTo(service.mayPerform(user, p, ProjectTransition.SUBMIT));
				assertThat(service.mayApprove(user, p))
						.isEqualTo(service.mayPerform(user, p, ProjectTransition.APPROVE));
				assertThat(service.mayPublish(user, p))
						.isEqualTo(service.mayPerform(user, p, ProjectTransition.PUBLISH));
				assertThat(service.mayRequestRevision(user, p))
						.isEqualTo(service.mayPerform(user, p, ProjectTransition.REQUEST_REVISION));
			}
		}

		@Test
		@DisplayName("Das Vier-Augen-Prinzip haengt am Recht und nicht am Status: es sperrt schon "
				+ "mayTrigger")
		void fourEyesBlocksTheTrigger() {
			Project own = TestProject.withAuthor(editorUser, ProjectStatus.SUBMITTED);

			assertThat(service.mayTrigger(editor, own, ProjectTransition.APPROVE)).isFalse();
			assertThat(service.mayTrigger(editor, own, ProjectTransition.PUBLISH)).isFalse();
			// Die Ruecknahme traegt keine Fussnote ¹ und bleibt offen.
			assertThat(service.mayTrigger(editor, own, ProjectTransition.REQUEST_REVISION)).isTrue();
		}
	}

	@Nested
	@DisplayName("Zeilen: Kommentare (§2.3, §2.4)")
	class Comments {

		@Test
		@DisplayName("REPLY: Projektseite ja, Redaktion und Admin ja, fremde:r Studierende:r nein")
		void reply() {
			Project p = project(ProjectStatus.SUBMITTED);

			assertThat(service.mayCreateReplyComment(author, p)).isTrue();
			assertThat(service.mayCreateReplyComment(editor, p)).isTrue();
			assertThat(service.mayCreateReplyComment(admin, p)).isTrue();
			assertThat(service.mayCreateReplyComment(otherStudent, p)).isFalse();
			assertThat(service.mayCreateReplyComment(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("NOTE: nur Redaktion und Admin - fuer Studierende unsichtbar")
		void note() {
			assertThat(service.mayUseNote(editor)).isTrue();
			assertThat(service.mayUseNote(admin)).isTrue();
			assertThat(service.mayUseNote(author)).isFalse();
			assertThat(service.mayUseNote(PUBLIC)).isFalse();
		}

		@Test
		@DisplayName("CHANGE_REQUEST erstellen: nur Redaktion und Admin")
		void createChangeRequest() {
			assertThat(service.mayCreateChangeRequestComment(editor)).isTrue();
			assertThat(service.mayCreateChangeRequestComment(admin)).isTrue();
			assertThat(service.mayCreateChangeRequestComment(author)).isFalse();
		}

		@Test
		@DisplayName("CHANGE_REQUEST-Status: die Projektseite schaltet um (Fussnote ²)")
		void changeRequestStatus() {
			User memberUser = TestUser.active(Role.STUDENT, "hash");
			Project p = TestProject.withMember(project(ProjectStatus.REVISION), memberUser);

			assertThat(service.maySetChangeRequestStatus(author, p)).isTrue();
			assertThat(service.maySetChangeRequestStatus(AuthenticatedUser.from(memberUser), p)).isTrue();
			assertThat(service.maySetChangeRequestStatus(editor, p)).isTrue();
			assertThat(service.maySetChangeRequestStatus(otherStudent, p)).isFalse();
		}

		@Test
		@DisplayName("Kommentartext aendern: nur die Verfasser:in, auch nicht der Admin (§6.1)")
		void editComment() {
			assertThat(service.mayEditComment(author, author.getId())).isTrue();
			assertThat(service.mayEditComment(editor, author.getId())).isFalse();
			assertThat(service.mayEditComment(admin, author.getId())).isFalse();
			assertThat(service.mayEditComment(PUBLIC, author.getId())).isFalse();
			// Eine Zeile ohne Verfasser:in gibt es laut §3.5 nicht; die Antwort
			// darauf ist trotzdem ein klares Nein und keine Ausnahme.
			assertThat(service.mayEditComment(author, null)).isFalse();
		}

		@Test
		@DisplayName("Kommentar loeschen: Verfasser:in und Admin, aber nicht die Redaktion (§6.1)")
		void deleteComment() {
			assertThat(service.mayDeleteComment(author, author.getId())).isTrue();
			assertThat(service.mayDeleteComment(admin, author.getId())).isTrue();
			assertThat(service.mayDeleteComment(editor, author.getId())).isFalse();
			assertThat(service.mayDeleteComment(otherStudent, author.getId())).isFalse();
			assertThat(service.mayDeleteComment(PUBLIC, author.getId())).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeilen: Dateien, Reaktionen, Portfolio")
	class Others {

		@Test
		@DisplayName("Datei hochladen: Projektseite (✓), zugewiesene Redaktion (✓), Admin ✓")
		void uploadFile() {
			Project p = project(ProjectStatus.DRAFT);

			assertThat(service.mayUploadFile(author, p)).isTrue();
			assertThat(service.mayUploadFile(editor, p)).isTrue();
			assertThat(service.mayUploadFile(otherEditor, p)).isFalse();
			assertThat(service.mayUploadFile(admin, p)).isTrue();
			assertThat(service.mayUploadFile(otherStudent, p)).isFalse();
			assertThat(service.mayUploadFile(PUBLIC, p)).isFalse();
		}

		@Test
		@DisplayName("Datei lesen: PUBLIC nur bei veroeffentlichtem Projekt (Fussnote ⁴)")
		void readFile() {
			assertThat(service.mayReadFile(PUBLIC, project(ProjectStatus.PUBLISHED))).isTrue();
			assertThat(service.mayReadFile(PUBLIC, project(ProjectStatus.DRAFT))).isFalse();
		}

		@Test
		@DisplayName("Reaktion: angemeldet ja, PUBLIC nein, und nur auf Veroeffentlichtes")
		void react() {
			assertThat(service.mayReact(otherStudent, project(ProjectStatus.PUBLISHED))).isTrue();
			assertThat(service.mayReact(admin, project(ProjectStatus.PUBLISHED))).isTrue();
			assertThat(service.mayReact(PUBLIC, project(ProjectStatus.PUBLISHED))).isFalse();
			assertThat(service.mayReact(otherStudent, project(ProjectStatus.DRAFT))).isFalse();
		}

		@Test
		@DisplayName("Portfolio: jede Rolle nur das eigene")
		void portfolio() {
			assertThat(service.mayEditPortfolio(author, author.getId())).isTrue();
			assertThat(service.mayEditPortfolio(author, UUID.randomUUID())).isFalse();
			// Auch der Admin bearbeitet in der Matrix nur (✓) - das eigene.
			assertThat(service.mayEditPortfolio(admin, author.getId())).isFalse();
			assertThat(service.mayEditPortfolio(PUBLIC, author.getId())).isFalse();
		}
	}

	@Nested
	@DisplayName("Zeilen: Zuweisung, Top-10, Administration")
	class Administration {

		@Test
		@DisplayName("Redakteur:innen zuweisen: Admin ✓, Autor:in im Entwurf (✓)³, EDITOR ✗")
		void assignEditors() {
			Project draft = project(ProjectStatus.DRAFT);

			assertThat(service.mayAssignEditors(admin, draft)).isTrue();
			assertThat(service.mayAssignEditors(author, draft)).isTrue();
			assertThat(service.mayAssignEditors(editor, draft)).isFalse();
			assertThat(service.mayAssignEditors(otherStudent, draft)).isFalse();
			// Nach dem Einreichen verteilt nur noch der Admin um.
			assertThat(service.mayAssignEditors(author, project(ProjectStatus.SUBMITTED))).isFalse();
			assertThat(service.mayAssignEditors(admin, project(ProjectStatus.SUBMITTED))).isTrue();
		}

		@Test
		@DisplayName("Der dedizierte Endpoint PUT /projects/{id}/editors bleibt Admin-only, "
				+ "dafuer in jedem Status (§6.1)")
		void reassignEditors() {
			assertThat(service.mayReassignEditors(admin)).isTrue();
			assertThat(service.mayReassignEditors(author)).isFalse();
			assertThat(service.mayReassignEditors(editor)).isFalse();
			assertThat(service.mayReassignEditors(PUBLIC)).isFalse();
		}

		@Test
		@DisplayName("Top-10 nominieren: Redaktion und Admin")
		void nominate() {
			assertThat(service.mayNominate(editor)).isTrue();
			assertThat(service.mayNominate(admin)).isTrue();
			assertThat(service.mayNominate(author)).isFalse();
			assertThat(service.mayNominate(PUBLIC)).isFalse();
		}

		@Test
		@DisplayName("Top-10 kuratieren, User verwalten, Stammdaten, Dashboard: nur Admin")
		void adminOnly() {
			assertThat(service.mayCurateTop10(admin)).isTrue();
			assertThat(service.mayCurateTop10(editor)).isFalse();

			assertThat(service.mayManageUsers(admin)).isTrue();
			assertThat(service.mayManageUsers(editor)).isFalse();
			assertThat(service.mayManageUsers(author)).isFalse();

			assertThat(service.mayManageMasterData(admin)).isTrue();
			assertThat(service.mayManageMasterData(editor)).isFalse();

			assertThat(service.maySeeAdminDashboard(admin)).isTrue();
			assertThat(service.maySeeAdminDashboard(editor)).isFalse();
			assertThat(service.maySeeAdminDashboard(PUBLIC)).isFalse();
		}
	}

	@Nested
	@DisplayName("Voraussetzung: status = ACTIVE (§2.9)")
	class OnlyActiveAccounts {

		@ParameterizedTest
		@EnumSource(value = UserStatus.class, names = {"REGISTRATION_PENDING", "DEACTIVATED"})
		@DisplayName("Ein nicht aktives Konto hat nur PUBLIC-Rechte")
		void inactiveAccounts(UserStatus status) {
			User blockedAdmin = TestUser.create(UUID.randomUUID(), "gesperrt@example.org",
					"gesperrt@hs-bremen.de", Role.ADMIN, status, "hash");
			AuthenticatedUser user = AuthenticatedUser.from(blockedAdmin);
			Project p = project(ProjectStatus.SUBMITTED);

			// Fuer das Anlegen wird eine zweite Rolle geprueft: einem
			// Admin-Konto ist es nach Fussnote 10 ohnehin verwehrt, der Status
			// waere an dieser Zeile also nicht mehr abzulesen.
			User blockedStudent = TestUser.create(UUID.randomUUID(), "gesperrt2@example.org",
					"gesperrt2@hs-bremen.de", Role.STUDENT, status, "hash");
			assertThat(service.mayCreateProject(AuthenticatedUser.from(blockedStudent))).isFalse();

			assertThat(service.mayCreateProject(user)).isFalse();
			assertThat(service.mayApprove(user, p)).isFalse();
			assertThat(service.mayManageUsers(user)).isFalse();
			assertThat(service.mayReadProject(user, p)).isFalse();
			// Veroeffentlichtes bleibt lesbar - das ist der PUBLIC-Rest.
			assertThat(service.mayReadProject(user, project(ProjectStatus.PUBLISHED))).isTrue();
		}
	}
}
