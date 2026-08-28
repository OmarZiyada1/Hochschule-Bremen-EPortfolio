/**
 * Der Rueckkanal der Anwendung: das oeffentliche Kontaktformular und die
 * Verwaltung der eingegangenen Anfragen (API-Contract §3.20, §6.1 Abschnitt
 * „Support", KAN-85).
 *
 * <p><strong>Ein eigenes Paket und nicht {@code admin}</strong>, obwohl drei der
 * vier Endpoints unter {@code /api/admin} liegen. Das Paket {@code admin} haelt
 * die Verwaltung fremder Ressourcen, die anderswo entstehen: Konten, Projekte,
 * Stammdaten. Die Support-Anfrage entsteht hier selbst, ueber einen Endpoint,
 * den {@code admin} gar nicht bedienen duerfte, denn er ist PUBLIC.
 *
 * <p><strong>Kein {@code may…} im {@code ProjectPermissionService}.</strong>
 * Support ist keine Projektressource; es gibt keine Zeile mit einer Autor:in,
 * keine Zugehoerigkeit und keinen Status, an dem ein Recht haengen koennte. Der
 * Zugriff ist reine Rollenebene und liegt vollstaendig in der Filterkette
 * ({@code /api/admin/**} mit {@code hasRole("ADMIN")}, §5).
 */
package de.hsbremen.eportfolio.support;
