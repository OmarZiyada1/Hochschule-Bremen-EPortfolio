# E-Portfolio Hochschule Bremen: Steuerung des Container-Stacks.
#
# Aufruf ohne Parameter oeffnet das Menue:
#   .\eportfolio.ps1
# Mit vorgewaehlter Betriebsart:
#   .\eportfolio.ps1 -Mode artifact
#
# Der Text ist bewusst frei von Umlauten: Windows PowerShell 5.1 liest eine
# UTF-8-Datei ohne BOM als ANSI und wuerde sie zerlegen.
#
# Drei Betriebsarten, drei getrennte Compose-Projekte. Sie haben eigene Ports
# und eigene Volumes und koennen deshalb nebeneinander laufen; sie teilen sich
# insbesondere KEINE Datenbank.
#
#   DEV       Quellcode als Mount, spring-boot:run, Vite-Dev-Server.
#             Profil dev. Zum Entwickeln.
#   ARTIFACT  Gebautes Jar im JRE-Image, Frontend hinter nginx.
#             Profil dev. Prueft den Auslieferungsstand, nicht die
#             Produktivkonfiguration.
#   PROD      Dieselben Images, aber Profil prod: Azure Blob Storage, SMTP,
#             keine Swagger-UI, keine Dev-Testnutzer. Laeuft nur mit echten
#             Zugangsdaten in der .env.
#
# Jede Betriebsart wird ausdruecklich benannt. "docker compose up" ohne -f
# scheitert mit "no configuration file provided"; das ist Absicht.

[CmdletBinding()]
param(
	[ValidateSet('dev', 'artifact', 'prod')]
	[string]$Mode = 'dev'
)

Set-StrictMode -Version 2.0
Set-Location -Path $PSScriptRoot

$BaseFile = 'compose.base.yml'

$Modes = [ordered]@{
	'dev' = @{
		Label           = 'DEV / Quellcode-Betrieb'
		Project         = 'eportfolio-dev'
		File            = 'compose.dev.yml'
		Profil          = 'dev'
		FrontendVar     = 'DEV_FRONTEND_PORT'
		FrontendDefault = '5173'
		BackendVar      = 'DEV_BACKEND_PORT'
		BackendDefault  = '8080'
		Hinweis         = 'Hot Reload. Erster Start laedt Maven und node_modules, das dauert.'
	}
	'artifact' = @{
		Label           = 'ARTIFACT-DEV / Auslieferungsstand'
		Project         = 'eportfolio-artifact'
		File            = 'compose.artifact.yml'
		Profil          = 'dev'
		FrontendVar     = 'ARTIFACT_FRONTEND_PORT'
		FrontendDefault = '5273'
		BackendVar      = 'ARTIFACT_BACKEND_PORT'
		BackendDefault  = '8180'
		Hinweis         = 'Gebautes Jar und gebautes Frontend, aber weiterhin Profil dev: Dateien im Dateisystem, Mails in der Konsole, Swagger an.'
	}
	'prod' = @{
		Label           = 'PROD / Produktivkonfiguration'
		Project         = 'eportfolio-prod'
		File            = 'compose.prod.yml'
		Profil          = 'prod'
		FrontendVar     = 'PROD_FRONTEND_PORT'
		FrontendDefault = '5373'
		BackendVar      = 'PROD_BACKEND_PORT'
		BackendDefault  = '8280'
		Hinweis         = 'Braucht Azure Blob Storage und ein SMTP-Relay. Ohne diese Werte startet die Anwendung absichtlich nicht.'
	}
}

$script:Mode = $Mode
$script:LastDockerExit = 0

# --------------------------------------------------------------------------
# Hilfsfunktionen
# --------------------------------------------------------------------------

function Get-Mode { return $Modes[$script:Mode] }

# Alle Aufrufe nennen beide Dateien. Der Projektname kommt aus dem "name" im
# Overlay, deshalb braucht es kein zusaetzliches -p.
function Get-ComposeArgs {
	$m = Get-Mode
	return @('-f', $BaseFile, '-f', $m['File'])
}

function Write-Head {
	param([string]$Text)
	Write-Host ''
	Write-Host $Text -ForegroundColor Cyan
	Write-Host ('-' * $Text.Length) -ForegroundColor DarkGray
}

function Invoke-Docker {
	param([string[]]$Arguments)
	Write-Host ''
	Write-Host "> docker $($Arguments -join ' ')" -ForegroundColor DarkGray
	# Kein Pipe und keine Umleitung: "compose exec" und "logs -f" brauchen die
	# Konsole unveraendert, sonst gibt es kein Terminal und kein Strg+C.
	& docker @Arguments
	$script:LastDockerExit = $LASTEXITCODE
	if ($script:LastDockerExit -ne 0) {
		Write-Host ''
		Write-Host "Docker meldet Exit-Code $($script:LastDockerExit)." -ForegroundColor Red
	}
}

function Invoke-Compose {
	param([string[]]$Arguments)
	Invoke-Docker (@('compose') + (Get-ComposeArgs) + $Arguments)
}

function Confirm-Action {
	param([string]$Message)
	Write-Host ''
	Write-Host $Message -ForegroundColor Yellow
	$answer = Read-Host 'Wirklich ausfuehren? [j/N]'
	return ($answer -eq 'j' -or $answer -eq 'J')
}

# Liest einen Wert aus der .env im Projektwurzelverzeichnis. Sie ist die
# einzige Quelle der Ports und wird nicht eingecheckt.
function Get-EnvValue {
	param([string]$Name, [string]$Default)
	$envFile = Join-Path $PSScriptRoot '.env'
	if (Test-Path $envFile) {
		foreach ($line in Get-Content -Path $envFile) {
			if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*)$") {
				$value = $Matches[1].Trim()
				if ($value -ne '') { return $value }
			}
		}
	}
	return $Default
}

function Get-FrontendPort {
	$m = Get-Mode
	return Get-EnvValue -Name $m['FrontendVar'] -Default $m['FrontendDefault']
}

function Get-BackendPort {
	$m = Get-Mode
	return Get-EnvValue -Name $m['BackendVar'] -Default $m['BackendDefault']
}

# Geprueft wird mit curl.exe, nicht mit Invoke-WebRequest. Grund: gegen den
# Vite-Dev-Server laeuft der .NET-Webstack in einen Timeout, waehrend curl.exe
# im selben Prozess HTTP 200 bekommt. Invoke-WebRequest meldete also "nicht
# erreichbar" fuer eine laufende Oberflaeche, und ein Fehlalarm ist schlimmer
# als keine Pruefung. curl.exe liegt seit Windows 10 1803 im System; fehlt es
# doch, faellt die Funktion zurueck.
function Test-Endpoint {
	param([string]$Label, [string]$Url)

	$status = $null
	if ($null -ne (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
		$code = & curl.exe -s -o NUL -m 5 -w '%{http_code}' $Url
		# curl liefert 000, wenn gar keine Antwort kam.
		if ($LASTEXITCODE -eq 0 -and $code -ne '000') { $status = [int]$code }
	} else {
		try {
			$status = [int](Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5).StatusCode
		} catch {
			$webException = $_.Exception -as [System.Net.WebException]
			if ($null -ne $webException -and $null -ne $webException.Response) {
				$status = [int]$webException.Response.StatusCode
			}
		}
	}

	if ($null -eq $status) {
		Write-Host ("  {0,-30} nicht erreichbar" -f $Label) -ForegroundColor Red
	} elseif ($status -ge 200 -and $status -lt 400) {
		Write-Host ("  {0,-30} HTTP {1}" -f $Label, $status) -ForegroundColor Green
	} else {
		# Ein 4xx ist eine Antwort und damit ein Lebenszeichen, kein Ausfall.
		Write-Host ("  {0,-30} HTTP {1}" -f $Label, $status) -ForegroundColor Yellow
	}
}

# Prueft die Voraussetzungen. Beide Fehler kosten sonst eine schwer lesbare
# Meldung aus Compose.
function Test-Voraussetzungen {
	if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue)) {
		Write-Host 'Docker ist nicht installiert oder nicht im PATH.' -ForegroundColor Red
		return $false
	}

	$ok = $true

	& docker version --format '{{.Server.Version}}' > $null
	if ($LASTEXITCODE -ne 0) {
		Write-Host 'Docker antwortet nicht. Laeuft Docker Desktop?' -ForegroundColor Red
		$ok = $false
	}

	if (-not (Test-Path (Join-Path $PSScriptRoot '.env'))) {
		Write-Host 'Es gibt keine .env. Anlegen mit: copy .env.example .env' -ForegroundColor Red
		Write-Host 'Danach mindestens POSTGRES_PASSWORD, JWT_SECRET und DEV_TEST_PASSWORD setzen.' -ForegroundColor Red
		$ok = $false
	}

	foreach ($file in @($BaseFile, 'compose.dev.yml', 'compose.artifact.yml', 'compose.prod.yml')) {
		if (-not (Test-Path (Join-Path $PSScriptRoot $file))) {
			Write-Host "Es fehlt $file." -ForegroundColor Red
			$ok = $false
		}
	}

	return $ok
}

function Show-Adressen {
	$frontendPort = Get-FrontendPort
	$backendPort = Get-BackendPort
	$m = Get-Mode
	Write-Host ''
	Write-Host "Erreichbar unter ($($m['Label'])):" -ForegroundColor Cyan
	Write-Host "  Oberflaeche   http://localhost:$frontendPort"
	Write-Host "  API           http://localhost:$frontendPort/api/  (gleicher Origin, kein CORS)"
	if ($m['Profil'] -eq 'dev') {
		Write-Host "  Swagger-UI    http://localhost:$backendPort/swagger-ui.html"
	} else {
		Write-Host "  Swagger-UI    im Profil prod abgeschaltet"
	}
	Write-Host "  Health        http://localhost:$backendPort/actuator/health"
}

# --------------------------------------------------------------------------
# Aktionen
# --------------------------------------------------------------------------

function Select-Betriebsart {
	Write-Head 'Betriebsart waehlen'
	$keys = @($Modes.Keys)
	for ($i = 0; $i -lt $keys.Count; $i++) {
		$m = $Modes[$keys[$i]]
		Write-Host ("  {0}  {1,-34} Projekt {2}, Profil {3}" -f ($i + 1), $m['Label'], $m['Project'], $m['Profil'])
	}
	$answer = Read-Host 'Nummer'
	$index = 0
	if ([int]::TryParse($answer, [ref]$index) -and $index -ge 1 -and $index -le $keys.Count) {
		$script:Mode = $keys[$index - 1]
		Write-Host ''
		Write-Host "Betriebsart ist jetzt $((Get-Mode)['Label'])." -ForegroundColor Green
	} else {
		Write-Host 'Unveraendert.' -ForegroundColor DarkGray
	}
}

function Start-Betriebsart {
	param([switch]$Build)
	$m = Get-Mode
	Write-Head "$($m['Label']) starten"
	Write-Host $m['Hinweis'] -ForegroundColor DarkGray

	if ($script:Mode -eq 'prod' -and (Get-EnvValue -Name 'AZURE_STORAGE_CONNECTION_STRING' -Default '') -eq '') {
		Write-Host ''
		Write-Host 'AZURE_STORAGE_CONNECTION_STRING ist in der .env leer. Das Backend wird' -ForegroundColor Yellow
		Write-Host 'starten wollen und sich mit der Meldung beenden, welcher Pflichtwert' -ForegroundColor Yellow
		Write-Host 'fehlt. Genau so ist die Fail-Fast-Regel gemeint; zum Nachlesen danach' -ForegroundColor Yellow
		Write-Host 'Menuepunkt 11 (Logs Backend).' -ForegroundColor Yellow
	}

	$arguments = @('up', '-d')
	if ($Build) { $arguments += '--build' }
	Invoke-Compose $arguments
	if ($script:LastDockerExit -eq 0) { Show-Adressen }
}

function Show-Status {
	Write-Head "Status: $((Get-Mode)['Label'])"
	Invoke-Compose @('ps', '--format', 'table {{.Name}}\t{{.Status}}\t{{.Ports}}')
}

function Show-StatusAlle {
	Write-Head 'Status aller Betriebsarten'
	Invoke-Docker @('ps', '--filter', 'name=eportfolio-', '--format', 'table {{.Names}}\t{{.Status}}\t{{.Ports}}')
}

function Test-Gesundheit {
	$frontendPort = Get-FrontendPort
	$backendPort = Get-BackendPort
	$m = Get-Mode
	Write-Head "Gesundheit: $($m['Label'])"
	Test-Endpoint -Label 'Oberflaeche' -Url "http://localhost:$frontendPort/"
	Test-Endpoint -Label 'API durch den Proxy' -Url "http://localhost:$frontendPort/actuator/health"
	Test-Endpoint -Label 'Backend direkt' -Url "http://localhost:$backendPort/actuator/health"
	if ($m['Profil'] -eq 'dev') {
		Test-Endpoint -Label 'OpenAPI-Dokument' -Url "http://localhost:$backendPort/v3/api-docs"
	} else {
		Write-Host '  OpenAPI-Dokument               im Profil prod abgeschaltet, 404 erwartet' -ForegroundColor DarkGray
		Test-Endpoint -Label 'OpenAPI-Dokument' -Url "http://localhost:$backendPort/v3/api-docs"
	}
}

function Invoke-BackendCompile {
	if ($script:Mode -ne 'dev') {
		Write-Head 'Backend neu uebersetzen'
		Write-Host "Nur in DEV moeglich. Die Images von ARTIFACT und PROD enthalten kein" -ForegroundColor Yellow
		Write-Host 'Maven und keinen Quellcode; dort wird mit Menuepunkt 5 neu gebaut.' -ForegroundColor Yellow
		return
	}
	Write-Head 'Backend neu uebersetzen'
	Write-Host 'DevTools startet danach neu. Zwei Neustarts hintereinander sind normal,' -ForegroundColor DarkGray
	Write-Host 'weil Maven target/classes erst leert und dann neu schreibt.' -ForegroundColor DarkGray
	Invoke-Compose @('exec', 'backend', 'mvn', 'compile')
}

function Open-Psql {
	$user = Get-EnvValue -Name 'POSTGRES_USER' -Default 'eportfolio'
	$database = Get-EnvValue -Name 'POSTGRES_DB' -Default 'eportfolio'
	Write-Head "psql als $user in $database ($((Get-Mode)['Label']))"
	Write-Host 'Jede Betriebsart hat ihre eigene Datenbank. Beenden mit \q' -ForegroundColor DarkGray
	Invoke-Compose @('exec', 'db', 'psql', '-U', $user, '-d', $database)
}

function Invoke-BackendTests {
	Write-Head 'Backend-Tests auf dem Host'
	Write-Host 'Laufen gegen die Datenbank auf POSTGRES_PORT, also die von DEV.' -ForegroundColor DarkGray
	Push-Location (Join-Path $PSScriptRoot 'backend')
	try {
		Write-Host ''
		Write-Host '> .\mvnw.cmd test' -ForegroundColor DarkGray
		& .\mvnw.cmd test
	} finally {
		Pop-Location
	}
}

function Invoke-FrontendTests {
	Write-Head 'Frontend-Tests auf dem Host'
	Push-Location (Join-Path $PSScriptRoot 'frontend')
	try {
		Write-Host ''
		Write-Host '> pnpm test' -ForegroundColor DarkGray
		& pnpm test
		if ($LASTEXITCODE -ne 0) {
			Write-Host ''
			Write-Host 'Scheitert es an ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION, ist ein Paket im' -ForegroundColor Yellow
			Write-Host 'Lockfile juenger als 24 Stunden. Entweder abwarten oder einmalig:' -ForegroundColor Yellow
			Write-Host '  $env:PNPM_CONFIG_MINIMUM_RELEASE_AGE = 0; pnpm test' -ForegroundColor Yellow
		}
	} finally {
		Pop-Location
	}
}

function Get-ProjektImages {
	$images = & docker images --format '{{.Repository}}:{{.Tag}}' --filter 'reference=eportfolio-*'
	if ($LASTEXITCODE -ne 0) { return @() }
	if ($null -eq $images) { return @() }
	return @($images)
}

function Remove-ProjektImages {
	Write-Head 'Images aller Betriebsarten entfernen'
	$images = Get-ProjektImages
	if ($images.Count -eq 0) {
		Write-Host 'Keine Images dieses Projekts vorhanden.' -ForegroundColor DarkGray
		return
	}
	Write-Host 'Betroffen:' -ForegroundColor Yellow
	foreach ($image in $images) { Write-Host "  $image" }
	if (Confirm-Action 'Der naechste Start baut sie neu. Daten sind nicht betroffen.') {
		Invoke-Docker (@('image', 'rm') + $images)
	}
}

function Remove-Betriebsart {
	$m = Get-Mode
	Write-Head "$($m['Label']) vollstaendig entfernen"
	Write-Host "Das loescht Container und Volumes des Projekts $($m['Project']):" -ForegroundColor Yellow
	Write-Host '  - den Datenbankinhalt dieser Betriebsart'
	Write-Host '  - die hochgeladenen Dateien dieser Betriebsart'
	if ($script:Mode -eq 'dev') {
		Write-Host '  - das Maven-Repository und node_modules der Container'
	}
	Write-Host 'Die anderen beiden Betriebsarten bleiben unberuehrt.'
	if (Confirm-Action 'Daten dieser Betriebsart sind danach weg.') {
		Invoke-Compose @('down', '-v', '--remove-orphans')
	}
}

function Remove-Alles {
	Write-Head 'Alle drei Betriebsarten vollstaendig entfernen'
	Write-Host 'Das loescht Container, Volumes und Images aller drei Projekte:' -ForegroundColor Yellow
	Write-Host '  - drei Datenbankinhalte'
	Write-Host '  - alle hochgeladenen Dateien'
	Write-Host '  - Maven-Repository und node_modules'
	Write-Host 'Andere Docker-Projekte bleiben unberuehrt.'
	if (-not (Confirm-Action 'Es bleibt nichts uebrig.')) { return }

	$merken = $script:Mode
	foreach ($key in @($Modes.Keys)) {
		$script:Mode = $key
		Invoke-Compose @('down', '-v', '--remove-orphans')
	}
	$script:Mode = $merken

	$images = Get-ProjektImages
	if ($images.Count -gt 0) {
		Invoke-Docker (@('image', 'rm') + $images)
	}
	Write-Host ''
	Write-Host 'Fertig.' -ForegroundColor Green
}

function Clear-BuildCache {
	Write-Head 'Build-Cache von BuildKit leeren'
	Write-Host 'Achtung: der Build-Cache ist NICHT nach Projekten getrennt.' -ForegroundColor Yellow
	Write-Host 'Das trifft jedes Docker-Projekt auf diesem Rechner; alle Builds' -ForegroundColor Yellow
	Write-Host 'laufen danach einmal ohne Cache und damit deutlich langsamer.' -ForegroundColor Yellow
	Write-Host 'Sinnvoll bei der Meldung "snapshot ... does not exist".' -ForegroundColor DarkGray
	if (Confirm-Action 'Build-Cache aller Projekte verwerfen.') {
		Invoke-Docker @('builder', 'prune', '-f')
	}
}

# --------------------------------------------------------------------------
# Menue
# --------------------------------------------------------------------------

function Show-Menu {
	$m = Get-Mode
	Write-Host ''
	Write-Host '=====================================================' -ForegroundColor Cyan
	Write-Host ' E-Portfolio Hochschule Bremen: Container-Steuerung' -ForegroundColor Cyan
	Write-Host '=====================================================' -ForegroundColor Cyan
	Write-Host ''
	Write-Host (" Betriebsart : {0}" -f $m['Label']) -ForegroundColor Green
	Write-Host ("               Projekt {0}, Spring-Profil {1}, Oberflaeche {2}" -f $m['Project'], $m['Profil'], (Get-FrontendPort)) -ForegroundColor DarkGray
	Write-Host ''
	Write-Host '   b  Betriebsart wechseln' -ForegroundColor White
	Write-Host ''
	Write-Host ' Starten und bauen                        (gilt fuer die Betriebsart oben)' -ForegroundColor White
	Write-Host '   1  Starten'
	Write-Host '   2  Neu bauen und starten'
	Write-Host '   3  Nur die Datenbank starten'
	Write-Host '   4  Images bauen, ohne zu starten'
	Write-Host '   5  Images ohne Cache bauen       (bei kaputtem Build-Cache)'
	Write-Host ''
	Write-Host ' Beobachten' -ForegroundColor White
	Write-Host '   6  Status'
	Write-Host '   7  Status ALLER Betriebsarten'
	Write-Host '   8  Gesundheit pruefen            (Health, Proxy, OpenAPI)'
	Write-Host '   9  Logs folgen: alle             (Strg+C beendet nur die Anzeige)'
	Write-Host '  10  Logs folgen: Backend'
	Write-Host '  11  Logs folgen: Frontend'
	Write-Host '  12  Logs folgen: Datenbank'
	Write-Host ''
	Write-Host ' Arbeiten' -ForegroundColor White
	Write-Host '  13  Backend neu uebersetzen       (nur DEV, loest den Hot Reload aus)'
	Write-Host '  14  Shell im Backend'
	Write-Host '  15  Shell im Frontend'
	Write-Host '  16  psql in der Datenbank'
	Write-Host '  17  Backend-Tests auf dem Host    (.\mvnw.cmd test)'
	Write-Host '  18  Frontend-Tests auf dem Host   (pnpm test)'
	Write-Host ''
	Write-Host ' Aufraeumen' -ForegroundColor White
	Write-Host '  19  Stoppen                       (Container und Daten bleiben)'
	Write-Host '  20  Container entfernen           (Volumes bleiben erhalten)'
	Write-Host '  21  Diese Betriebsart entfernen   [inkl. ihrer Datenbank]'
	Write-Host '  22  Images aller Betriebsarten entfernen'
	Write-Host '  23  ALLE drei Betriebsarten entfernen  [Container, Volumes, Images]'
	Write-Host '  24  Build-Cache leeren            [betrifft ALLE Docker-Projekte]'
	Write-Host ''
	Write-Host '   0  Beenden' -ForegroundColor White
	Write-Host ''
}

if (-not (Test-Voraussetzungen)) {
	Write-Host ''
	Write-Host 'Abgebrochen.' -ForegroundColor Red
	exit 1
}

$running = $true
# Schutz gegen einen nicht-interaktiven Aufruf: kommt die Eingabe aus einer
# Datei oder einer Pipeline, liefert Read-Host am Ende endlos leere Zeilen,
# und das Menue liefe fuer immer.
$leereEingaben = 0

while ($running) {
	Show-Menu
	$choice = Read-Host 'Auswahl'

	if ([string]::IsNullOrWhiteSpace($choice)) {
		$leereEingaben++
		if ($leereEingaben -ge 3) {
			Write-Host ''
			Write-Host 'Keine Eingabe. Beendet.' -ForegroundColor Yellow
			break
		}
		continue
	}
	$leereEingaben = 0

	switch ($choice.Trim().ToLower()) {
		'b'  { Select-Betriebsart }
		'1'  { Start-Betriebsart }
		'2'  { Start-Betriebsart -Build }
		'3'  { Write-Head 'Nur die Datenbank starten'; Invoke-Compose @('up', '-d', 'db') }
		'4'  { Write-Head 'Images bauen'; Invoke-Compose @('build') }
		'5'  { Write-Head 'Images ohne Cache bauen'; Invoke-Compose @('build', '--no-cache') }
		'6'  { Show-Status }
		'7'  { Show-StatusAlle }
		'8'  { Test-Gesundheit }
		'9'  { Invoke-Compose @('logs', '-f', '--tail', '100') }
		'10' { Invoke-Compose @('logs', '-f', '--tail', '100', 'backend') }
		'11' { Invoke-Compose @('logs', '-f', '--tail', '100', 'frontend') }
		'12' { Invoke-Compose @('logs', '-f', '--tail', '100', 'db') }
		'13' { Invoke-BackendCompile }
		'14' { Invoke-Compose @('exec', 'backend', 'bash') }
		'15' { Invoke-Compose @('exec', 'frontend', 'bash') }
		'16' { Open-Psql }
		'17' { Invoke-BackendTests }
		'18' { Invoke-FrontendTests }
		'19' { Write-Head 'Stoppen'; Invoke-Compose @('stop') }
		'20' { Write-Head 'Container entfernen'; Invoke-Compose @('down', '--remove-orphans') }
		'21' { Remove-Betriebsart }
		'22' { Remove-ProjektImages }
		'23' { Remove-Alles }
		'24' { Clear-BuildCache }
		'0'  { $running = $false }
		default { Write-Host ''; Write-Host "Unbekannte Auswahl: $choice" -ForegroundColor Red }
	}

	if ($running) {
		Write-Host ''
		Read-Host 'Weiter mit Eingabetaste' | Out-Null
	}
}
