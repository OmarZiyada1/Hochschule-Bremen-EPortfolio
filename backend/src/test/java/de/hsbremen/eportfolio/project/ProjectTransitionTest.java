package de.hsbremen.eportfolio.project;

import static org.assertj.core.api.Assertions.assertThat;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Prueft die Uebergangstabelle aus API-Contract §4.1 Zeile fuer Zeile und
 * ausserdem, dass sie <em>nur</em> diese Zeilen enthaelt.
 *
 * <p>Der zweite Teil ist der wichtigere: §4.1 sagt „Jeder Uebergang, der nicht in
 * dieser Tabelle steht, wird abgewiesen", und diese Aussage laesst sich nur
 * pruefen, indem alle Kombinationen aus Status und Uebergang durchgezaehlt werden.
 * Bei fuenf Status und fuenf Uebergaengen sind das fuenfundzwanzig Faelle, von
 * denen neun zulaessig sind.
 */
class ProjectTransitionTest {

	/**
	 * Die Tabelle aus §4.1, hier bewusst ein zweites Mal aufgeschrieben: dieser
	 * Test ist gegen den Contract formuliert und nicht gegen die Implementierung.
	 * Wuerde er {@code ProjectTransition.allowedSources()} als Sollwert nehmen,
	 * bestaetigte er nur, dass der Code sich selbst gleicht.
	 */
	private static final Map<ProjectTransition, Set<ProjectStatus>> EXPECTED =
			new EnumMap<>(Map.of(
					ProjectTransition.SUBMIT,
					Set.of(ProjectStatus.DRAFT, ProjectStatus.REVISION),

					ProjectTransition.WITHDRAW,
					Set.of(ProjectStatus.SUBMITTED),

					ProjectTransition.APPROVE,
					Set.of(ProjectStatus.SUBMITTED),

					ProjectTransition.PUBLISH,
					Set.of(ProjectStatus.APPROVED),

					ProjectTransition.REQUEST_REVISION,
					Set.of(ProjectStatus.SUBMITTED, ProjectStatus.APPROVED,
							ProjectStatus.PUBLISHED)));

	@Test
	@DisplayName("Die Zielstatus stehen wie in §4.1")
	void targets() {
		assertThat(ProjectTransition.SUBMIT.target()).isEqualTo(ProjectStatus.SUBMITTED);
		assertThat(ProjectTransition.WITHDRAW.target()).isEqualTo(ProjectStatus.DRAFT);
		assertThat(ProjectTransition.APPROVE.target()).isEqualTo(ProjectStatus.APPROVED);
		assertThat(ProjectTransition.PUBLISH.target()).isEqualTo(ProjectStatus.PUBLISHED);
		assertThat(ProjectTransition.REQUEST_REVISION.target()).isEqualTo(ProjectStatus.REVISION);
	}

	@ParameterizedTest(name = "{0}")
	@EnumSource(ProjectTransition.class)
	@DisplayName("Je Uebergang genau die Ausgangsstatus aus §4.1, und kein weiterer")
	void allowedSources(ProjectTransition transition) {
		assertThat(transition.allowedSources())
				.containsExactlyInAnyOrderElementsOf(EXPECTED.get(transition));

		for (ProjectStatus status : ProjectStatus.values()) {
			assertThat(transition.isAllowedFrom(status))
					.as("%s aus %s", transition, status)
					.isEqualTo(EXPECTED.get(transition).contains(status));
		}
	}

	@Test
	@DisplayName("Es gibt genau fuenf Uebergaenge mit Ausgangsstatus; „Anlegen\" (– nach DRAFT) "
			+ "gehoert nicht dazu")
	void onlyFiveTransitions() {
		assertThat(ProjectTransition.values()).hasSize(5);
		// Nach DRAFT fuehrt seit v50 genau ein Uebergang, das Zurueckziehen.
		// Das Anlegen zaehlt weiter nicht dazu: dorthin kommt ein neues Projekt
		// nur durch POST /api/projects, ohne Ausgangsstatus (§4.1).
		assertThat(ProjectTransition.values())
				.filteredOn(transition -> transition.target() == ProjectStatus.DRAFT)
				.containsExactly(ProjectTransition.WITHDRAW);
	}

	@Test
	@DisplayName("Die Mengen sind unveraenderlich: die Tabelle laesst sich zur Laufzeit nicht "
			+ "erweitern")
	void sourcesAreImmutable() {
		assertThat(ProjectTransition.APPROVE.allowedSources())
				.isUnmodifiable();
	}
}
