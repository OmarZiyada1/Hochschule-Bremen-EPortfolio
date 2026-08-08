package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
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

	/** Eine offene Nominierung (§2.8, {@code PENDING}). */
	public static Top10Nomination pending(Project project, User nominatedBy,
			Integer proposedPosition) {

		Top10Nomination nomination = new Top10Nomination();
		nomination.setProject(project);
		nomination.setNominatedBy(nominatedBy);
		nomination.setProposedPosition(proposedPosition);
		nomination.setStatus(NominationStatus.PENDING);
		return nomination;
	}

	/**
	 * Eine bereits entschiedene Nominierung, fuer die Faelle rund um
	 * {@code NOMINATION_ALREADY_DECIDED}.
	 */
	public static Top10Nomination decided(Project project, User nominatedBy, User decidedBy,
			NominationStatus decision) {

		Top10Nomination nomination = pending(project, nominatedBy, null);
		nomination.setStatus(decision);
		nomination.setDecidedBy(decidedBy);
		nomination.setDecidedAt(Instant.now());
		return nomination;
	}

	private TestTop10() {
	}
}
