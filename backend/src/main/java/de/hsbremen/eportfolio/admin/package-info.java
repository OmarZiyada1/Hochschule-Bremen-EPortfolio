/**
 * Die Administrationsseite (KAN-25): Kennzahlen-Dashboard und Nutzerverwaltung
 * aus §6.1, Abschnitt „Administration".
 *
 * <p><strong>Warum ein eigenes Paket, obwohl sonst nach Fachlichkeit
 * geschnitten wird.</strong> Zwei Gruende, je einer pro Baustein:
 *
 * <ul>
 * <li>Das <strong>Dashboard</strong> gehoert keinem Feature. Es zaehlt Projekte,
 * Konten, Bloecke und Nominierungen zusammen; in eines dieser vier Pakete
 * gelegt, waere es dort ein Fremdkoerper mit drei Abhaengigkeiten nach
 * aussen.</li>
 * <li>Die <strong>Nutzerverwaltung</strong> laege nach dem Schnitt in
 * {@code user}, kann es aber nicht: sie braucht {@code AuthenticatedUser},
 * {@code EmailAddresses} und {@code PasswordPolicy} aus {@code auth}, und
 * {@code auth} kennt bereits {@code user.User} und {@code user.UserRepository}.
 * Aus der heute einseitigen Abhaengigkeit wuerde ein Kreis. Von hier aus zeigen
 * alle Pfeile nach aussen: {@code admin} kennt {@code auth}, {@code user},
 * {@code project}, {@code portfolio} und {@code top10}, und keines von ihnen
 * kennt {@code admin}.</li>
 * </ul>
 *
 * <p><strong>Nicht hier liegen</strong> die uebrigen Admin-Endpoints aus §6.1,
 * und das ist Absicht: die Top-10-Kuratierung steht im {@code Top10AdminController}
 * (Paket {@code top10}), das Stammdaten-CRUD im {@code MasterDataAdminController}
 * (Paket {@code masterdata}). Beide arbeiten auf den Entitaeten ihres Features
 * und ohne Kreis; sie hierher zu ziehen hiesse, den Schnitt nach Fachlichkeit
 * durch einen Schnitt nach Zielgruppe zu ersetzen. Das gemeinsame Merkmal
 * dieser Endpoints ist ihr Pfadpraefix {@code /api/admin} und die Regel in
 * {@code SecurityConfig}, nicht ihr Gegenstand.
 */
package de.hsbremen.eportfolio.admin;
