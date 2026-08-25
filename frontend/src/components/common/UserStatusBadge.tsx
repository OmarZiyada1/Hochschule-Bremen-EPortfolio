import { useTranslation } from "react-i18next"

import type { UserStatus } from "@/api/types"
import { Pill, type PillTone } from "@/components/common/Pill"

/*
 * Record ueber den Enum-Typ ohne Standardzweig, wie im StatusBadge: ein
 * vierter Kontostatus bricht den Typecheck, sobald er im Typ steht, statt
 * still auf Grau zu fallen. Der Typ kommt aus der generierten schema.d.ts,
 * die Zusage traegt damit gegen den Contract selbst (§2.9).
 *
 * ACTIVE ist der Normalfall und traegt deshalb den ruhigen gruenen Ton,
 * DEACTIVATED den roten: die Person kommt nicht mehr herein, und das ist
 * die Aussage, die eine Verwaltungsliste auf einen Blick braucht.
 * REGISTRATION_PENDING ist beides nicht, sondern ein Zwischenstand.
 */
const statusTones: Record<UserStatus, PillTone> = {
  ACTIVE: "success",
  DEACTIVATED: "danger",
  REGISTRATION_PENDING: "warning",
}

/**
 * Der Kontostatus als Pille (§2.9, KAN-39).
 *
 * <p>Eigene Komponente statt eines Aufrufs von {@link Pill} je Stelle, weil
 * der Status in der Tabellenzeile <em>und</em> in der Detailansicht steht
 * und beide denselben Ton tragen muessen. Sie liegt neben {@code RoleBadge}
 * und {@code StatusBadge} in der Bibliothek, weil sie wie diese ein
 * Contract-Enum darstellt: die drei gehoeren zusammen, auch wenn dieses
 * bisher nur die Nutzerverwaltung zeigt.
 *
 * <p>Der Ton ist Zugabe und nie die Aussage: die Bedeutung steht in der
 * Beschriftung (SC 1.4.1).
 */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation()

  return <Pill tone={statusTones[status]}>{t(`user.status.${status}`)}</Pill>
}
