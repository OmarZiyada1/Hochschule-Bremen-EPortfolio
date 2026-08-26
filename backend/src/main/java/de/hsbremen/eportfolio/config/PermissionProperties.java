package de.hsbremen.eportfolio.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Schalter fuer die beiden dokumentierten Default-Annahmen aus API-Contract §7
 * ({@code app.permission}).
 *
 * <p>Beide sind offene Fragen an die Pruefer und deshalb konfigurierbar statt
 * einbetoniert: die Antwort aendert dann eine Property, keinen Code.
 *
 * @param fourEyesPrinciple         OF 1: Wenn {@code true} (Default), gibt
 *                                  niemand ein Projekt frei, an dem er selbst
 *                                  beteiligt ist, also weder genehmigen noch
 *                                  veroeffentlichen. Seit KAN-82 gilt der
 *                                  Schalter fuer beide Rollen: bis v82 sperrte
 *                                  er nur {@code EDITOR}, weil ein Admin-Konto
 *                                  keine eigenen Projekte haben konnte
 *                                  (§5 Fussnote 1).
 * @param adminMayEditForeignContent OF 2: Wenn {@code false} (Default), aendert
 *                                  ein Admin an fremden Projekten nur den
 *                                  Status ueber die Aktions-Endpoints, nicht
 *                                  die Inhalte.
 */
@ConfigurationProperties(prefix = "app.permission")
public record PermissionProperties(
		boolean fourEyesPrinciple,
		boolean adminMayEditForeignContent) {
}
