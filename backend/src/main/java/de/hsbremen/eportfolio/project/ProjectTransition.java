package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/**
 * Die Uebergangstabelle aus API-Contract §4.1, einmal als Datenstruktur statt
 * viermal als Bedingung im Code.
 *
 * <p><strong>Warum ein eigener Typ.</strong> §4.1 sagt: „Jeder Uebergang, der
 * nicht in dieser Tabelle steht, wird abgewiesen." Ein Zustandsautomat, dessen
 * Regeln in vier Servicemethoden und vier Rechtepruefungen verstreut sind, laesst
 * genau diesen Satz nicht mehr nachlesen; man muesste jede Methode einzeln
 * pruefen, um zu wissen, welche Uebergaenge es gibt. Hier stehen Ausgangs- und
 * Zielstatus je Uebergang an einer Stelle, und {@link #isAllowedFrom} ist die
 * einzige Stelle, an der die Tabelle ausgewertet wird.
 *
 * <p><strong>Der Uebergang „Anlegen" fehlt hier bewusst.</strong> §4.1 fuehrt ihn
 * als „– → DRAFT", also ohne Ausgangsstatus, und er hat keinen eigenen
 * Aktions-Endpoint, sondern faellt bei {@code POST /api/projects} an
 * ({@code ProjectWriteService.create}). Ihn mit einer leeren Menge von
 * Ausgangsstatus aufzunehmen hiesse, den einzigen Fall in diesen Typ zu ziehen,
 * fuer den seine Frage („darf man von hier aus dorthin?") keinen Sinn ergibt.
 * Protokolliert wird er trotzdem, mit {@code fromStatus = null} (§3.12).
 *
 * <p>Die Namen entsprechen den Endpoint-Pfaden aus §6.1
 * ({@code /submit}, {@code /approve}, {@code /publish},
 * {@code /request-revision}), damit von der Anfrage bis zur Regel derselbe
 * Begriff traegt.
 */
public enum ProjectTransition {

	/** Einreichen: {@code DRAFT} oder {@code REVISION} nach {@code SUBMITTED}. */
	SUBMIT(ProjectStatus.SUBMITTED, ProjectStatus.DRAFT, ProjectStatus.REVISION),

	/** Genehmigen: {@code SUBMITTED} nach {@code APPROVED}. */
	APPROVE(ProjectStatus.APPROVED, ProjectStatus.SUBMITTED),

	/** Veroeffentlichen: {@code APPROVED} nach {@code PUBLISHED}. */
	PUBLISH(ProjectStatus.PUBLISHED, ProjectStatus.APPROVED),

	/**
	 * Zur Ueberarbeitung zurueckgeben: {@code SUBMITTED}, {@code APPROVED} oder
	 * {@code PUBLISHED} nach {@code REVISION}. Aus {@code PUBLISHED} heraus ist
	 * das das Zurueckziehen eines schon oeffentlichen Projekts.
	 */
	REQUEST_REVISION(ProjectStatus.REVISION,
			ProjectStatus.SUBMITTED, ProjectStatus.APPROVED, ProjectStatus.PUBLISHED);

	private final ProjectStatus target;

	private final Set<ProjectStatus> allowedSources;

	ProjectTransition(ProjectStatus target, ProjectStatus... allowedSources) {
		this.target = target;
		this.allowedSources = Collections.unmodifiableSet(EnumSet.copyOf(Set.of(allowedSources)));
	}

	/** Status, in dem das Projekt nach dem Uebergang steht. */
	public ProjectStatus target() {
		return target;
	}

	/**
	 * Status, aus denen dieser Uebergang laut §4.1 heraus zulaessig ist. Fuer
	 * Fehlermeldungen und Tests; entschieden wird ueber {@link #isAllowedFrom}.
	 */
	public Set<ProjectStatus> allowedSources() {
		return allowedSources;
	}

	/**
	 * Ob §4.1 diesen Uebergang aus dem angegebenen Status heraus fuehrt. Ein
	 * {@code false} ergibt <strong>409</strong>
	 * {@code PROJECT_STATUS_TRANSITION_INVALID}.
	 */
	public boolean isAllowedFrom(ProjectStatus status) {
		return allowedSources.contains(status);
	}
}
