#!/usr/bin/env bash
# ===================================================================
# Pruefung der Server-Einrichtung fuer die automatische Ausrollung
# (KAN-106).
#
# Laeuft auf dem VPS als root (oder mit sudo) und veraendert weder
# Arbeitsverzeichnis noch HEAD noch die .env; das Einzige, was es schreibt,
# ist ein "git fetch" als deploy nach .git/ (origin/main nachholen, wie die
# Ausrollung selbst). Je Punkt eine Zeile OK, FEHLT oder HINWEIS; zu jedem FEHLT der
# Befehl, der den Punkt behebt. Gedacht fuer die einmalige Einrichtung
# (docs/SETUP.md, Abschnitt 10) und fuer den Fall "die Action ist rot, und
# ich weiss nicht, warum":
#
#     sudo bash /opt/eportfolio/deploy/vps-pruefen.sh
#
# Rueckgabewert 0, wenn kein FEHLT gemeldet wurde, sonst 1. HINWEIS-Zeilen
# sind Entscheidungen fuer einen Menschen (SSH-Haertung, Schluessel von
# root) und kein Fehler.
#
# FEHLT bedeutet: deploy/ausrollen.sh wuerde an dieser Stelle abbrechen.
# Die Pruefungen hier sind dieselben wie in dessen Schritt 0, nur dass sie
# alle durchlaufen, statt beim ersten Treffer zu stoppen, und dass sie
# als root auch die Punkte sehen, die deploy nicht sehen kann.
# ===================================================================
set -uo pipefail

VERZEICHNIS=/opt/eportfolio
SICHERUNGEN=/var/backups/eportfolio
NUTZER=deploy
NAMENSRAUM=ghcr.io/omarziyada1
REPOSITORY_SSH=git@github.com:OmarZiyada1/Hochschule-Bremen-EPortfolio.git

fehler=0

ok() {
	printf 'OK       %s\n' "$*"
}

fehlt() {
	printf 'FEHLT    %s\n' "$1"
	if [ -n "${2:-}" ]; then
		printf '         beheben: %s\n' "$2"
	fi
	fehler=1
}

hinweis() {
	printf 'HINWEIS  %s\n' "$*"
}

als_deploy() {
	sudo -u "$NUTZER" -H "$@"
}

if [ "$(id -u)" != 0 ]; then
	echo "Bitte als root ausfuehren: sudo bash $0" >&2
	exit 2
fi

echo "== Nutzer =="
if id -u "$NUTZER" >/dev/null 2>&1; then
	ok "Nutzer $NUTZER vorhanden ($(getent passwd "$NUTZER" | cut -d: -f7))"
	if id -nG "$NUTZER" | tr ' ' '\n' | grep -qx docker; then
		ok "$NUTZER ist Mitglied der Gruppe docker"
	else
		fehlt "$NUTZER ist nicht in der Gruppe docker" "usermod -aG docker $NUTZER"
	fi
	if id -nG "$NUTZER" | tr ' ' '\n' | grep -qxE 'sudo|admin|wheel'; then
		hinweis "$NUTZER hat sudo. Vorgesehen ist: kein sudo, das GitHub-Secret waere sonst ein Root-Zugang (KAN-101)."
	else
		ok "$NUTZER hat kein sudo"
	fi
	case "$(passwd -S "$NUTZER" 2>/dev/null | awk '{print $2}')" in
		L|NP) ok "$NUTZER hat kein Passwort-Login" ;;
		P) hinweis "$NUTZER hat ein Passwort. Vorgesehen ist Anmeldung nur mit Schluessel: passwd -l $NUTZER" ;;
		*) hinweis "Passwortstatus von $NUTZER nicht lesbar" ;;
	esac
	if [ -s "/home/$NUTZER/.ssh/authorized_keys" ]; then
		ok "authorized_keys von $NUTZER vorhanden ($(grep -c . "/home/$NUTZER/.ssh/authorized_keys") Eintraege; einer davon muss zu VPS_SSH_KEY passen)"
	else
		fehlt "/home/$NUTZER/.ssh/authorized_keys fehlt oder ist leer" "docs/SETUP.md Abschnitt 10, Einrichtung Schritt 3"
	fi
else
	fehlt "Nutzer $NUTZER gibt es nicht" "adduser --system --group --shell /bin/bash --home /home/$NUTZER $NUTZER"
fi

echo
echo "== Verzeichnisse und Rechte =="
if [ -d "$VERZEICHNIS" ]; then
	eigentuemer="$(stat -c %U "$VERZEICHNIS")"
	if [ "$eigentuemer" = "$NUTZER" ]; then
		ok "$VERZEICHNIS gehoert $NUTZER"
	else
		fehlt "$VERZEICHNIS gehoert $eigentuemer, nicht $NUTZER" "chown -R $NUTZER:$NUTZER $VERZEICHNIS"
	fi
	if id -u "$NUTZER" >/dev/null 2>&1; then
		fremd="$(find "$VERZEICHNIS" ! -user "$NUTZER" 2>/dev/null | wc -l)"
		if [ "$fremd" = 0 ]; then
			ok "Alle Dateien unter $VERZEICHNIS gehoeren $NUTZER"
		else
			fehlt "$fremd Dateien unter $VERZEICHNIS gehoeren nicht $NUTZER (typisch nach einem git pull als root; Schritt 0 der Ausrollung bricht daran ab)" "chown -R $NUTZER:$NUTZER $VERZEICHNIS"
		fi
	fi
else
	fehlt "$VERZEICHNIS gibt es nicht" "nach Schritt 5b (docs/SETUP.md Abschnitt 10): sudo -u $NUTZER -H git clone $REPOSITORY_SSH $VERZEICHNIS"
fi

if [ -f "$VERZEICHNIS/.env" ]; then
	rechte="$(stat -c '%U %a' "$VERZEICHNIS/.env")"
	if [ "$rechte" = "$NUTZER 600" ]; then
		ok ".env gehoert $NUTZER mit Rechten 600"
	else
		fehlt ".env hat '$rechte', erwartet '$NUTZER 600'" "chown $NUTZER:$NUTZER $VERZEICHNIS/.env && chmod 600 $VERZEICHNIS/.env"
	fi
	for schluessel in POSTGRES_PASSWORD JWT_SECRET APP_DOMAIN APP_BASE_URL ACME_EMAIL; do
		if grep -qE "^$schluessel=." "$VERZEICHNIS/.env"; then
			ok ".env setzt $schluessel"
		else
			fehlt ".env setzt $schluessel nicht" ".env.example, Abschnitt 'Nur im Profil prod'"
		fi
	done
	if grep -q '^COMPOSE_PROFILES=.*edge' "$VERZEICHNIS/.env"; then
		ok ".env schaltet das Profil edge (caddy)"
	else
		fehlt ".env setzt COMPOSE_PROFILES nicht auf edge; ohne caddy ist die Seite von aussen nicht erreichbar" "COMPOSE_PROFILES=edge in die .env"
	fi
	marke="$(sed -n 's/^IMAGE_TAG=//p' "$VERZEICHNIS/.env")"
	if [ -n "$marke" ]; then
		ok ".env traegt IMAGE_TAG=$marke"
	else
		hinweis ".env traegt keinen IMAGE_TAG; die naechste Ausrollung schreibt ihn"
	fi
else
	fehlt "$VERZEICHNIS/.env fehlt" "docs/SETUP.md Abschnitt 10, Erstausrollung Schritt 4"
fi

if [ -d "$SICHERUNGEN" ] && [ "$(stat -c %U "$SICHERUNGEN")" = "$NUTZER" ]; then
	ok "$SICHERUNGEN gehoert $NUTZER ($(find "$SICHERUNGEN" -name 'vor-*.sql.gz' 2>/dev/null | wc -l) Sicherungen der Ausrollung)"
else
	fehlt "$SICHERUNGEN fehlt oder gehoert nicht $NUTZER" "install -d -o $NUTZER -g $NUTZER $SICHERUNGEN"
fi

echo
echo "== Werkzeuge =="
for werkzeug in git docker curl; do
	if command -v "$werkzeug" >/dev/null; then
		ok "$werkzeug vorhanden"
	else
		fehlt "$werkzeug fehlt" "apt install -y $werkzeug"
	fi
done
if docker compose version >/dev/null 2>&1; then
	ok "docker compose $(docker compose version --short)"
else
	fehlt "docker compose fehlt" "Docker-Compose-Plugin installieren"
fi
if [ "$(systemctl is-enabled docker 2>/dev/null)" = enabled ]; then
	ok "Docker startet beim Hochfahren"
else
	fehlt "Docker startet nicht beim Hochfahren" "systemctl enable docker"
fi

echo
echo "== Git als $NUTZER =="
if [ -d "$VERZEICHNIS/.git" ] && id -u "$NUTZER" >/dev/null 2>&1; then
	url="$(als_deploy git -C "$VERZEICHNIS" remote get-url origin 2>/dev/null || echo '?')"
	if [ "$url" = "$REPOSITORY_SSH" ]; then
		ok "origin ist $url"
	else
		fehlt "origin ist '$url', erwartet $REPOSITORY_SSH" "sudo -u $NUTZER -H git -C $VERZEICHNIS remote set-url origin $REPOSITORY_SSH"
	fi
	if [ -f "/home/$NUTZER/.ssh/config" ] && grep -qi 'github.com' "/home/$NUTZER/.ssh/config"; then
		ok "~$NUTZER/.ssh/config kennt github.com"
	else
		hinweis "~$NUTZER/.ssh/config nennt keinen Eintrag fuer github.com. Das stoert nur, wenn der Schluessel keinen Standardnamen traegt; ob es stoert, sagt die naechste Zeile."
	fi
	if meldung="$(als_deploy env GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=15' git -C "$VERZEICHNIS" ls-remote --exit-code --heads origin main 2>&1 >/dev/null)"; then
		ok "$NUTZER kann origin lesen"
	else
		fehlt "$NUTZER kann origin nicht lesen: $meldung" "docs/SETUP.md Abschnitt 10, Einrichtung Schritt 5b (Lese-Schluessel fuer $NUTZER, Deploy-Key bei GitHub ohne Schreibrecht)"
	fi
	zweig="$(als_deploy git -C "$VERZEICHNIS" symbolic-ref --short -q HEAD 2>/dev/null || echo '?')"
	if [ "$zweig" = main ]; then
		ok "main ist ausgecheckt ($(als_deploy git -C "$VERZEICHNIS" log -1 --format='%h %ad' --date=short))"
	else
		fehlt "ausgecheckt ist '$zweig', erwartet main" "sudo -u $NUTZER -H git -C $VERZEICHNIS checkout main"
	fi
	aenderungen="$(als_deploy git -C "$VERZEICHNIS" -c core.fileMode=false status --porcelain --untracked-files=no 2>/dev/null)"
	if [ -z "$aenderungen" ]; then
		ok "keine lokalen Aenderungen an verfolgten Dateien"
	else
		fehlt "lokale Aenderungen an verfolgten Dateien: $(tr '\n' ' ' <<<"$aenderungen")" "als $NUTZER ansehen (git diff), dann git stash oder git checkout -- <datei>"
	fi
	if meldung="$(als_deploy env GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=15' git -C "$VERZEICHNIS" fetch --quiet origin main 2>&1 >/dev/null)"; then
		hinter="$(als_deploy git -C "$VERZEICHNIS" rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
		voraus="$(als_deploy git -C "$VERZEICHNIS" rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
		if [ "$voraus" = 0 ]; then
			ok "Checkout hat keine eigenen Commits; $hinter Commits hinter origin/main (zieht die naechste Ausrollung nach)"
		else
			fehlt "Checkout hat $voraus eigene Commits, kein Fast-Forward moeglich" "sudo -u $NUTZER -H git -C $VERZEICHNIS log --oneline origin/main..HEAD ansehen und aufloesen"
		fi
	else
		fehlt "git fetch origin main scheitert als $NUTZER: $meldung" "als $NUTZER ansehen; bei 'cannot lock ref' die .lock-Datei unter $VERZEICHNIS/.git/refs/remotes/origin entfernen"
	fi
else
	fehlt "$VERZEICHNIS ist kein Git-Checkout oder $NUTZER fehlt" "docs/SETUP.md Abschnitt 10"
fi

echo
echo "== Registry als $NUTZER =="
if id -u "$NUTZER" >/dev/null 2>&1; then
	if als_deploy docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
		ok "$NUTZER erreicht Docker"
	else
		fehlt "$NUTZER erreicht Docker nicht (Gruppe docker, Neuanmeldung?)" "usermod -aG docker $NUTZER"
	fi
	if meldung="$(als_deploy docker manifest inspect "$NAMENSRAUM/eportfolio-backend:main" 2>&1 >/dev/null)"; then
		ok "$NUTZER liest $NAMENSRAUM/eportfolio-backend:main aus GHCR (Anmeldung gueltig)"
	else
		fehlt "$NUTZER liest GHCR nicht: $meldung" "sudo -u $NUTZER -H sh -c 'echo <PAT read:packages> | docker login ghcr.io -u <github-konto> --password-stdin'"
	fi
fi

echo
echo "== Laufender Stapel =="
if [ -d "$VERZEICHNIS" ] && id -u "$NUTZER" >/dev/null 2>&1; then
	if bilder="$(als_deploy docker compose --project-directory "$VERZEICHNIS" -f "$VERZEICHNIS/compose.base.yml" -f "$VERZEICHNIS/compose.prod.yml" ps --format '{{.Service}} {{.Image}} {{.Status}}' 2>/dev/null)" && [ -n "$bilder" ]; then
		while read -r zeile; do ok "$zeile"; done <<<"$bilder"
		if grep -q '^db ' <<<"$bilder"; then
			ok "Dienst db laeuft (Voraussetzung fuer die Sicherung in Schritt 1)"
		else
			fehlt "Dienst db laeuft nicht; ohne ihn gibt es keine Sicherung, und Schritt 0 der Ausrollung bricht ab" "sudo -u $NUTZER -H docker compose --project-directory $VERZEICHNIS -f $VERZEICHNIS/compose.base.yml -f $VERZEICHNIS/compose.prod.yml up -d db"
		fi
		marke="$(sed -n 's/^IMAGE_TAG=//p' "$VERZEICHNIS/.env" 2>/dev/null)"
		if [ -n "$marke" ]; then
			for dienst in backend frontend; do
				if grep -q "^$dienst $NAMENSRAUM/eportfolio-$dienst:$marke " <<<"$bilder"; then
					ok "$dienst laeuft mit der Marke aus der .env ($marke)"
				else
					fehlt "$dienst laeuft nicht mit der Marke aus der .env ($marke)" "naechste Ausrollung abwarten oder Rollback ueber 'Run workflow'"
				fi
			done
		fi
	else
		fehlt "Kein laufender Stapel eportfolio-prod" "docs/SETUP.md Abschnitt 10, Erstausrollung"
	fi
fi

echo
echo "== Hinweise (Entscheidungen fuer einen Menschen) =="
if ls /root/.ssh/id_* >/dev/null 2>&1; then
	hinweis "root hat eigene SSH-Schluessel unter /root/.ssh ($(ls /root/.ssh/id_* | grep -v '\.pub$' | tr '\n' ' ')). Seit KAN-106 braucht root keinen Zugang zum Repository mehr: Schluessel entfernen und den zugehoerigen Deploy-Key mit Schreibrecht bei GitHub loeschen."
fi
if [ -f /root/.docker/config.json ] && grep -q ghcr.io /root/.docker/config.json; then
	hinweis "root ist an ghcr.io angemeldet (/root/.docker/config.json). Gebraucht wird die Anmeldung nur fuer $NUTZER: docker logout ghcr.io als root."
fi
if command -v sshd >/dev/null; then
	rootlogin="$(sshd -T 2>/dev/null | awk '$1=="permitrootlogin"{print $2}')"
	passwort="$(sshd -T 2>/dev/null | awk '$1=="passwordauthentication"{print $2}')"
	if [ "$rootlogin" = no ] && [ "$passwort" = no ]; then
		ok "sshd: PermitRootLogin no, PasswordAuthentication no"
	else
		hinweis "sshd: PermitRootLogin=${rootlogin:-?}, PasswordAuthentication=${passwort:-?}. Die Haertung aus KAN-101 (docs/SETUP.md Abschnitt 10, Einrichtung Schritt 6) steht noch aus; nur mit zweiter offener Sitzung durchfuehren."
	fi
fi
if systemctl is-active fail2ban >/dev/null 2>&1; then
	ok "fail2ban laeuft"
else
	hinweis "fail2ban laeuft nicht (KAN-98, Punkt 1)"
fi
if [ -n "$(swapon --show --noheadings 2>/dev/null)" ]; then
	ok "Swap vorhanden"
else
	hinweis "kein Swap (KAN-98, Punkt 1; auf dem Notweg wird auf dem Server gebaut)"
fi

echo
if [ "$fehler" = 0 ]; then
	echo "Ergebnis: kein FEHLT. Die automatische Ausrollung findet alle Voraussetzungen vor."
else
	echo "Ergebnis: mindestens ein FEHLT. Die automatische Ausrollung wuerde an dieser Stelle abbrechen." >&2
fi
exit "$fehler"
