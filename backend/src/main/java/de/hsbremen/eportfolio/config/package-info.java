/**
 * Anwendungsweite Spring-Konfiguration (Beans, Security, Web, Properties).
 *
 * <p><strong>Alle {@code @ConfigurationProperties}-Records liegen hier</strong>,
 * auch die eines einzelnen Features (KAN-50). Vorher lagen sie neben dem
 * Feature, das sie liest: {@code JwtProperties} in {@code auth},
 * {@code PermissionProperties} in {@code project}. Mit den Fremddiensten aus
 * API-Contract §6.8 waere daraus eine halbe Regel geworden, denn Speicher und
 * Mailversand gehoeren keinem Feature: {@code StorageProperties} liest KAN-23,
 * {@code MailProperties} liest KAN-51, konfiguriert wird beides aber an einer
 * Stelle. Eine Regel ohne Ausnahme ist die Antwort auf die Frage, wo ein
 * Konfigurationswert steht.
 *
 * <p>Das Paket enthaelt deshalb zweierlei: die Konfigurationsklassen selbst
 * ({@code SecurityConfig}, {@code JpaConfig}, {@code OpenApiConfig}) und die
 * gebundenen Werte ({@code …Properties}) samt der Enums, die deren Auswahl
 * beschreiben ({@code StorageProvider}, {@code MailProvider}). Die fachlichen
 * Enums aus Contract §2 liegen dagegen weiterhin in
 * {@code common.enums}: sie beschreiben Daten, nicht die Umgebung.
 */
package de.hsbremen.eportfolio.config;
