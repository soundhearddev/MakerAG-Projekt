<?php

/**
 * API Endpoint: Background Patterns
 * Verwaltet SVG-Hintergrundmuster
 */

// Security Headers
header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

// CORS für lokale Entwicklung
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
}

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Konfiguration
define('BG_FOLDER', $_SERVER['DOCUMENT_ROOT'] . '/images/background/');
define('WEB_PATH', '/images/background/');
define('MAX_FILE_SIZE', 2 * 1024 * 1024); // 2MB
define('ALLOWED_EXTENSIONS', ['svg']);

// Logging-Funktion
function logError($message)
{
    $logFile = BG_FOLDER . 'error.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// JSON Response Helper
function jsonResponse($success, $data = [], $error = null, $code = 200)
{
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error,
        'timestamp' => time()
    ], JSON_PRETTY_PRINT);
    exit();
}

// Ordner erstellen falls nicht vorhanden
if (!is_dir(BG_FOLDER)) {
    if (!mkdir(BG_FOLDER, 0755, true)) {
        logError("Konnte Ordner nicht erstellen: " . BG_FOLDER);
        jsonResponse(false, [], "Ordner konnte nicht erstellt werden", 500);
    }
}

// .htaccess für Sicherheit erstellen
$htaccessPath = BG_FOLDER . '.htaccess';
if (!file_exists($htaccessPath)) {
    $htaccessContent = <<<EOT
# Sicherheit für Background-Ordner
<FilesMatch "\.(svg)$">
    Header set Content-Type "image/svg+xml"
    Header set X-Content-Type-Options "nosniff"
</FilesMatch>

# Nur SVG-Dateien erlauben
<Files *>
    Order Deny,Allow
    Deny from all
</Files>

<FilesMatch "\.(svg)$">
    Allow from all
</FilesMatch>

# Directory Listing verhindern
Options -Indexes
EOT;
    file_put_contents($htaccessPath, $htaccessContent);
}

/**
 * SVG Validierung und Sanitization
 */
function validateSVG($filePath)
{
    $content = file_get_contents($filePath);

    // Prüfe ob es wirklich ein SVG ist
    if (strpos($content, '<svg') === false) {
        return false;
    }

    // Gefährliche Tags und Attribute entfernen
    $dangerousPatterns = [
        '/<script\b[^>]*>.*?<\/script>/is',
        '/<iframe\b[^>]*>.*?<\/iframe>/is',
        '/<object\b[^>]*>.*?<\/object>/is',
        '/<embed\b[^>]*>/is',
        '/on\w+\s*=/i', // Event-Handler wie onclick, onload, etc.
        '/javascript:/i',
        '/data:text\/html/i',
    ];

    foreach ($dangerousPatterns as $pattern) {
        if (preg_match($pattern, $content)) {
            return false;
        }
    }

    return true;
}

/**
 * Sichere Dateinamen generieren
 */
function sanitizeFilename($filename)
{
    $filename = pathinfo($filename, PATHINFO_FILENAME);
    $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $filename);
    $filename = preg_replace('/_+/', '_', $filename);
    $filename = trim($filename, '_');

    if (empty($filename)) {
        $filename = 'pattern_' . uniqid();
    }

    return $filename . '.svg';
}

// ============================================================================
// ACTION: Liste alle SVG-Patterns
// ============================================================================
if (!isset($_POST['action']) || $_POST['action'] === 'list') {
    try {
        $svgs = glob(BG_FOLDER . '*.svg');
        $patterns = [];

        if ($svgs === false) {
            throw new Exception("Fehler beim Lesen des Ordners");
        }

        foreach ($svgs as $file) {
            $basename = basename($file);

            // Skip versteckte Dateien
            if ($basename[0] === '.') continue;

            $patterns[] = [
                'name' => $basename,
                'path' => WEB_PATH . $basename,
                'size' => filesize($file),
                'modified' => filemtime($file)
            ];
        }

        // Sortiere nach Name
        usort($patterns, function ($a, $b) {
            return strcmp($a['name'], $b['name']);
        });

        jsonResponse(true, [
            'patterns' => $patterns,
            'count' => count($patterns)
        ]);
    } catch (Exception $e) {
        logError("List Error: " . $e->getMessage());
        jsonResponse(false, [], $e->getMessage(), 500);
    }
}

// ============================================================================
// ACTION: Upload neues SVG-Pattern
// ============================================================================
if ($_POST['action'] === 'upload') {
    try {
        // Prüfe ob Datei vorhanden
        if (!isset($_FILES['svg']) || $_FILES['svg']['error'] !== UPLOAD_ERR_OK) {
            $errorMsg = isset($_FILES['svg']) ?
                "Upload-Fehler Code: " . $_FILES['svg']['error'] :
                "Keine Datei hochgeladen";
            throw new Exception($errorMsg);
        }

        $file = $_FILES['svg'];

        // Dateigröße prüfen
        if ($file['size'] > MAX_FILE_SIZE) {
            throw new Exception("Datei zu groß (max. 2MB)");
        }

        // Extension prüfen
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_EXTENSIONS)) {
            throw new Exception("Nur SVG-Dateien erlaubt");
        }

        // MIME-Type prüfen
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, ['image/svg+xml', 'text/xml', 'application/xml'])) {
            throw new Exception("Ungültiger Dateityp: " . $mimeType);
        }

        // SVG Content validieren
        if (!validateSVG($file['tmp_name'])) {
            throw new Exception("SVG enthält unsichere Inhalte");
        }

        // Sicheren Dateinamen generieren
        $safeName = sanitizeFilename($file['name']);
        $targetPath = BG_FOLDER . $safeName;

        // Prüfe ob Datei bereits existiert
        if (file_exists($targetPath)) {
            $safeName = pathinfo($safeName, PATHINFO_FILENAME) . '_' . time() . '.svg';
            $targetPath = BG_FOLDER . $safeName;
        }

        // Upload durchführen
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new Exception("Upload fehlgeschlagen");
        }

        // Dateiberechtigungen setzen
        chmod($targetPath, 0644);

        jsonResponse(true, [
            'pattern' => [
                'name' => $safeName,
                'path' => WEB_PATH . $safeName,
                'size' => filesize($targetPath)
            ],
            'message' => 'Pattern erfolgreich hochgeladen'
        ]);
    } catch (Exception $e) {
        logError("Upload Error: " . $e->getMessage());
        jsonResponse(false, [], $e->getMessage(), 400);
    }
}

// ============================================================================
// ACTION: Lösche SVG-Pattern
// ============================================================================
if ($_POST['action'] === 'delete') {
    try {
        if (!isset($_POST['name']) || empty($_POST['name'])) {
            throw new Exception("Kein Dateiname angegeben");
        }

        // Sicherheit: Nur Basename verwenden
        $name = basename($_POST['name']);
        $filePath = BG_FOLDER . $name;

        // Prüfe ob Datei existiert
        if (!file_exists($filePath)) {
            throw new Exception("Datei nicht gefunden");
        }

        // Prüfe ob es wirklich eine SVG ist
        if (pathinfo($filePath, PATHINFO_EXTENSION) !== 'svg') {
            throw new Exception("Nur SVG-Dateien können gelöscht werden");
        }

        // Lösche Datei
        if (!unlink($filePath)) {
            throw new Exception("Löschen fehlgeschlagen");
        }

        jsonResponse(true, [
            'message' => 'Pattern erfolgreich gelöscht',
            'deleted' => $name
        ]);
    } catch (Exception $e) {
        logError("Delete Error: " . $e->getMessage());
        jsonResponse(false, [], $e->getMessage(), 400);
    }
}

// ============================================================================
// ACTION: Pattern Info
// ============================================================================
if ($_POST['action'] === 'info' && isset($_POST['name'])) {
    try {
        $name = basename($_POST['name']);
        $filePath = BG_FOLDER . $name;

        if (!file_exists($filePath)) {
            throw new Exception("Datei nicht gefunden");
        }

        $info = [
            'name' => $name,
            'path' => WEB_PATH . $name,
            'size' => filesize($filePath),
            'modified' => filemtime($filePath),
            'created' => filectime($filePath),
            'readable' => is_readable($filePath),
            'writable' => is_writable($filePath)
        ];

        // Lese SVG Dimensionen
        $content = file_get_contents($filePath);
        if (preg_match('/width=["\']([^"\']+)["\']/', $content, $matches)) {
            $info['width'] = $matches[1];
        }
        if (preg_match('/height=["\']([^"\']+)["\']/', $content, $matches)) {
            $info['height'] = $matches[1];
        }

        jsonResponse(true, ['pattern' => $info]);
    } catch (Exception $e) {
        logError("Info Error: " . $e->getMessage());
        jsonResponse(false, [], $e->getMessage(), 400);
    }
}

// Ungültige Action
jsonResponse(false, [], 'Ungültige Aktion', 400);
