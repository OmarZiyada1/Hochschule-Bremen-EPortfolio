package de.hsbremen.eportfolio.config;

import jakarta.validation.constraints.NotEmpty;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Konfiguration der Selbstregistrierung ({@code app.registration}, API-Contract
 * §3.1.1 und §6.8).
 *
 * <p><strong>Warum die Domains konfigurierbar sind und nicht im Code stehen.</strong>
 * Die Hochschule fuehrt mehr als eine Adressendung, und ihr Bestand aendert sich
 * unabhaengig von dieser Software. Stuenden die Domains im Code, waere die
 * Aufnahme einer weiteren Endung ein Codeeingriff mit Neuuebersetzung und
 * Auslieferung, obwohl sich fachlich nichts geaendert hat. §6.8 zaehlt sie
 * ausdruecklich zu den Zusagen an den Client und nicht zu den Interna.
 *
 * <p><strong>Hier steht kein Geheimnis.</strong> Domainlisten und Laufzeit sind
 * oeffentliche Angaben und stehen deshalb im Klartext in {@code application.yml},
 * profilunabhaengig. Eine Pruefung auf nicht aufgeloeste Platzhalter wie in
 * {@link MailProperties} braucht dieser Record nicht: kein Profil setzt diese
 * Werte aus der Umgebung.
 *
 * @param studentDomains Adressendungen, die zur Rolle {@code STUDENT} fuehren.
 *                       Pflicht und nicht leer: eine leere Liste liesse jede
 *                       Registrierung mit 400 scheitern, und das faellt nach
 *                       §6.8 erst auf, wenn sich niemand mehr registrieren kann.
 * @param staffDomains   Adressendungen, die zur Rolle {@code EDITOR} fuehren.
 *                       Darf leer sein, und das ist kein Versehen: §7, offener
 *                       Punkt 3 nennt die leere Liste als vorgesehene
 *                       Gegenmassnahme, falls die Pruefenden die automatische
 *                       Redakteursrolle ablehnen. Dann vergibt sie
 *                       ausschliesslich der Admin.
 * @param codeLifetime   Gueltigkeitsdauer eines Einmalcodes (§3.16). Default 24
 *                       Stunden: der Flow verlangt zwei Postfaecher, davon das
 *                       HSB-Webmail, das viele nur selten oeffnen. Eine kurze
 *                       Frist erzeugt hier vor allem erneuten Versand statt
 *                       Sicherheit; die traegt die Einmalverwendung zusammen mit
 *                       dem Rate-Limit.
 */
@Validated
@ConfigurationProperties(prefix = "app.registration")
public record RegistrationProperties(
		@NotEmpty List<String> studentDomains,
		List<String> staffDomains,
		Duration codeLifetime) {

	/** Siehe {@link #codeLifetime()}. */
	private static final Duration DEFAULT_CODE_LIFETIME = Duration.ofHours(24);

	public RegistrationProperties {
		studentDomains = normalize(studentDomains, "app.registration.student-domains");
		staffDomains = normalize(staffDomains, "app.registration.staff-domains");
		requireDisjoint(studentDomains, staffDomains);

		if (codeLifetime == null || codeLifetime.isNegative() || codeLifetime.isZero()) {
			codeLifetime = DEFAULT_CODE_LIFETIME;
		}
	}

	/**
	 * Ob diese Domain zu einem studentischen Konto gehoert. Erwartet den bereits
	 * kleingeschriebenen Teil hinter dem letzten {@code @}.
	 */
	public boolean isStudentDomain(String domain) {
		return studentDomains.contains(domain);
	}

	/** Gegenstueck zu {@link #isStudentDomain(String)} fuer Mitarbeitendenadressen. */
	public boolean isStaffDomain(String domain) {
		return staffDomains.contains(domain);
	}

	/**
	 * Vereinheitlicht die Liste, damit der Vergleich spaeter reiner
	 * Zeichenkettenvergleich sein kann.
	 *
	 * <p>Kleinschreibung und {@code trim} passieren hier und nicht bei jedem
	 * Vergleich: eine Konfiguration mit {@code Stud.HS-Bremen.de} soll dieselbe
	 * Wirkung haben wie die kleingeschriebene Fassung, und ein einzelner
	 * vergessener {@code toLowerCase} an einer Vergleichsstelle wuerde die
	 * Registrierung fuer eine ganze Endung lautlos abweisen.
	 *
	 * <p>Ein Eintrag mit {@code @} ist eine vollstaendige Adresse und keine
	 * Domain. Er wuerde nie treffen und die Liste damit still um einen wirkungslosen
	 * Eintrag laenger machen, deshalb scheitert stattdessen der Start.
	 */
	private static List<String> normalize(List<String> domains, String key) {
		if (domains == null) {
			return List.of();
		}

		Set<String> normalized = new LinkedHashSet<>();
		for (String domain : domains) {
			if (domain == null || domain.isBlank()) {
				throw new IllegalStateException(
						"%s enthaelt einen leeren Eintrag.".formatted(key));
			}
			String cleaned = domain.trim().toLowerCase(Locale.ROOT);
			if (cleaned.contains("@")) {
				throw new IllegalStateException(
						"%s erwartet Domains ohne \"@\", gefunden: %s".formatted(key, cleaned));
			}
			normalized.add(cleaned);
		}
		return List.copyOf(normalized);
	}

	/**
	 * Dieselbe Domain in beiden Listen waere eine Konfiguration ohne eindeutige
	 * Antwort: die Rolle haenge dann an der Reihenfolge der Pruefung im Code und
	 * nicht an der Konfiguration. Nach §3.1.1 leitet die Domain die Rolle ab, also
	 * muss sie genau eine ergeben.
	 */
	private static void requireDisjoint(List<String> studentDomains, List<String> staffDomains) {
		List<String> both = studentDomains.stream().filter(staffDomains::contains).toList();
		if (!both.isEmpty()) {
			throw new IllegalStateException(
					"Diese Domains stehen in student-domains und in staff-domains zugleich, "
							+ "damit waere die Rolle nicht mehr aus der Domain ableitbar (§3.1.1): "
							+ String.join(", ", both));
		}
	}
}
