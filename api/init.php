<?php

/**
 * Gemeinsamer Bootstrap für alle API-Endpunkte.
 *
 * Stellt JSON-Antworten, Parameter-Helfer, Item-Anreicherung und die
 * Datenbankverbindung ($db) bereit.
 */

define('API_DEBUG', false);

// Erst Exceptions aktivieren, dann Fehlerausgabe unterdrücken: eine direkte
// Ausgabe würde das JSON zerstören.
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
error_reporting(E_ALL);
ini_set('display_errors', '0');

/** Spec-Schlüssel, unter denen die Gesamtanzahl eines Items abgelegt sein kann (klein geschrieben). */
const QUANTITY_SPEC_KEYS = ['anzahl', 'quantity', 'menge'];

// ─── Header & CORS ───────────────────────────────────────────────────────────

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Explizite Whitelist statt Origin-Reflection: zusammen mit Credentials würde
// sonst jede fremde Seite die API im Namen des Nutzers aufrufen können.
// TODO: Produktiv-Domain eintragen.
$allowedOrigins = [
    'http://localhost',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── Antworten ───────────────────────────────────────────────────────────────

function sendSuccess(array $data = [], array $extra = [], int $code = 200): void
{
    http_response_code($code);
    echo json_encode(
        array_merge(['success' => true], $extra, ['data' => $data]),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit();
}

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
 * Loggt eine Exception und antwortet mit einer generischen Fehlermeldung.
 * Interne Details gelangen nur bei API_DEBUG in die Antwort.
 */
function sendException(Throwable $e, string $message = 'Datenbankfehler', int $code = 500): void
{
    error_log(basename($_SERVER['SCRIPT_NAME'] ?? 'api') . ': ' . $e->getMessage());
    sendError($message, $code, [], $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')');
}

// Muss vor allem registriert werden, was fehlschlagen kann (Config, DB).
set_exception_handler(function (Throwable $e): void {
    error_log('Unbehandelte Exception: ' . $e->getMessage());
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    http_response_code(500);
    $payload = ['success' => false, 'error' => 'Interner Serverfehler'];
    if (API_DEBUG) {
        $payload['debug'] = $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')';
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
});

// ─── Request-Helfer ──────────────────────────────────────────────────────────

/** Bricht mit 405 ab, wenn die Request-Methode nicht erlaubt ist. */
function requireMethod(string ...$allowed): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        sendError('Methode nicht erlaubt', 405);
    }
}

/** Liest den JSON-Body und bricht mit 400 ab, wenn er kein Objekt ist. */
function readJsonBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        sendError('Ungültiger JSON-Body', 400);
    }
    return $body;
}

/**
 * Schützt schreibende bzw. sensible Endpunkte. Aktiv, sobald API_WRITE_TOKEN
 * in config.php gesetzt ist; der Client sendet ihn im Header X-Api-Token.
 * Ohne gesetztes Token bleibt das Verhalten unverändert (offen).
 */
function requireWriteAccess(): void
{
    if (!defined('API_WRITE_TOKEN') || API_WRITE_TOKEN === '') {
        return;
    }
    $given = (string) ($_SERVER['HTTP_X_API_TOKEN'] ?? '');
    if (!hash_equals((string) API_WRITE_TOKEN, $given)) {
        sendError('Nicht autorisiert', 401);
    }
}

/** Wendet das Rate-Limit an (benötigt APCu, sonst deaktiviert). */
function enforceRateLimit(): void
{
    require_once __DIR__ . '/RateLimiter.php';
    if (!(new \MakerAG\RateLimiter())->check()) {
        sendError('Zu viele Anfragen – bitte warte kurz', 429);
    }
}

function getIntParam(string $key, int $default = 0): int
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return is_numeric($val) ? (int) $val : $default;
}

function getStringParam(string $key, string $default = ''): string
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return is_scalar($val) ? trim((string) $val) : $default;
}

// ─── Dateisystem ─────────────────────────────────────────────────────────────

/** Mögliche Document-Roots, je nach Server-Setup. */
function docRoots(): array
{
    $roots = [rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/'), '/var/www/public'];
    return array_values(array_unique(array_filter($roots)));
}

/** Absoluter Pfad (mit abschließendem /) zu docs/items/{id}/{sub}/ oder null. */
function findItemDir(int $id, string $sub): ?string
{
    foreach (docRoots() as $root) {
        $dir = "{$root}/docs/items/{$id}/{$sub}/";
        if (is_dir($dir)) {
            return $dir;
        }
    }
    return null;
}

/** Web-Pfad des Thumbnails (thumb.*, sonst das erste Bild) oder null. */
function findThumbnail(int $id): ?string
{
    $dir = $id > 0 ? findItemDir($id, 'images') : null;
    if ($dir === null) {
        return null;
    }

    foreach (['thumb.png', 'thumb.jpg', 'thumb.jpeg', 'thumb.webp'] as $thumb) {
        if (is_file($dir . $thumb)) {
            return "/docs/items/{$id}/images/{$thumb}";
        }
    }

    $files = scandir($dir) ?: [];
    foreach ($files as $file) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
            return "/docs/items/{$id}/images/{$file}";
        }
    }

    return null;
}

/** Web-Pfad der Dokumentationsseite des Items oder null. */
function findDocsLink(int $id): ?string
{
    if ($id <= 0) {
        return null;
    }
    foreach (docRoots() as $root) {
        if (is_file("{$root}/docs/items/{$id}/index.html")) {
            return "/docs/items/{$id}/index.html";
        }
    }
    return null;
}

// ─── Item-Daten ──────────────────────────────────────────────────────────────

/**
 * Führt eine Abfrage mit "IN (...)" für mehrere IDs aus.
 * $sqlTemplate enthält genau ein %s für die Platzhalter.
 */
function queryByIds(string $sqlTemplate, array $ids): array
{
    global $db;

    if (!$ids) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare(sprintf($sqlTemplate, $placeholders));
    $stmt->bind_param(str_repeat('i', count($ids)), ...$ids);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

/** Gesamtanzahl aus den Specs (Schlüssel case-insensitiv) oder null. */
function quantityFromSpecs(array $specs): ?int
{
    foreach ($specs as $key => $value) {
        if (in_array(strtolower((string) $key), QUANTITY_SPEC_KEYS, true) && is_numeric($value)) {
            return (int) $value;
        }
    }
    return null;
}

/** Eindeutige, positive Integer-Werte einer Spalte. */
function uniqueIds(array $items, string $column): array
{
    $ids = array_map(static fn(array $item): int => (int) ($item[$column] ?? 0), $items);
    return array_values(array_unique(array_filter($ids, static fn(int $id): bool => $id > 0)));
}

/**
 * Ergänzt rohe items-Zeilen um Kategorie, Standort, Specs, Tags, Mengen
 * und Dateisystem-Infos (Thumbnail, Doku-Link).
 *
 * Die zugehörigen Daten werden pro Aufruf in je einer Abfrage geladen
 * (statt mehrerer Abfragen pro Item).
 */
function enrichItems(array $items): array
{
    if (!$items) {
        return [];
    }

    $categories = [];
    $rows = queryByIds(
        'SELECT c.id, c.name AS category_name, p.name AS parent_name
         FROM categories c
         LEFT JOIN categories p ON p.id = c.parent_id
         WHERE c.id IN (%s)',
        uniqueIds($items, 'category_id')
    );
    foreach ($rows as $row) {
        $categories[(int) $row['id']] = $row;
    }

    $locations = [];
    $rows = queryByIds(
        'SELECT l.id, r.name AS room, l.schrank, l.fach
         FROM locations l
         LEFT JOIN rooms r ON r.id = l.room_id
         WHERE l.id IN (%s)',
        uniqueIds($items, 'location_id')
    );
    foreach ($rows as $row) {
        $locations[(int) $row['id']] = $row;
    }

    $itemIds = uniqueIds($items, 'id');

    // Bei doppelten Keys gewinnt der spätere Eintrag (ORDER BY id).
    $specsByItem = [];
    $rows = queryByIds(
        'SELECT item_id, `key`, `value` FROM specs WHERE item_id IN (%s) ORDER BY id ASC',
        $itemIds
    );
    foreach ($rows as $row) {
        $specsByItem[(int) $row['item_id']][$row['key']] = $row['value'];
    }

    $tagsByItem = [];
    $rows = queryByIds(
        'SELECT it.item_id, t.name
         FROM tags t
         INNER JOIN item_tags it ON it.tag_id = t.id
         WHERE it.item_id IN (%s)
         ORDER BY t.name ASC',
        $itemIds
    );
    foreach ($rows as $row) {
        $tagsByItem[(int) $row['item_id']][] = $row['name'];
    }

    return array_map(static function (array $item) use ($categories, $locations, $specsByItem, $tagsByItem): array {
        $id = (int) ($item['id'] ?? 0);

        $cat = $categories[(int) ($item['category_id'] ?? 0)] ?? null;
        $item['category_name'] = $cat['category_name'] ?? null;
        $item['parent_category'] = $cat['parent_name'] ?? null;

        // location als Objekt und zusätzlich flach (locker/shelf/room) fürs Frontend.
        $loc = $locations[(int) ($item['location_id'] ?? 0)] ?? null;
        $item['location'] = $loc
            ? ['room' => $loc['room'], 'schrank' => $loc['schrank'], 'fach' => $loc['fach']]
            : null;
        $item['locker'] = $loc['schrank'] ?? null;
        $item['shelf'] = $loc['fach'] ?? null;
        $item['room'] = $loc['room'] ?? null;

        $item['specs'] = $specsByItem[$id] ?? [];
        $item['tags'] = $tagsByItem[$id] ?? [];
        // Dokumente liegen im Dateisystem (siehe get_data.php), nicht in der DB.
        $item['documents'] = [];

        $item['quantity'] = quantityFromSpecs($item['specs']);
        $item['quantity_available'] = isset($item['quantity_available'])
            ? (int) $item['quantity_available']
            : $item['quantity'];

        $item['thumbnail'] = findThumbnail($id);
        $item['docs_link'] = findDocsLink($id);
        $item['has_docs'] = $item['docs_link'] !== null;

        return $item;
    }, $items);
}

// ─── Config & Datenbank ──────────────────────────────────────────────────────

$configPaths = [
    '/var/www/secure/config.php',
    __DIR__ . '/../secure/config.php',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/secure/config.php',
];

$configLoaded = false;
foreach ($configPaths as $configPath) {
    if (is_file($configPath)) {
        require_once $configPath;
        $configLoaded = true;
        break;
    }
}
if (!$configLoaded) {
    sendError('Konfigurationsfehler: config.php nicht gefunden', 500);
}

try {
    $db = Database::connect();
    $db->set_charset('utf8mb4');
} catch (Throwable $e) {
    sendException($e, 'Datenbankverbindung fehlgeschlagen');
}
