/**
 * DTOs der Administrationsseite: die Kennzahlen des Dashboards und die
 * Nutzerverwaltung aus §6.1.
 *
 * <p>{@code AdminUserResponse} ist der einzige Ort im ganzen Projekt, an dem
 * {@code hsbEmail} den Server verlaesst (§3.1). Deshalb steht es hier und nicht
 * neben {@code auth.dto.UserResponse}: waere es dasselbe Record, gelangte die
 * Adresse zwangslaeufig in jede Antwort, die einen User einbettet.
 */
package de.hsbremen.eportfolio.admin.dto;
