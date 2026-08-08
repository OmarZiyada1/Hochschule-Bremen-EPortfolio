package de.hsbremen.eportfolio.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Die beiden Regeln aus {@link EmailAddresses}, jede fuer sich.
 *
 * <p>Sie stehen hier und nicht nur im Integrationstest, weil an ihnen die
 * Domainpruefung aus §3.1.1 haengt: {@link EmailAddresses#domainOf} liefert die
 * Zeichenkette, die anschliessend auf Gleichheit mit einem Listeneintrag
 * geprueft wird. Ein Fehler hier waere eine Luecke in der Zugangskontrolle und
 * kein Formatierungsproblem.
 */
class EmailAddressesTest {

	@Test
	@DisplayName("Normalisieren macht klein und schneidet Leerzeichen ab")
	void normalizeTrimsAndLowercases() {
		assertThat(EmailAddresses.normalize("  Erika@Example.ORG ")).isEqualTo("erika@example.org");
	}

	@Test
	@DisplayName("Normalisieren laesst null stehen, die Pflichtfeldpruefung ist Sache der Bean-Validation")
	void normalizeKeepsNull() {
		assertThat(EmailAddresses.normalize(null)).isNull();
	}

	@Test
	@DisplayName("Die Domain ist der kleingeschriebene Teil hinter dem letzten @")
	void domainIsLowercasePartAfterLastAt() {
		assertThat(EmailAddresses.domainOf("Erika@Stud.HS-Bremen.de")).isEqualTo("stud.hs-bremen.de");
	}

	@Test
	@DisplayName("Bei mehreren @ zaehlt das letzte")
	void domainUsesLastAt() {
		// Ein lokaler Teil in Anfuehrungszeichen darf selbst ein @ enthalten.
		// Wuerde hier das erste zaehlen, waere die Domain "b@stud.hs-bremen.de"
		// und die Pruefung liefe ins Leere.
		assertThat(EmailAddresses.domainOf("\"a@b\"@stud.hs-bremen.de")).isEqualTo("stud.hs-bremen.de");
	}

	@Test
	@DisplayName("Eine Eingabe ohne @ hat keine Domain und faellt damit durch die Pruefung")
	void withoutAtThereIsNoDomain() {
		assertThat(EmailAddresses.domainOf("keine-adresse")).isEmpty();
		assertThat(EmailAddresses.domainOf(null)).isEmpty();
	}

	@Test
	@DisplayName("boesehs-bremen.de ist eine andere Domain als hs-bremen.de")
	void lookalikeDomainStaysDistinct() {
		// Der Grund, warum §3.1.1 auf Gleichheit prueft und nicht per endsWith:
		// beide Zeichenketten enden gleich, sind aber verschiedene Domains.
		String lookalike = EmailAddresses.domainOf("x@boesehs-bremen.de");

		assertThat(lookalike).isEqualTo("boesehs-bremen.de");
		assertThat(lookalike).isNotEqualTo("hs-bremen.de");
		assertThat(lookalike.endsWith("hs-bremen.de")).isTrue();
	}
}
