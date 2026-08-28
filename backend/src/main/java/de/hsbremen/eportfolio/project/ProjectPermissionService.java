package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.config.PermissionProperties;
import de.hsbremen.eportfolio.user.User;
import java.util.LinkedHashSet;
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
		return isLoggedIn(user) && projectSideIds(project).contains(user.getId());
	}

	/**
	 * Dieselbe Projektseite als Menge von Konten-IDs.
	 *
	 * <p><strong>Warum hier und nicht im Schreibdienst.</strong> „Wer gehoert zum
	 * Projekt" ist eine Frage der Ressourcenebene und wird nach CLAUDE.md an
	 * genau einer Stelle beantwortet. Der {@code ProjectWriteService} braucht sie
	 * fuer die Trennung von Projektseite und Redaktion (§5, Fussnote ³ seit
	 * Contract v61) nicht als Ja-Nein-Frage zu einer Person, sondern als ganze
	 * Menge. Beides aus derselben Quelle zu speisen verhindert, dass die beiden
	 * Fassungen auseinanderlaufen, sobald §3.13 sich aendert.
	 */
	public Set<UUID> projectSideIds(Project project) {
		Set<UUID> ids = new LinkedHashSet<>();
		if (project.getAuthor() != null) {
			ids.add(project.getAuthor().getId());
		}
		for (ProjectMember member : project.getMembers()) {
			if (member.getUser() != null) {
				ids.add(member.getUser().getId());
			}
		}
		return ids;
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
	 * <p><strong>Gilt seit Contract v55 nur noch fuer die Statushistorie.</strong>
	 * Bis v54 hing {@code editors} an derselben Zusage, weil KAN-16 fuer beide
	 * Felder dieselbe Zielgruppe nannte. Fuer ein veroeffentlichtes Projekt
	 * traegt das nicht: siehe {@link #maySeeProjectEditors}.
	 */
	public boolean maySeeProjectInternals(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		return user.hasRole(Role.ADMIN)
				|| isProjectSide(user, project)
				|| isAssignedEditor(user, project);
	}

	/**
	 * Sichtbarkeit von {@code editors} in {@code ProjectDetailResponse}
	 * (§3.3, seit Contract v55).
	 *
	 * <p>Bei {@code PUBLISHED} darf die zugewiesene Redaktion jede:r sehen, auch
	 * ohne Anmeldung; in jedem anderen Status gilt weiter die enge Zusage aus
	 * {@link #maySeeProjectInternals}.
	 *
	 * <p><strong>Warum die Statushistorie nicht mitgeht:</strong> deren
	 * Begruendung in §3.12 zielt auf den Arbeitsprozess, der Verlauf legt offen,
	 * wie oft eine Arbeit zurueckgewiesen wurde. Wer eine <em>veroeffentlichte</em>
	 * Arbeit betreut hat, ist dagegen eine Angabe zum Ergebnis und gehoert zu ihm
	 * wie das Impressum zu einem Text. Das oeffentliche Template
	 * „Projektdetail" fuehrt die Redaktion deshalb an zwei Stellen, im
	 * Redaktionshinweis und in der Metadaten-Seitenleiste; bis v54 waeren beide
	 * fuer PUBLIC dauerhaft leer geblieben (aufgefallen in KAN-32).
	 *
	 * <p>Aus der Trennung folgt ein Nebennutzen, auf den sich das Frontend
	 * stuetzt: {@code statusHistory} ist jetzt das einzige Feld der
	 * Detailantwort, das genau dann steht, wenn die lesende Person die Interna
	 * sehen darf, also Projektseite, zugewiesene Redaktion oder Admin ist
	 * (§5 Fussnote ⁷). Ein Client erkennt den Kreis daran, ohne aus der Rolle
	 * zu raten. Praezisiert mit v56: „am Projekt beteiligt" schloss den Admin
	 * aus, der das Feld sehr wohl sieht.
	 *
	 * <p><strong>Heute ist diese Methode an jeder erreichbaren Stelle wahr</strong>,
	 * und das ist kein Versehen. Wer eine Antwort ueberhaupt zu sehen bekommt,
	 * hat {@link #mayReadProject} passiert; bei einem nicht veroeffentlichten
	 * Projekt laesst die Regel nur Admin, Projektseite und zugewiesene Redaktion
	 * durch, also genau den Kreis von {@link #maySeeProjectInternals}. Formal:
	 * {@code mayReadProject(nicht PUBLISHED)} zieht {@code maySeeProjectInternals}
	 * nach sich. Der Guard im Lesedienst bleibt trotzdem stehen, damit eine
	 * spaetere Lockerung von {@code mayReadProject} das Feld nicht stillschweigend
	 * mit oeffnet: er ist die Verteidigung in der Tiefe, nicht toter Code.
	 */
	public boolean maySeeProjectEditors(AuthenticatedUser user, Project project) {
		return project.getStatus() == ProjectStatus.PUBLISHED
				|| maySeeProjectInternals(user, project);
	}

	// ------------------------------------------------------------------
	// §5: Anlegen und Bearbeiten
	// ------------------------------------------------------------------

	/**
	 * Zeile „Projekt anlegen": STUDENT ✓, EDITOR ✓, ADMIN ✓.
	 *
	 * <p><strong>Bis v82 stand hier ein Kreuz fuer {@code ADMIN}</strong>, und
	 * der Grund war stimmig: die Zeile „Projekt einreichen" gab {@code ADMIN}
	 * ebenfalls eines, ein vom Admin angelegtes Projekt haette {@code DRAFT}
	 * also nie verlassen koennen und waere liegen geblieben (Fussnote 10, seit
	 * v32). Aufgehoben ist nicht dieser Gedanke, sondern seine Voraussetzung:
	 * Einreichen und Zurueckziehen stehen einem Admin jetzt offen, siehe
	 * {@link #mayTrigger}. Ohne diesen zweiten Schritt waere die Zeile hier
	 * nicht zu oeffnen gewesen.
	 *
	 * <p><strong>Anlass ist ein Konto, das beides ist</strong> (KAN-82). Wer mit
	 * einer Mitarbeitendenadresse als {@code EDITOR} ein eigenes Portfolio
	 * fuehrt und zusaetzlich mit der Administration beauftragt wird, kann dafuer
	 * kein zweites Konto bekommen: {@code hsbEmail} ist eindeutig (§3.1). Die
	 * Hochstufung ueber {@code PATCH /admin/users/{id}} haette dieser Person
	 * Portfolio und Projektanlage genommen, ohne dass die Anwendung einen
	 * Ausweg anbietet. {@code ADMIN} ist deshalb die Obermenge und keine
	 * Parallelwelt: erlaubt ist, was mindestens eine der niedrigeren Ebenen
	 * erlaubt. In Kauf genommen ist dabei, dass diese Rechte auch ein reines
	 * Verwaltungskonto traegt, das sie nie benutzt.
	 *
	 * <p>Die Kehrseite steht in {@link #mayDecideEditorially}: wer eigene
	 * Projekte hat, faellt auch als Admin unter das Vier-Augen-Prinzip.
	 */
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
	 * Wer einen Uebergang <em>grundsaetzlich</em> ausloesen darf, ohne den
	 * aktuellen Status zu betrachten: die Rollen- und Beziehungsspalte aus §5
	 * einschliesslich Vier-Augen-Prinzip.
	 *
	 * <p><strong>Eine benannte Ausnahme seit Contract v73:</strong> beim
	 * {@code SUBMIT} haengt das Recht der Redaktion am Ausgangsstatus. §4.1
	 * fuehrt zwei Zeilen auf demselben Endpoint: die Autor:in reicht aus
	 * {@code DRAFT} und {@code REVISION} ein, die zugewiesene Redaktion und
	 * die Administration allein aus {@code REVISION}. Fuer sie ist das kein
	 * Zustandsproblem, sondern eine Frage des Rechts: aus dem Entwurf duerfen
	 * sie ueberhaupt nicht einreichen, und die Antwort ist deshalb
	 * <strong>403</strong> und nicht 409 (§6.3.1). Wer das aendert, aendert
	 * damit auch den Statuscode.
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
			// „Projekt einreichen": STUDENT (✓), EDITOR (✓), ADMIN (✓). §4.1 und
			// §6.1 nennen seit Contract v85 die Projektseite und nicht mehr
			// allein die Autor:in: wer den Inhalt verantwortet, gibt ihn auch
			// zur Pruefung. §3.13.1 begruendet die Mitgliederpflege schon
			// genauso, und bei Abwesenheit der Autor:in kaeme eine
			// Gruppenarbeit sonst nicht weiter. Bis v84 stand hier isAuthor,
			// und damit endeten die Rechte eines Mitglieds vor dem
			// Redaktionsweg, obwohl es denselben Text verantwortet.
			// Eingereicht wird auch so nur das eigene Projekt: die Klammer um
			// den Haken bleibt. Der Ausschluss von ADMIN ist mit KAN-82
			// gefallen, weil ein Admin jetzt selbst anlegen darf
			// (mayCreateProject) und sein Entwurf sonst dauerhaft in DRAFT
			// laege.
			// Seit Contract v73 hat die Zeile ein Gegenstueck: „Projekt zurueck
			// in die Pruefung geben" (§5), also REVISION nach SUBMITTED durch
			// die zugewiesene Redaktion oder die Administration. Bis v72 konnte
			// das allein die Autor:in, und damit war die Ruecknahme ein Weg
			// ohne Rueckweg: wer versehentlich zurueckgegeben oder die
			// Aenderungswuensche selbst erledigt hatte, steckte fest.
			//
			// Ausdruecklich nur aus REVISION. Aus DRAFT reicht weiterhin allein
			// die Projektseite ein; den Entwurf sieht die Redaktion nach §5
			// Fussnote 11 nicht einmal, und ein Einreichen von dort waere ein
			// Zugriff auf etwas, das noch niemand zur Pruefung gegeben hat.
			//
			// Die Rolle wird mitgeprueft, genau wie beim REQUEST_REVISION
			// darunter: eine Zuweisung in project_editor bleibt stehen, wenn
			// ein Konto ueber PATCH /admin/users/{id} von EDITOR auf STUDENT
			// heruntergestuft wird (§3.1.1). Ohne hasRole(EDITOR) kaeme diese
			// Person durch die Rechtepruefung und scheiterte erst beim Lesen
			// der Antwort, also nach dem geschriebenen Statuswechsel.
			case SUBMIT -> isProjectSide(user, project)
					|| (project.getStatus() == ProjectStatus.REVISION
							&& (isAdmin(user)
									|| (user.hasRole(Role.EDITOR)
											&& isAssignedEditor(user, project))));

			// „Projekt zurueckziehen" (§4.1, seit v50): dieselbe Spalte wie beim
			// Einreichen, denn es ist dessen Gegenstueck. Wer einreichen darf,
			// darf die eigene Einreichung zurueckholen, solange die Redaktion
			// nicht entschieden hat, und das ist seit Contract v85 die ganze
			// Projektseite. Ein Mitglied, das einreichen kann, die eigene
			// Einreichung aber nicht zuruecknehmen koennte, stellte einen
			// Zustand her, aus dem es allein nicht mehr herauskaeme. ADMIN geht
			// seit KAN-82 denselben Weg wie beim SUBMIT.
			case WITHDRAW -> isProjectSide(user, project);

			// „Projekt genehmigen" und „veroeffentlichen": EDITOR ✓¹, ADMIN ✓⁵.
			case APPROVE, PUBLISH -> mayDecideEditorially(user, project);

			// „Zur Ueberarbeitung zurueckgeben": EDITOR (✓)¹¹, ADMIN ✓, ohne
			// Fussnote ¹. Das Vier-Augen-Prinzip greift also nicht, und das ist
			// plausibel: eine Ruecknahme ist keine Freigabe, niemand verschafft
			// sich damit einen Vorteil. Seit v42 entscheidet auch hier nur die
			// zugewiesene Redaktion; ein Admin entscheidet auch ohne Zuweisung
			// (§5, Fussnote 5 in der Fassung von v89).
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

	/** „Einreichen": DRAFT/REVISION nach SUBMITTED durch die Projektseite. */
	public boolean maySubmit(AuthenticatedUser user, Project project) {
		return mayPerform(user, project, ProjectTransition.SUBMIT);
	}

	/**
	 * „Zurueckziehen": SUBMITTED nach DRAFT durch die Projektseite (seit v50,
	 * Projektseite statt Autor:in seit v85).
	 */
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
	 * darf, soll auch nicht ueber seine Freigabe entscheiden koennen. Ein Admin
	 * entscheidet unabhaengig von der Join-Tabelle.
	 *
	 * <p><strong>Die Sperre gilt fuer beide Rollen</strong> (KAN-82, zuvor §7,
	 * offener Punkt 7). Bis dahin kehrte {@code ADMIN} hier bedingungslos mit
	 * {@code true} zurueck, weil Fussnote ¹ nur an den EDITOR-Zellen hing. Das
	 * fiel nicht auf, solange ein Admin gar keine eigenen Projekte haben
	 * konnte; seit {@link #mayCreateProject} ihm das erlaubt, faellt es auf.
	 * Inhaltlich lautet das Prinzip „niemand gibt die eigene Arbeit frei", und
	 * das ist eine Aussage ueber die Person und nicht ueber die Rolle.
	 *
	 * <p><strong>Was fuer {@code ADMIN} weiterhin nicht gilt</strong>, ist
	 * Fussnote ¹¹: Ein Admin entscheidet <em>auch ohne</em> Eintrag in
	 * {@code project_editor}. Nur diese eine Pruefung ueberspringt er, nicht die
	 * auf die eigene Beteiligung. Wo dadurch niemand mehr freigeben koennte,
	 * etwa bei einer einzigen Admin-Person ohne zugewiesene Redaktion, hilft
	 * dieselbe Property, die schon fuer EDITOR den Ausweg bildet; ein Sonderweg
	 * im Code entsteht dafuer nicht.
	 *
	 * <p><strong>Bis Contract v88 stand hier „ein Admin steht nie in
	 * {@code project_editor}".</strong> Das war schon damals eine Aussage ueber
	 * den Regelfall und nicht ueber die Technik; seit v89 (KAN-87) ist die
	 * Zuweisung eines Admin-Kontos der vorgesehene Weg in seine Liste „Meine
	 * Reviews" (§5, Fussnote 5). An dieser Methode aendert das nichts: die
	 * Zuweisung ist Arbeitsorganisation und keine Rechtequelle, ein
	 * zugewiesener Admin entscheidet genau wie zuvor, und ein nicht
	 * zugewiesener ebenso.
	 *
	 * <p><strong>Geprueft wird die gesamte Projektseite</strong> (Fussnote ¹ in
	 * der Fassung von Contract v61, KAN-77), also {@link #isProjectSide} und
	 * nicht mehr {@link #isAuthor} allein. Wer an einem Projekt mitgeschrieben
	 * hat, entscheidet nicht ueber seine Freigabe, auch dann nicht, wenn es ihm
	 * als Redaktion zugewiesen ist. Ohne diese Reichweite bliebe die Sperre
	 * ueber zwei Ecken zu umgehen: eine Autor:in traegt ein Projektmitglied mit
	 * der Rolle EDITOR als zustaendige Redaktion ein, und schon entscheidet eine
	 * Beteiligte ueber das gemeinsame Ergebnis.
	 *
	 * <p><strong>Diese Pruefung ist die letzte Sicherung, nicht die
	 * einzige.</strong> Vorgelagert verhindert der {@code ProjectWriteService}
	 * den verbotenen Zustand schon beim Schreiben (§5, Fussnote ³). Hier faengt
	 * er ab, was auf anderem Weg entstanden ist, etwa in Bestandsdaten, die
	 * ausdruecklich nicht rueckwirkend beanstandet werden.
	 *
	 * <p><strong>{@code REQUEST_REVISION} bleibt aussen vor</strong> und laeuft
	 * deshalb nicht ueber diese Methode: die Zeile „Zur Ueberarbeitung
	 * zurueckgeben" traegt in §5 keine Fussnote ¹. Eine Ruecknahme ist keine
	 * Freigabe, sie gibt die Arbeit an die Projektseite zurueck.
	 */
	private boolean mayDecideEditorially(AuthenticatedUser user, Project project) {
		// Erst die Zustaendigkeit (Fussnote 11), dann die Beteiligung
		// (Fussnote 1). Bewusst in zwei Schritten und nicht als eine
		// verneinte Bedingung: die Reihenfolge ist die Aussage.
		boolean responsible = isAdmin(user)
				|| (user.hasRole(Role.EDITOR) && isAssignedEditor(user, project));
		if (!responsible) {
			return false;
		}
		return !properties.fourEyesPrinciple() || !isProjectSide(user, project);
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
	 * <p>Fussnote ³ meint die Auswahl der zustaendigen Redaktion durch die
	 * Projektseite, deshalb hier auf das eigene Projekt und dessen
	 * Arbeitszustaende beschraenkt. Achtung: §6.1 fuehrt
	 * {@code PUT /projects/{id}/editors} als reinen ADMIN-Endpoint. Beides
	 * passt nur zusammen, wenn die studentische Auswahl ueber
	 * {@code POST /projects} laeuft und nicht ueber diesen Endpoint. Siehe
	 * Rueckmeldung zu KAN-5.
	 *
	 * <p>Diese Methode gilt deshalb fuer den <em>eingebetteten</em> Weg, also
	 * das Feld {@code editorIds} in {@code POST /projects} und
	 * {@code PUT /projects/{id}}. Fuer den dedizierten Endpoint gilt
	 * {@link #mayReassignEditors}.
	 *
	 * <p><strong>Mitglieder gehoeren seit Contract v85 dazu</strong> (KAN-86).
	 * Bis v84 nahm §3.13.1 ihnen {@code editorIds} ausdruecklich weg, obwohl
	 * sie sonst dieselben Felder pflegen durften: wer die Redaktion bestimme,
	 * entscheide darueber, wer das Ergebnis beurteilt. Zusammen mit dem
	 * geoeffneten {@code SUBMIT} ergab das eine Sackgasse derselben Bauart wie
	 * die weiter unten beschriebene: {@code editorIds} ist seit v59
	 * Pflichtfeld des Einreichens, ein Mitglied bekaeme also beim Einreichen
	 * 400 {@code PROJECT_INCOMPLETE} und beim Nachtragen der Redaktion 403 und
	 * kaeme ohne die Autor:in nicht weiter. Wer den Beitrag einreichen darf,
	 * benennt deshalb auch die Redaktion, die ihn beurteilt.
	 *
	 * <p><strong>Die eigene Systemrolle spielt keine Rolle</strong> (Fussnote ³
	 * in der Fassung von Contract v60, KAN-77). Bis dahin stand hier ein Zweig,
	 * der die Rolle EDITOR pauschal abwies, auch am eigenen Entwurf. Zusammen
	 * mit dem Pflichtfeld aus §3.3 ergab das eine Sackgasse: eine Autor:in mit
	 * der Rolle EDITOR konnte ihr Projekt weder mit einer Redaktion versehen
	 * (403) noch ohne sie einreichen (400 {@code PROJECT_INCOMPLETE}), es waere
	 * dauerhaft im Entwurf liegengeblieben, bis ein Admin
	 * {@code PUT /projects/{id}/editors} bedient. Das Kreuz der EDITOR-Spalte in
	 * §5 meint fremde Projekte, und die grenzt {@link #isProjectSide} bereits
	 * ab.
	 *
	 * <p><strong>Wen die Projektseite eintragen darf, steht nicht hier.</strong>
	 * Dass niemand sich selbst zuweist und niemand von der Projektseite als
	 * Redaktion eingetragen wird (Fussnote ³ seit v61), ist keine Rechte-,
	 * sondern eine Zustandsfrage: sie haengt am Ergebnis des Schreibvorgangs und
	 * nicht an der anfragenden Rolle. Geprueft wird sie deshalb im
	 * {@code ProjectWriteService} und mit 400, nicht hier und mit 403.
	 *
	 * <p><strong>Der ADMIN-Zweig kennt keine Statusschranke.</strong> Der Satz
	 * „ab {@code SUBMITTED} nur noch der Admin" beschreibt den Weg der
	 * Projektseite, nicht den des Admins: dessen Recht haengt an der Rolle und
	 * nicht am Status, hier wie beim dedizierten Endpoint. Praktisch erreicht
	 * er den eingebetteten Weg nur, wenn er selbst zur Projektseite gehoert,
	 * denn sonst scheitert er vorher an {@code mayEditMetadata}.
	 *
	 * <p><strong>{@code REVISION} zaehlt seit Contract v62 dazu</strong>
	 * (KAN-77). Bis v61 endete dieses Recht mit dem {@code DRAFT}, und
	 * seit {@code editorIds} mit v59 Pflichtfeld des Einreichens ist, hing damit
	 * ein Bestandsprojekt fest: eines, das vor v59 ohne Redaktion eingereicht und
	 * spaeter zur Ueberarbeitung zurueckgegeben wurde, liess sich weder
	 * einreichen (400 {@code PROJECT_INCOMPLETE}) noch mit einer Redaktion
	 * versehen (403), und hinaus fuehrte allein der Weg ueber die Administration.
	 * {@code DRAFT} und {@code REVISION} sind die beiden Arbeitszustaende, in
	 * denen §4.1 ohnehin jede Metadatenaenderung erlaubt; die Zuweisung folgt
	 * jetzt derselben Schranke. Ab {@code SUBMITTED} bleibt es unveraendert beim
	 * Admin und seinem Endpoint, siehe {@link #mayReassignEditors}.
	 */
	public boolean mayAssignEditors(AuthenticatedUser user, Project project) {
		if (!isLoggedIn(user)) {
			return false;
		}
		if (user.hasRole(Role.ADMIN)) {
			return true;
		}
		return isProjectSide(user, project) && isContentEditable(project);
	}

	/**
	 * Der dedizierte Endpoint {@code PUT /projects/{id}/editors} aus §6.1:
	 * „Redaktion umverteilen, jederzeit und unabhaengig vom Status", Rolle
	 * ADMIN.
	 *
	 * <p><strong>Warum getrennt von {@link #mayAssignEditors}:</strong> die
	 * beiden beantworten verschiedene Fragen. Dort geht es um die Auswahl der
	 * Autor:in am eigenen Projekt, solange sie daran arbeitet, hier um den
	 * Eingriff der Administration in ein beliebiges Projekt in beliebigem
	 * Status. Waere es eine Methode, bekaeme entweder die Autor:in Zugriff auf
	 * den Admin-Endpoint oder der
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

	/**
	 * Zeile „Eigene Redaktionszuweisung abgeben" aus §5 (seit Contract v68):
	 * PUBLIC ✗, STUDENT ✗, EDITOR (✓)¹¹, ADMIN (✓)¹¹
	 * ({@code DELETE /api/projects/{id}/editors/me}).
	 *
	 * <p><strong>Geprueft wird die Zuweisung und nicht die Systemrolle.</strong>
	 * EDITOR zu sein heisst nicht, fuer <em>dieses</em> Projekt zustaendig zu
	 * sein (§5 Fussnote 11); der Klammerhaken der Matrix meint genau das. Wer
	 * nicht zugewiesen ist, hat hier nichts abzugeben und bekommt
	 * <strong>403</strong>. Fremde Zuweisungen aendert allein die
	 * Administration ueber {@code PUT /projects/{id}/editors}
	 * ({@link #mayReassignEditors}).
	 *
	 * <p><strong>Die ADMIN-Zelle traegt seit Contract v89 (KAN-87) denselben
	 * Klammerhaken.</strong> Bis v88 stand dort ein Kreuz, weil ein Admin als
	 * nicht zuweisbar galt und deshalb nichts abzugeben hatte; §4.1 beschrieb
	 * den anderen Fall schon damals, und diese Methode verhielt sich seit jeher
	 * danach. Die Matrix ist damit an den Code angeglichen und nicht umgekehrt:
	 * ein zugewiesener Admin traegt sich selbst aus, ein nicht zugewiesener
	 * bekommt <strong>403</strong>.
	 *
	 * <p><strong>Ohne Statuspruefung.</strong> Ob der aktuelle Status das
	 * Abgeben zulaesst, ist eine Frage des Zustandsautomaten (§4.1) und keine
	 * der Rechtematrix; sie steht deshalb im {@code ProjectWorkflowService}
	 * und ergibt einen anderen Statuscode (409 statt 403).
	 */
	public boolean mayResignAsEditor(AuthenticatedUser user, Project project) {
		return isAssignedEditor(user, project);
	}

	/**
	 * Zeile „Projektmitgliedschaft beenden" aus §5 (seit Contract v84, KAN-83):
	 * PUBLIC ✗, STUDENT (✓)¹³, EDITOR (✓)¹³, ADMIN (✓)¹³
	 * ({@code DELETE /api/projects/{id}/members/me}).
	 *
	 * <p><strong>Nur die eigene Zeile.</strong> Der Klammerhaken der Matrix meint
	 * genau das: gepruft wird die Mitgliedschaft und nicht die Systemrolle. Auch
	 * ein Admin geht auf diesem Weg nur selbst; fremde Zeilen entfernt weiterhin
	 * allein die eingebettete Pflege ueber {@code PUT /projects/{id}}
	 * ({@link #mayManageMembers}), und dort bleibt die Statusschranke.
	 *
	 * <p><strong>Die Autor:in kann diesen Weg nicht gehen</strong> und bekommt
	 * 403. Sie ist keine {@code ProjectMember}-Zeile (§3.13.1, Ruecknahme mit
	 * v66), es gaebe also nichts auszutragen; wer sein eigenes Projekt loswerden
	 * will, loescht es (§5, Zeile „Projekt loeschen").
	 *
	 * <p><strong>Ohne Statuspruefung, und zwar absichtlich.</strong> Anders als
	 * bei {@link #mayManageMembers} gibt es hier keine Schranke im
	 * Workflow-Dienst, die noch folgte: §3.13.1 hebt sie fuer das Austragen der
	 * eigenen Person ausdruecklich auf. Die Statusschranke schuetzt den Inhalt
	 * eines eingereichten Projekts; wer nicht laenger als Mitwirkende:r genannt
	 * werden will, muss aber auch nach dem Einreichen und nach dem
	 * Veroeffentlichen gehen koennen, sonst stuende eine Person dauerhaft und
	 * ohne eigenes Zutun in einem fremden Beitrag.
	 */
	public boolean mayLeaveProject(AuthenticatedUser user, Project project) {
		return isMember(user, project);
	}

	/**
	 * Zeile „Eigene Top-10-Nominierungen lesen" aus §5 (seit Contract v68):
	 * EDITOR (✓), ADMIN (✓), jeweils auf die eigenen Vorschlaege beschraenkt
	 * ({@code GET /api/top10-nominations?nominatedBy=me}).
	 *
	 * <p><strong>Warum eine eigene Methode</strong>, obwohl sie heute dieselbe
	 * Rollenmenge prueft wie {@link #mayNominate}: §5 fuehrt zwei Zeilen, und sie
	 * sagen Verschiedenes. Nominieren heisst vorschlagen, dies heisst nachsehen,
	 * was aus dem eigenen Vorschlag geworden ist. Dieselbe Ueberlegung wie bei
	 * {@link #mayReadTop10Audit} gegenueber {@link #mayCurateTop10}.
	 *
	 * <p><strong>Die Einschraenkung auf die eigene Person steckt nicht hier,
	 * sondern im Endpoint</strong>: {@code nominatedBy} laesst allein
	 * {@code me} zu (§6.1). Der Klammerhaken in §5 beschreibt genau das.
	 */
	public boolean mayReadOwnNominations(AuthenticatedUser user) {
		return isLoggedIn(user) && user.hasRole(Role.EDITOR, Role.ADMIN);
	}

	/**
	 * Zeile „Nominierung zurueckziehen" aus §5 (seit Contract v70): PUBLIC ✗,
	 * STUDENT ✗, EDITOR (✓) auf den eigenen Vorschlag, ADMIN ✓ auf jeden
	 * ({@code POST /api/top10-nominations/{id}/withdraw}).
	 *
	 * <p><strong>Die Einschraenkung auf die eigene Person steht hier und nicht
	 * im Endpoint</strong>, anders als bei {@link #mayReadOwnNominations}: dort
	 * schneidet der Pflichtparameter {@code nominatedBy=me} die Ressource
	 * zurecht, hier adressiert der Pfad eine einzelne fremde Nominierung. Der
	 * Klammerhaken der Matrix ist damit eine Ressourcenfrage und gehoert nach
	 * Hausregel 5 in diesen Dienst.
	 *
	 * <p><strong>Ohne Standspruefung.</strong> Ob {@code PENDING} oder
	 * {@code ACCEPTED} zurueckgezogen werden darf, ist eine Frage des Zustands
	 * (§3.11.1) und keine der Rechtematrix; sie steht deshalb im
	 * {@code Top10NominationService} und ergibt 409 statt 403. Dieselbe
	 * Aufteilung wie bei {@link #mayResignAsEditor}.
	 *
	 * @param nominatedById wer den Vorschlag gemacht hat
	 */
	public boolean mayWithdrawNomination(AuthenticatedUser user, UUID nominatedById) {
		if (isAdmin(user)) {
			return true;
		}
		return isLoggedIn(user) && user.hasRole(Role.EDITOR)
				&& user.getId().equals(nominatedById);
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
