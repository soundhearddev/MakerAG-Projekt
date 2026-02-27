<?php

/**
 * init.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Gemeinsame Basis für alle API-Endpunkte.
 * Angepasst für die normalisierte Datenbankstruktur mit:
 *   items, categories, locations, specs, tags, item_tags, documents
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── 1. ERROR REPORTING ───────────────────────────────────────────────────────
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// ─── 2. HEADERS ───────────────────────────────────────────────────────────────
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

// ─── 3. CONFIG / DATENBANK ────────────────────────────────────────────────────
function sendSuccess(array $data = [], array $extra = [], int $code = 200): void
{
    http_response_code($code);
    echo json_encode(
        array_merge(['success' => true], $extra, ['data' => $data]),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit();
}

function sendError(string $message, int $code = 400, array $extra = []): void
{
    http_response_code($code);
    echo json_encode(
        array_merge(['success' => false, 'error' => $message], $extra),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit();
}




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

try {
    $db = Database::connect();
    $db->set_charset('utf8mb4');
} catch (Exception $e) {
    error_log('init.php: DB-Verbindung fehlgeschlagen – ' . $e->getMessage());
    sendError('Datenbankverbindung fehlgeschlagen', 500);
}

// ─── 4. HILFSFUNKTIONEN ───────────────────────────────────────────────────────



function getIntParam(string $key, int $default = 0): int
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null && is_numeric($val)) ? intval($val) : $default;
}

function getStringParam(string $key, string $default = ''): string
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null) ? trim((string)$val) : $default;
}

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

        foreach (scandir($dir) as $file) {
            if (in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['png', 'jpg', 'jpeg', 'gif', 'webp'])) {
                return "/docs/{$id}/images/{$file}";
            }
        }
    }

    return null;
}

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
 * Lädt Specs für ein Item aus der specs-Tabelle.
 * Gibt ein assoziatives Array zurück: ['RAM' => '2 GB', 'Anzahl' => '3']
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
 * Lädt Tags für ein Item aus item_tags + tags.
 * Gibt ein Array von Tag-Namen zurück: ['laptop', 'vintage']
 */
function fetchTags(int $itemId): array
{
    global $db;
    $stmt = $db->prepare(
        "SELECT t.name FROM tags t
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
 * Lädt Documents für ein Item.
 */
function fetchDocuments(int $itemId): array
{
    global $db;
    $stmt = $db->prepare(
        "SELECT id, type, filename, path, uploaded_at FROM documents WHERE item_id = ? ORDER BY uploaded_at ASC"
    );
    $stmt->bind_param('i', $itemId);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

/**
 * Reichert ein einzelnes Item-Array mit allen verknüpften Daten an:
 * - category_name (aus categories inkl. parent)
 * - location (aus locations: room, schrank, regal, position)
 * - specs (aus specs-Tabelle)
 * - tags (aus tags-Tabelle)
 * - documents (aus documents-Tabelle)
 * - thumbnail + docs_link (Dateisystem)
 */
function enrichItem(array $item): array
{
    global $db;

    $id = (int)($item['id'] ?? 0);

    // ── Kategorie ─────────────────────────────────────────────────────────────
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
            $item['category_name'] = $cat['category_name'];
            $item['parent_category'] = $cat['parent_name'];
        }
    } else {
        $item['category_name']  = null;
        $item['parent_category'] = null;
    }

    // ── Location ──────────────────────────────────────────────────────────────
    if (!empty($item['location_id'])) {
        $stmt = $db->prepare("SELECT room, schrank, regal, position FROM locations WHERE id = ?");
        $stmt->bind_param('i', $item['location_id']);
        $stmt->execute();
        $loc = $stmt->get_result()->fetch_assoc();
        if ($loc) {
            $item['location'] = $loc;
            // Komfort-Felder direkt am Item für einfachere Nutzung im Frontend
            $item['locker'] = $loc['schrank'];
            $item['shelf']  = $loc['regal'];
            $item['room']   = $loc['room'];
        }
    } else {
        $item['location'] = null;
        $item['locker']   = null;
        $item['shelf']    = null;
        $item['room']     = null;
    }

    // ── Specs, Tags, Documents ────────────────────────────────────────────────
    if ($id > 0) {
        $item['specs']     = fetchSpecs($id);
        $item['tags']      = fetchTags($id);
        $item['documents'] = fetchDocuments($id);
        // quantity aus Specs holen (war früher eigene Spalte)
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
 * Reichert ein Array von Items an (ruft enrichItem() für jedes auf).
 */
function enrichItems(array $items): array
{
    return array_map('enrichItem', $items);
}
