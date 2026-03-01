<?php
/**
 * init.php – Gemeinsame Basis für alle API-Endpunkte.
 * Wird in jeder anderen PHP-Datei ganz oben mit require_once eingebunden.
 * Tabellen: items, categories, locations, specs, tags, item_tags, documents
 */

// ─── 0. DEBUG-FLAG ────────────────────────────────────────────────────────────
// define() legt eine Konstante fest – kein $ davor, kann später nicht überschrieben werden.
// true = Fehlermeldungen werden in der JSON-Antwort mitgeschickt (nur für Entwicklung!)
// NIEMALS auf einem Produktions-Server auf true lassen!
define('API_DEBUG', true);

// ─── 1. MYSQLI EXCEPTIONS AKTIVIEREN ─────────────────────────────────────────
// Standardmäßig gibt mysqli bei Fehlern nur false zurück – das merkt man oft nicht.
// MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT = Fehler werden als Exceptions geworfen,
// also fängt das try/catch sie auf und nichts fällt still durch.
// MUSS vor jeder DB-Nutzung stehen, sonst knallt prepare() unkontrolliert.
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ─── 2. ERROR REPORTING ───────────────────────────────────────────────────────
// E_ALL = alle PHP-Fehler melden (auch Notices, Warnings usw.)
error_reporting(E_ALL);
// display_errors = 0: Fehler werden NIE direkt ausgegeben (würde das JSON kaputt machen!)
ini_set('display_errors', 0);
// log_errors = 1: Fehler stattdessen in die Logdatei schreiben
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// ─── 3. HEADERS ───────────────────────────────────────────────────────────────
// Dem Browser sagen dass die Antwort JSON ist, auf UTF-8 kodiert
header('Content-Type: application/json; charset=UTF-8');
// Verhindert dass der Browser den Content-Type "errät" (Security-Maßnahme)
header('X-Content-Type-Options: nosniff');
// Verhindert dass die Seite in einem <iframe> eingebettet werden kann (Clickjacking-Schutz)
header('X-Frame-Options: DENY');

// CORS: Andere Domains/Ports dürfen die API aufrufen (wichtig für lokale Frontend-Entwicklung)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    // Erlaubt Anfragen von der Domain, von der der Request kommt
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    // Erlaubt Cookies/Auth-Header mitzuschicken
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS-Request = Browser fragt zuerst "darf ich?" (Preflight) bevor er den echten Request schickt
// Einfach 200 OK antworten und sofort aufhören
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── 4. HILFSFUNKTIONEN ──────────────────────────────────────────────────────

/**
 * Erfolgsantwort als JSON senden und Skript beenden.
 *
 * array_merge() klebt die Arrays zusammen:
 *   ['success' => true] + $extra + ['data' => $data]
 * Das ergibt z.B.: { "success": true, "count": 5, "data": [...] }
 *
 * JSON_UNESCAPED_UNICODE = Umlaute bleiben als ä/ö/ü statt \u00e4
 * JSON_UNESCAPED_SLASHES = / bleibt als / statt \/
 * exit() danach = kein weiterer Code läuft mehr
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
 * Fehlerantwort als JSON senden und Skript beenden.
 * ?string = der Parameter darf null sein (PHP 8 Nullable Type)
 */
function sendError(string $message, int $code = 400, array $extra = [], ?string $debugInfo = null): void
{
    http_response_code($code);
    $payload = array_merge(['success' => false, 'error' => $message], $extra);
    // Debug-Info nur mitsenden wenn API_DEBUG aktiv ist
    if (API_DEBUG && $debugInfo !== null) {
        $payload['debug'] = $debugInfo;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Integer aus GET oder POST lesen.
 * ?? = Null-Coalescing: nimmt den ersten Wert der nicht null ist
 * is_numeric() prüft ob es eine Zahl ist (auch "42" als String gilt)
 * (int) castet den Wert zu einem Integer
 */
function getIntParam(string $key, int $default = 0): int
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null && is_numeric($val)) ? (int)$val : $default;
}

/**
 * String aus GET oder POST lesen.
 * trim() entfernt Leerzeichen am Anfang und Ende
 */
function getStringParam(string $key, string $default = ''): string
{
    $val = $_GET[$key] ?? $_POST[$key] ?? null;
    return ($val !== null) ? trim((string)$val) : $default;
}

/**
 * Thumbnail-Bild für ein Item im Dateisystem suchen.
 * Gibt den Web-Pfad zurück (z.B. "/docs/42/images/thumb.png") oder null wenn nichts gefunden.
 */
function findThumbnail(int $id): ?string
{
    if ($id <= 0) return null;

    // Zwei mögliche Basispfade – je nachdem wie der Server konfiguriert ist
    $dirs = [
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . "/docs/{$id}/images/",
        "/var/www/public/docs/{$id}/images/",
    ];

    foreach ($dirs as $dir) {
        if (!is_dir($dir)) continue;

        // Zuerst explizit benannte Thumbnails suchen
        foreach (['thumb.png', 'thumb.jpg', 'thumb.jpeg', 'thumb.webp'] as $thumb) {
            if (file_exists($dir . $thumb)) {
                return "/docs/{$id}/images/{$thumb}";
            }
        }

        // Kein Thumbnail vorhanden → einfach das erste Bild nehmen
        // @ vor scandir = Fehlermeldungen unterdrücken wenn Ordner nicht lesbar
        $files = @scandir($dir);
        if ($files === false) continue;
        foreach ($files as $file) {
            // pathinfo() zerlegt den Dateinamen → PATHINFO_EXTENSION gibt nur die Endung
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
                return "/docs/{$id}/images/{$file}";
            }
        }
    }

    return null; // kein Bild gefunden
}

/**
 * Prüft ob eine index.html-Dokumentationsseite für das Item existiert.
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
 * Alle Specs (technische Daten) für ein Item aus der DB laden.
 *
 * Die specs-Tabelle hat Spalten: item_id, key, value
 * z.B. item_id=42, key="RAM", value="16 GB"
 *
 * array_column() wäre hier nicht möglich weil wir key→value brauchen,
 * deshalb manuelles foreach das ein assoziatives Array aufbaut: ['RAM' => '16 GB', ...]
 */
function fetchSpecs(int $itemId): array
{
    global $db; // $db ist in init.php definiert, global macht es hier verfügbar
    $stmt = $db->prepare("SELECT `key`, `value` FROM specs WHERE item_id = ? ORDER BY id ASC");
    // bind_param: 'i' = integer, dann die Variable
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
 * Alle Tags für ein Item laden.
 *
 * item_tags ist eine Zwischentabelle (n:m-Beziehung):
 *   items ←→ item_tags ←→ tags
 * INNER JOIN = nur Datensätze die in BEIDEN Tabellen einen Match haben
 * array_column() extrahiert nur die 'name'-Spalte aus dem Ergebnis-Array
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
    return array_column($rows, 'name'); // ['laptop', 'vintage', ...]
}

/**
 * Dokumente werden über das Dateisystem geladen (get_data.php),
 * nicht aus einer DB-Tabelle – leeres Array als Platzhalter.
 */
function fetchDocuments(int $itemId): array
{
    return [];
}

/**
 * Ein einzelnes Item-Array mit allen verknüpften Daten anreichern.
 *
 * "Anreichern" bedeutet: das Item kommt mit rohen DB-Spalten rein
 * (z.B. nur category_id=8) und geht mit allem raus was die UI braucht
 * (category_name, parent_category, location, specs, tags, thumbnail usw.)
 */
function enrichItem(array $item): array
{
    global $db;

    $id = (int)($item['id'] ?? 0);

    // ── Kategorie ─────────────────────────────────────────────────────────────
    // LEFT JOIN auf sich selbst (Self-Join): categories hat eine parent_id
    // die auf eine andere Zeile in derselben Tabelle zeigt
    // c = child (die eigentliche Kategorie), p = parent (Oberkategorie)
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
        $cat = $stmt->get_result()->fetch_assoc(); // fetch_assoc = eine Zeile als Array
        if ($cat) {
            $item['category_name']   = $cat['category_name'];
            $item['parent_category'] = $cat['parent_name'];
        }
    }

    // ── Location ──────────────────────────────────────────────────────────────
    // Lagerort-Infos aus der locations-Tabelle laden (Raum, Schrank, Regal, Position)
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
            // Das ganze Objekt UND einzelne Felder direkt speichern (für einfacheren Zugriff im Frontend)
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
        // Anzahl als eigenes Feld rausziehen (liegt als Spec drin)
        // ?? null = wenn 'Anzahl' kein Key in specs ist, null zurückgeben
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
    // !empty() = true wenn docs_link nicht null/leer ist (= Docs vorhanden)
    $item['has_docs']  = !empty($item['docs_link']);

    return $item;
}

/**
 * array_map() wendet enrichItem auf jedes Element des Arrays an.
 * 'enrichItem' als String = Funktionsname wird als Callback übergeben
 */
function enrichItems(array $items): array
{
    return array_map('enrichItem', $items);
}

// ─── 5. CONFIG / DATENBANK ────────────────────────────────────────────────────
// Verschiedene Pfade probieren weil der Server unterschiedlich aufgesetzt sein kann
$_configPaths = [
    '/var/www/secure/config.php',
    __DIR__ . '/../secure/config.php',               // __DIR__ = Ordner dieser Datei
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/secure/config.php',
];

$_configLoaded = false;
foreach ($_configPaths as $_path) {
    if (file_exists($_path)) {
        require_once $_path; // require_once = einbinden, aber nur einmal (kein doppeltes Laden)
        $_configLoaded = true;
        break; // Ersten gefundenen Pfad nehmen, Rest überspringen
    }
}

if (!$_configLoaded) {
    error_log('init.php: config.php nicht gefunden. Gesuchte Pfade: ' . implode(', ', $_configPaths));
    sendError('Konfigurationsfehler: config.php nicht gefunden', 500);
}

// DB-Verbindung aufbauen (Database-Klasse kommt aus config.php)
try {
    $db = Database::connect();
    $db->set_charset('utf8mb4'); // utf8mb4 = echtes UTF-8 inkl. Emojis (utf8 in MySQL ist kaputt)
} catch (Exception $e) {
    error_log('init.php: DB-Verbindung fehlgeschlagen – ' . $e->getMessage());
    sendError(
        'Datenbankverbindung fehlgeschlagen',
        500,
        [],
        API_DEBUG ? $e->getMessage() : null // Debug-Info nur wenn API_DEBUG = true
    );
}

// ─── 6. GLOBALER EXCEPTION-HANDLER ───────────────────────────────────────────
// Wenn irgendwo eine Exception nicht gefangen wird, läuft dieser Code.
// Verhindert weißen 500er (leere Seite) – gibt stattdessen sauberes JSON zurück.
// Throwable = Basisklasse von Exception UND Error (z.B. TypeError, ParseError)
set_exception_handler(function (Throwable $e) {
    $msg = $e->getMessage();
    error_log('init.php: Unbehandelte Exception – ' . $msg . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) { // Nur setzen wenn noch keine Headers rausgegangen sind
        header('Content-Type: application/json; charset=UTF-8');
    }
    http_response_code(500);
    // array_filter() entfernt null-Werte aus dem Array (debug ist null wenn API_DEBUG=false)
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