package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ErrorCodes;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.common.error.ValidationException;
import de.hsbremen.eportfolio.project.dto.ProjectBulkStatusRequest;
import de.hsbremen.eportfolio.project.dto.ProjectBulkStatusResponse;
import de.hsbremen.eportfolio.project.dto.ProjectBulkStatusResultResponse;
import de.hsbremen.eportfolio.project.dto.RevisionRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der Sammel-Statuswechsel der Administrationsseite aus §6.1 (KAN-46):
 * {@code POST /api/admin/projects/status}.
 *
 * <p><strong>Dieser Dienst enthaelt keine Uebergangslogik.</strong> Er
 * uebersetzt {@code action} in einen {@link ProjectTransition} und ruft je
 * Projekt dieselbe Methode des {@link ProjectWorkflowService}, die auch der
 * Einzel-Endpoint ruft. Damit gelten Rechtepruefung (§5), Uebergangstabelle
 * (§4.1), Historieneintrag (§3.12), der Top-10-Entzug beim Verlassen von
 * {@code PUBLISHED} (§3.11.1) und der {@code CHANGE_REQUEST}-Kommentar
 * unveraendert. Eine zweite Umsetzung derselben Regeln waere die
 * wahrscheinlichste Stelle, an der der Zustandsautomat spaeter auseinanderlaeuft.
 *
 * <p><strong>Warum es diesen Dienst trotzdem gibt</strong> und der Bulk nicht im
 * {@link ProjectWorkflowService} steht: dort ist jede Methode ein Uebergang, und
 * die Klasse ist ueber ihre gemeinsame Pruefreihenfolge zusammengehalten. Hier
 * geht es um etwas anderes, naemlich um eine Schleife mit Fehlerbehandlung je
 * Zeile. Dazwischen liegt auch die Transaktionsgrenze, und die laesst sich nicht
 * in derselben Klasse zweimal verschieden setzen.
 *
 * <p><strong>Jedes Projekt bekommt seine eigene Transaktion.</strong> Die
 * Schleife selbst laeuft mit {@link Propagation#NOT_SUPPORTED}, also ohne
 * Transaktion und mit einer etwaigen aeusseren ausgesetzt; jeder Aufruf des
 * {@code ProjectWorkflowService} (dort {@code @Transactional}, also
 * {@code REQUIRED}) oeffnet daraufhin seine eigene und schliesst sie sofort
 * wieder. Ohne das machte der erste unzulaessige Uebergang die ganze Transaktion
 * {@code rollback-only}, und die bereits erfolgreichen Uebergaenge waeren wieder
 * weg, obwohl die Antwort sie als erfolgreich meldet.
 *
 * <p><strong>Was hier keine Zeile wird, sondern die ganze Anfrage abweist:</strong>
 * eine unbekannte {@code action} und eine fehlende oder ueberfluessige
 * {@code reason}. Beides ist ein Fehler im Aufruf und keine Eigenschaft eines
 * einzelnen Projekts; die Antwort ist deshalb 400 {@code VALIDATION_FAILED} im
 * Envelope aus §6.2 und keine Liste aus lauter gescheiterten Zeilen.
 */
@Service
public class ProjectAdminService {

	/** Wert von {@code action} fuer {@code POST /api/projects/{id}/publish}. */
	static final String ACTION_PUBLISH = "publish";

	/** Wert von {@code action} fuer {@code POST /api/projects/{id}/request-revision}. */
	static final String ACTION_REQUEST_REVISION = "request-revision";

	private final ProjectWorkflowService workflowService;

	public ProjectAdminService(ProjectWorkflowService workflowService) {
		this.workflowService = workflowService;
	}

	/**
	 * {@code POST /api/admin/projects/status}, <strong>200</strong> mit einer
	 * Ergebnisliste je Projekt.
	 *
	 * <p>Doppelte IDs im Body werden nicht zusammengefasst: die zweite Zeile
	 * findet den erwarteten Ausgangsstatus nicht mehr vor und traegt
	 * {@code PROJECT_STATUS_TRANSITION_INVALID}. Das ist dieselbe Auskunft, die
	 * ein zweiter Aufruf des Einzel-Endpoints gaebe, und ehrlicher als ein
	 * stilles Entfernen: die Antwort behaelt Anzahl und Reihenfolge des Bodys.
	 *
	 * @throws ValidationException wenn {@code action} unbekannt ist oder
	 *                             {@code reason} nicht zur Aktion passt (400)
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public ProjectBulkStatusResponse changeStatus(AuthenticatedUser user,
			ProjectBulkStatusRequest request) {

		ProjectTransition transition = requireKnownAction(request.action());
		RevisionRequest revision = requireMatchingReason(transition, request.reason());

		List<ProjectBulkStatusResultResponse> results = new ArrayList<>(request.projectIds().size());
		for (UUID projectId : request.projectIds()) {
			results.add(apply(user, projectId, transition, revision));
		}

		return new ProjectBulkStatusResponse(List.copyOf(results));
	}

	// ------------------------------------------------------------------
	// Ein Projekt
	// ------------------------------------------------------------------

	/**
	 * Ein Uebergang, ein Ergebnis. Die Ausnahmen des Workflow-Dienstes werden
	 * hier nicht in eine Antwort uebersetzt, sondern in eine Zeile: es sind
	 * dieselben Faelle, die der {@code GlobalExceptionHandler} beim
	 * Einzel-Endpoint auf 404, 403, 409 und 400 abbildet.
	 *
	 * <p>Welche das sind, entscheidet {@link #errorCodeOf}; alles andere wirft
	 * es weiter und ergibt einen 500 fuer die ganze Anfrage.
	 */
	private ProjectBulkStatusResultResponse apply(AuthenticatedUser user, UUID projectId,
			ProjectTransition transition, RevisionRequest revision) {

		try {
			if (transition == ProjectTransition.PUBLISH) {
				workflowService.publish(user, projectId);
			}
			else {
				workflowService.requestRevision(user, projectId, revision);
			}
			return ProjectBulkStatusResultResponse.success(projectId);
		}
		catch (RuntimeException e) {
			return ProjectBulkStatusResultResponse.failure(projectId, errorCodeOf(e));
		}
	}

	/**
	 * Dieselbe Zuordnung, die der {@code GlobalExceptionHandler} beim
	 * Einzel-Endpoint vornimmt, nur in eine Zeile statt in eine Antwort.
	 *
	 * <p>Der {@code default}-Zweig wirft weiter, und das ist der Kern der
	 * Methode: zu einer Zeile wird ausschliesslich, was §6.2 als Fehlercode
	 * einer <em>Anfrage</em> kennt. Alles andere ist ein Programmfehler und
	 * keine Aussage ueber dieses Projekt; es hinter einem 200 als Zeile zu
	 * berichten hiesse, es zu verstecken. Es laeuft stattdessen in den
	 * Auffang-Handler aus KAN-55 und ergibt 500
	 * {@link ErrorCodes#INTERNAL_ERROR} fuer die ganze Anfrage.
	 *
	 * <p>{@code OptimisticLockingFailureException} ist der echte Wettlauf zweier
	 * Transaktionen (§6.4). Sie steht hier, weil sie beim Sammel-Aufruf
	 * wahrscheinlicher ist als beim Einzel-Endpoint und die uebrigen Zeilen
	 * nicht mitreissen darf.
	 */
	private static String errorCodeOf(RuntimeException e) {
		return switch (e) {
			case ResourceNotFoundException notFound -> notFound.getErrorCode();
			case ConflictException conflict -> conflict.getErrorCode();
			case ValidationException validation -> validation.getErrorCode();
			case AccessDeniedException denied -> ErrorCodes.NO_PERMISSION;
			case OptimisticLockingFailureException locking ->
					ErrorCodes.PROJECT_VERSION_CONFLICT;
			default -> throw e;
		};
	}

	// ------------------------------------------------------------------
	// Pruefung des Aufrufs
	// ------------------------------------------------------------------

	/**
	 * Uebersetzt {@code action} in den Uebergang aus §4.1. Die beiden Werte
	 * heissen wie die Einzel-Endpoints aus §6.1 (Contract v32).
	 *
	 * <p>Die uebrigen zwei Uebergaenge aus §4.1 stehen bewusst nicht zur
	 * Auswahl. {@code submit} loest nach §4.1 die Autor:in aus und keine
	 * Verwaltung; {@code approve} ist eine redaktionelle Einzelfallpruefung, und
	 * eine Sammelgenehmigung waere das Gegenteil davon. §6.1 nennt fuer diesen
	 * Endpoint deshalb nur die beiden.
	 */
	private static ProjectTransition requireKnownAction(String action) {
		String trimmed = action.trim();
		if (ACTION_PUBLISH.equals(trimmed)) {
			return ProjectTransition.PUBLISH;
		}
		if (ACTION_REQUEST_REVISION.equals(trimmed)) {
			return ProjectTransition.REQUEST_REVISION;
		}
		throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
				"action: Zulaessig sind nur " + ACTION_PUBLISH + " und " + ACTION_REQUEST_REVISION
						+ ".");
	}

	/**
	 * Prueft {@code reason} gegen die Aktion und baut daraus den Body, den der
	 * Einzel-Endpoint bekaeme.
	 *
	 * <p><strong>Bei {@code publish} muss das Feld fehlen</strong> und ergibt
	 * sonst 400. Eine mitgeschickte, aber folgenlos verworfene Begruendung waere
	 * die schlechteste der drei Moeglichkeiten: die Administration saehe einen
	 * Text abgeschickt, den niemand je liest.
	 *
	 * @return der Body fuer {@link ProjectWorkflowService#requestRevision}, bei
	 *         {@code publish} {@code null}
	 */
	private static RevisionRequest requireMatchingReason(ProjectTransition transition,
			String reason) {

		boolean filled = reason != null && !reason.isBlank();

		if (transition == ProjectTransition.REQUEST_REVISION) {
			if (!filled) {
				throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
						"reason fehlt. Eine Ruecknahme ohne Begruendung laesst die Autor:innen "
								+ "ohne Arbeitsauftrag zurueck (§4.1).");
			}
			return new RevisionRequest(reason);
		}

		if (filled) {
			throw new ValidationException(ErrorCodes.VALIDATION_FAILED,
					"reason gehoert nur zu " + ACTION_REQUEST_REVISION + "; beim "
							+ ACTION_PUBLISH + " gibt es keinen Kommentar, in dem der Text "
							+ "landen koennte.");
		}
		return null;
	}
}
