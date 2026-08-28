package de.hsbremen.eportfolio.editlock;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.error.ConflictException;
import de.hsbremen.eportfolio.common.error.ResourceNotFoundException;
import de.hsbremen.eportfolio.editlock.dto.EditLockHolderResponse;
import de.hsbremen.eportfolio.editlock.dto.EditLockResponse;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.project.ProjectPermissionService;
import de.hsbremen.eportfolio.project.ProjectRepository;
import de.hsbremen.eportfolio.user.UserName;
import de.hsbremen.eportfolio.user.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Die beiden Endpoints der Bearbeitungssperre (§6.9): sich bewerben samt
 * Herzschlag und die eigene Sperre freigeben.
 *
 * <p><strong>Reihenfolge der Pruefungen</strong> wie im {@code BlockService},
 * nach §6.3.1: laden (fehlt → 404) → Berechtigung (nein → 401 ohne Anmeldung,
 * sonst 403) → Statusregel (nein → 409) → Sperre setzen. Eine
 * Versionspruefung gibt es hier nicht: der Herzschlag aendert am Projekt nichts
 * und traegt deshalb auch keine {@code version}.
 *
 * <p><strong>Dieselben Rechte wie der Schreibpfad</strong>
 * ({@code mayEditBlocks}, also Projektseite in {@code DRAFT} und
 * {@code REVISION}). Etwas anderes waere sinnlos: eine Sperre, die halten darf,
 * wer nicht schreiben darf, sperrte nur diejenigen aus, die es duerfen. Und ein
 * Konto ausserhalb des Projekts erfaehrt so nicht ueber den Umweg der
 * Sperranzeige, wer an einem fremden Entwurf sitzt.
 *
 * <p><strong>Zur Paketrichtung.</strong> Dieser Dienst kennt {@code project},
 * weil er das Projekt fuer 404 und Rechte braucht; {@link EditLockGuard}, den
 * umgekehrt der Schreibpfad ruft, kennt es bewusst nicht. Die beiden Wege
 * beruehren einander nicht: der Guard haengt allein an der Registry, es gibt
 * also keinen Kreis zwischen den Beans.
 */
@Service
public class EditLockService {

	private final ProjectRepository projectRepository;

	private final ProjectPermissionService permissions;

	private final UserRepository userRepository;

	private final EditLockRegistry registry;

	public EditLockService(ProjectRepository projectRepository,
			ProjectPermissionService permissions, UserRepository userRepository,
			EditLockRegistry registry) {

		this.projectRepository = projectRepository;
		this.permissions = permissions;
		this.userRepository = userRepository;
		this.registry = registry;
	}

	/**
	 * Bewirbt sich um die Sperre und setzt den Herzschlag (§6.9).
	 *
	 * <p><strong>Der Aufruf lehnt nie ab.</strong> Haelt jemand anders, ist das
	 * die Auskunft und kein Fehler: die Antwort nennt die haltende Person und
	 * {@code heldBySelf = false}, und der Client sagt daraufhin, auf wen zu
	 * warten ist. Idempotent: wer schon haelt, behaelt seinen Beginn und
	 * erneuert allein die Frist.
	 *
	 * <p>Der Client ruft das im Takt, deutlich haeufiger als er schreibt. Die
	 * Methode ist deshalb {@code readOnly}: sie laedt ein Projekt und aendert
	 * ausschliesslich den Arbeitsspeicher. Wuerde sie am Projekt etwas
	 * schreiben, erhoehte jeder Herzschlag die {@code version} und erzeugte in
	 * jeder anderen offenen Sitzung genau den Konflikt, den §6.4 abfedern soll.
	 *
	 * @param user      angemeldete Person
	 * @param projectId ID aus dem Pfad
	 * @return wer nach diesem Aufruf haelt
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person nicht zur Projektseite
	 *                                   gehoert (403)
	 * @throws ConflictException         wenn der Status die Bearbeitung sperrt
	 *                                   (409)
	 */
	@Transactional(readOnly = true)
	public EditLockResponse acquire(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		requireEditable(user, project);

		Optional<UserName> self = userRepository.findNameById(user.getId());
		EditLock lock = registry.acquireOrRenew(projectId, user.getId(),
				self.map(UserName::firstName).orElse(null),
				self.map(UserName::lastName).orElse(null));

		return response(lock, user.getId());
	}

	/**
	 * Gibt die eigene Sperre frei (§6.9).
	 *
	 * <p>Eine Beschleunigung, kein Verlass: bleibt der Aufruf aus, weil der Tab
	 * geschlossen, der Rechner eingeschlafen oder das Netz gewechselt wurde,
	 * traegt der Ablauf aus {@code app.edit-lock.ttl} denselben Fall. Deshalb
	 * ist die Methode idempotent und meldet auch dann keinen Fehler, wenn die
	 * Sperre laengst abgelaufen oder uebergegangen ist: der Client ruft sie beim
	 * Verlassen der Seite, und dort ist beides nicht zu wissen.
	 *
	 * <p><strong>Eine fremde Sperre bricht sie nicht</strong>, auch nicht fuer
	 * die Administration. Das ist die Festlegung aus §6.9 und keine Luecke.
	 *
	 * <p><strong>Warum dieselbe Rechtepruefung wie beim Bewerben</strong>,
	 * obwohl das Freigeben der eigenen Sperre niemandem schaden koennte: sonst
	 * antwortete der Endpoint einem fremden Konto mit 204 und bestaetigte damit,
	 * dass es die Projekt-ID gibt. Die Folge der Strenge ist klein und tragbar:
	 * wurde das Projekt zwischenzeitlich eingereicht, endet der Aufruf mit 409
	 * und die Sperre laeuft nach ihrer Frist von selbst ab. Bearbeitbar ist das
	 * Projekt in diesem Zustand ohnehin nicht.
	 *
	 * @param user      angemeldete Person
	 * @param projectId ID aus dem Pfad
	 * @throws ResourceNotFoundException wenn es die ID nicht gibt (404)
	 * @throws AccessDeniedException     wenn die Person nicht zur Projektseite
	 *                                   gehoert (403)
	 * @throws ConflictException         wenn der Status die Bearbeitung sperrt
	 *                                   (409)
	 */
	@Transactional(readOnly = true)
	public void release(AuthenticatedUser user, UUID projectId) {
		Project project = load(projectId);
		requireEditable(user, project);

		registry.release(projectId, user.getId());
	}

	private Project load(UUID projectId) {
		return projectRepository.findById(projectId)
				.orElseThrow(() -> ResourceNotFoundException.forProject(projectId));
	}

	/**
	 * Rechte und Status, in der Reihenfolge aus §6.3.1 und mit derselben
	 * Ruecksicht wie im {@code BlockService}: ein 409 verraet Unbeteiligten
	 * sonst den Status eines fremden Entwurfs.
	 */
	private void requireEditable(AuthenticatedUser user, Project project) {
		if (permissions.mayEditBlocks(user, project)) {
			return;
		}
		if (permissions.isProjectSide(user, project)) {
			throw ConflictException.statusNotEditable(project.getStatus().name());
		}
		throw new AccessDeniedException(
				"Den Beitrag bearbeiten duerfen nur die Autor:in und die Projektmitglieder "
						+ "(§6.9).");
	}

	private EditLockResponse response(EditLock lock, UUID selfId) {
		EditLockHolderResponse holder = new EditLockHolderResponse(
				lock.userId(), lock.firstName(), lock.lastName(), lock.since());
		return new EditLockResponse(holder, lock.userId().equals(selfId));
	}
}
