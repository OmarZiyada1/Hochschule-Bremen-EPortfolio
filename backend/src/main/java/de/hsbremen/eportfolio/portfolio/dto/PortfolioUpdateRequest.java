package de.hsbremen.eportfolio.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code PUT /api/portfolio/me} (§6.1): Biografie und Avatar des
 * eigenen Profils.
 *
 * <p><strong>Der Body beschreibt den Zielzustand, nicht eine Aenderung.</strong>
 * Ein weggelassenes oder auf {@code null} gesetztes Feld leert den bisherigen
 * Wert. Das ist die Bedeutung von {@code PUT} (§6.3) und die Entscheidung aus
 * der Klaerungsrunde zu KAN-22: waeren fehlende Felder „unveraendert", liesse
 * sich eine einmal gesetzte Biografie ueber diesen Endpoint nie wieder loeschen,
 * und die Methode verhielte sich wie ein {@code PATCH}. Das Formular schickt
 * beide Felder ohnehin immer mit.
 *
 * <p><strong>Beide Felder sind optional</strong> und keines ist
 * {@code @NotBlank}: ein Profil ohne Biografie und ohne Bild ist ein gueltiger
 * Zustand, §3.2 fuehrt beide Spalten als nullable.
 *
 * <p><strong>Kein {@code version}-Feld</strong>, anders als bei den schreibenden
 * Projekt-Endpoints (§6.4). Das eigene Portfolio bearbeitet ausschliesslich sein
 * Besitzer (§5); es gibt hier keine zweite Person, deren Arbeit verloren gehen
 * koennte.
 *
 * @param biography Freitext zur eigenen Person, {@code null} loescht ihn
 * @param avatarUrl Profilbild, {@code null} entfernt es
 */
public record PortfolioUpdateRequest(
		@Schema(description = "Freitext zur eigenen Person. null oder weggelassen loescht die "
				+ "bisherige Biografie.", nullable = true)
		@Size(max = 5000, message = "biography ist zu lang (hoechstens 5000 Zeichen).")
		String biography,

		@Schema(description = "Adresse des Profilbilds. null oder weggelassen entfernt es. "
				+ "Wird mit KAN-23 durch eine Datei-ID ersetzt (§3.15).", nullable = true)
		@Size(max = 1024, message = "avatarUrl ist zu lang (hoechstens 1024 Zeichen).")
		String avatarUrl) {
}
