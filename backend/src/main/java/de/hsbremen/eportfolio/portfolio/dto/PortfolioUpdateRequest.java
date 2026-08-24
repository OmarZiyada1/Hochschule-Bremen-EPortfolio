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
 * <p><strong>Die Biografie fasst hoechstens 500 Zeichen</strong> (§3.2, seit
 * Contract v75). Bis dahin stand hier 5000, eine Zahl, die nie im Contract
 * stand; sie ist mit KAN-79 durch die festgeschriebene Grenze ersetzt worden.
 * Dieselbe Grenze traegt die Spalte selbst als {@code varchar(500)}, damit sie
 * nicht allein an dieser Annotation haengt. Kommentartext und die Begruendung
 * eines Aenderungswunsches bleiben davon unberuehrt und weiterhin bei 5000
 * Zeichen (§3.5).
 *
 * <p><strong>Kein {@code version}-Feld</strong>, anders als bei den schreibenden
 * Projekt-Endpoints (§6.4). Das eigene Portfolio bearbeitet ausschliesslich sein
 * Besitzer (§5); es gibt hier keine zweite Person, deren Arbeit verloren gehen
 * koennte.
 *
 * @param biography Freitext zur eigenen Person, hoechstens 500 Zeichen;
 *                  {@code null} loescht ihn
 * @param avatarUrl Profilbild, {@code null} entfernt es
 */
public record PortfolioUpdateRequest(
		@Schema(description = "Freitext zur eigenen Person, hoechstens 500 Zeichen. null oder "
				+ "weggelassen loescht die bisherige Biografie.", nullable = true,
				maxLength = 500)
		@Size(max = 500, message = "biography ist zu lang (hoechstens 500 Zeichen).")
		String biography,

		@Schema(description = "Adresse des Profilbilds. null oder weggelassen entfernt es. "
				+ "Wird mit KAN-23 durch eine Datei-ID ersetzt (§3.15).", nullable = true)
		@Size(max = 1024, message = "avatarUrl ist zu lang (hoechstens 1024 Zeichen).")
		String avatarUrl) {
}
