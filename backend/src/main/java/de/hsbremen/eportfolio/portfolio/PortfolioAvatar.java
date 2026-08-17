package de.hsbremen.eportfolio.portfolio;

import java.util.UUID;

/**
 * Profilbild einer Person, Ergebniszeile von
 * {@link PortfolioRepository#findAvatarUrlsByUserIds}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis, dieselbe Rolle wie
 * {@code ReactionCount} im Reaktionsmodul. Es gibt dieses Record, weil die
 * Alternative, das Portfolio je Kachel einzeln zu laden, genau das
 * N+1-Verhalten erzeugen wuerde, das die Kachelliste vermeiden soll.
 *
 * @param userId    Konto, zu dem das Bild gehoert
 * @param avatarUrl Referenz der Form {@code /api/files/{id}} (§3.15.1).
 *                  Konten ohne Bild kommen in der Ergebnisliste gar nicht
 *                  vor; fuer sie bleibt das Feld der Kachel leer
 */
public record PortfolioAvatar(UUID userId, String avatarUrl) {
}
