package de.hsbremen.eportfolio.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Bindung und Vorverarbeitung der Registrierungs-Konfiguration (§3.1.1).
 *
 * <p>Der Kompaktkonstruktor ist die einzige Stelle, an der die Domainlisten
 * angefasst werden; ab da vergleicht der Fachcode nur noch Zeichenketten. Was
 * hier durchrutscht, faellt spaeter niemandem mehr auf, weil eine falsch
 * geschriebene Domain schlicht nie trifft.
 */
class RegistrationPropertiesTest {

	private static RegistrationProperties with(List<String> student, List<String> staff) {
		return new RegistrationProperties(student, staff, Duration.ofHours(24));
	}

	@Test
	@DisplayName("Domains werden kleingeschrieben und getrimmt abgelegt")
	void domainsAreNormalized() {
		RegistrationProperties properties = with(List.of(" Stud.HS-Bremen.DE "), List.of("HS-Bremen.de"));

		assertThat(properties.isStudentDomain("stud.hs-bremen.de")).isTrue();
		assertThat(properties.isStaffDomain("hs-bremen.de")).isTrue();
	}

	@Test
	@DisplayName("Verglichen wird auf Gleichheit, nicht per Suffix")
	void comparisonIsExact() {
		RegistrationProperties properties = with(List.of("stud.hs-bremen.de"), List.of("hs-bremen.de"));

		// Genau der Fall aus §3.1.1: mit endsWith waere diese Domain gueltig.
		assertThat(properties.isStaffDomain("boesehs-bremen.de")).isFalse();
		assertThat(properties.isStudentDomain("nicht.stud.hs-bremen.de")).isFalse();
	}

	@Test
	@DisplayName("Eine leere Mitarbeitendenliste ist zulaessig, §7 Punkt 3 sieht sie ausdruecklich vor")
	void staffDomainsMayBeEmpty() {
		RegistrationProperties properties = with(List.of("stud.hs-bremen.de"), List.of());

		assertThat(properties.staffDomains()).isEmpty();
		assertThat(properties.isStaffDomain("hs-bremen.de")).isFalse();
	}

	@Test
	@DisplayName("Dieselbe Domain in beiden Listen laesst den Start scheitern")
	void overlappingListsFail() {
		// Sonst haenge die Rolle an der Reihenfolge der Pruefung im Code und
		// nicht an der Konfiguration.
		assertThatThrownBy(() -> with(List.of("hs-bremen.de"), List.of("hs-bremen.de")))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("hs-bremen.de");
	}

	@Test
	@DisplayName("Ein Eintrag mit @ ist eine Adresse und keine Domain, das scheitert beim Start")
	void addressInsteadOfDomainFails() {
		assertThatThrownBy(() -> with(List.of("erika@stud.hs-bremen.de"), List.of()))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("student-domains");
	}

	@Test
	@DisplayName("Ein leerer Eintrag scheitert, statt still nie zu treffen")
	void blankEntryFails() {
		assertThatThrownBy(() -> with(Arrays.asList("stud.hs-bremen.de", "  "), List.of()))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("student-domains");
	}

	@Test
	@DisplayName("Ohne Laufzeit gilt der Vorgabewert von 24 Stunden")
	void codeLifetimeFallsBackToDefault() {
		RegistrationProperties properties =
				new RegistrationProperties(List.of("stud.hs-bremen.de"), List.of(), null);

		assertThat(properties.codeLifetime()).isEqualTo(Duration.ofHours(24));
	}

	@Test
	@DisplayName("Eine Laufzeit von null oder weniger waere ein sofort abgelaufener Code")
	void nonPositiveLifetimeFallsBackToDefault() {
		RegistrationProperties zero =
				new RegistrationProperties(List.of("stud.hs-bremen.de"), List.of(), Duration.ZERO);

		assertThat(zero.codeLifetime()).isEqualTo(Duration.ofHours(24));
	}
}
