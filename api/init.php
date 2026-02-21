<?php
/**
 * init.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Gemeinsame Basis für alle API-Endpunkte.
 * Einfach am Anfang jeder PHP-Datei einbinden:
 *
 *   require_once __DIR__ . '/init.php';
 *
 * Was diese Datei übernimmt:
 *   • Error-Logging (nie im Browser, immer ins Log)
 *   • Sicherheits-Header
 *   • CORS-Header
 *   • JSON Content-Type
 *   • Datenbank-Verbindung (via Database::connect())
 *   • Hilfsfunktionen: sendSuccess(), sendError(), getIntParam(), getStringParam()
 *   • Thumbnail- und Docs-Pfad-Generierung
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── 1. ERROR REPORTING ───────────────────────────────────────────────────────
error_reporting(E_ALL);
ini_set('display_errors', 0);           // Fehler NIE im Browser anzeigen
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// ─── 2. HEADERS ───────────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// CORS – erlaubt alle Origins (für Intranet/Dev-Setup ausreichend)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS-Preflight sofort beantworten
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── 3. CONFIG / DATENBANK ────────────────────────────────────────────────────
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
    sendError('Konfigurationsfehler: config.php nicht gefunden', 500);
}

// Globale $db-Variable für alle Endpunkte
try {
    $db = Database::connect();
    $db->set_charset('utf8mb4');
} catch (Exception $e) {
    error_log('init.php: DB-Verbindung fehlgeschlagen – ' . $e->getMessage());
    sendError('Datenbankverbindung fehlgeschlagen', 500);
}

// ─── 4. HILFSFUNKTIONEN ───────────────────────────────────────────────────────

/**
 * Sendet eine erfolgreiche JSON-Antwort und beendet das Skript.
 *
 * @param array $data    Payload (wird unter "data" ausgegeben)
 * @param array $extra   Optionale Top-Level-Felder (z. B. count, total, …)
 * @param int   $code    HTTP-Status (Standard: 200)
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
 * Sendet eine Fehler-JSON-Antwort und beendet das Skript.
 *
 * @param string $message  Fehlermeldung
 * @param int    $code     HTTP-Status (Standard: 400)
 * @param array  $extra    Optionale zusätzliche Felder
 */
function sendError(string $message, int $code = 400, array $extra = []): void
{
    http_response_code($code);
    echo json_encode(
        array_merge(['success' => false, 'error' => $message], $extra),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit();
}

/**
 * Liest einen GET/POST-Parameter als Integer.
 * Gibt $default zurück, wenn der Parameter fehlt oder ungültig ist.
 */
function getIntParam(string $key, int $default = 0): int
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null && is_numeric($val)) ? intval($val) : $default;
}

/**
 * Liest einen GET/POST-Parameter als bereinigten String.
 */
function getStringParam(string $key, string $default = ''): string
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null) ? trim((string)$val) : $default;
}

/**
 * Gibt den Web-Pfad zum Thumbnail einer Item-ID zurück.
 * Priorität: thumb.png → thumb.jpg → thumb.jpeg → thumb.webp → erstes Bild
 *
 * @param  int|string $id  Item-ID
 * @return string|null     Web-Pfad oder null
 */
function findThumbnail($id): ?string
{
    if (empty($id)) return null;

    $basePaths = [
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . "/docs/{$id}/images/",
        '/var/www/public/docs/' . $id . '/images/',
    ];

    foreach ($basePaths as $dir) {
        if (!is_dir($dir)) continue;

        foreach (['thumb.png', 'thumb.jpg', 'thumb.jpeg', 'thumb.webp'] as $thumb) {
            if (file_exists($dir . $thumb)) {
                return "/docs/{$id}/images/{$thumb}";
            }
        }

        // Fallback: erstes beliebiges Bild
        foreach (scandir($dir) as $file) {
            if (in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['png', 'jpg', 'jpeg', 'gif', 'webp'])) {
                return "/docs/{$id}/images/{$file}";
            }
        }
    }

    return null;
}

/**
 * Prüft ob eine Docs-Seite für eine Item-ID existiert und gibt den Link zurück.
 *
 * @param  int|string $id  Item-ID
 * @return string|null     Web-Pfad oder null
 */
function findDocsLink($id): ?string
{
    if (empty($id)) return null;

    $paths = [
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . "/docs/{$id}/index.html",
        '/var/www/public/docs/' . $id . '/index.html',
    ];

    foreach ($paths as $path) {
        if (file_exists($path)) return "/docs/{$id}/index.html";
    }

    return null;
}

/**
 * Reichert ein einzelnes Item-Array mit thumbnail und docs_link an.
 */
function enrichItem(array $item): array
{
    $item['thumbnail'] = findThumbnail($item['id'] ?? null);
    $item['docs_link']  = findDocsLink($item['id'] ?? null);
    $item['has_docs']   = !empty($item['docs_link']);
    return $item;
}

/**
 * Reichert ein Array von Items an (ruft enrichItem() für jedes auf).
 */
function enrichItems(array $items): array
{
    return array_map('enrichItem', $items);
}