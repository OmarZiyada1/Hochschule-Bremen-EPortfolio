/**
 * DTOs der Administrationsseite: die Kennzahlen des Dashboards und die
 * Nutzerverwaltung aus §6.1.
 *
 * <p>{@code AdminUserResponse} ist der einzige Ort im ganzen Projekt, an dem
 * {@code hsbEmail} fremder Konten den Server verlaesst; die eigene Adresse
 * fuehren seit v50 auch die Auth-Antworten an die Person selbst (§3.1,
 * KAN-69). Es steht deshalb hier und nicht neben
 * {@code auth.dto.UserResponse}: waere es dasselbe Record, gelangte die
 * Adresse zwangslaeufig in jede Antwort, die einen User einbettet.
 */
package de.hsbremen.eportfolio.admin.dto;
