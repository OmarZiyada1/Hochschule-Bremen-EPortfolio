package de.hsbremen.eportfolio.projekt;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Schalter fuer die beiden dokumentierten Default-Annahmen aus API-Contract §7
 * ({@code app.berechtigung}).
 *
 * <p>Beide sind offene Fragen an die Pruefer und deshalb konfigurierbar statt
 * einbetoniert — die Antwort aendert dann eine Property, keinen Code.
 *
 * @param vierAugenPrinzip                 OF 1: Wenn {@code true} (Default),
 *                                         darf ein:e Redakteur:in ein eigenes
 *                                         Projekt weder genehmigen noch
 *                                         veroeffentlichen.
 * @param adminDarfFremdeInhalteBearbeiten OF 2: Wenn {@code false} (Default),
 *                                         aendert ein Admin an fremden
 *                                         Projekten nur den Status ueber die
 *                                         Aktions-Endpoints, nicht die Inhalte.
 */
@ConfigurationProperties(prefix = "app.berechtigung")
public record BerechtigungEigenschaften(
		boolean vierAugenPrinzip,
		boolean adminDarfFremdeInhalteBearbeiten) {
}
