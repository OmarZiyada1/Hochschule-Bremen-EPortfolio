package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.NominationTier;
import de.hsbremen.eportfolio.common.enums.Top10Action;
import de.hsbremen.eportfolio.project.Project;
import de.hsbremen.eportfolio.user.User;
import java.time.Instant;

/**
 * Baut Top-10-Entitaeten fuer Tests.
 *
 * <p>Liegt in diesem Paket, weil die Konstruktoren von {@link Top10Entry} und
 * {@link Top10Nomination} JPA vorbehalten sind. Beide Fabriken lassen die ID
 * bewusst leer, damit {@code save} ueber {@code persist} statt {@code merge}
 * geht (Begruendung wie bei {@code TestUser.activeWithoutId}).
 *
 * <p><strong>Zum Zweck:</strong> die Helfer schreiben an den Diensten vorbei
 * direkt in die Tabellen. Das ist genau dann richtig, wenn ein Test einen
 * Ausgangszustand braucht, der ueber die API mehrere Aufrufe kostete, oder einen,
 * den die API gar nicht herstellt: etwa einen Eintrag zu einem nicht
 * veroeffentlichten Projekt, mit dem die zweite Sperre in
 * {@code Top10EntryRepository.findVisible} geprueft wird.
 */
public final class TestTop10 {

	/** Ein Platz in der Liste, ohne den Umweg ueber eine Nominierung. */
	public static Top10Entry entry(Project project, int position, Instant addedAt) {
		Top10Entry entry = new Top10Entry();
		entry.setProject(project);
		entry.setPosition(position);
		entry.setAddedAt(addedAt);
		return entry;
	}

	/**
	 * Eine offene Nominierung (§2.8, {@code PENDING}) mit der vorgeschlagenen
	 * Stufe (§2.13, seit Contract v68).
	 *
	 * <p>{@code proposedPosition} setzt der Helfer nicht mehr: das Feld gehoert
	 * seit v68 der Administration und entsteht erst beim Annehmen.
	 */
	public static Top10Nomination pending(Project project, User nominatedBy,
			NominationTier proposedTier) {

		Top10Nomination nomination = new Top10Nomination();
		nomination.setProject(project);
		nomination.setNominatedBy(nominatedBy);
		nomination.setProposedTier(proposedTier);
		nomination.setStatus(NominationStatus.PENDING);
		return nomination;
	}

	/**
	 * Eine bereits entschiedene Nominierung, fuer die Faelle rund um
	 * {@code NOMINATION_ALREADY_DECIDED}.
	 */
	public static Top10Nomination decided(Project project, User nominatedBy, User decidedBy,
			NominationStatus decision) {

		Top10Nomination nomination = pending(project, nominatedBy, NominationTier.TOP_10);
		nomination.setStatus(decision);
		nomination.setDecidedBy(decidedBy);
		nomination.setDecidedAt(Instant.now());
		return nomination;
	}

	/**
	 * Eine Zeile des Aenderungsprotokolls (§3.17), fuer die Lesetests von
	 * {@code GET /api/admin/top10-audit}.
	 *
	 * <p>Der einzige Weg, einen Eintrag zu einem <em>gewaehlten</em> Zeitpunkt zu
	 * bekommen: im Produktivcode setzt {@code Top10AuditService} immer
	 * {@code Instant.now()}, ein Protokoll mit Eintraegen von letzter Woche liesse
	 * sich ueber die API also nicht herstellen. Genau die brauchen die Filter
	 * {@code from} und {@code to}.
	 *
	 * <p>Dass die Setter der Entity paketprivat sind, ist hier kein Hindernis: die
	 * Klasse liegt im selben Paket. Ausserhalb von {@code top10} bleibt das
	 * Protokoll unschreibbar, und das ist die Zusage aus §3.17.
	 */
	public static Top10AuditEntry auditEntry(User admin, Project project, Top10Action action,
			Instant timestamp, Integer previousPosition, Integer newPosition) {

		Top10AuditEntry entry = new Top10AuditEntry();
		entry.setAdmin(admin);
		entry.setProject(project);
		entry.setAction(action);
		entry.setTimestamp(timestamp);
		entry.setPreviousPosition(previousPosition);
		entry.setNewPosition(newPosition);
		return entry;
	}

	private TestTop10() {
	}
}
