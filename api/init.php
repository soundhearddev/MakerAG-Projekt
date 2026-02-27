<?php
/**
 * init.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Gemeinsame Basis für alle API-Endpunkte.
 * Tabellen: items, categories, locations, specs, tags, item_tags, documents
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── 0. DEBUG-FLAG ────────────────────────────────────────────────────────────
// Auf true setzen um detaillierte Fehlermeldungen in der JSON-Antwort zu sehen.
// NIEMALS auf einem Produktions-Server auf true lassen!
define('API_DEBUG', false);

// ─── 1. MYSQLI EXCEPTIONS AKTIVIEREN ─────────────────────────────────────────
// MUSS vor jeder DB-Nutzung stehen – sonst gibt prepare() stillschweigend
// false zurück und der nachfolgende bind_param()-Aufruf knallt unkontrolliert.
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ─── 2. ERROR REPORTING ───────────────────────────────────────────────────────
error_reporting(E_ALL);
ini_set('display_errors', 0);   // Nie direkt ausgeben (würde JSON zerstören)
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// ─── 3. HEADERS ───────────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── 4. HILFSFUNKTIONEN (VOR dem ersten Aufruf definieren!) ──────────────────

/**
 * Erfolgsantwort senden und beenden.
 */
function sendSuccess(array $data = [], array $extra = [], int $code = 200): void
{
    http_response_code($code);
    echo json_encode(
        array_merge(['success' => true], $extra, ['data' => $data]),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit();
}

/**
 * Fehlerantwort senden und beenden.
 * Bei API_DEBUG=true wird zusätzlich $debugInfo mitgeschickt.
 */
function sendError(string $message, int $code = 400, array $extra = [], ?string $debugInfo = null): void
{
    http_response_code($code);
    $payload = array_merge(['success' => false, 'error' => $message], $extra);
    if (API_DEBUG && $debugInfo !== null) {
        $payload['debug'] = $debugInfo;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Integer-Parameter aus GET oder POST lesen.
 */
function getIntParam(string $key, int $default = 0): int
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null && is_numeric($val)) ? (int)$val : $default;
}

/**
 * String-Parameter aus GET oder POST lesen.
 */
function getStringParam(string $key, string $default = ''): string
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null) ? trim((string)$val) : $default;
}

/**
 * Thumbnail für ein Item suchen (Dateisystem).
 */
function findThumbnail(int $id): ?string
{
    if ($id <= 0) return null;

    $dirs = [
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . "/docs/{$id}/images/",
        "/var/www/public/docs/{$id}/images/",
    ];

    foreach ($dirs as $dir) {
        if (!is_dir($dir)) continue;

        // Zuerst explizite thumb-Dateien suchen
        foreach (['thumb.png', 'thumb.jpg', 'thumb.jpeg', 'thumb.webp'] as $thumb) {
            if (file_exists($dir . $thumb)) {
                return "/docs/{$id}/images/{$thumb}";
            }
        }

        // Dann erstes Bild in dem Ordner nehmen
        $files = @scandir($dir);
        if ($files === false) continue;
        foreach ($files as $file) {
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
                return "/docs/{$id}/images/{$file}";
            }
        }
    }

    return null;
}

/**
 * Docs-Link für ein Item suchen (index.html im Dateisystem).
 */
function findDocsLink(int $id): ?string
{
    if ($id <= 0) return null;

    $paths = [
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . "/docs/{$id}/index.html",
        "/var/www/public/docs/{$id}/index.html",
    ];

    foreach ($paths as $path) {
        if (file_exists($path)) return "/docs/{$id}/index.html";
    }

    return null;
}

/**
 * Specs für ein Item aus der specs-Tabelle laden.
 * Gibt ['RAM' => '2 GB', 'Anzahl' => '3'] zurück.
 */
function fetchSpecs(int $itemId): array
{
    global $db;
    $stmt = $db->prepare("SELECT `key`, `value` FROM specs WHERE item_id = ? ORDER BY id ASC");
    $stmt->bind_param('i', $itemId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $specs = [];
    foreach ($rows as $row) {
        $specs[$row['key']] = $row['value'];
    }
    return $specs;
}

/**
 * Tags für ein Item aus item_tags + tags laden.
 * Gibt ['laptop', 'vintage'] zurück.
 */
function fetchTags(int $itemId): array
{
    global $db;
    $stmt = $db->prepare(
        "SELECT t.name
         FROM tags t
         INNER JOIN item_tags it ON it.tag_id = t.id
         WHERE it.item_id = ?
         ORDER BY t.name ASC"
    );
    $stmt->bind_param('i', $itemId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    return array_column($rows, 'name');
}

/**
 * Dokumente für ein Item laden.
 */
function fetchDocuments(int $itemId): array
{
    global $db;
    $stmt = $db->prepare(
        "SELECT id, type, filename, path, uploaded_at
         FROM documents
         WHERE item_id = ?
         ORDER BY uploaded_at ASC"
    );
    $stmt->bind_param('i', $itemId);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

/**
 * Ein einzelnes Item mit allen verknüpften Daten anreichern:
 *   category_name, parent_category, location, specs, tags, documents,
 *   thumbnail, docs_link, has_docs, quantity
 */
function enrichItem(array $item): array
{
    global $db;

    $id = (int)($item['id'] ?? 0);

    // ── Kategorie ─────────────────────────────────────────────────────────────
    $item['category_name']   = null;
    $item['parent_category'] = null;

    if (!empty($item['category_id'])) {
        $stmt = $db->prepare(
            "SELECT c.name AS category_name, p.name AS parent_name
             FROM categories c
             LEFT JOIN categories p ON p.id = c.parent_id
             WHERE c.id = ?"
        );
        $stmt->bind_param('i', $item['category_id']);
        $stmt->execute();
        $cat = $stmt->get_result()->fetch_assoc();
        if ($cat) {
            $item['category_name']   = $cat['category_name'];
            $item['parent_category'] = $cat['parent_name'];
        }
    }

    // ── Location ──────────────────────────────────────────────────────────────
    $item['location'] = null;
    $item['locker']   = null;
    $item['shelf']    = null;
    $item['room']     = null;

    if (!empty($item['location_id'])) {
        $stmt = $db->prepare(
            "SELECT room, schrank, regal, position FROM locations WHERE id = ?"
        );
        $stmt->bind_param('i', $item['location_id']);
        $stmt->execute();
        $loc = $stmt->get_result()->fetch_assoc();
        if ($loc) {
            $item['location'] = $loc;
            $item['locker']   = $loc['schrank'];
            $item['shelf']    = $loc['regal'];
            $item['room']     = $loc['room'];
        }
    }

    // ── Specs / Tags / Documents ──────────────────────────────────────────────
    if ($id > 0) {
        $item['specs']     = fetchSpecs($id);
        $item['tags']      = fetchTags($id);
        $item['documents'] = fetchDocuments($id);
        $item['quantity']  = $item['specs']['Anzahl'] ?? null;
    } else {
        $item['specs']     = [];
        $item['tags']      = [];
        $item['documents'] = [];
        $item['quantity']  = null;
    }

    // ── Dateisystem ───────────────────────────────────────────────────────────
    $item['thumbnail'] = findThumbnail($id);
    $item['docs_link'] = findDocsLink($id);
    $item['has_docs']  = !empty($item['docs_link']);

    return $item;
}

/**
 * Mehrere Items anreichern.
 */
function enrichItems(array $items): array
{
    return array_map('enrichItem', $items);
}

// ─── 5. CONFIG / DATENBANK ────────────────────────────────────────────────────
// Suchpfade für config.php
$_configPaths = [
    '/var/www/secure/config.php',
    __DIR__ . '/../secure/config.php',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/secure/config.php',
];

$_configLoaded = false;
foreach ($_configPaths as $_path) {
    if (file_exists($_path)) {
        require_once $_path;
        $_configLoaded = true;
        break;
    }
}

if (!$_configLoaded) {
    error_log('init.php: config.php nicht gefunden. Gesuchte Pfade: ' . implode(', ', $_configPaths));
    sendError('Konfigurationsfehler: config.php nicht gefunden', 500);
}

// DB-Verbindung aufbauen
try {
    $db = Database::connect();
    $db->set_charset('utf8mb4');
} catch (Exception $e) {
    error_log('init.php: DB-Verbindung fehlgeschlagen – ' . $e->getMessage());
    sendError(
        'Datenbankverbindung fehlgeschlagen',
        500,
        [],
        API_DEBUG ? $e->getMessage() : null
    );
}

// ─── 6. GLOBALER EXCEPTION-HANDLER ───────────────────────────────────────────
// Fängt alle nicht behandelten Exceptions und gibt sauberes JSON zurück,
// statt einen weißen 500er zu liefern.
set_exception_handler(function (Throwable $e) {
    $msg = $e->getMessage();
    error_log('init.php: Unbehandelte Exception – ' . $msg . ' in ' . $e->getFile() . ':' . $e->getLine());
    // Wenn noch kein Output gesendet wurde, sauber antworten
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    http_response_code(500);
    echo json_encode(
        array_filter([
            'success' => false,
            'error'   => 'Interner Serverfehler',
            'debug'   => API_DEBUG ? $msg . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')' : null,
        ]),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit();
});