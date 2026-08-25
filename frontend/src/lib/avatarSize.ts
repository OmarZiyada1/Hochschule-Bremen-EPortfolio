/** Die Stufen, die das Figma-Designsystem tatsaechlich verwendet. */
export type UserAvatarSize = "sm" | "md" | "lg" | "xl"

/**
 * Mass und Schriftgroesse je Avatarstufe.
 *
 * <p>Vier Stufen, jede mit ihrer Fundstelle im Template: 24px in der
 * Autorenzeile der ProjectCard, 28px in der Kopfleiste, 40px in der
 * Nutzertabelle, 96px in der Profilkarte. Eine Stufe ohne Fundstelle kommt
 * nicht dazu, wie bei den Token (Skill frontend-design, Abschnitt 1).
 *
 * <p><strong>Warum die Tabelle hier steht und nicht neben der Komponente.</strong>
 * Sie hat zwei Verwender: {@code UserAvatar} setzt daraus die Klassen, und
 * {@code ProjectPeople} rechnet aus {@code rem} die Breite aus, die eine
 * aufgefaecherte Gruppe braucht (KAN-80). Als zweite Abschrift liefen beide
 * beim naechsten Massewechsel auseinander, und die Gruppe reservierte Platz
 * fuer eine Groesse, die es nicht mehr gibt. Eine eigene Datei und keine
 * Konstante neben der Komponente, weil eine Komponentendatei mit weiteren
 * Exporten das Fast Refresh bricht (Lint
 * {@code react-refresh/only-export-components}), dieselbe Begruendung wie bei
 * {@code lib/people.ts}.
 *
 * <p>{@code rem} und {@code box} sagen dasselbe in zwei Sprachen: {@code box}
 * ist die Tailwind-Klasse, {@code rem} ihr Zahlwert. Sie muessen zueinander
 * passen, und {@code avatarSize.test.ts} prueft genau das.
 */
export const AVATAR_SIZES: Record<
  UserAvatarSize,
  { box: string; initials: string; rem: number }
> = {
  sm: { box: "size-6", initials: "text-xs", rem: 1.5 },
  md: { box: "size-7", initials: "text-xs", rem: 1.75 },
  lg: { box: "size-10", initials: "text-sm", rem: 2.5 },
  xl: { box: "size-24", initials: "text-3xl", rem: 6 },
}

/** Abstand zwischen zwei Gesichtern, wenn die Gruppe aufgefaechert ist. */
export const AVATAR_GROUP_GAP_REM = 0.25

/**
 * Die Breite, die eine aufgefaecherte Gruppe aus {@code count} Gesichtern
 * einnimmt, in rem (KAN-80).
 *
 * <p>Die Gruppe reserviert sie von Anfang an. Ohne das wuchs sie beim Hovern
 * ueber ihre Zeile hinaus, die Kachel brach um und sprang unter dem Zeiger
 * weg; wer dann weiterklicken wollte, traf ins Leere.
 */
export function fannedGroupWidthRem(
  count: number,
  size: UserAvatarSize
): number {
  return count * (AVATAR_SIZES[size].rem + AVATAR_GROUP_GAP_REM)
}
