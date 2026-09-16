#!/usr/bin/env bash
# ===================================================================
# Ausrollen auf dem VPS (KAN-106).
#
# Dieses Skript laeuft auf dem SERVER, nicht auf dem Entwicklerrechner,
# und wird im Normalfall nicht von Hand gestartet: der Job "deploy" in
# .github/workflows/deploy.yml schickt es ueber SSH an den Nutzer deploy
# und fuehrt es dort mit "bash -s" aus. Es kommt dabei aus dem Checkout
# der Action zum Commit COMMIT: nach einem Merge ist das der Merge-Commit,
# dessen Images gebaut wurden; beim von Hand gestarteten Rollback der Stand
# von main beim Start, waehrend die Images aelter sind (die Compose-Dateien
# sind dann die aktuellen; brachte ausgerechnet deren letzte Aenderung den
# Fehler, bleibt der Notweg aus docs/SETUP.md Abschnitt 10). Welche Fassung
# im Checkout auf dem Server liegt, spielt fuer den Ablauf keine Rolle; er
# wird in Schritt 2 auf COMMIT gezogen.
#
# EINGABEN, alle ueber die Umgebung (die Action setzt sie auf der
# Befehlszeile vor "bash -s"):
#
#   IMAGE_TAG        Marke der beiden Images, sha-<kurzer hash>      Pflicht
#   COMMIT           voller Hash des Commits, dessen Compose-Dateien
#                    und Caddyfile auf dem Server liegen muessen      Pflicht
#   TRIGGER          "push" (Merge nach main) oder "dispatch" (von
#                    Hand gestarteter Lauf, etwa ein Rollback)        Pflicht
#   BACKEND_DIGEST   sha256:<hash> des Backend- bzw. Frontend-Images,
#   FRONTEND_DIGEST  so wie der Build-Job es geschoben hat. Pflicht
#                    bei "push"; leer bei "dispatch", denn dort gab es
#                    keinen Bau, geprueft wird dann gegen die Registry.
#
# REIHENFOLGE. Jeder Schritt bricht bei einem Fehler ab, und nichts wird
# stillschweigend uebersprungen. Die Reihenfolge ist so gewaehlt, dass der
# Server bei einem Abbruch VOR Schritt 6 unveraendert weiterlaeuft, die
# .env eingeschlossen:
#
#   0. Vorbedingungen: Nutzer, Eingaben, Eigentum, Docker, .env,
#      Sicherungsordner, Registry (Marke und PAT), GitHub (Schluessel
#      von deploy), Checkout sauber und auf main
#   1. Datenbank sichern, immer
#   2. Checkout auf COMMIT ziehen (git als deploy, nur Fast-Forward) und
#      nachweisen, dass compose.*.yml und Caddyfile dem Commit gleichen
#   3. Compose-Konfiguration pruefen, bevor irgendetwas laeuft
#   4. Images ziehen und gegen den Digest des Build-Jobs pruefen
#   5. IMAGE_TAG in die .env schreiben
#   6. Container neu erstellen und auf die Gesundheitspruefungen warten
#   7. Nachweis: Marke, Image-ID, Zustand, .env, Caddy neu laden, HTTPS
#   8. Alte Images abraeumen, erst jetzt
#
# WARUM DAS ALLES SO MISSTRAUISCH IST. Die Laeufe #91 bis #94 (September
# 2026) waren gruen, ohne etwas auszurollen: das Checkout auf dem Server
# war veraltet, Compose fand keine image-Zeile, meldete "Skipped No image
# to be pulled", liess die alten Container stehen, und die Pruefung druckte
# nur den Namen des laufenden Images, statt ihn zu vergleichen. Seitdem
# gilt: gedruckt wird nichts, was nicht auch verglichen wird.
#
# WARUM DER GANZE RUMPF IN EINER FUNKTION STEHT. Dieses Skript kommt ueber
# die STANDARDEINGABE (bash -s). Und "docker compose exec -T" haengt die
# Standardeingabe an den Container weiter, genau deshalb funktioniert sonst
# "exec -T db psql < dump.sql". Hier ist die Standardeingabe aber dieses
# Skript selbst: ein "exec -T" mitten im Ablauf laese den REST DES SKRIPTS
# weg, die Sicherung wuerde geschrieben, alles danach verschwaende
# stillschweigend, und die Shell endete mit Rueckgabewert 0. Nachgestellt
# und bestaetigt in KAN-101. Als Funktion liest bash zuerst den
# vollstaendigen Rumpf ein und fuehrt ihn danach aus; der Aufruf ganz unten
# klemmt die Standardeingabe mit </dev/null ab, fuer JEDEN Befehl darin.
# ===================================================================
set -euo pipefail

VERZEICHNIS=/opt/eportfolio
SICHERUNGEN=/var/backups/eportfolio
# Wie in compose.base.yml und wie IMAGE_NAMESPACE im Workflow.
NAMENSRAUM=ghcr.io/omarziyada1
# So viele sha-Staende je Image bleiben nach dem Aufraeumen liegen.
BEHALTEN=5
# Die Dateien, die der Server aus dem Repository braucht. Alles andere
# kommt als Image.
DEPLOYMENT_DATEIEN=(compose.base.yml compose.prod.yml Caddyfile)

# Compose liest IMAGE_TAG aus der Umgebung und bevorzugt sie gegenueber der
# .env. Ausdruecklich exportiert, damit das auch gilt, wenn jemand das
# Skript anders aufruft als die Action.
export IMAGE_TAG

fehler() {
	echo "FEHLER: $*" >&2
	# Sobald Schritt 6 die Container ersetzt hat, gehoert der Rueckweg in
	# JEDE Fehlermeldung und nicht nur in die des Starts: ab dort kann die
	# Seite unten sein, auch wenn erst der Nachweis in Schritt 7 scheitert.
	if [ "${container_ersetzt:-0}" = 1 ]; then
		rueckweg_hinweis "${ziel:-unbekannt}" >&2
	fi
	exit 1
}

schritt() {
	echo
	echo "== $* =="
}

compose() {
	docker compose -f compose.base.yml -f compose.prod.yml "$@"
}

# Steht hier und nicht allein in einer Doku, die im Ernstfall niemand
# aufschlaegt.
rueckweg_hinweis() {
	local sicherung="$1"
	cat <<HINWEIS

Es wird NICHT automatisch zurueckgerollt: eine Flyway-Migration dieses
Standes kann bereits gelaufen sein, und ein aelteres Image traefe dann auf
ein neueres Schema. Das kann schlimmer sein als der Stillstand. Die Seite
ist ab hier moeglicherweise unten.

Zurueck auf einen frueheren Stand: den Workflow "CI/CD" von Hand starten
(GitHub, Actions, "Run workflow", Zweig main) und als image_tag die vorige
Marke angeben, etwa sha-<alt>. Welche das war, steht im Protokoll des
vorigen Laufs und auf dem Server unter "docker images".

Notweg auf dem Server, falls GitHub nicht erreichbar ist (docs/SETUP.md,
Abschnitt 10), als deploy und nicht als root: nur deploy ist an ghcr.io
angemeldet, als root scheitert das Ziehen, und was root anlegt, haelt die
naechste Ausrollung an:
  sudo -iu deploy
  cd $VERZEICHNIS
  sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<alt>/' .env
  docker compose -f compose.base.yml -f compose.prod.yml pull backend frontend
  docker compose -f compose.base.yml -f compose.prod.yml up -d --no-build

Die Sicherung von eben liegt unter $sicherung
HINWEIS
}

ausrollen() {
	# ------------------------------------------------------------------
	# 0. Vorbedingungen
	# ------------------------------------------------------------------
	# Alles, was scheitern kann, ohne dass der Server davon etwas merkt,
	# scheitert hier. Danach hat jeder Schritt seine Voraussetzungen.
	schritt "0. Vorbedingungen"

	[ "$(id -un)" != root ] \
		|| fehler "Dieses Skript laeuft als root. Vorgesehen ist der Nutzer deploy (VPS_USER im Workflow)."
	[[ "${IMAGE_TAG:-}" =~ ^sha-[0-9a-f]{7,40}$ ]] \
		|| fehler "IMAGE_TAG fehlt oder hat nicht die Form sha-<hash>: '${IMAGE_TAG:-}'."
	[[ "${COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] \
		|| fehler "COMMIT fehlt oder ist kein voller Commit-Hash: '${COMMIT:-}'."
	case "${TRIGGER:-}" in
		push)
			[[ "${BACKEND_DIGEST:-}" =~ ^sha256:[0-9a-f]{64}$ ]] \
				|| fehler "BACKEND_DIGEST fehlt oder ist kein Digest: '${BACKEND_DIGEST:-}'."
			[[ "${FRONTEND_DIGEST:-}" =~ ^sha256:[0-9a-f]{64}$ ]] \
				|| fehler "FRONTEND_DIGEST fehlt oder ist kein Digest: '${FRONTEND_DIGEST:-}'."
			;;
		dispatch)
			# Kein Bau in diesem Lauf, also kein Digest zum Vergleichen.
			# Schritt 4 verlangt dann nur, dass das Image ueberhaupt einen
			# Registry-Digest traegt, also aus GHCR stammt.
			BACKEND_DIGEST=""
			FRONTEND_DIGEST=""
			;;
		*)
			fehler "TRIGGER muss push oder dispatch sein: '${TRIGGER:-}'."
			;;
	esac

	cd "$VERZEICHNIS" 2>/dev/null || fehler "$VERZEICHNIS gibt es nicht."
	eigentuemer="$(stat -c %U .)"
	[ "$eigentuemer" = "$(id -un)" ] \
		|| fehler "$VERZEICHNIS gehoert $eigentuemer, nicht $(id -un). Als root beheben: chown -R deploy:deploy $VERZEICHNIS"
	# Nicht nur das Verzeichnis, jede Datei darunter: nach einem "git pull"
	# als root gehoert das Verzeichnis weiter deploy, aber Objekte unter
	# .git/ nicht mehr, und daran scheiterte sonst erst Schritt 2, nach der
	# Sicherung. "-quit" haelt beim ersten Treffer an.
	fremd="$(find . ! -user "$(id -un)" -print -quit 2>/dev/null || true)"
	[ -z "$fremd" ] \
		|| fehler "Unter $VERZEICHNIS gehoeren Dateien nicht $(id -un), zum Beispiel $fremd (typisch nach einem git pull als root). Als root beheben: chown -R deploy:deploy $VERZEICHNIS"
	git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
		|| fehler "$VERZEICHNIS ist kein Git-Checkout."
	docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 \
		|| fehler "Docker antwortet nicht. Ist $(id -un) Mitglied der Gruppe docker?"
	command -v curl >/dev/null \
		|| fehler "curl fehlt auf dem Server; Schritt 7 prueft damit die Seite von aussen. Als root: apt install -y curl"

	# Die .env ist die einzige Quelle aller Betriebswerte und wird nie
	# erzeugt, das waere geraten.
	[ -f .env ] \
		|| fehler "Keine .env in $VERZEICHNIS. Ohne sie fehlt jeder Betriebswert."
	grep -q '^POSTGRES_PASSWORD=' .env \
		|| fehler ".env traegt kein POSTGRES_PASSWORD und ist damit unvollstaendig."
	[ -w .env ] \
		|| fehler ".env ist fuer $(id -un) nicht schreibbar (Eigentuemer $(stat -c %U .env), Rechte $(stat -c %a .env)). Als root beheben: chown deploy:deploy $VERZEICHNIS/.env && chmod 600 $VERZEICHNIS/.env"
	# Dieses Skript rollt auf einen Server aus, und dort ist caddy das
	# einzige Tor nach aussen. Ohne das Profil edge liefe der Stapel, die
	# Seite waere weg, und Schritt 7 haette nichts zu pruefen. Ein lokaler
	# PROD-Lauf ohne caddy benutzt dieses Skript nicht.
	grep -q '^COMPOSE_PROFILES=.*edge' .env \
		|| fehler "COMPOSE_PROFILES in der .env schaltet das Profil edge nicht. Ohne caddy ist die Seite von aussen nicht erreichbar; ausgerollt wird nur auf einen Server, der es setzt."
	[ -w "$SICHERUNGEN" ] \
		|| fehler "Kein beschreibbares $SICHERUNGEN. Als root anlegen: install -d -o deploy -g deploy $SICHERUNGEN"

	# Registry: Marke vorhanden UND Anmeldung gueltig, in einem Aufruf.
	# "docker manifest inspect" liest mit den hinterlegten Zugangsdaten
	# (docker login als deploy, docs/SETUP.md Abschnitt 10, Schritt 5) nur
	# das Manifest und laedt nichts. Scheitert es, ist entweder die Marke
	# falsch (Rollback mit Tippfehler) oder das PAT abgelaufen; die Meldung
	# von Docker sagt, welches von beiden.
	for dienst in backend frontend; do
		ref="$NAMENSRAUM/eportfolio-$dienst:$IMAGE_TAG"
		if ! meldung="$(docker manifest inspect "$ref" 2>&1 >/dev/null)"; then
			fehler "$ref ist in GHCR nicht lesbar: Marke fehlt, oder die Anmeldung von $(id -un) an ghcr.io (PAT mit read:packages) ist abgelaufen. Docker sagt: $meldung"
		fi
	done

	# GitHub: der Schluessel von deploy muss das Repository lesen koennen.
	# BatchMode verhindert jede Rueckfrage (Passwort, unbekannter Wirt):
	# eine Rueckfrage haette hier niemanden, der antwortet, und der Lauf
	# stuende bis zum Zeitlimit.
	export GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=15'
	if ! meldung="$(git ls-remote --exit-code --heads origin main 2>&1 >/dev/null)"; then
		fehler "git erreicht origin nicht ($meldung). Der Nutzer deploy braucht einen eigenen Lese-Schluessel fuer GitHub samt ~/.ssh/config, siehe docs/SETUP.md Abschnitt 10, Einrichtung Schritt 5b."
	fi
	zweig="$(git symbolic-ref --short -q HEAD || true)"
	[ "$zweig" = main ] \
		|| fehler "Auf dem Server ist '${zweig:-kein Zweig}' ausgecheckt, erwartet main."
	# core.fileMode=false: ein chmod +x an einem der Skripte (etwa fuer die
	# Seeder) ist keine Aenderung, die eine Ausrollung aufhalten soll.
	# Inhaltliche Aenderungen an verfolgten Dateien sind es dagegen sehr
	# wohl: sie wuerden nicht stumm ueberschrieben, sondern stehen dem
	# Fast-Forward im Weg, und das soll hier gesagt werden, nicht in Schritt 2.
	aenderungen="$(git -c core.fileMode=false status --porcelain --untracked-files=no)" \
		|| fehler "git status ist fehlgeschlagen (Meldung darueber)."
	[ -z "$aenderungen" ] \
		|| fehler "Der Checkout auf dem Server hat lokale Aenderungen an verfolgten Dateien:
$aenderungen
Ansehen mit 'git diff', dann 'git stash' oder 'git checkout -- <datei>' als deploy. Nichts davon geschieht von selbst."
	# origin/main schon jetzt nachholen (schreibt nur nach .git/), damit die
	# beiden Zugehoerigkeitsproben VOR der Sicherung laufen: der Commit muss
	# auf main liegen, und beim Rollback auch der Commit hinter der Marke.
	# Schritt 2 arbeitet dann mit diesem Stand weiter.
	git fetch --quiet origin main || fehler "git fetch origin main ist fehlgeschlagen."
	git merge-base --is-ancestor "$COMMIT" origin/main \
		|| fehler "Commit ${COMMIT:0:7} liegt nicht auf origin/main. Ausgerollt wird nur, was nach main gemergt ist."
	if [ "$TRIGGER" = dispatch ]; then
		marke_commit="${IMAGE_TAG#sha-}"
		if ! git cat-file -e "${marke_commit}^{commit}" 2>/dev/null \
			|| ! git merge-base --is-ancestor "$marke_commit" origin/main; then
			fehler "Die Marke $IMAGE_TAG nennt keinen Commit auf main. Ein Rollback geht nur auf einen Stand, der einmal ueber main ausgerollt wurde."
		fi
	fi

	# Ohne laufende Datenbank gibt es keine Sicherung, und ohne Sicherung
	# keine Ausrollung. Die Erstausrollung ist Handarbeit (SETUP.md).
	[ -n "$(compose ps -q db)" ] \
		|| fehler "Der Dienst db laeuft nicht; ohne ihn gibt es keine Sicherung. Die Erstausrollung steht in docs/SETUP.md, Abschnitt 10."

	echo "Nutzer $(id -un), Verzeichnis $VERZEICHNIS, Docker $(docker info --format '{{.ServerVersion}}'), Compose $(docker compose version --short)"
	echo "Marke $IMAGE_TAG, Commit ${COMMIT:0:7}, Ausloeser $TRIGGER"

	# ------------------------------------------------------------------
	# 1. Sichern, immer
	# ------------------------------------------------------------------
	# Ohne Fallunterscheidung. Eine Erkennung ueber den Commit-Vergleich
	# beantwortet die falsche Frage: sie vergleicht Push gegen Push,
	# waehrend es auf den Abstand zwischen SERVERSTAND und neuem Stand
	# ankaeme. Ein pg_dump dieses Bestands kostet Sekunden. Flyway-
	# Migrationen laufen beim Start des Backends und haben keinen Rueckweg.
	schritt "1. Datenbank sichern"
	# Nur fuer deploy lesbar. Die umask von deploy ist 002, damit entstanden
	# die Sicherungen bisher mit 664: ein Datenbankabzug mit Passwort-Hashes
	# und Adressen, lesbar fuer jeden Nutzer auf dem Server. Gilt fuer den
	# Rest des Laufs; die .env-Tempdatei (mktemp, 600) ist davon unberuehrt.
	umask 077
	ziel="$SICHERUNGEN/vor-${IMAGE_TAG}-$(date +%F-%H%M).sql.gz"
	# Benutzername und Datenbank kommen aus der Umgebung DES CONTAINERS und
	# nicht aus der .env auf dem Wirt: so muss dieser Ablauf die Datei mit
	# den Geheimnissen nicht lesen.
	if ! compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$ziel"; then
		rm -f "$ziel"
		fehler "pg_dump ist fehlgeschlagen, nichts ausgerollt."
	fi
	if ! gzip -t "$ziel" 2>/dev/null || [ "$(stat -c %s "$ziel")" -le 100 ]; then
		fehler "Die Sicherung $ziel ist leer oder beschaedigt, nichts ausgerollt."
	fi
	echo "Sicherung geschrieben: $ziel ($(du -h "$ziel" | cut -f1))"
	# Dieselbe Frist wie beim taeglichen Timer aus KAN-98.
	find "$SICHERUNGEN" -name 'vor-*.sql.gz' -mtime +14 -delete

	# ------------------------------------------------------------------
	# 2. Checkout auf den Commit ziehen
	# ------------------------------------------------------------------
	# Als deploy, nicht als root, und nur als Fast-Forward: der Server
	# bekommt genau den Commit, dessen Images gleich laufen, und alles,
	# was davon abweicht, ist ein Fehler und kein Fall fuer "reset --hard".
	schritt "2. Checkout auf ${COMMIT:0:7} ziehen"
	vorher="$(git rev-parse HEAD)" || fehler "git rev-parse HEAD ist fehlgeschlagen."
	if [ "$vorher" != "$COMMIT" ]; then
		git -c core.fileMode=false merge --ff-only --quiet "$COMMIT" \
			|| fehler "Fast-Forward von ${vorher:0:7} auf ${COMMIT:0:7} nicht moeglich: der Checkout auf dem Server hat eigene Commits. Ansehen mit: git -C $VERZEICHNIS log --oneline origin/main..HEAD"
	fi
	jetzt="$(git rev-parse HEAD)"
	[ "$jetzt" = "$COMMIT" ] \
		|| fehler "HEAD ist ${jetzt:0:7}, erwartet ${COMMIT:0:7}. Entweder ist der Server main voraus, oder dieser Lauf ist aelter als der Stand auf dem Server (ein alter Lauf wurde erneut gestartet). Ein Rollback laeuft ueber 'Run workflow' mit image_tag, nicht ueber das Wiederholen eines alten Laufs."
	git -c core.fileMode=false diff --quiet "$COMMIT" -- "${DEPLOYMENT_DATEIEN[@]}" \
		|| fehler "${DEPLOYMENT_DATEIEN[*]} weichen auf dem Server vom Commit ${COMMIT:0:7} ab."
	caddyfile_geaendert=0
	git diff --quiet "$vorher" "$COMMIT" -- Caddyfile || caddyfile_geaendert=1
	echo "Checkout: $(git log -1 --format='%h %ad %s' --date=short)"
	if [ "$vorher" = "$COMMIT" ]; then
		echo "Der Checkout stand bereits auf diesem Commit."
	else
		echo "Vorher ${vorher:0:7}; Caddyfile geaendert: $caddyfile_geaendert"
	fi

	# ------------------------------------------------------------------
	# 3. Compose-Konfiguration pruefen
	# ------------------------------------------------------------------
	# Mit den Dateien des Commits und der .env des Servers, BEVOR ein
	# Container angefasst wird. "config --images" sagt ausserdem, welche
	# Images Compose gleich verwenden wird; steht dort nicht die Marke, wird
	# gar nicht erst gezogen.
	schritt "3. Compose-Konfiguration pruefen"
	compose config --quiet \
		|| fehler "Die Compose-Dateien dieses Commits sind mit der .env auf dem Server nicht gueltig (Meldung darueber). Nichts wurde angefasst."
	erwartet_backend="$NAMENSRAUM/eportfolio-backend:$IMAGE_TAG"
	erwartet_frontend="$NAMENSRAUM/eportfolio-frontend:$IMAGE_TAG"
	bilder="$(compose config --images)" \
		|| fehler "docker compose config --images ist fehlgeschlagen (Meldung darueber)."
	for ref in "$erwartet_backend" "$erwartet_frontend"; do
		grep -qxF "$ref" <<<"$bilder" \
			|| fehler "Compose loest nicht auf $ref auf, sondern auf: $(tr '\n' ' ' <<<"$bilder")"
	done
	echo "Compose wird verwenden: $(tr '\n' ' ' <<<"$bilder")"

	# ------------------------------------------------------------------
	# 4. Images ziehen und pruefen
	# ------------------------------------------------------------------
	# VOR dem Schreiben der .env: stuende die neue Marke schon in der Datei
	# und das Ziehen scheiterte, zeigte sie auf ein Image, das es auf dem
	# Server nicht gibt. Nur backend und frontend, nicht der ganze Stapel:
	# ein pauschales "pull" holte auch postgres:16 und caddy:2-alpine neu
	# und startete bei jeder Ausrollung ungefragt die Datenbank neu.
	schritt "4. Images ziehen"
	compose pull --quiet backend frontend \
		|| fehler "Ziehen fehlgeschlagen (Anmeldung, PAT, Netz oder Marke; Meldung darueber). Die .env ist unveraendert."
	for dienst in backend frontend; do
		ref="$NAMENSRAUM/eportfolio-$dienst:$IMAGE_TAG"
		docker image inspect "$ref" >/dev/null 2>&1 \
			|| fehler "$ref liegt nach dem Ziehen nicht vor."
		# RepoDigests traegt "repo@sha256:<manifest-digest>" fuer jedes
		# Ziehen aus einer Registry. Ein auf dem Server gebautes Image hat
		# keinen solchen Eintrag, und ein anderes Image unter derselben
		# Marke einen anderen. Der Build-Job liefert genau diesen Digest
		# (ohne Provenance-Anhaenge, siehe deploy.yml).
		digests="$(docker image inspect --format '{{join .RepoDigests "\n"}}' "$ref")"
		[ -n "$digests" ] \
			|| fehler "$ref traegt keinen Registry-Digest, stammt also nicht aus GHCR (auf dem Server gebaut?)."
		soll=""
		case "$dienst" in
			backend) soll="$BACKEND_DIGEST" ;;
			frontend) soll="$FRONTEND_DIGEST" ;;
		esac
		if [ -n "$soll" ]; then
			grep -qxF "$NAMENSRAUM/eportfolio-$dienst@$soll" <<<"$digests" \
				|| fehler "$ref ist nicht das Image, das die Action geschoben hat. Erwartet $soll, vorhanden: $(tr '\n' ' ' <<<"$digests")"
		fi
		printf '%-9s %s\n          Image-ID %s\n          Digest   %s\n' \
			"$dienst" "$ref" "$(docker image inspect --format '{{.Id}}' "$ref")" "$(tr '\n' ' ' <<<"$digests")"
	done

	# ------------------------------------------------------------------
	# 5. IMAGE_TAG in die .env schreiben
	# ------------------------------------------------------------------
	# DIESE DATEI IST DIE EMPFINDLICHSTE STELLE DES GANZEN ABLAUFS. Sie
	# liegt nicht im Repository und ist die einzige Quelle aller
	# Betriebswerte; fuer das Datenbankpasswort gibt es keine zweite, es
	# haengt im Volume fest. Deshalb drei Riegel statt eines Einzeilers, und
	# danach die Probe, dass genau eine IMAGE_TAG-Zeile mit der Marke steht.
	schritt "5. IMAGE_TAG in die .env schreiben"
	vorher_zeilen="$(wc -l < .env)"
	tmp="$(mktemp -p "$VERZEICHNIS" .env.XXXXXX)" \
		|| fehler "Konnte keine temporaere Datei in $VERZEICHNIS anlegen (Rechte? Platte voll?). Die .env ist unveraendert."
	# NICHT "|| true". grep endet mit 1, wenn keine Zeile passt (Regelfall
	# bei der ersten Ausrollung), und ab 2 bei einem echten Fehler: Datei
	# unlesbar, Platte voll. Ein pauschales "true" schluckte beides.
	grep -v '^IMAGE_TAG=' .env > "$tmp"; rc=$?
	if [ "$rc" -gt 1 ]; then
		rm -f "$tmp"
		fehler "Konnte .env nicht lesen (grep $rc), nichts geaendert."
	fi
	if ! grep -q '^POSTGRES_PASSWORD=' "$tmp"; then
		rm -f "$tmp"
		fehler ".env unvollstaendig, nicht ersetzt."
	fi
	printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG" >> "$tmp"
	nachher_zeilen="$(wc -l < "$tmp")"
	if [ "$nachher_zeilen" -lt "$vorher_zeilen" ]; then
		rm -f "$tmp"
		fehler "Die neue .env waere kuerzer als die alte ($nachher_zeilen statt $vorher_zeilen Zeilen), nicht ersetzt."
	fi
	# "cat >" statt "mv" oder "sed -i": so bleibt die .env dieselbe Datei
	# und behaelt Eigentuemer und Rechte (600, deploy).
	cat "$tmp" > .env
	rm -f "$tmp"
	if [ "$(grep -c '^IMAGE_TAG=' .env)" != 1 ] || ! grep -qx "IMAGE_TAG=$IMAGE_TAG" .env; then
		fehler ".env traegt nach dem Schreiben nicht genau eine Zeile IMAGE_TAG=$IMAGE_TAG."
	fi
	echo "IMAGE_TAG=$IMAGE_TAG"

	# ------------------------------------------------------------------
	# 6. Starten
	# ------------------------------------------------------------------
	# --no-build und --pull never: auf dem Server wird weder gebaut noch
	# nebenbei gezogen; was gleich laeuft, liegt seit Schritt 4 vor. --wait
	# wartet auf die Healthchecks (backend, frontend, db) bzw. auf "running"
	# (caddy) und endet nach fuenf Minuten mit Fehler.
	#
	# Beide Dienste werden dabei neu erstellt, weil beide eine neue Marke
	# tragen. Wuerde allein das Backend ersetzt, bekaeme es eine neue
	# Adresse im Compose-Netz, und der nginx des Frontends hielte die alte
	# fest: die API antwortete danach dauerhaft mit 502.
	schritt "6. Container neu erstellen"
	if ! compose up -d --no-build --pull never --wait --wait-timeout 300; then
		echo "Der Stapel ist nicht vollstaendig hochgekommen." >&2
		compose ps -a >&2 || true
		echo "" >&2
		compose logs --tail=80 backend frontend >&2 || true
		rueckweg_hinweis "$ziel" >&2
		exit 1
	fi
	# Ab hier haengt fehler() den Rueckweg an jede Meldung.
	container_ersetzt=1

	# ------------------------------------------------------------------
	# 7. Nachweis
	# ------------------------------------------------------------------
	# Nichts davon wird nur gedruckt, alles wird verglichen. Je Container:
	# genau einer, laeuft, gesund, traegt den Namen der Marke, und seine
	# Image-ID ist die, auf die die Marke zeigt. Der letzte Punkt ist der
	# gegen "neuer Name, altes Image".
	schritt "7. Nachweis"
	for dienst in backend frontend; do
		ref="$NAMENSRAUM/eportfolio-$dienst:$IMAGE_TAG"
		ids="$(compose ps -aq "$dienst")" \
			|| fehler "docker compose ps fuer $dienst ist fehlgeschlagen (Meldung darueber)."
		[ "$(printf '%s\n' "$ids" | grep -c .)" = 1 ] \
			|| fehler "Fuer $dienst gibt es nicht genau einen Container: '$(tr '\n' ' ' <<<"$ids")'"
		cid="$ids"
		zustand="$(docker inspect --format '{{.State.Status}}' "$cid")"
		[ "$zustand" = running ] \
			|| fehler "$dienst laeuft nicht (Zustand $zustand)."
		gesund="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}ohne-healthcheck{{end}}' "$cid")"
		[ "$gesund" = healthy ] \
			|| fehler "$dienst ist nicht healthy ($gesund)."
		bild="$(docker inspect --format '{{.Config.Image}}' "$cid")"
		[ "$bild" = "$ref" ] \
			|| fehler "$dienst laeuft mit $bild statt $ref."
		id_container="$(docker inspect --format '{{.Image}}' "$cid")"
		id_marke="$(docker image inspect --format '{{.Id}}' "$ref")"
		[ "$id_container" = "$id_marke" ] \
			|| fehler "$dienst laeuft mit der Image-ID $id_container, die Marke $ref zeigt aber auf $id_marke: der Container traegt den neuen Namen, aber nicht das neue Image."
		printf '%-9s %s\n          %s, %s, gestartet %s\n' \
			"$dienst" "$ref" "$zustand" "$gesund" "$(docker inspect --format '{{.State.StartedAt}}' "$cid")"
	done

	# Die .env allein, ohne die Umgebungsvariable: so sieht der naechste
	# "up -d" von Hand die Marke. Stuende sie dort falsch, liefe nach einem
	# Neustart des Servers etwas anderes als jetzt.
	bilder_env="$(env -u IMAGE_TAG docker compose -f compose.base.yml -f compose.prod.yml config --images)" \
		|| fehler "docker compose config --images ohne Umgebungsvariable ist fehlgeschlagen (Meldung darueber)."
	for ref in "$erwartet_backend" "$erwartet_frontend"; do
		grep -qxF "$ref" <<<"$bilder_env" \
			|| fehler "Aus der .env allein loest Compose nicht auf $ref auf, sondern auf: $(tr '\n' ' ' <<<"$bilder_env")"
	done
	echo ".env allein loest auf: $(tr '\n' ' ' <<<"$bilder_env")"

	# Caddy; das Profil edge ist seit Schritt 0 gesichert. Der Healthcheck
	# oben fragt die Container IM COMPOSE-NETZ; faellt caddy aus, ist die
	# Seite von aussen weg, waehrend drinnen alles gesund meldet.
	{
		caddy_id="$(compose ps -q caddy || true)"
		if [ -z "$caddy_id" ] \
			|| [ "$(docker inspect --format '{{.State.Running}}' "$caddy_id" 2>/dev/null || echo false)" != true ]; then
			compose logs --tail=40 caddy >&2 || true
			fehler "Profil edge ist gesetzt, aber caddy laeuft nicht."
		fi
		# Das Caddyfile liegt als Bind-Mount im Container. Ein geaenderter
		# Inhalt aendert fuer Compose nichts an der Containerkonfiguration,
		# "up -d" erstellt caddy also nicht neu, und ohne diesen Aufruf
		# liefe die alte Konfiguration weiter, solange der Container lebt.
		# "caddy reload" ist unterbrechungsfrei, bei unveraendertem Caddyfile
		# folgenlos, und ein fehlerhaftes Caddyfile lehnt es ab: caddy
		# behaelt dann die bisherige Konfiguration, und dieser Lauf ist rot.
		if ! compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
			fehler "caddy hat das Caddyfile dieses Commits nicht uebernommen und laeuft mit der bisherigen Konfiguration weiter (Meldung darueber)."
		fi
		echo "Caddyfile neu geladen (geaendert: $caddyfile_geaendert)."

		# Von aussen, ueber die oeffentliche Adresse: DNS, Zertifikat,
		# Firewall, caddy, nginx und Backend in einer Probe. Zwoelf
		# Versuche zu hoechstens 5 s plus 5 s Pause, also bis zu zwei
		# Minuten je Pfad; caddy braucht nach einem Reload einen Moment.
		domain="$(sed -n 's/^APP_DOMAIN=//p' .env | sed -e "s/^['\"]//" -e "s/['\"]$//" -e 's/[[:space:]]*$//')"
		[ -n "$domain" ] \
			|| fehler "APP_DOMAIN fehlt in der .env, obwohl das Profil edge gesetzt ist."
		for pfad in / /api/site-content; do
			code=000
			for _ in $(seq 1 12); do
				code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "https://$domain$pfad" 2>/dev/null || echo 000)"
				[ "$code" = 200 ] && break
				sleep 5
			done
			[ "$code" = 200 ] \
				|| fehler "https://$domain$pfad antwortet mit $code statt 200. Der Stapel laeuft, aber von aussen ist er nicht erreichbar (DNS, Zertifikat, Firewall des Anbieters, caddy)."
			echo "https://$domain$pfad -> $code"
		done
	}

	# ------------------------------------------------------------------
	# 8. Aufraeumen, erst jetzt
	# ------------------------------------------------------------------
	# Schichten ohne Marke, und darueber hinaus die alten Staende. "image
	# prune" allein genuegt nicht: markierte Images ruehrt es nie an, und je
	# Ausrollung kommen rund 800 MB dazu. Die letzten BEHALTEN Staende
	# bleiben liegen, denn genau sie braucht ein Rollback; was ein Container
	# gerade benutzt, bleibt immer. Ein aelterer Stand ist nicht verloren,
	# in GHCR bleibt jede Marke liegen.
	#
	# EIN FREMDER AUFTRAG REDET HIER MIT (nachgewiesen am 16.09.2026).
	# Hostinger legt beim Aufsetzen des VPS /etc/cron.d/docker-image-prune an,
	# im Original mit "docker image prune -af --filter until=24h". Das "-a"
	# entfernt auch MARKIERTE Images, sobald sie aelter als 24 Stunden sind
	# und kein Container sie benutzt: die Reserve hier unten war jede Nacht um
	# 00:57 weg, und weil "until" ab dem BAU zaehlt und nicht ab dem Ziehen,
	# konnte der Auftrag sogar eine gerade gezogene aeltere Marke zwischen
	# Schritt 4 und Schritt 6 entfernen. Die Datei auf dem Server traegt
	# deshalb ein "-f" statt "-af"; deploy/vps-pruefen.sh prueft das, damit
	# ein Update des Anbieters nicht still das Alte zurueckbringt. Verloren
	# waere auch dann nichts, ein Rollback zieht die Marke neu aus GHCR.
	schritt "8. Alte Images abraeumen"
	docker image prune -f > /dev/null
	in_benutzung="$(docker ps -a --format '{{.Image}}' || true)"
	for name in eportfolio-backend eportfolio-frontend; do
		docker images --filter "reference=$NAMENSRAUM/$name:sha-*" \
				--format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
			| sort -r | tail -n +"$((BEHALTEN + 1))" | cut -f2 \
			| while read -r alt; do
				if grep -qxF "$alt" <<<"$in_benutzung"; then
					echo "behalte $alt (in Benutzung)"
				elif docker rmi "$alt" > /dev/null 2>&1; then
					echo "entfernt $alt"
				else
					echo "Hinweis: $alt liess sich nicht entfernen."
				fi
			done
	done
	echo "Liegen bereit: $(docker images --filter "reference=$NAMENSRAUM/eportfolio-*:sha-*" --format '{{.Repository}}:{{.Tag}}' | sort | tr '\n' ' ')"

	schritt "Fertig"
	echo "Ausgerollt: $IMAGE_TAG (Commit ${COMMIT:0:7}), Ausloeser $TRIGGER, Sicherung $ziel"
}

# HIER klemmt </dev/null die Standardeingabe ab, siehe den Kopf der Datei.
ausrollen </dev/null
