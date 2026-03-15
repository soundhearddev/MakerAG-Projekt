<?php

/**
 * api.php – Zentrales Backend (v2)
 *
 * Verbesserungen gegenüber v1:
 *  - Vollständiges DB-Logging in `logs`-Tabelle (mit Fallback auf error_log)
 *  - CSRF-Schutz für alle schreibenden POST-Requests
 *  - Input-Sanitierung & Längen-Limits
 *  - Structured Error Codes
 *  - Rate-Limiting (Session-basiert, konfigurierbar)
 *  - Datei-Upload: MIME-Type-Prüfung statt nur Extension
 *  - Keine sensiblen Fehlermeldungen im Response (nur intern geloggt)
 *  - Konsistente JSON-Antwort-Struktur: {ok, data, error, code}
 *  - Alle DB-Operationen in Transaktionen (save_item)
 */

declare(strict_types=1);

// ─── Konfiguration ────────────────────────────────────────────────────────────

const APP_VERSION     = '2.0';
const MAX_UPLOAD_MB   = 20;
const RATE_LIMIT_RPM  = 60;   // Requests pro Minute pro Session
const DEBUG_MODE      = false; // Auf true setzen für lokale Entwicklung

// Erlaubte MIME-Types für Uploads
const ALLOWED_MIMES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/avif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
];

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
const DOC_EXTS   = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'];

// ─── Bootstrap ────────────────────────────────────────────────────────────────

session_start();

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

// ─── DB verbinden ─────────────────────────────────────────────────────────────

$db      = null;
$dbError = null;

$configPaths = [
    '/var/www/secure/config.php',
    __DIR__ . '/../secure/config.php',
    __DIR__ . '/../../secure/config.php',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/secure/config.php',
];

foreach ($configPaths as $path) {
    if (file_exists($path)) {
        require_once $path;
        break;
    }
}

if (class_exists('Database')) {
    try {
        $db = Database::connect();
        $db->set_charset('utf8mb4');
    } catch (Exception $e) {
        $dbError = DEBUG_MODE ? $e->getMessage() : 'Datenbankverbindung fehlgeschlagen';
        error_log('[api.php] DB-Connect-Fehler: ' . $e->getMessage());
    }
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/**
 * Loggt eine Aktion in die DB (Tabelle `logs`) UND in error_log als Fallback.
 *
 * @param string      $action   z.B. 'page_view', 'item_created', 'error'
 * @param string|null $detail   Freitext-Detail (z.B. "ID 42: Raspberry Pi")
 * @param string      $level    'info' | 'warning' | 'error' | 'debug'
 * @param array       $extra    Zusätzliche Key-Value-Daten (werden als JSON in extra_data gespeichert)
 */
function logAction(
    string  $action,
    ?string $detail = null,
    string  $level  = 'info',
    array   $extra  = []
): void {
    global $db;

    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

    $entry = [
        'timestamp'    => date('Y-m-d H:i:s'),
        'level'        => $level,
        'action'       => $action,
        'detail'       => $detail,
        'ip'           => getClientIp(),
        'browser'      => parseBrowser($ua),
        'os'           => parseOS($ua),
        'device_type'  => parseDeviceType($ua),
        'language'     => parseLanguage($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null),
        'referrer'     => isset($_SERVER['HTTP_REFERER']) ? substr($_SERVER['HTTP_REFERER'], 0, 512) : null,
        'method'       => $_SERVER['REQUEST_METHOD'] ?? null,
        'url'          => getCurrentUrl(),
        'session_id'   => session_id() ?: null,
        'user_agent'   => $ua ? substr($ua, 0, 512) : null,
        'extra_data'   => !empty($extra) ? json_encode($extra, JSON_UNESCAPED_UNICODE) : null,
    ];

    // ── error_log (immer, als Fallback) ──────────────────────────────────────
    $line = str_repeat('─', 60);
    $out  = "\n{$line}\n  LOG [{$level}] {$action}\n{$line}\n";
    foreach ($entry as $k => $v) {
        if ($k === 'extra_data' && $v) {
            $out .= '  ' . str_pad($k, 14) . '  ' . $v . "\n";
        } elseif ($v !== null) {
            $out .= '  ' . str_pad($k, 14) . '  ' . $v . "\n";
        }
    }
    $out .= "{$line}\n";
    error_log($out);

    // ── DB-Insert ─────────────────────────────────────────────────────────────
    if (!$db) return;

    try {
        $stmt = $db->prepare("
            INSERT INTO logs
                (level, action, detail, ip, browser, os, device_type, language,
                 referrer, method, url, session_id, user_agent, extra_data)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->bind_param(
            'ssssssssssssss',
            $entry['level'],
            $entry['action'],
            $entry['detail'],
            $entry['ip'],
            $entry['browser'],
            $entry['os'],
            $entry['device_type'],
            $entry['language'],
            $entry['referrer'],
            $entry['method'],
            $entry['url'],
            $entry['session_id'],
            $entry['user_agent'],
            $entry['extra_data']
        );
        $stmt->execute();
    } catch (Exception $e) {
        // Logging darf nie den Request abbrechen – nur intern protokollieren
        error_log('[api.php] Log-DB-Fehler: ' . $e->getMessage());
    }
}




/**
 * Startet lookup_host.sh im Hintergrund für eine IP.
 * Non-blocking: PHP wartet NICHT auf das Ergebnis.
 *
 * Sicherheit:
 *  - IP wird mit filter_var validiert bevor sie ans Script geht
 *  - Nur interne RFC-1918 Adressen werden akzeptiert
 *  - Script-Pfad ist hardcoded (kein User-Input im Pfad)
 *  - escapeshellarg() verhindert Shell-Injection
 */
function triggerHostLookup(string $ip): void
{
    // Leere oder ungültige IP → nichts tun
    if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP)) {
        return;
    }

    // Nur interne IPs (10.x, 172.16-31.x, 192.168.x)
    // Verhindert dass jemand externe IPs reinschleust
    if (!isPrivateIp($ip)) {
        return;
    }

    $scriptPath = '/opt/inventar/lookup_host.sh';

    // Script muss existieren und ausführbar sein
    if (!is_executable($scriptPath)) {
        error_log("[api.php] triggerHostLookup: Script nicht gefunden/ausführbar: {$scriptPath}");
        return;
    }

    // IP sicher escapen für Shell
    $safeIp = escapeshellarg($ip);

    // Non-blocking ausführen:
    //   nohup  → läuft weiter auch wenn PHP-Prozess endet
    //   >>     → Logdatei anhängen
    //   2>&1   → stderr auch in Log
    //   &      → in Hintergrund schicken (PHP wartet nicht)
    $logFile = '/var/log/lookup_host.log';
    $cmd = "nohup {$scriptPath} {$safeIp} >> " . escapeshellarg($logFile) . " 2>&1 &";

    exec($cmd);






    // Nur intern loggen, kein error_log-Spam bei jedem Request
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        error_log("[api.php] Host-Lookup gestartet für: {$ip}");
    }
    triggerHostLookup(getClientIp());
}

/**
 * Prüft ob eine IP im privaten RFC-1918 Bereich liegt.
 */
function isPrivateIp(string $ip): bool
{
    // filter_var mit FILTER_FLAG_NO_PRIV_RANGE schließt private IPs AUS
    // Wir wollen aber NUR private IPs → Logik umkehren
    $isPublic = filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    );
    return $isPublic === false; // false = ist privat = wir wollen es
}



// ─── IP / UA-Parser ───────────────────────────────────────────────────────────

function getClientIp(): string
{
    foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $key) {
        $ip = trim(explode(',', $_SERVER[$key] ?? '')[0]);
        if ($ip && filter_var($ip, FILTER_VALIDATE_IP)) {
            return substr($ip, 0, 45);
        }
    }
    return '0.0.0.0';
}

function getCurrentUrl(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $uri    = $_SERVER['REQUEST_URI'] ?? '/';
    return substr("{$scheme}://{$host}{$uri}", 0, 512);
}

function parseBrowser(?string $ua): ?string
{
    if (!$ua) return null;
    $browsers = [
        'Edg'           => 'Edge',
        'OPR'           => 'Opera',
        'SamsungBrowser' => 'Samsung Browser',
        'Chrome'        => 'Chrome',
        'Firefox'       => 'Firefox',
        'Safari'        => 'Safari',
        'Trident'       => 'Internet Explorer',
    ];
    foreach ($browsers as $token => $name) {
        if (stripos($ua, $token) !== false) {
            $version = '';
            if (preg_match("/{$token}[\/ ]([\d]+)/i", $ua, $m)) {
                $version = ' ' . $m[1];
            }
            return $name . $version;
        }
    }
    return substr($ua, 0, 64);
}

function parseOS(?string $ua): ?string
{
    if (!$ua) return null;
    if (preg_match('/Windows NT ([\d.]+)/i', $ua, $m)) {
        $map = ['10.0' => 'Windows 10/11', '6.3' => 'Windows 8.1', '6.2' => 'Windows 8', '6.1' => 'Windows 7'];
        return $map[$m[1]] ?? 'Windows NT ' . $m[1];
    }
    if (preg_match('/Android ([\d.]+)/i', $ua, $m))        return 'Android ' . $m[1];
    if (preg_match('/Mac OS X ([\d_]+)/i', $ua, $m))       return 'macOS ' . str_replace('_', '.', $m[1]);
    if (stripos($ua, 'iPhone') !== false)                  return 'iOS (iPhone)';
    if (stripos($ua, 'iPad') !== false)                    return 'iPadOS';
    if (stripos($ua, 'Linux') !== false)                   return 'Linux';
    return null;
}

function parseDeviceType(?string $ua): string
{
    if (!$ua) return 'unknown';
    if (preg_match('/tablet|ipad|playbook|silk/i', $ua))                              return 'tablet';
    if (preg_match('/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i', $ua)) return 'mobile';
    return 'desktop';
}

function parseLanguage(?string $l): ?string
{
    if (!$l) return null;
    return substr(trim(explode(',', $l)[0]), 0, 64);
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function docRoot(): string
{
    return rtrim($_SERVER['DOCUMENT_ROOT'] ?? '/var/www/public', '/');
}

function makeDir(int $id, string $sub): string
{
    $path = docRoot() . "/docs/{$id}/{$sub}/";
    if (!is_dir($path)) {
        if (!mkdir($path, 0775, true) && !is_dir($path)) {
            throw new RuntimeException("Verzeichnis konnte nicht erstellt werden: {$path}");
        }
    }
    return $path;
}

/**
 * Einheitliche JSON-Antwort.
 * Erfolg:  respond(['data' => ...])
 * Fehler:  respond(['error' => 'Meldung', 'code' => 'ERR_CODE'], 400)
 */
function respond(array $payload, int $httpCode = 200): never
{
    http_response_code($httpCode);
    $response = array_merge(['ok' => $httpCode < 400], $payload);
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function respondError(string $message, int $httpCode = 400, string $code = ''): never
{
    $payload = ['error' => $message];
    if ($code) $payload['code'] = $code;
    respond($payload, $httpCode);
}

/**
 * Sanitiert einen String: trimmt, begrenzt auf $maxLen Zeichen.
 */
function sanitize(?string $val, int $maxLen = 255): ?string
{
    if ($val === null) return null;
    $val = trim($val);
    if ($val === '') return null;
    return mb_substr($val, 0, $maxLen);
}

// ─── CSRF-Token ───────────────────────────────────────────────────────────────

function getCsrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCsrf(): void
{
    $token = $_POST['csrf_token']
        ?? $_SERVER['HTTP_X_CSRF_TOKEN']
        ?? '';
    if (!hash_equals(getCsrfToken(), $token)) {
        logAction('csrf_violation', 'Ungültiger CSRF-Token', 'warning');
        respondError('Ungültige Anfrage (CSRF)', 403, 'ERR_CSRF');
    }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

function checkRateLimit(): void
{
    $now    = time();
    $window = 60; // Sekunden

    if (!isset($_SESSION['rl_count'], $_SESSION['rl_start'])) {
        $_SESSION['rl_count'] = 0;
        $_SESSION['rl_start'] = $now;
    }

    if (($now - $_SESSION['rl_start']) > $window) {
        $_SESSION['rl_count'] = 0;
        $_SESSION['rl_start'] = $now;
    }

    $_SESSION['rl_count']++;

    if ($_SESSION['rl_count'] > RATE_LIMIT_RPM) {
        logAction('rate_limit', 'Limit überschritten: ' . $_SESSION['rl_count'] . ' Req/min', 'warning');
        respondError('Zu viele Anfragen. Bitte warten.', 429, 'ERR_RATE_LIMIT');
    }
}

// ─── Router ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = trim($_GET['action'] ?? $_POST['action'] ?? '');

checkRateLimit();

// ─────────────────────────────────────────────────────────────────────────────
// GET-Requests
// ─────────────────────────────────────────────────────────────────────────────

if ($method === 'GET') {

    // ── GET /api.php?action=formdata ──────────────────────────────────────────
    if ($action === 'formdata') {
        logAction('page_view', null, 'info', ['action' => 'formdata']);

        if (!$db) {
            respondError($dbError ?? 'Keine Datenbankverbindung', 503, 'ERR_DB');
        }

        $categories = $db->query("
            SELECT c.id, c.name, c.parent_id, p.name AS parent_name
            FROM categories c
            LEFT JOIN categories p ON p.id = c.parent_id
            ORDER BY COALESCE(p.name, c.name) ASC, c.name ASC
        ")->fetch_all(MYSQLI_ASSOC);

        $locations = $db->query("
            SELECT * FROM locations ORDER BY schrank ASC, regal ASC
        ")->fetch_all(MYSQLI_ASSOC);

        $tags = $db->query("
            SELECT * FROM tags ORDER BY name ASC
        ")->fetch_all(MYSQLI_ASSOC);

        // CSRF-Token mitliefern damit das Frontend es verwenden kann
        respond([
            'data' => [
                'categories' => $categories,
                'locations'  => $locations,
                'tags'       => $tags,
                'csrf_token' => getCsrfToken(),
            ],
        ]);
    }

    // ── GET /api.php?action=logs ──────────────────────────────────────────────
    if ($action === 'logs') {
        if (!$db) respondError('Keine Datenbankverbindung', 503, 'ERR_DB');

        $limit  = min((int)($_GET['limit']  ?? 100), 500);
        $offset = max((int)($_GET['offset'] ?? 0),   0);
        $level  = sanitize($_GET['level'] ?? null, 20);
        $search = sanitize($_GET['q']     ?? null, 100);

        $where  = [];
        $params = [];
        $types  = '';

        if ($level) {
            $where[]  = 'level = ?';
            $params[] = $level;
            $types   .= 's';
        }
        if ($search) {
            $where[]  = '(action LIKE ? OR detail LIKE ? OR ip LIKE ?)';
            $like     = '%' . $db->real_escape_string($search) . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $types   .= 'sss';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $db->prepare("SELECT COUNT(*) FROM logs {$whereClause}");
        if ($types) $countStmt->bind_param($types, ...$params);
        $countStmt->execute();
        $total = $countStmt->get_result()->fetch_row()[0];

        $stmt = $db->prepare("
            SELECT id, created_at, level, action, detail, ip, browser, os,
                   device_type, language, method, url, session_id, extra_data
            FROM logs
            {$whereClause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        ");
        $params[] = $limit;
        $params[] = $offset;
        $types   .= 'ii';
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $logs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        respond(['data' => ['logs' => $logs, 'total' => $total, 'limit' => $limit, 'offset' => $offset]]);
    }

    respondError('Unbekannte Action', 400, 'ERR_UNKNOWN_ACTION');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-Requests
// ─────────────────────────────────────────────────────────────────────────────

if ($method === 'POST') {

    // ── POST accept_overlay (kein CSRF nötig – schreibt nur Session) ─────────
    if ($action === 'accept_overlay') {
        $_SESSION['welcome_accepted'] = true;
        logAction('overlay_accepted', null, 'info');
        respond(['data' => ['session_id' => session_id()]]);
    }

    // ── POST session_status ──────────────────────────────────────────────────
    if ($action === 'session_status') {
        respond(['data' => [
            'accepted'   => !empty($_SESSION['welcome_accepted']),
            'csrf_token' => getCsrfToken(),
        ]]);
    }

    // ── POST save_item ────────────────────────────────────────────────────────
    if ($action === 'save_item') {
        validateCsrf();

        if (!$db) respondError('Keine Datenbankverbindung', 503, 'ERR_DB');

        // Transaktion starten
        $db->begin_transaction();

        try {
            // ── 1. Kategorie ─────────────────────────────────────────────────
            $categoryId = null;
            if (!empty($_POST['category_id']) && (int)$_POST['category_id'] > 0) {
                $categoryId = (int)$_POST['category_id'];
                // Existenz prüfen
                $cs = $db->prepare("SELECT id FROM categories WHERE id = ?");
                $cs->bind_param('i', $categoryId);
                $cs->execute();
                if (!$cs->get_result()->fetch_row()) {
                    throw new InvalidArgumentException("Kategorie #{$categoryId} existiert nicht.");
                }
            } elseif (!empty($_POST['new_category_name'])) {
                $cn  = sanitize($_POST['new_category_name'], 100);
                if (!$cn) throw new InvalidArgumentException('Kategoriename darf nicht leer sein.');
                $pid = !empty($_POST['new_category_parent']) ? (int)$_POST['new_category_parent'] : null;
                $s   = $db->prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)");
                $s->bind_param('si', $cn, $pid);
                $s->execute();
                $categoryId = $db->insert_id;
            }

            // ── 2. Standort ──────────────────────────────────────────────────
            $locationId = null;
            if (!empty($_POST['location_id']) && (int)$_POST['location_id'] > 0) {
                $locationId = (int)$_POST['location_id'];
                $ls = $db->prepare("SELECT id FROM locations WHERE id = ?");
                $ls->bind_param('i', $locationId);
                $ls->execute();
                if (!$ls->get_result()->fetch_row()) {
                    throw new InvalidArgumentException("Standort #{$locationId} existiert nicht.");
                }
            } elseif (!empty($_POST['new_schrank'])) {
                $room = sanitize($_POST['new_room']     ?? null, 100);
                $sch  = sanitize($_POST['new_schrank']  ?? null, 100);
                $reg  = sanitize($_POST['new_regal']    ?? null, 100);
                $pos  = sanitize($_POST['new_position'] ?? null, 100);
                $s    = $db->prepare("INSERT INTO locations (room, schrank, regal, position) VALUES (?,?,?,?)");
                $s->bind_param('ssss', $room, $sch, $reg, $pos);
                $s->execute();
                $locationId = $db->insert_id;
            }

            // ── 3. Item ──────────────────────────────────────────────────────
            $name   = sanitize($_POST['name']          ?? null, 255);
            $brand  = sanitize($_POST['brand']         ?? null, 100);
            $model  = sanitize($_POST['model']         ?? null, 100);
            $serial = sanitize($_POST['serial_number'] ?? null, 100);
            $notes  = sanitize($_POST['notes']         ?? null, 2000);

            $status = in_array($_POST['status'] ?? '', ['verfügbar', 'ausgeliehen', 'defekt', 'verschollen', 'entsorgt'], true)
                ? $_POST['status']
                : 'verfügbar';

            $validConditions = ['', 'neu', 'gut', 'akzeptabel', 'schlecht'];
            $cond = in_array($_POST['item_condition'] ?? '', $validConditions, true)
                ? ($_POST['item_condition'] ?: null)
                : null;

            if (!$name) {
                throw new InvalidArgumentException('Name darf nicht leer sein.');
            }

            $s = $db->prepare("
                INSERT INTO items (name, brand, model, serial_number, category_id, status, item_condition, location_id, notes)
                VALUES (?,?,?,?,?,?,?,?,?)
            ");
            $s->bind_param('ssssissis', $name, $brand, $model, $serial, $categoryId, $status, $cond, $locationId, $notes);
            $s->execute();
            $newId = $db->insert_id;

            // ── 4. Specs ─────────────────────────────────────────────────────
            $specCount = 0;
            if (!empty($_POST['spec_key']) && is_array($_POST['spec_key'])) {
                $ss = $db->prepare("INSERT INTO specs (item_id, `key`, value) VALUES (?,?,?)");
                foreach ($_POST['spec_key'] as $i => $k) {
                    $k = sanitize($k, 100);
                    $v = sanitize($_POST['spec_value'][$i] ?? null, 500);
                    if ($k && $v) {
                        $ss->bind_param('iss', $newId, $k, $v);
                        $ss->execute();
                        $specCount++;
                    }
                }
            }

            // ── 5. Tags ──────────────────────────────────────────────────────
            $tagIds = array_filter(array_map('intval', (array)($_POST['tags'] ?? [])));

            if (!empty($_POST['new_tags'])) {
                $newTagNames = array_filter(
                    array_map(fn($t) => sanitize($t, 50), explode(',', $_POST['new_tags']))
                );
                foreach ($newTagNames as $nt) {
                    $sc = $db->prepare("SELECT id FROM tags WHERE name = ?");
                    $sc->bind_param('s', $nt);
                    $sc->execute();
                    $existing = $sc->get_result()->fetch_assoc();
                    if ($existing) {
                        $tagIds[] = (int)$existing['id'];
                    } else {
                        $st = $db->prepare("INSERT INTO tags (name) VALUES (?)");
                        $st->bind_param('s', $nt);
                        $st->execute();
                        $tagIds[] = $db->insert_id;
                    }
                }
            }

            foreach (array_unique($tagIds) as $tid) {
                if ($tid <= 0) continue;
                $si = $db->prepare("INSERT IGNORE INTO item_tags (item_id, tag_id) VALUES (?,?)");
                $si->bind_param('ii', $newId, $tid);
                $si->execute();
            }

            // ── 6. Uploads ───────────────────────────────────────────────────
            $uploaded  = ['images' => [], 'docs' => [], 'rejected' => []];
            $maxBytes  = MAX_UPLOAD_MB * 1024 * 1024;

            if (!empty($_FILES['uploads']['name'][0])) {
                $imgDir = makeDir($newId, 'images');
                $datDir = makeDir($newId, 'data');

                foreach ($_FILES['uploads']['name'] as $i => $origName) {
                    $error = $_FILES['uploads']['error'][$i];
                    if ($error !== UPLOAD_ERR_OK) {
                        $uploaded['rejected'][] = ['file' => $origName, 'reason' => "Upload-Fehler Code {$error}"];
                        continue;
                    }

                    $size = $_FILES['uploads']['size'][$i];
                    if ($size > $maxBytes) {
                        $uploaded['rejected'][] = ['file' => $origName, 'reason' => 'Datei zu groß (max. ' . MAX_UPLOAD_MB . ' MB)'];
                        continue;
                    }

                    $tmp  = $_FILES['uploads']['tmp_name'][$i];
                    $mime = mime_content_type($tmp) ?: 'application/octet-stream';
                    $ext  = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

                    if (!in_array($mime, ALLOWED_MIMES, true)) {
                        $uploaded['rejected'][] = ['file' => $origName, 'reason' => "MIME-Type nicht erlaubt: {$mime}"];
                        continue;
                    }

                    // Sicherer Dateiname: nur alphanumerisch + . - _
                    $safeName = preg_replace('/[^a-zA-Z0-9_\-\.]/i', '_', $origName);
                    $safeName = preg_replace('/\.{2,}/', '.', $safeName); // Double-dots entfernen
                    $safeName = substr($safeName, 0, 200);

                    // Duplikat-Handling: bei Namenskonflikt Timestamp-Suffix anhängen
                    if (in_array($ext, IMAGE_EXTS, true)) {
                        $dest = $imgDir . $safeName;
                        if (file_exists($dest)) {
                            $safeName = pathinfo($safeName, PATHINFO_FILENAME) . '_' . time() . '.' . $ext;
                            $dest     = $imgDir . $safeName;
                        }
                        if (move_uploaded_file($tmp, $dest)) {
                            $uploaded['images'][] = $safeName;
                        }
                    } elseif (in_array($ext, DOC_EXTS, true)) {
                        $dest = $datDir . $safeName;
                        if (file_exists($dest)) {
                            $safeName = pathinfo($safeName, PATHINFO_FILENAME) . '_' . time() . '.' . $ext;
                            $dest     = $datDir . $safeName;
                        }
                        if (move_uploaded_file($tmp, $dest)) {
                            $uploaded['docs'][] = $safeName;
                        }
                    } else {
                        $uploaded['rejected'][] = ['file' => $origName, 'reason' => "Unbekannte Dateiendung: {$ext}"];
                    }
                }
            }

            // ── Transaktion abschließen ───────────────────────────────────────
            $db->commit();

            logAction('item_created', "ID {$newId}: {$name}", 'info', [
                'item_id'    => $newId,
                'status'     => $status,
                'specs'      => $specCount,
                'tags'       => count(array_unique($tagIds)),
                'images'     => count($uploaded['images']),
                'docs'       => count($uploaded['docs']),
                'rejected'   => count($uploaded['rejected']),
                'category_id' => $categoryId,
                'location_id' => $locationId,
            ]);

            respond([
                'data' => [
                    'id'       => $newId,
                    'name'     => $name,
                    'uploaded' => $uploaded,
                ],
            ]);
        } catch (InvalidArgumentException $e) {
            $db->rollback();
            logAction('item_validation_error', $e->getMessage(), 'warning');
            respondError($e->getMessage(), 422, 'ERR_VALIDATION');
        } catch (Exception $e) {
            $db->rollback();
            $internalMsg = $e->getMessage();
            logAction('item_error', $internalMsg, 'error', ['trace' => substr($e->getTraceAsString(), 0, 500)]);
            $publicMsg = DEBUG_MODE ? $internalMsg : 'Interner Serverfehler. Bitte versuche es erneut.';
            respondError($publicMsg, 500, 'ERR_INTERNAL');
        }
    }

    // ── POST delete_item (mit CSRF) ──────────────────────────────────────────
    if ($action === 'delete_item') {
        validateCsrf();
        if (!$db) respondError('Keine Datenbankverbindung', 503, 'ERR_DB');

        $itemId = (int)($_POST['item_id'] ?? 0);
        if ($itemId <= 0) respondError('Ungültige Item-ID', 422, 'ERR_VALIDATION');

        // Item holen für den Log
        $si = $db->prepare("SELECT name FROM items WHERE id = ?");
        $si->bind_param('i', $itemId);
        $si->execute();
        $item = $si->get_result()->fetch_assoc();
        if (!$item) respondError('Item nicht gefunden', 404, 'ERR_NOT_FOUND');

        $sd = $db->prepare("DELETE FROM items WHERE id = ?");
        $sd->bind_param('i', $itemId);
        $sd->execute();

        logAction('item_deleted', "ID {$itemId}: {$item['name']}", 'info', ['item_id' => $itemId]);
        respond(['data' => ['deleted_id' => $itemId]]);
    }

    respondError('Unbekannte Action', 400, 'ERR_UNKNOWN_ACTION');
}

respondError('Methode nicht erlaubt', 405, 'ERR_METHOD');
