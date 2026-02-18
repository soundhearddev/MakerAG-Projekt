<?php
/**
 * API Endpoint: Background Patterns
 * Pfad: /var/www/public/api/background.php
 * SVGs: /var/www/public/images/background/
 */

// ============================================================================
// HEADERS
// ============================================================================
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================================================
// KONFIGURATION
// Dieser Script liegt in /api/ → eine Ebene hoch, dann images/background/
// ============================================================================
define('BG_FOLDER',   dirname(__DIR__) . '/images/background/');
define('WEB_PATH',    '/images/background/');
define('MAX_SIZE',    2 * 1024 * 1024);

// ============================================================================
// HELPERS
// ============================================================================
function respond(bool $ok, array $data = [], string $err = '', int $code = 200): void
{
    http_response_code($code);
    echo json_encode([
        'success'   => $ok,
        'data'      => $data,
        'error'     => $err ?: null,
        'timestamp' => time(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function logMsg(string $msg): void
{
    $f = dirname(__DIR__) . '/logs/php_errors.log';
    @file_put_contents($f, '[' . date('Y-m-d H:i:s') . '] [background.php] ' . $msg . PHP_EOL, FILE_APPEND);
}

// ============================================================================
// ORDNER SICHERSTELLEN
// ============================================================================
if (!is_dir(BG_FOLDER)) {
    if (!@mkdir(BG_FOLDER, 0755, true)) {
        logMsg('mkdir fehlgeschlagen: ' . BG_FOLDER);
        respond(false, [], 'Ordner konnte nicht erstellt werden', 500);
    }
}

if (!is_readable(BG_FOLDER)) {
    logMsg('Kein Lesezugriff: ' . BG_FOLDER);
    respond(false, [], 'Kein Lesezugriff auf den Ordner', 500);
}

// ============================================================================
// SVG SANITIZER
// ============================================================================
function isSafeSVG(string $path): bool
{
    $content = @file_get_contents($path);
    if ($content === false)                     return false;
    if (stripos($content, '<svg') === false)     return false;

    $bad = [
        '/<script\b[^>]*>.*?<\/script>/is',
        '/<iframe\b[^>]*>/is',
        '/<object\b[^>]*>/is',
        '/<embed\b[^>]*>/is',
        '/on\w+\s*=/i',
        '/javascript\s*:/i',
        '/data\s*:\s*text\/html/i',
        '/xlink\s*:\s*href\s*=\s*["\']?\s*javascript/i',
    ];

    foreach ($bad as $p) {
        if (preg_match($p, $content)) return false;
    }
    return true;
}

function safeFilename(string $raw): string
{
    $base = pathinfo($raw, PATHINFO_FILENAME);
    $base = preg_replace('/[^a-zA-Z0-9_-]/', '_', $base);
    $base = preg_replace('/_+/', '_', $base);
    $base = trim($base, '_');
    if ($base === '') $base = 'pattern_' . uniqid();
    return $base . '.svg';
}

// ============================================================================
// ACTION
// ============================================================================
$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// ============================================================================
// LIST
// ============================================================================
if ($action === 'list') {
    $files = @glob(BG_FOLDER . '*.svg');

    if ($files === false) {
        logMsg('glob() fehlgeschlagen für: ' . BG_FOLDER);
        respond(false, [], 'Ordner konnte nicht gelesen werden', 500);
    }

    $patterns = [];
    foreach ($files as $file) {
        $name = basename($file);
        if ($name[0] === '.') continue;

        $patterns[] = [
            'name'     => $name,
            'path'     => WEB_PATH . $name,
            'size'     => (int) @filesize($file),
            'modified' => (int) @filemtime($file),
        ];
    }

    usort($patterns, fn($a, $b) => strcmp($a['name'], $b['name']));

    respond(true, [
        'patterns' => $patterns,
        'count'    => count($patterns),
    ]);
}

// ============================================================================
// UPLOAD
// ============================================================================
if ($action === 'upload') {
    if (!isset($_FILES['svg'])) {
        respond(false, [], 'Keine Datei übermittelt', 400);
    }

    $f = $_FILES['svg'];

    if ($f['error'] !== UPLOAD_ERR_OK) {
        $codes = [
            UPLOAD_ERR_INI_SIZE   => 'Datei überschreitet upload_max_filesize (php.ini)',
            UPLOAD_ERR_FORM_SIZE  => 'Datei überschreitet MAX_FILE_SIZE im Formular',
            UPLOAD_ERR_PARTIAL    => 'Datei wurde nur teilweise hochgeladen',
            UPLOAD_ERR_NO_FILE    => 'Keine Datei hochgeladen',
            UPLOAD_ERR_NO_TMP_DIR => 'Temp-Ordner fehlt',
            UPLOAD_ERR_CANT_WRITE => 'Schreibfehler auf Disk',
            UPLOAD_ERR_EXTENSION  => 'Upload durch PHP-Extension gestoppt',
        ];
        respond(false, [], $codes[$f['error']] ?? 'Upload-Fehler Code ' . $f['error'], 400);
    }

    if ($f['size'] > MAX_SIZE) {
        respond(false, [], 'Datei zu groß (max. 2 MB)', 400);
    }

    if (strtolower(pathinfo($f['name'], PATHINFO_EXTENSION)) !== 'svg') {
        respond(false, [], 'Nur SVG-Dateien erlaubt', 400);
    }

    // MIME-Prüfung (tolerant, da Server unterschiedlich liefern)
    if (function_exists('finfo_open')) {
        $fi   = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($fi, $f['tmp_name']);
        finfo_close($fi);
        $allowed = ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain'];
        if (!in_array($mime, $allowed, true)) {
            respond(false, [], 'Ungültiger MIME-Typ: ' . $mime, 400);
        }
    }

    if (!isSafeSVG($f['tmp_name'])) {
        respond(false, [], 'SVG enthält unsichere Inhalte', 400);
    }

    $name = safeFilename($f['name']);
    $dest = BG_FOLDER . $name;

    if (file_exists($dest)) {
        $name = pathinfo($name, PATHINFO_FILENAME) . '_' . time() . '.svg';
        $dest = BG_FOLDER . $name;
    }

    if (!move_uploaded_file($f['tmp_name'], $dest)) {
        logMsg('move_uploaded_file fehlgeschlagen → ' . $dest);
        respond(false, [], 'Speichern fehlgeschlagen – Schreibrecht prüfen', 500);
    }

    chmod($dest, 0644);
    logMsg('Upload OK: ' . $name);

    respond(true, [
        'pattern' => [
            'name' => $name,
            'path' => WEB_PATH . $name,
            'size' => (int) filesize($dest),
        ],
        'message' => 'Pattern erfolgreich hochgeladen',
    ]);
}

// ============================================================================
// DELETE
// ============================================================================
if ($action === 'delete') {
    $name = basename(trim($_POST['name'] ?? ''));

    if ($name === '') {
        respond(false, [], 'Kein Dateiname angegeben', 400);
    }

    if (pathinfo($name, PATHINFO_EXTENSION) !== 'svg') {
        respond(false, [], 'Nur SVG-Dateien können gelöscht werden', 400);
    }

    $path = BG_FOLDER . $name;

    if (!file_exists($path)) {
        respond(false, [], 'Datei nicht gefunden: ' . $name, 404);
    }

    if (!@unlink($path)) {
        logMsg('unlink fehlgeschlagen: ' . $path);
        respond(false, [], 'Löschen fehlgeschlagen – Schreibrecht prüfen', 500);
    }

    logMsg('Gelöscht: ' . $name);
    respond(true, ['deleted' => $name, 'message' => 'Pattern gelöscht']);
}

// ============================================================================
// INFO
// ============================================================================
if ($action === 'info') {
    $name = basename(trim($_POST['name'] ?? $_GET['name'] ?? ''));
    if ($name === '') respond(false, [], 'Kein Dateiname angegeben', 400);

    $path = BG_FOLDER . $name;
    if (!file_exists($path)) respond(false, [], 'Datei nicht gefunden', 404);

    $info = [
        'name'     => $name,
        'path'     => WEB_PATH . $name,
        'size'     => (int) filesize($path),
        'modified' => (int) filemtime($path),
        'readable' => is_readable($path),
        'writable' => is_writable($path),
    ];

    $content = @file_get_contents($path);
    if ($content !== false) {
        if (preg_match('/\bwidth=["\']([^"\']+)["\']/',  $content, $m)) $info['width']  = $m[1];
        if (preg_match('/\bheight=["\']([^"\']+)["\']/', $content, $m)) $info['height'] = $m[1];
        if (preg_match('/\bviewBox=["\']([^"\']+)["\']/', $content, $m)) $info['viewBox'] = $m[1];
    }

    respond(true, ['pattern' => $info]);
}

// ============================================================================
// DEBUG – Aufruf mit ?action=debug
// ============================================================================
if ($action === 'debug') {
    $files = @glob(BG_FOLDER . '*.svg') ?: [];
    respond(true, [
        'bg_folder'      => BG_FOLDER,
        'web_path'       => WEB_PATH,
        'folder_exists'  => is_dir(BG_FOLDER),
        'is_readable'    => is_readable(BG_FOLDER),
        'is_writable'    => is_writable(BG_FOLDER),
        'svg_count'      => count($files),
        'svg_files'      => array_map('basename', $files),
        'document_root'  => $_SERVER['DOCUMENT_ROOT'] ?? '(nicht gesetzt)',
        'script_dir'     => __DIR__,
        'php_version'    => PHP_VERSION,
        'upload_max'     => ini_get('upload_max_filesize'),
        'post_max'       => ini_get('post_max_size'),
    ]);
}

// ============================================================================
// FALLBACK
// ============================================================================
respond(false, [], "Unbekannte Aktion: '$action'", 400);