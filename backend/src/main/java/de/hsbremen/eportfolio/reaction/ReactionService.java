package de.hsbremen.eportfolio.reaction;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.reaction.dto.ReactionResponse;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die beiden Reaktions-Endpoints aus API-Contract §6.1 (KAN-21): der Zaehler,
 * den die Kacheln der Startseite zeigen (§3.10).
 *
 * <p><strong>Beide Aufrufe sind idempotent.</strong> Ein zweites {@code POST}
 * legt keine zweite Zeile an, ein zweites {@code DELETE} laeuft ins Leere; beide
 * antworten wie beim ersten Mal mit 200 und dem aktuellen Stand. Das ist keine
 * Bequemlichkeit, sondern die Bedingung dafuer, dass ein Knopf in einer
 * Oberflaeche verlaesslich ist: ein Doppelklick, ein wiederholtes Absenden nach
 * einer Zeitueberschreitung oder zwei offene Tabs derselben Person duerfen den
 * Zaehler nicht verfaelschen. Wie das gegen echte Gleichzeitigkeit abgesichert
 * ist, steht an {@link ReactionRepository#insertIfAbsent}.
 *
 * <p><strong>Warum die Anmeldung Pflicht ist.</strong> Der Unique-Constraint
 * {@code (project_id, user_id)} aus §3.10 ist das einzige Mittel gegen
 * Mehrfachzaehlung, und er braucht eine identifizierte Person. Ein Zaehler auf
 * einer oeffentlichen Startseite, den jede:r beliebig oft hochsetzen kann, ist
 * als Signal wertlos. Die Alternative eines nullable {@code userId} fuehrt der
 * Contract als offenen Punkt 8 und wird hier ausdruecklich nicht umgesetzt.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im {@code CommentService},
 * nach §6.3.1: laden (fehlt → 404 {@code PROJECT_NOT_FOUND}) → Berechtigung
 * (nein → 401 ohne Anmeldung, sonst 403 {@code NO_PERMISSION}) → schreiben →
 * zaehlen.
 *
 * <p><strong>Ohne {@code version} im Body</strong>, anders als die schreibenden
 * Projekt-Endpoints (§6.4). Eine Reaktion aendert das Projekt nicht, sie legt
 * eine eigene Zeile daneben; es gibt also nichts, was zwei Personen einander
 * ueberschreiben koennten. §6.1 fuehrt fuer diese beiden Zeilen konsequenterweise
 * gar keinen Body.
 */
@Service
public class ReactionService {

	private final ReactionRepository reactionRepository;

	private final ProjectRepository projectRepository;

	private final ProjectPermissionService permissions;

	public ReactionService(ReactionRepository reactionRepository,
			ProjectRepository projectRepository,
			ProjectPermissionService permissions) {
		this.reactionRepository = reactionRepository;
		this.projectRepository = projectRepository;
		this.permissions = permissions;
	}

	// ------------------------------------------------------------------
	// POST /api/projects/{id}/reaction
	// ------------------------------------------------------------------

	/**
	 * Setzt die Reaktion der angemeldeten Person auf dieses Projekt (§6.1),
	 * <strong>200</strong> mit dem Zaehler.
	 *
	 * <p><strong>200 und nicht 201</strong>, obwohl ein {@code POST} nach §6.3
	 * sonst 201 ergibt: §6.1 legt fuer diese Zeile ausdruecklich 200 fest, und das
	 * passt zur Sache. Ein 201 verspricht eine neu entstandene, adressierbare
	 * Ressource samt {@code Location}; hier gibt es keine, die Reaktion hat keinen
	 * eigenen Endpoint. Beim zweiten Aufruf entsteht ohnehin nichts mehr, ein 201
	 * waere dann schlicht falsch.
	 *
	 * @param user      angemeldete Person; ohne Anmeldung kommt die Anfrage hier
	 *                  nicht an, weil {@code SecurityConfig} auf diesem Pfad nur
	 *                  {@code GET} freigibt (401)
	 * @param projectId ID aus dem Pfad
	 * @throws ResourceNotFoundException wenn es die Projekt-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn das Projekt nicht veroeffentlicht ist
	 *                                   (403)
	 */
	@Transactional
	public ReactionResponse react(AuthenticatedUser user, UUID projectId) {
		requireMayReact(user, projectId);

		reactionRepository.insertIfAbsent(projectId, user.getId());
		return count(projectId);
	}

	// ------------------------------------------------------------------
	// DELETE /api/projects/{id}/reaction
	// ------------------------------------------------------------------

	/**
	 * Nimmt die eigene Reaktion zurueck (§6.1), <strong>200</strong> mit dem
	 * Zaehler.
	 *
	 * <p><strong>Ausschliesslich die eigene.</strong> Der Endpoint bekommt keine
	 * Benutzerkennung, weder im Pfad noch im Body; geloescht wird die Zeile zur
	 * angemeldeten Person. Fremde Reaktionen zu entfernen ist damit kein Recht,
	 * das jemand haben oder nicht haben koennte, sondern etwas, das dieser
	 * Endpoint gar nicht ausdruecken kann.
	 *
	 * <p><strong>204 waere hier falsch</strong>, obwohl §6.3 fuer {@code DELETE}
	 * sonst 204 fuehrt: der Client braucht den neuen Zaehler fuer den Knopf, und
	 * ein 204 hat definitionsgemaess keinen Koerper. §6.1 legt deshalb auch fuer
	 * diese Zeile 200 fest.
	 *
	 * <p><strong>Dieselbe Rechtepruefung wie beim Setzen</strong>, also
	 * einschliesslich {@code PUBLISHED}. Das ist eine Entscheidung aus der
	 * Klaerungsrunde zu KAN-21, weil §6.1 fuer diese Zeile nur „authentifiziert"
	 * nennt: ein zurueckgezogenes Projekt ist fuer die reagierende Person ohnehin
	 * nicht mehr lesbar, ihre Reaktion bleibt bestehen und zaehlt wieder, sobald
	 * es erneut veroeffentlicht wird. Eine Ruecknahme an einem Projekt, das man
	 * gerade nicht sehen darf, waere ein Sonderweg ohne Anwendungsfall.
	 *
	 * @throws ResourceNotFoundException wenn es die Projekt-ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn das Projekt nicht veroeffentlicht ist
	 *                                   (403)
	 */
	@Transactional
	public ReactionResponse withdraw(AuthenticatedUser user, UUID projectId) {
		requireMayReact(user, projectId);

		reactionRepository.deleteByProjectIdAndUserId(projectId, user.getId());
		return count(projectId);
	}

	// ------------------------------------------------------------------
	// Pruefungen und gemeinsame Hilfsmittel
	// ------------------------------------------------------------------

	/**
	 * Laedt das Projekt und prueft die Zeile „Reaktion geben" aus §5 zusammen mit
	 * der Einschraenkung auf veroeffentlichte Projekte aus §3.10
	 * ({@code mayReact}).
	 *
	 * <p><strong>Erst laden, dann pruefen</strong> (§6.3.1): eine unbekannte ID
	 * ergibt 404 und nicht 403, damit ein Tippfehler im Client von einem
	 * Rechteproblem unterscheidbar bleibt.
	 *
	 * <p><strong>Der Status des Projekts entscheidet, nicht die Beziehung zu
	 * ihm.</strong> Auch die Autor:in kann auf ihren eigenen Entwurf nicht
	 * reagieren, obwohl sie ihn lesen darf: §3.10 kennt Reaktionen nur an
	 * veroeffentlichten Projekten. Auf das eigene <em>veroeffentlichte</em>
	 * Projekt darf sie dagegen reagieren; §5 traegt in dieser Zeile drei
	 * unmarkierte Haken und keine Fussnote, die ein Vier-Augen-Prinzip wie beim
	 * Genehmigen einfuehren wuerde.
	 */
	private void requireMayReact(AuthenticatedUser user, UUID projectId) {
		Project project = projectRepository.findById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));

		if (permissions.mayReact(user, project)) {
			return;
		}

		// Die beiden Gruende fuer ein false auseinandergehalten, wie in
		// CommentService.noReadAccess: ohne Anmeldung 401, sonst 403. Der erste
		// Fall kann die Filterkette schon abgefangen haben; die Unterscheidung
		// steht hier trotzdem, damit der Dienst auch fuer sich genommen die
		// richtige Antwort gibt.
		if (user == null || user.getStatus() != UserStatus.ACTIVE) {
			throw new AuthenticationCredentialsNotFoundException(
					"Fuer eine Reaktion ist eine Anmeldung erforderlich (§3.10).");
		}
		throw new AccessDeniedException(
				"Reagieren laesst sich nur auf veroeffentlichte Projekte (§3.10).");
	}

	/**
	 * Der Zaehler fuer die Antwort, immer frisch gezaehlt (§3.10) und nie aus
	 * einem mitgefuehrten Feld gelesen.
	 */
	private ReactionResponse count(UUID projectId) {
		return ReactionResponse.of(reactionRepository.countByProjectId(projectId));
	}
}
