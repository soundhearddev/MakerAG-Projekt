<?php

// =============================================================================
// ERROR HANDLING & SECURITY
// =============================================================================
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// Security Headers - bisschen unnötig für so eine API, aber egal



// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
/**
 * JSON-Antwort senden und Skript beenden
 */
function sendJsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    exit;
}

/**
 * ERROR Logging
 */
function logError(string $message, $context = null): void
{
    $logMessage = "[" . date('Y-m-d H:i:s') . "] " . $message;
    if ($context !== null) {
        $logMessage .= " | Context: " . json_encode($context);
    }
    error_log($logMessage);
}

/**
 * bisschen input reinigen und länge begrenzen, damit nicht versehentlich riesige Strings in die DB oder Logs kommen
 */

/*
    * $input: der input string welcher halt dann gereinigt wird
    * $maxLength: wird als int übergeben und gibt die maximale Länge des Strings an
    * das : string bei der Funktion gibt übrigens einfach nur an, dass die Funktion einen String zurückgeben wird, das hat nichts mit der Länge zu tun, sondern ist einfach eine Typdeklaration in PHP 7.0+ (gibt auch int, float, bool, array, etc.). das macht es dann einfach klarer wie die Funktion verwendet wird und hilft auch bei der Fehlersuche. Bisschen ahh, dass ich es nicht so oft genutzt habe.
*/
function cleanupInput($input, int $maxLength = 255): string
{

    /* 
    
        okay. Jetzt zur eigentlichen Funktion: es macht zuerst einfach mal ein grundcheck ob der input nicht leer ist und wenn das der Fall ist, wird einfach ein leerer String zurückgegeben. Das heißt einfach nur eine schnelle Abfrage, damit nicht unnötig das verarbeitet wird was eh schon leer ist.
    */

    if ($input === null || $input === '') {
        return '';
    }


    /* 
        Danach wird geprüft ob der Input ein String ist, wenn nicht wird er einfach in einen String umgewandelt. Das ist wichtig, weil manchmal könnte der Input z.B. eine Zahl oder ein Array sein, und das könnte zu Problemen führen. Recht simpel.
    */

    if (!is_string($input)) {
        $input = (string)$input;
    }

    // bisschen mehr cleaning - es trimmt den String (entfernt also Leerzeichen am Anfang und Ende) und entfernt HTML-Tags. WICHTIG: das ist noch lange nicht "Sicher" genug weil so alles andere wie SQL-Injection oder XSS-Angriffe immenoch funktionieren!
    $clean = strip_tags(trim($input));

    // ja einfach genau die gleiche sache wie eben nur halt mit null bytes. 
    $clean = str_replace("\0", '', $clean);

    // mb_substr schneidet den String auf die maximale Länge zu und sorgt dabei auch dafür, dass es keine Probleme mit Multibyte-Zeichen gibt (also z.B. Emojis oder andere Unicode-Zeichen). 
    return mb_substr($clean, 0, $maxLength, 'UTF-8');
}



/**
 * Hilfsfunktion: Erstellt alle möglichen Pfade für Docs-Dateien
 * 
 * Statt überall die gleichen $_SERVER['DOCUMENT_ROOT'] + /var/www/public Pfade zu schreiben, wird das hier zentral gemacht.
 */
function getPossibleDocsPaths($itemId, $subPath = '')
{
    $basePaths = [
        rtrim($_SERVER['DOCUMENT_ROOT'], '/'),
        '/var/www/public'
    ];

    $paths = [];
    foreach ($basePaths as $base) {
        $paths[] = $base . '/docs/' . $itemId . $subPath;
    }
    return $paths;
}

/**
 * Generiert docs_link basierend auf Item-ID
 * 
 * Das hier habe ich erst etwas später hinzugefügt, weil es zu umständlich war, in der datenbank IMMER UND IMMER WIEDER den pfad zu speichern und das dann auch noch zu aktualisieren, wenn sich die ID ändert. Das ist einfach viel einfacher, weil der Pfad ja immer gleich aufgebaut ist und sich nur die ID ändert. Also wird hier einfach geprüft, ob es eine Datei gibt unter /docs/{id}/index.html und wenn ja, wird der Link generiert. Wenn nicht, wird null zurückgegeben. Das ist auch sicherer, weil so nicht versehentlich falsche Links in der Datenbank landen können.
 */

// SEHR simpel: die Funktion nimmt die itemID als input und erstellt daraus den docs pfad und gibt diesen zurück. 
function generateDocsLink($itemId): ?string
{
    if (empty($itemId)) {
        return null;
    }

    // Prüfe ob /docs/{id}/index.html existiert
    // und jaja statische Pfade sind schlecht und anfällig für Fehler. ICH WEIß, aber sonst müsste ich so 20 weitere Zeilen schireben welche die Varablen des geradigen Pfades nutzt. somit ist es halt schlechter, falls das Projekt jemals auf einem anderen Gerät läuft (was ich denken mal nicht passieren wird) oder wenn sich die Ordnerstruktur ändert (was auch eher unwahrscheinlich ist), aber was sind die chancen???
    foreach (getPossibleDocsPaths($itemId, '/index.html') as $path) {
        if (file_exists($path)) {
            return "/docs/" . $itemId . "/";
        }
    }

    return null;
}

/**
 * Findet Thumbnail in /docs/{id}/images/
 * Das war eine weitere Funktion, welche ich erst später wirklich hinzugefügt habe, wegen den gleichen gründen. 
 * Jedenfalls: Die Funktion nimmt die Item-ID als Input und sucht dann in den möglichen Verzeichnissen nach einem Thumbnail. Es wird zuerst nach gängigen Thumbnail-Namen gesucht (so thump.png, thumb.jpg, etc.) und wenn kein Thumbnail gefunden wird, wird einfach Null zurückgegeben.
 */
function findThumbnail($itemId): ?string
{
    if (empty($itemId)) {
        return null;
    }

    // Security Check wie immer
    if (strpos($itemId, '..') !== false || strpos($itemId, "\0") !== false) {
        error_log("Directory traversal attempt: " . $itemId);
        return null;
    }


    $thumbnailNames = ['thumb.png', 'thumb.jpg', 'thumb.jpeg', 'thumb.webp', 'thumb.gif'];

    foreach (getPossibleDocsPaths($itemId, '/images/') as $imagesPath) {
        if (!is_dir($imagesPath)) {
            continue;
        }

        foreach ($thumbnailNames as $thumb) {
            $fullPath = $imagesPath . $thumb;
            if (file_exists($fullPath) && is_file($fullPath)) {
                // kompletter Pfad wird erstellt und zurückgegeben.
                return "/docs/" . $itemId . "/images/" . $thumb;
            }
        }
    }

    return null;
}



/**
 * Process items array - Generiert Pfade basierend auf ID.
 * 
 * Endlich mal was anderes!:
 * Diese Funktion nimmt als input einen Array von Items (also die Ergebnisse der Datenbank) und gibt einen array zurück.
 */
function processItems(array $items): array
{
    // foreach loop durch den array
    // das $items as &$item ist einfach das weil es ja jedes item einzelnd durch geht wird halt immer das derzeitige item aus items zu als Variable item genommen und mit & davor wird es als Referenz übergeben, damit die Änderungen auch im ursprünglichen Array gespeichert werden. Das wird einfach gemacht, damit es auch wirklich die docs_link und thumbnail in das ursprüngliche Array einfügt, welches dann als JSON an den Browser gesendet wird. Also nichts wird an die Datenbank zurückgesendet, deswegen kann man auch weitere Spalten hinzufügen, ohne dass es Probleme gibt.
    // das hat mir etwas sehr viel debugging gebraucht, aber jetzt wo ich es verstanden habe, macht es total Sinn...
    foreach ($items as &$item) {


        $itemId = $item['id'];

        // Generiere docs_link basierend auf ID
        // Jetzt werden unsere Funktionen genutzt. 
        $item['docs_link'] = generateDocsLink($itemId);
        // simpler check ob es überhaubt docs gibt
        // und außerdem "erstellt" es eine neue spalte in dem array welche dann in der API response mitgeschickt wird
        $item['has_docs'] = !empty($item['docs_link']);

        // Generiere thumbnail basierend auf ID 
        $item['thumbnail'] = findThumbnail($itemId);

        // einfach noch ein check
        if (isset($item['quantity'])) {
            $item['quantity'] = (int)$item['quantity'];
        }

        // noch mehr checks 
        $textFields = [
            'name',
            'category',
            'subcategory',
            'brand',
            'model',
            'serial',
            'locker',
            'notes'
        ];

        // hier wird geprüft ob die textfelder exestieren und wenn nicht, wird ein leerer String eingefügt
        foreach ($textFields as $field) {
            if (
                !isset($item[$field]) ||
                $item[$field] === null
            ) {
                $item[$field] = '';
            }
        }
    }

    return $items;
}

/**
 * Validate sort field - Verhindert SQL-Injection durch Sortierung 
 * Dieser ganze SQL-Injection Hacking Schutz Schrott ist wie gesagt... Schrott. Es ist einfach nicht möglich, dass hier eine SQL-Injection stattfindet, weil die Sortierfelder ja sowieso nur bestimmte Werte annehmen können (id, name, category, etc.) und wenn jemand versucht, da was anderes reinzuschreiben, wird einfach der Default-Wert "id" genommen. Es ist also quasi unmöglich, dass hier eine SQL-Injection stattfindet, weil die möglichen Werte so stark eingeschränkt sind... Reine Zeitverschwendung.
 */

function validateSortField(string $field): string
{

    $allowedFields = [
        'id',
        'name',
        'category',
        'subcategory',
        'brand',
        'model',
        'quantity',
        'locker'
    ];

    return in_array($field, $allowedFields, true) ? $field : 'id';
}

/**
 * Validate sort order - Verhindert SQL-Injection durch Sortierreihenfolge
 */
function validateSortOrder(string $order): string
{
    $order = strtoupper($order);
    return in_array($order, ['ASC', 'DESC'], true) ? $order : 'DESC';
}

/**
 * Validate limit - Stellt sicher, dass die Anzahl der Ergebnisse in einem normalen Bereich liegt. 
 * Dast ist glaube ist das einzig gute hier. das Rate Limiting was easy zu machen ist
 */
function validateLimit($limit): int
{
    $limit = (int)$limit;
    return min(max($limit, 1), 200);
}

// =============================================================================
// CONFIG LADEN
// =============================================================================
// Config für die Datenbankverbindung
$configPath = '/var/www/secure/config.php';


// All das sind einfach nur checks ob alles funktioniert:

// Check ob die Datei existiert
if (!file_exists($configPath)) {
    logError("Config file not found", ['path' => $configPath]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler: Datei nicht gefunden"
    ], 500);
}

// Check ob die Datei lesbar ist
if (!is_readable($configPath)) {
    logError("Config file not readable", ['path' => $configPath]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler: Keine Leserechte"
    ], 500);
}

// Check ob die Datei fehlerfrei ist
try {
    require_once $configPath;
} catch (Throwable $e) {
    logError("Config load error", ['error' => $e->getMessage()]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler"
    ], 500);
}

// Check ob Database-Klasse existiert
if (!class_exists('Database')) {
    logError("Database class not found in config");
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler: Database-Klasse fehlt"
    ], 500);
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

$query     = cleanupInput($_GET['query'] ?? '', 500);
$limit     = validateLimit($_GET['limit'] ?? 50);
$sortField = validateSortField(cleanupInput($_GET['sort'] ?? 'id', 50));
$sortOrder = validateSortOrder($_GET['order'] ?? 'DESC');

// =============================================================================
// DATABASE CONNECTION
// =============================================================================
$db = null;
$stmt = null;

try {
    $db = Database::connect(); // Falls intelephense hier sagt, dass es ein fehler ist: NEIN! IST ES NICHT

    if (!$db instanceof mysqli) {
        throw new Exception("Database connection returned invalid type");
    }

    // verifizierung der Verbindung
    if ($db->connect_error) {
        throw new Exception("Connection failed: " . $db->connect_error);
    }
} catch (Throwable $e) {
    logError("Database connection error", ['error' => $e->getMessage()]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Datenbankverbindung fehlgeschlagen"
    ], 500);
}

// =============================================================================
// EXECUTE QUERY
// =============================================================================
try {
    // Wenn kein Suchbegriff eingegeben wurde, wird eine einfache Abfrage ohne WHERE ausgeführt, um die neuesten Artikel zu holen. In diesem Fall werden die Feldnamen in der ORDER BY mit Backticks umschlossen.
    // also $query === " bedeutet einfach nur, dass kein Suchbegriff eingegeben wurde. Man könnte das auch, dass wenn es leer ist, nichts gequeryt wird. Das könnte an query anfragen sparen aber ich denke mal, das wird gehen. Aber wie gesagt. hier wird was ausgeführt wenn nichst eingegeben wurde 
    if ($query === '') {
        // Simple ahh query
        $sql = "SELECT * FROM items ORDER BY `{$sortField}` {$sortOrder} LIMIT ?";

        //  Und hier wird dann einfach nur die limit variable gebunden, weil es ja keine Suchparameter gibt. Einfacher gesagt: es wird einfach nur die neusten Items geholt, sortiert nach dem sortField und sortOrder (welche halt alle in search.html über search.js übergeben werden) und die Anzahl der Ergebnisse wird durch die limit variable bestimmt, welche auch über search.js übergeben wird. Also hier wird einfach nur eine einfache Abfrage ausgeführt, ohne dass nach einem Suchbegriff gefiltert wird.
        $stmt = $db->prepare($sql);

        // mehr error handling
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $db->error);
        }

        if (!$stmt->bind_param("i", $limit)) {
            throw new Exception("Bind param failed: " . $stmt->error);
        }
    } else {
        // Fallback - Dynamische WHERE-Klausel basierend auf vorhandenen Spalten. 
        $columnsResult = $db->query("SHOW COLUMNS FROM items");
        $existingColumns = [];
        while ($col = $columnsResult->fetch_assoc()) {
            $existingColumns[] = $col['Field'];
        }

        // die suchfelder werden hier definiert, damit man sie später einfach anpassen kann, ohne dass man die ganze Abfrage anpassen muss. Es wird dann einfach geprüft, ob diese Felder auch wirklich in der Datenbank existieren (weil vielleicht wurden mal Spalten gelöscht oder hinzugefügt) und wenn ja, werden sie in WHERE aufgenommen. 
        $searchFields = [
            'id',
            'name',
            'category',
            'subcategory',
            'brand',
            'model',
            'serial',
            'quantity',
            'locker',
            'notes'
        ];

        // Mehr leere Variablen für die dynamische Abfrage
        $whereClauses = [];
        $params = [];
        $types = '';

        foreach ($searchFields as $field) {
            if (in_array($field, $existingColumns)) {
                // Für die Felder "id" und "quantity" wird eine spezielle Behandlung vorgenommen, damit auch nach diesen Feldern gesucht werden kann, ohne dass es zu Problemen mit der Datenbank kommt. Das ist wegen halt dem Unterschied zwischen Int und String Feldern (auch eine Sache die ich recht spät realisiert habe, dass das das Problem war)

                // richtig Lustig: in der PHP extension in Vs-code wird hier angezeigt in_array(needle: $field, haystack: ['id', 'quantity']) 
                if (in_array($field, ['id', 'quantity'])) {
                    $whereClauses[] = "CAST(`{$field}` AS CHAR) LIKE CONCAT('%', ?, '%')";
                } else {
                    $whereClauses[] = "`{$field}` LIKE CONCAT('%', ?, '%')";
                }
                $params[] = $query;
                $types .= 's';
            }
        }

        // implode verbindet Array Elemente zu einem String also wird der array $whereClauses verbunden zu einem String mit der trennung "\n      OR" wobei \n ein Zeilenumbruch ist und OR halt ein SQL-Operator. super duper simple

        // auch hier wieder gibt Vscode PHP extension eine sehr gute übersicht, was was ist:
        //$whereClause = implode(separator:"\n                   OR ", array: $whereClauses);
        $whereClause = implode("\n                   OR ", $whereClauses);

        // noch ein simple ahh query 
        $sql = "SELECT * FROM items
                WHERE {$whereClause}
                ORDER BY `{$sortField}` {$sortOrder}
                LIMIT ?";

        // SO VIEL ERROR HANDLING
        $stmt = $db->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $db->error);
        }

        // Add limit parameter
        $params[] = $limit;
        $types .= 'i';

        // Bind parameters dynamically
        if (!$stmt->bind_param($types, ...$params)) {
            throw new Exception("Bind param failed: " . $stmt->error);
        }
    }

    // Execute query
    if (!$stmt->execute()) {
        throw new Exception("Execute failed: " . $stmt->error);
    }

    // Get results
    $result = $stmt->get_result();
    if (!$result) {
        throw new Exception("Get result failed: " . $stmt->error);
    }

    $items = $result->fetch_all(MYSQLI_ASSOC);

    // Process items - Generiert docs_link und thumbnail
    $items = processItems($items);
    $count = count($items);

    // Logging
    // NOTE TO FUTURE:  kann villeicht entfernt werden lowk key. Das lasse ich jetzt einfach nur für testen
    if ($query !== '') {
        logError("Search executed", [
            'query' => $query,
            'results' => $count,
            'sort' => "{$sortField} {$sortOrder}",
            'limit' => $limit
        ]);
    }

    // Antworten
    sendJsonResponse([
        "success" => true,
        "count"   => $count,
        "data"    => $items,
        "query"   => $query,
        "sort"    => [
            "field" => $sortField,
            "order" => $sortOrder
        ],
        "limit"   => $limit
    ]);
} catch (Throwable $e) {
    logError("Search query error", [
        'error' => $e->getMessage(),
        'query' => $query,
        'sort' => "{$sortField} {$sortOrder}",
        'sql' => isset($sql) ? $sql : 'N/A',
        'trace' => $e->getTraceAsString()
    ]);

    sendJsonResponse([
        "success" => false,
        "error"   => "Suchfehler",
        "message" => "Ein Fehler ist bei der Suche aufgetreten"
    ], 500);
} finally {
    // Cleanup
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }
    if (isset($db) && $db instanceof mysqli) {
        $db->close();
    }
}
