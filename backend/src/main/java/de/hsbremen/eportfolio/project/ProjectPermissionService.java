package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
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
	 * veroeffentlichte Projekte lesen" (PUBLIC ✗, STUDENT (✓), EDITOR ✓,
	 * ADMIN ✓).
	 */
	public boolean mayReadProject(AuthenticatedUser user, Project project) {
		if (project.getStatus() == ProjectStatus.PUBLISHED) {
			return true;
		}
		if (!isLoggedIn(user)) {
			return false;
		}
		// EDITOR steht in der Matrix mit vollem Haken, nicht mit (✓):
		// die Redaktion darf auch nicht zugewiesene Projekte einsehen.
		return user.hasRole(Role.EDITOR, Role.ADMIN) || isProjectSide(user, project);
	}

	/**
	 * Zeile „Statushistorie eines Projekts sehen": PUBLIC ✗, STUDENT (✓)⁷,
	 * EDITOR ✓⁷, ADMIN ✓.
	 *
	 * <p>Fussnote ⁷ engt den Haken bei EDITOR ausdruecklich ein: „Nur die
	 * Projektseite sowie zugewiesene Redaktion und Admin". Deshalb reicht die
	 * System-Rolle EDITOR hier nicht, anders als bei {@link #mayReadProject}.
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

	/** Zeile „Projekt anlegen": alle angemeldeten Rollen ✓. */
	public boolean mayCreateProject(AuthenticatedUser user) {
		return isLoggedIn(user);
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
	 * „Einreichen": DRAFT/REVISION nach SUBMITTED durch die Autor:in.
	 *
	 * <p>ADMIN ist in der Matrix ausdruecklich mit ✗ eingetragen, auch wenn er
	 * das Projekt selbst angelegt haette.
	 */
	public boolean maySubmit(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user) || user.hasRole(Role.ADMIN)) {
			return false;
		}
		if (project.getStatus() != ProjectStatus.DRAFT
				&& project.getStatus() != ProjectStatus.REVISION) {
			return false;
		}
		// §4.1 und §6.1 nennen beide ausdruecklich die Autor:in, nicht die
		// Projektseite. Mitglieder duerfen mitschreiben, aber nicht einreichen.
		return isAuthor(user, project);
	}

	/**
	 * „Genehmigen": SUBMITTED nach APPROVED durch EDITOR (Fussnote ¹) oder
	 * ADMIN.
	 */
	public boolean mayApprove(AuthenticatedUser user, Project project) {
		return mayDecideEditorially(user, project, ProjectStatus.SUBMITTED);
	}

	/**
	 * „Veroeffentlichen": APPROVED nach PUBLISHED durch EDITOR (Fussnote ¹)
	 * oder ADMIN.
	 */
	public boolean mayPublish(AuthenticatedUser user, Project project) {
		return mayDecideEditorially(user, project, ProjectStatus.APPROVED);
	}

	/**
	 * „Zur Ueberarbeitung zurueckgeben": SUBMITTED/APPROVED/PUBLISHED nach
	 * REVISION durch EDITOR oder ADMIN.
	 *
	 * <p>Hier steht in der Matrix kein Fussnotenzeichen ¹, das
	 * Vier-Augen-Prinzip greift also nicht. Das ist plausibel: eine Ruecknahme
	 * ist keine Freigabe und niemand verschafft sich damit einen Vorteil.
	 */
	public boolean mayRequestRevision(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user) || !user.hasRole(Role.EDITOR, Role.ADMIN)) {
			return false;
		}
		return project.getStatus() == ProjectStatus.SUBMITTED
				|| project.getStatus() == ProjectStatus.APPROVED
				|| project.getStatus() == ProjectStatus.PUBLISHED;
	}

	/**
	 * Gemeinsame Pruefung fuer Genehmigen und Veroeffentlichen inklusive
	 * Vier-Augen-Prinzip.
	 *
	 * <p><strong>Zur Reichweite des Vier-Augen-Prinzips:</strong> Fussnote ¹
	 * der Matrix haengt ausschliesslich an den EDITOR-Zellen; die ADMIN-Spalte
	 * traegt einen unmarkierten Haken. Deshalb greift die Sperre hier nur fuer
	 * EDITOR. Ob ein Admin sein eigenes Projekt freigeben koennen soll, ist mit
	 * den Pruefern zu klaeren (siehe Rueckmeldung zu KAN-5).
	 */
	private boolean mayDecideEditorially(AuthenticatedUser user, Project project,
			ProjectStatus expectedStatus) {
		if (!isLoggedIn(user) || project.getStatus() != expectedStatus) {
			return false;
		}
		if (user.hasRole(Role.ADMIN)) {
			return true;
		}
		if (!user.hasRole(Role.EDITOR)) {
			return false;
		}
		if (properties.fourEyesPrinciple() && isAuthor(user, project)) {
			return false;
		}
		return true;
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
	 * Projekt (§3.15). Die Entity {@code StoredFile} gibt es noch nicht; sobald
	 * sie existiert, laesst sich diese Methode direkt darauf anwenden.
	 */
	public boolean mayReadFile(AuthenticatedUser user, Project project) {
		return mayReadProject(user, project);
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
