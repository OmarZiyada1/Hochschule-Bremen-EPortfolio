package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.config.PermissionProperties;
import de.hsbremen.eportfolio.user.User;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Bildet die Rechtematrix aus API-Contract §5 und die Uebergangstabelle aus
 * §4.1 ab.
 *
 * <p><strong>Warum ein eigener Service:</strong> Rollenannotationen wie
 * {@code @PreAuthorize("hasRole('EDITOR')")} beantworten nur die Frage „darf
 * diese Rolle so etwas ueberhaupt?". Die Matrix kennt aber die Stufe
 * „(✓) = nur eigene Ressource": ob jemand <em>dieses</em> Projekt bearbeiten
 * darf, haengt an {@code authorId}, an der Projektmitgliedschaft (§3.13) und an
 * den zugewiesenen Redakteur:innen (§3.3). Das steht in den Daten, nicht in der
 * Rolle, und laesst sich mit einer Annotation nicht ausdruecken. Beide Ebenen
 * werden gebraucht.
 *
 * <p><strong>Konvention:</strong> {@code user == null} bedeutet PUBLIC, also
 * nicht angemeldet (§2.1). PUBLIC ist kein Enum-Wert und steht nirgends in der
 * Datenbank.
 *
 * <p><strong>Aufrufkontext:</strong> die Methoden lesen {@code author},
 * {@code members} und {@code editors} vom uebergebenen Projekt. Diese
 * Beziehungen sind LAZY und {@code open-in-view} ist aus, die Aufrufer muessen
 * also innerhalb einer Transaktion laufen.
 */
@Service
public class ProjectPermissionService {

	private final PermissionProperties properties;

	public ProjectPermissionService(PermissionProperties properties) {
		this.properties = properties;
	}

	// ------------------------------------------------------------------
	// Grundlegende Beziehungen zwischen Benutzer und Projekt
	// ------------------------------------------------------------------

	/** Ersteller:in und Eigentuemer:in des Projekts ({@code authorId}, §3.3). */
	public boolean isAuthor(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user) || project.getAuthor() == null) {
			return false;
		}
		return user.getId().equals(project.getAuthor().getId());
	}

	/** Co-Autor:in bzw. Mitwirkende:r (§3.13). */
	public boolean isMember(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		return project.getMembers().stream()
				.map(ProjectMember::getUser)
				.anyMatch(member -> member != null && user.getId().equals(member.getId()));
	}

	/**
	 * „Projektseite" im Sinne von §2.4 und §3.13: Autor:in plus
	 * Projektmitglieder, im Gegensatz zu Redaktion und Admin.
	 */
	public boolean isProjectSide(AuthenticatedUser user, Project project) {
		return isAuthor(user, project) || isMember(user, project);
	}

	/**
	 * Betreuende:r Redakteur:in dieses Projekts (Join-Tabelle
	 * {@code project_editor}, §3.3). Nicht zu verwechseln mit der System-Rolle
	 * EDITOR: die sagt nur, dass jemand ueberhaupt Redakteur:in ist, diese
	 * Methode, dass er/sie fuer <em>dieses</em> Projekt zustaendig ist.
	 */
	public boolean isAssignedEditor(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		Set<User> editors = project.getEditors();
		return editors.stream()
				.anyMatch(editor -> editor != null && user.getId().equals(editor.getId()));
	}

	// ------------------------------------------------------------------
	// §5: Lesen
	// ------------------------------------------------------------------

	/**
	 * Zeile „Veroeffentlichte Projekte lesen" (alle ✓) und „Nicht-
	 * veroeffentlichte Projekte lesen" (PUBLIC ✗, STUDENT (✓), EDITOR (✓)¹¹,
	 * ADMIN ✓).
	 *
	 * <p>Fussnote ¹¹ (seit Contract v42): die Redaktion liest nicht mehr jedes
	 * Projekt, sondern nur die ihr zugewiesenen, und diese erst ab der
	 * Einreichung. Ein {@code DRAFT} bleibt Privatsache von Autor:in,
	 * Mitgliedern und Admin, auch gegenueber der bereits zugewiesenen
	 * Redaktion: zu beurteilen gibt es erst etwas, wenn eingereicht ist.
	 */
	public boolean mayReadProject(AuthenticatedUser user, Project project) {
		if (project.getStatus() == ProjectStatus.PUBLISHED) {
			return true;
		}
		if (!isLoggedIn(user)) {
			return false;
		}
		if (user.hasRole(Role.ADMIN) || isProjectSide(user, project)) {
			return true;
		}
		return user.hasRole(Role.EDITOR)
				&& isAssignedEditor(user, project)
				&& project.getStatus() != ProjectStatus.DRAFT;
	}

	/**
	 * Zeile „Statushistorie eines Projekts sehen": PUBLIC ✗, STUDENT (✓)⁷,
	 * EDITOR ✓⁷, ADMIN ✓.
	 *
	 * <p>Fussnote ⁷ engt den Haken bei EDITOR ausdruecklich ein: „Nur die
	 * Projektseite sowie zugewiesene Redaktion und Admin". Die System-Rolle
	 * EDITOR reicht hier nicht; seit v42 gilt dieselbe Einschraenkung auch bei
	 * {@link #mayReadProject}, die Internals-Regel bleibt als eigene, engere
	 * Zusage bestehen (sie greift auch bei PUBLISHED, wo jede:r lesen darf).
	 * §3.12 sagt dasselbe noch einmal in Worten. Der Verlauf legt offen, wie oft
	 * ein Projekt zurueckgewiesen wurde; das ist eine Information ueber den
	 * Arbeitsprozess einer Person und nicht Teil der oeffentlichen Darstellung
	 * ihres Ergebnisses.
	 *
	 * <p><strong>Gilt auch fuer {@code editors}</strong> in
	 * {@code ProjectDetailResponse}: KAN-16 nennt fuer beide Felder dieselbe
	 * Zielgruppe. Wer das Projekt betreut, ist ebenso eine Aussage ueber den
	 * laufenden Begutachtungsvorgang wie der Verlauf selbst; die beiden Felder
	 * auseinanderzuziehen haette keinen fachlichen Grund.
	 */
	public boolean maySeeProjectInternals(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		return user.hasRole(Role.ADMIN)
				|| isProjectSide(user, project)
				|| isAssignedEditor(user, project);
	}

	// ------------------------------------------------------------------
	// §5: Anlegen und Bearbeiten
	// ------------------------------------------------------------------

	/**
	 * Zeile „Projekt anlegen": STUDENT ✓, EDITOR ✓, ADMIN ✗ (Fussnote 10).
	 *
	 * <p><strong>Warum ein Admin-Konto aussen vor bleibt:</strong> bis v32 trug
	 * die Zeile einen Haken fuer alle angemeldeten Rollen und widersprach damit
	 * der Zeile „Projekt einreichen", die {@code ADMIN} seit jeher ein Kreuz
	 * gibt. Ein vom Admin angelegtes Projekt haette {@code DRAFT} nie verlassen
	 * koennen und waere dauerhaft liegen geblieben. Die Administrationsseite
	 * verwaltet fremde Projekte, sie verfasst keine eigenen; wer beides tut, hat
	 * dafuer ein Konto mit {@code STUDENT} oder {@code EDITOR}.
	 *
	 * <p>Unberuehrt bleibt die Zeile „Eigenes Portfolio bearbeiten": Name,
	 * Biografie und Avatar pflegt auch ein Admin-Konto (§3.2). Gesperrt ist
	 * allein das Anlegen neuer Projekte, nicht der Zugriff auf bestehende.
	 */
	public boolean mayCreateProject(AuthenticatedUser user) {
		return isLoggedIn(user) && !user.hasRole(Role.ADMIN);
	}

	/**
	 * Zeile „Projekt-Inhalt bearbeiten": STUDENT (✓), EDITOR (✓), ADMIN siehe
	 * OF 2.
	 *
	 * <p>Vorgeschaltet gilt die harte Regel aus §4.1: Inhalte sind nur in
	 * {@code DRAFT} und {@code REVISION} aenderbar. In den uebrigen Status ist
	 * die Bearbeitung fuer <em>alle</em> gesperrt (409
	 * {@code PROJECT_STATUS_NOT_EDITABLE}), unabhaengig von der Rolle.
	 *
	 * <p><strong>Diese Methode bildet die Matrixzeile ab, nicht den
	 * Block-Endpoint.</strong> Fuer {@code PUT /projects/{id}/blocks} gilt die
	 * engere Endpoint-Zeile aus §6.1, siehe {@link #mayEditBlocks}. Die Methode
	 * bleibt trotzdem stehen: sie ist die Umsetzung der Zeile „Projekt-Inhalt
	 * bearbeiten" aus §5 und die richtige Grundlage fuer jeden weiteren Weg, auf
	 * dem Inhalt entsteht, etwa den Datei-Upload zu einem Projekt (§3.15).
	 */
	public boolean mayEditContent(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user) || !isContentEditable(project)) {
			return false;
		}
		if (isProjectSide(user, project)) {
			return true;
		}
		if (user.hasRole(Role.EDITOR)) {
			// (✓) = nur eigene Ressource, hier: das zugewiesene Projekt.
			return isAssignedEditor(user, project);
		}
		if (user.hasRole(Role.ADMIN)) {
			// OF 2, Default false: Admin aendert Status, nicht fremde Inhalte.
			return properties.adminMayEditForeignContent();
		}
		return false;
	}

	/** §4.1: Inhaltsbearbeitung nur in DRAFT und REVISION. */
	public boolean isContentEditable(Project project) {
		return project.getStatus() == ProjectStatus.DRAFT
				|| project.getStatus() == ProjectStatus.REVISION;
	}

	/**
	 * Metadaten aendern ueber {@code PUT /projects/{id}}: Autor:in und
	 * Projektmitglieder, in {@code DRAFT} und {@code REVISION}.
	 *
	 * <p><strong>Warum enger als {@link #mayEditContent}:</strong> die
	 * Matrixzeile „Projekt-Inhalt bearbeiten" gibt der Redaktion ein (✓), die
	 * Endpoint-Zeile zu {@code PUT /projects/{id}} in §6.1 nennt dagegen
	 * ausdruecklich nur „Autor:in und Mitglieder". Die Endpoint-Zeile ist die
	 * speziellere Aussage und gewinnt: die Redaktion beurteilt ein Projekt und
	 * schickt es zurueck, sie schreibt nicht die Metadaten ihrer Autor:innen um.
	 *
	 * <p><strong>Zur Fehlerunterscheidung:</strong> diese Methode fasst zwei
	 * Gruende zusammen, die der Client auseinanderhalten muss. Der aufrufende
	 * Dienst prueft deshalb bei einem {@code false} zusaetzlich
	 * {@link #isProjectSide}: gehoert die Person zum Projekt, liegt es am Status
	 * (409 {@code PROJECT_STATUS_NOT_EDITABLE}), sonst am Recht (403
	 * {@code NO_PERMISSION}).
	 */
	public boolean mayEditMetadata(AuthenticatedUser user, Project project) {
		return isProjectSide(user, project) && isContentEditable(project);
	}

	/**
	 * Inhalt aendern ueber {@code PUT /projects/{id}/blocks} (KAN-18):
	 * Autor:in und Projektmitglieder, in {@code DRAFT} und {@code REVISION}.
	 *
	 * <p><strong>Warum enger als {@link #mayEditContent}.</strong> KAN-17 hielt
	 * hier noch fest, fuer die Bloecke stehe die Matrixzeile „Projekt-Inhalt
	 * bearbeiten" mit ihrem (✓) fuer EDITOR ohne Gegenrede. Das trifft nicht zu:
	 * §6.1 fuehrt fuer genau diesen Pfad „Autor:in und Mitglieder, in DRAFT und
	 * REVISION", also dieselbe Einschraenkung wie bei den Metadaten. Nach
	 * derselben Ueberlegung wie dort gewinnt die Endpoint-Zeile als die
	 * speziellere Aussage, und sie passt zum Ablauf aus §4.1: die Redaktion
	 * schreibt einen Aenderungswunsch und gibt das Projekt nach
	 * {@code REVISION} zurueck, sie schreibt nicht im fremden Dokument. Wer den
	 * Text verantwortet, bleibt damit erkennbar dieselbe Person, die ihn
	 * eingereicht hat.
	 *
	 * <p><strong>Warum trotzdem eine eigene Methode</strong> und nicht der Aufruf
	 * von {@link #mayEditMetadata}: die beiden beantworten verschiedene Fragen
	 * und stuetzen sich auf verschiedene Zeilen des Contracts. Sie geben heute
	 * dasselbe zurueck; faellt eine der beiden Zeilen spaeter anders aus, ist
	 * genau eine Methode zu aendern. Dieselbe Ueberlegung wie bei
	 * {@link #mayManageMembers}.
	 *
	 * <p><strong>Zur Fehlerunterscheidung</strong> gilt wie bei den Metadaten:
	 * ein {@code false} kann am Status oder am Recht liegen. Der aufrufende
	 * Dienst prueft deshalb zusaetzlich {@link #isProjectSide} und antwortet
	 * gehoert-zum-Projekt mit 409 {@code PROJECT_STATUS_NOT_EDITABLE}, sonst mit
	 * 403 {@code NO_PERMISSION}.
	 */
	public boolean mayEditBlocks(AuthenticatedUser user, Project project) {
		return isProjectSide(user, project) && isContentEditable(project);
	}

	/**
	 * Zeile „Projektmitglieder pflegen": STUDENT (✓)⁶, EDITOR (✓)⁶, ADMIN ✓.
	 * Fussnote ⁶ und §3.13.1: Autor:in und bestehende Projektmitglieder, nur in
	 * {@code DRAFT} und {@code REVISION}.
	 *
	 * <p>Ein Mitglied darf also weitere Mitglieder aufnehmen und andere
	 * entfernen. Das ist gewollt (§3.13.1): Gruppenarbeiten organisieren sich
	 * nicht ueber eine einzelne privilegierte Person, und bei Abwesenheit der
	 * Autor:in kaeme die Gruppe sonst nicht weiter. Die Schranke ist der Status,
	 * nicht die Person.
	 *
	 * <p><strong>Warum eine eigene Methode</strong>, obwohl sie heute dasselbe
	 * beantwortet wie {@link #mayEditMetadata}: §3.13.1 verlangt sie
	 * ausdruecklich und die beiden Regeln stehen an verschiedenen Stellen des
	 * Contracts. Faellt eine von ihnen spaeter anders aus, etwa weil die
	 * Endpoint-Zeile die Redaktion doch aufnimmt, muss genau eine der beiden
	 * Methoden geaendert werden und nicht eine gemeinsame, an der beide Regeln
	 * unsichtbar haengen.
	 *
	 * <p>Die Zeile in §5 traegt in der ADMIN-Spalte einen vollen Haken. Er greift
	 * hier trotzdem nicht: die Mitgliederliste wird ausschliesslich eingebettet
	 * ueber {@code POST}/{@code PUT /projects} gepflegt, und diese Endpoints
	 * stehen dem Admin nach der Endpoint-Zeile aus §6.1 nicht offen. Ein Admin,
	 * der an einer fremden Mitgliederliste etwas aendern muesste, hat dafuer
	 * derzeit keinen Weg; das ist dieselbe Luecke wie bei offenem Punkt 2 (§7)
	 * und keine eigene Entscheidung dieses Moduls.
	 */
	public boolean mayManageMembers(AuthenticatedUser user, Project project) {
		return mayEditMetadata(user, project);
	}

	/**
	 * Zeile „Projekt loeschen" nach §6.1: Autor:in nur im Entwurf, Admin
	 * jederzeit.
	 */
	public boolean mayDeleteProject(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		if (user.hasRole(Role.ADMIN)) {
			return true;
		}
		return isAuthor(user, project) && project.getStatus() == ProjectStatus.DRAFT;
	}

	// ------------------------------------------------------------------
	// §4.1: Statusuebergaenge
	// ------------------------------------------------------------------

	/**
	 * Wer einen Uebergang <em>grundsaetzlich</em> ausloesen darf, ohne den
	 * aktuellen Status zu betrachten: die Rollen- und Beziehungsspalte aus §5
	 * einschliesslich Vier-Augen-Prinzip.
	 *
	 * <p><strong>Warum die Frage getrennt von der Statusfrage beantwortet
	 * wird.</strong> Ein abgewiesener Uebergang hat zwei verschiedene Antworten:
	 * fehlt das Recht, ist es 403 {@code NO_PERMISSION}, passt nur der Status
	 * nicht, ist es 409 {@code PROJECT_STATUS_TRANSITION_INVALID} (§4.1, §6.3.1).
	 * Waeren beide Gruende in einem {@code boolean} vermischt, koennte der
	 * aufrufende Dienst sie nicht auseinanderhalten. Die Reihenfolge ist dann
	 * bewusst „Recht vor Status", wie schon bei
	 * {@code ProjectWriteService.requireEditable}: sonst verraet ein 409 einer
	 * unbeteiligten Person den Status eines fremden Entwurfs.
	 *
	 * <p>Zusammen mit {@link #mayPerform} bilden diese beiden Methoden die
	 * Tabelle aus §4.1 vollstaendig ab; die Statusseite steht in
	 * {@link ProjectTransition}.
	 */
	public boolean mayTrigger(AuthenticatedUser user, Project project,
			ProjectTransition transition) {

		if (!isLoggedIn(user)) {
			return false;
		}
		return switch (transition) {
			// „Projekt einreichen": STUDENT (✓), EDITOR (✓), ADMIN ✗. §4.1 und
			// §6.1 nennen beide ausdruecklich die Autor:in und nicht die
			// Projektseite: Mitglieder duerfen mitschreiben, aber nicht
			// einreichen. Der Haken bei ADMIN fehlt in der Matrix selbst dann,
			// wenn er das Projekt angelegt hat.
			case SUBMIT -> !user.hasRole(Role.ADMIN) && isAuthor(user, project);

			// „Projekt zurueckziehen" (§4.1, seit v50): dieselbe Spalte wie beim
			// Einreichen, denn es ist dessen Gegenstueck. Wer einreichen darf,
			// darf die eigene Einreichung zurueckholen, solange die Redaktion
			// nicht entschieden hat; ADMIN bleibt aussen vor wie beim SUBMIT.
			case WITHDRAW -> !user.hasRole(Role.ADMIN) && isAuthor(user, project);

			// „Projekt genehmigen" und „veroeffentlichen": EDITOR ✓¹, ADMIN ✓⁵.
			case APPROVE, PUBLISH -> mayDecideEditorially(user, project);

			// „Zur Ueberarbeitung zurueckgeben": EDITOR (✓)¹¹, ADMIN ✓, ohne
			// Fussnote ¹. Das Vier-Augen-Prinzip greift also nicht, und das ist
			// plausibel: eine Ruecknahme ist keine Freigabe, niemand verschafft
			// sich damit einen Vorteil. Seit v42 entscheidet auch hier nur die
			// zugewiesene Redaktion; Admins werden nicht zugewiesen und
			// entscheiden immer.
			case REQUEST_REVISION -> user.hasRole(Role.ADMIN)
					|| (user.hasRole(Role.EDITOR) && isAssignedEditor(user, project));
		};
	}

	/**
	 * Die vollstaendige Pruefung eines Uebergangs: darf diese Person, und laesst
	 * der aktuelle Status es zu (§4.1)?
	 *
	 * <p>Fuer Aufrufer, die nur ein Ja oder Nein brauchen, etwa eine Oberflaeche,
	 * die einen Knopf ausgraut. Der Workflow-Dienst nimmt stattdessen die beiden
	 * Einzelfragen, weil er die Antworten unterscheiden muss.
	 */
	public boolean mayPerform(AuthenticatedUser user, Project project,
			ProjectTransition transition) {

		return mayTrigger(user, project, transition)
				&& transition.isAllowedFrom(project.getStatus());
	}

	/** „Einreichen": DRAFT/REVISION nach SUBMITTED durch die Autor:in. */
	public boolean maySubmit(AuthenticatedUser user, Project project) {
		return mayPerform(user, project, ProjectTransition.SUBMIT);
	}

	/** „Zurueckziehen": SUBMITTED nach DRAFT durch die Autor:in (seit v50). */
	public boolean mayWithdraw(AuthenticatedUser user, Project project) {
		return mayPerform(user, project, ProjectTransition.WITHDRAW);
	}

	/**
	 * „Genehmigen": SUBMITTED nach APPROVED durch die zugewiesene Redaktion
	 * (Fussnoten ¹ und ¹¹) oder ADMIN.
	 */
	public boolean mayApprove(AuthenticatedUser user, Project project) {
		return mayPerform(user, project, ProjectTransition.APPROVE);
	}

	/**
	 * „Veroeffentlichen": APPROVED nach PUBLISHED durch die zugewiesene
	 * Redaktion (Fussnoten ¹ und ¹¹) oder ADMIN.
	 */
	public boolean mayPublish(AuthenticatedUser user, Project project) {
		return mayPerform(user, project, ProjectTransition.PUBLISH);
	}

	/**
	 * „Zur Ueberarbeitung zurueckgeben": SUBMITTED/APPROVED/PUBLISHED nach
	 * REVISION durch die zugewiesene Redaktion (Fussnote ¹¹) oder ADMIN.
	 */
	public boolean mayRequestRevision(AuthenticatedUser user, Project project) {
		return mayPerform(user, project, ProjectTransition.REQUEST_REVISION);
	}

	/**
	 * Gemeinsame Rechtepruefung fuer Genehmigen und Veroeffentlichen inklusive
	 * Vier-Augen-Prinzip.
	 *
	 * <p><strong>Nur die zugewiesene Redaktion entscheidet</strong> (Fussnote
	 * ¹¹, seit Contract v42): wer ein Projekt weder in Liste noch Detail sehen
	 * darf, soll auch nicht ueber seine Freigabe entscheiden koennen. Admins
	 * werden nicht zugewiesen und entscheiden deshalb unabhaengig von der
	 * Join-Tabelle.
	 *
	 * <p><strong>Zur Reichweite des Vier-Augen-Prinzips:</strong> Fussnote ¹
	 * der Matrix haengt ausschliesslich an den EDITOR-Zellen; die ADMIN-Spalte
	 * traegt einen unmarkierten Haken. Deshalb greift die Sperre hier nur fuer
	 * EDITOR. Ob ein Admin sein eigenes Projekt freigeben koennen soll, ist mit
	 * den Pruefern zu klaeren (§7, offener Punkt 7).
	 */
	private boolean mayDecideEditorially(AuthenticatedUser user, Project project) {
		if (user.hasRole(Role.ADMIN)) {
			return true;
		}
		if (!user.hasRole(Role.EDITOR) || !isAssignedEditor(user, project)) {
			return false;
		}
		return !properties.fourEyesPrinciple() || !isAuthor(user, project);
	}

	// ------------------------------------------------------------------
	// §5: Kommentare (§2.3, §2.4)
	// ------------------------------------------------------------------

	/** Zeile „REPLY-Kommentar erstellen": STUDENT (✓), EDITOR ✓, ADMIN ✓. */
	public boolean mayCreateReplyComment(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		return user.hasRole(Role.EDITOR, Role.ADMIN) || isProjectSide(user, project);
	}

	/**
	 * Zeile „NOTE-Kommentar erstellen/lesen": nur EDITOR und ADMIN. Interne
	 * Notizen sind fuer Studierende unsichtbar (§2.3), die Liste in
	 * {@code GET /projects/{id}/comments} muss serverseitig danach filtern.
	 */
	public boolean mayUseNote(AuthenticatedUser user) {
		return isLoggedIn(user) && user.hasRole(Role.EDITOR, Role.ADMIN);
	}

	/** Zeile „CHANGE_REQUEST-Kommentar erstellen": nur EDITOR und ADMIN. */
	public boolean mayCreateChangeRequestComment(AuthenticatedUser user) {
		return isLoggedIn(user) && user.hasRole(Role.EDITOR, Role.ADMIN);
	}

	/**
	 * Zeile „CHANGE_REQUEST-Status setzen": STUDENT (✓)², EDITOR ✓, ADMIN ✓.
	 * Fussnote ²: die Projektseite schaltet einen an sie gerichteten
	 * Aenderungswunsch auf erledigt, nicht die Redaktion (§2.4).
	 */
	public boolean maySetChangeRequestStatus(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		return user.hasRole(Role.EDITOR, Role.ADMIN) || isProjectSide(user, project);
	}

	/**
	 * Endpoint-Zeile {@code PATCH /comments/{id}} aus §6.1: den Text eines
	 * Kommentars aendert ausschliesslich seine Verfasser:in.
	 *
	 * <p><strong>Ausdruecklich auch nicht die Administration</strong>, anders als
	 * bei {@link #mayDeleteComment}: §6.1 fuehrt in dieser Zeile allein die
	 * „Autor:in des Kommentars", in der {@code DELETE}-Zeile zusaetzlich ADMIN.
	 * Das ist stimmig. Ein Kommentar ist die Aeusserung einer Person; wer sie
	 * entfernen darf, darf deshalb noch lange nicht in ihrem Namen etwas anderes
	 * sagen.
	 *
	 * <p><strong>Ohne Kommentar-Entity als Parameter</strong>, sondern mit der ID
	 * der Verfasser:in, aus demselben Grund wie bei {@link #mayEditPortfolio}:
	 * die Antwort braucht nichts weiter, und dieser Dienst liegt im Paket
	 * {@code project}. Ein Verweis von hier auf {@code comment.Comment} machte
	 * aus der einseitigen Abhaengigkeit der beiden Pakete einen Kreis.
	 *
	 * @param commentAuthorId ID der Person, die den Kommentar verfasst hat
	 */
	public boolean mayEditComment(AuthenticatedUser user, UUID commentAuthorId) {
		return isLoggedIn(user) && user.getId().equals(commentAuthorId);
	}

	/**
	 * Endpoint-Zeile {@code DELETE /comments/{id}} aus §6.1: „Autor:in / ADMIN".
	 *
	 * <p>Die Redaktion gehoert nicht dazu, auch nicht die zugewiesene: sie darf
	 * einen fremden Beitrag zurueckgeben, aber nicht die Rueckfrage der Autor:in
	 * daran verschwinden lassen. Zum Parameter siehe {@link #mayEditComment}.
	 *
	 * @param commentAuthorId ID der Person, die den Kommentar verfasst hat
	 */
	public boolean mayDeleteComment(AuthenticatedUser user, UUID commentAuthorId) {
		return mayEditComment(user, commentAuthorId) || isAdmin(user);
	}

	// ------------------------------------------------------------------
	// §5: Dateien, Reaktionen, Portfolio
	// ------------------------------------------------------------------

	/** Zeile „Datei hochladen": STUDENT (✓), EDITOR (✓), ADMIN ✓. */
	public boolean mayUploadFile(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		if (user.hasRole(Role.ADMIN)) {
			return true;
		}
		if (user.hasRole(Role.EDITOR)) {
			return isProjectSide(user, project) || isAssignedEditor(user, project);
		}
		return isProjectSide(user, project);
	}

	/**
	 * Zeile „Datei lesen": die Sichtbarkeit richtet sich nach dem zugehoerigen
	 * Projekt (§3.15). Der {@code FileService} ruft sie fuer Dateien mit
	 * Projektbezug auf; Avatare ({@code projectId = null}) sind ohne Anmeldung
	 * abrufbar und kommen hier gar nicht erst an.
	 */
	public boolean mayReadFile(AuthenticatedUser user, Project project) {
		return mayReadProject(user, project);
	}

	/**
	 * Endpoint-Zeile {@code DELETE /files/{id}} aus §6.1: „Uploader:in /
	 * ADMIN".
	 *
	 * <p>Die Redaktion gehoert bewusst nicht dazu, auch nicht die zugewiesene:
	 * §6.1 fuehrt sie in dieser Zeile nicht, anders als beim Hochladen. Zum
	 * Parameter (ID statt Entity) gilt dasselbe wie bei
	 * {@link #mayEditComment}: die Antwort braucht nichts weiter, und ein
	 * Verweis von hier auf {@code file.StoredFile} machte aus der einseitigen
	 * Abhaengigkeit der Pakete einen Kreis.
	 *
	 * @param uploaderId ID der Person, die die Datei hochgeladen hat
	 */
	public boolean mayDeleteFile(AuthenticatedUser user, UUID uploaderId) {
		return (isLoggedIn(user) && user.getId().equals(uploaderId)) || isAdmin(user);
	}

	/**
	 * Zeile „Reaktion geben": alle angemeldeten Rollen ✓, aber nur auf
	 * veroeffentlichte Projekte (§3.10).
	 */
	public boolean mayReact(AuthenticatedUser user, Project project) {
		return isLoggedIn(user) && project.getStatus() == ProjectStatus.PUBLISHED;
	}

	/** Zeile „Eigenes Portfolio bearbeiten": alle Rollen (✓), nur das eigene. */
	public boolean mayEditPortfolio(AuthenticatedUser user, UUID portfolioOwnerId) {
		return isLoggedIn(user) && user.getId().equals(portfolioOwnerId);
	}

	// ------------------------------------------------------------------
	// §5: Zuweisung, Top-10, Administration
	// ------------------------------------------------------------------

	/**
	 * Zeile „Redakteur:innen einem Projekt zuweisen": STUDENT (✓)³, EDITOR ✗,
	 * ADMIN ✓.
	 *
	 * <p>Fussnote ³ meint die Auswahl der zustaendigen Redaktion beim Anlegen,
	 * deshalb hier auf den eigenen Entwurf beschraenkt. Achtung: §6.1 fuehrt
	 * {@code PUT /projects/{id}/editors} als reinen ADMIN-Endpoint. Beides
	 * passt nur zusammen, wenn die studentische Auswahl ueber
	 * {@code POST /projects} laeuft und nicht ueber diesen Endpoint. Siehe
	 * Rueckmeldung zu KAN-5.
	 *
	 * <p>Diese Methode gilt deshalb fuer den <em>eingebetteten</em> Weg, also
	 * das Feld {@code editorIds} in {@code POST /projects} und
	 * {@code PUT /projects/{id}}. Fuer den dedizierten Endpoint gilt
	 * {@link #mayReassignEditors}. Mitglieder sind hier bewusst nicht dabei:
	 * §3.13.1 nimmt ihnen {@code editorIds} ausdruecklich weg, obwohl sie sonst
	 * dieselben Felder pflegen duerfen. Wer die Redaktion bestimmt, entscheidet
	 * darueber, wer das Ergebnis beurteilt; das bleibt bei der Autor:in.
	 */
	public boolean mayAssignEditors(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		if (user.hasRole(Role.ADMIN)) {
			return true;
		}
		if (user.hasRole(Role.EDITOR)) {
			return false;
		}
		return isAuthor(user, project) && project.getStatus() == ProjectStatus.DRAFT;
	}

	/**
	 * Der dedizierte Endpoint {@code PUT /projects/{id}/editors} aus §6.1:
	 * „Redaktion umverteilen, jederzeit und unabhaengig vom Status", Rolle
	 * ADMIN.
	 *
	 * <p><strong>Warum getrennt von {@link #mayAssignEditors}:</strong> die
	 * beiden beantworten verschiedene Fragen. Dort geht es um die Auswahl der
	 * Autor:in am eigenen Entwurf, hier um den Eingriff der Administration in
	 * ein beliebiges Projekt in beliebigem Status. Waere es eine Methode,
	 * bekaeme entweder die Autor:in Zugriff auf den Admin-Endpoint oder der
	 * Admin verloere den Zugriff auf eingereichte Projekte, also genau die
	 * Faelle, fuer die es diesen Endpoint gibt.
	 *
	 * <p>Ohne Projektbezug, weil die Antwort keinen braucht: der Status spielt
	 * hier ausdruecklich keine Rolle, und ADMIN ist eine reine Rollenfrage.
	 */
	public boolean mayReassignEditors(AuthenticatedUser user) {
		return isAdmin(user);
	}

	/** Zeile „Projekt fuer Top-10 nominieren": EDITOR ✓, ADMIN ✓. */
	public boolean mayNominate(AuthenticatedUser user) {
		return isLoggedIn(user) && user.hasRole(Role.EDITOR, Role.ADMIN);
	}

	/** Zeile „Top-10 kuratieren": nur ADMIN. */
	public boolean mayCurateTop10(AuthenticatedUser user) {
		return isAdmin(user);
	}

	/**
	 * Zeile „Top-10-Protokoll lesen" aus §5: nur ADMIN
	 * ({@code GET /api/admin/top10-audit}, §3.17).
	 *
	 * <p><strong>Warum eine eigene Methode</strong>, obwohl sie heute dasselbe
	 * beantwortet wie {@link #mayCurateTop10}: §5 fuehrt zwei Zeilen, und sie
	 * sagen Verschiedenes. Kuratieren heisst die Liste aendern, das Protokoll
	 * lesen heisst nachsehen, wer sie geaendert hat. Faellt eine der beiden Zeilen
	 * spaeter anders aus, etwa weil die Redaktion ihre eigenen Nominierungen
	 * nachvollziehen soll, ist genau eine Methode zu aendern. Dieselbe
	 * Ueberlegung wie bei {@link #mayManageMembers} und {@link #mayEditBlocks}.
	 *
	 * <p><strong>Nicht zu verwechseln mit der Frage, wer im Protokoll
	 * steht.</strong> Eine Zeile kann eine Person mit der Rolle EDITOR nennen,
	 * weil der Entzug eines Platzes beim Verlassen von {@code PUBLISHED} von der
	 * Redaktion ausgeloest wird (§3.17). Das erweitert das Leserecht nicht.
	 */
	public boolean mayReadTop10Audit(AuthenticatedUser user) {
		return isAdmin(user);
	}

	/** Zeile „User verwalten (inkl. deaktivieren)": nur ADMIN. */
	public boolean mayManageUsers(AuthenticatedUser user) {
		return isAdmin(user);
	}

	/** Zeile „Kategorien / Studiengaenge / Module / Fakultaeten verwalten": nur ADMIN. */
	public boolean mayManageMasterData(AuthenticatedUser user) {
		return isAdmin(user);
	}

	/** Zeile „Admin-Dashboard": nur ADMIN. */
	public boolean maySeeAdminDashboard(AuthenticatedUser user) {
		return isAdmin(user);
	}

	// ------------------------------------------------------------------

	private boolean isAdmin(AuthenticatedUser user) {
		return isLoggedIn(user) && user.hasRole(Role.ADMIN);
	}

	/**
	 * Angemeldet heisst: Benutzer vorhanden <em>und</em> {@code status = ACTIVE}
	 * (§2.9, Hinweis unter der Matrix). Der Filter laesst nicht-aktive Konten
	 * zwar gar nicht erst durch; die Pruefung steht hier trotzdem, damit der
	 * Service auch fuer sich genommen richtig entscheidet.
	 */
	private boolean isLoggedIn(AuthenticatedUser user) {
		return user != null && user.getStatus() == UserStatus.ACTIVE;
	}
}
