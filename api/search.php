<?php

// =============================================================================
// ERROR HANDLING & SECURITY
// =============================================================================
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// Security Headers
header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Rate Limiting Headers (placeholder - implement actual rate limiting)
header("X-RateLimit-Limit: 100");
header("X-RateLimit-Remaining: 99");

// CORS Headers (adjust for your domain)
// header("Access-Control-Allow-Origin: https://yourdomain.com");
// header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type");

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Send JSON response and exit
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
 * Log error message
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
 * Sanitize input string
 */
function sanitizeInput($input, int $maxLength = 255): string
{
    if ($input === null || $input === '') {
        return '';
    }

    if (!is_string($input)) {
        $input = (string)$input;
    }

    // Remove HTML tags and trim
    $clean = strip_tags(trim($input));
    
    // Remove null bytes
    $clean = str_replace("\0", '', $clean);
    
    // Limit length
    return mb_substr($clean, 0, $maxLength, 'UTF-8');
}

/**
 * Validate and format docs link
 */
function formatDocsLink(?string $docsLink): ?string
{
    if (empty($docsLink)) {
        return null;
    }

    $docsLink = trim($docsLink, "/ \t\n\r\0\x0B");

    // If already contains path or extension, return as-is
    if (str_contains($docsLink, '/') || str_contains($docsLink, '.html')) {
        return $docsLink;
    }

    // Otherwise, format as standard docs path
    return "/docs/{$docsLink}/index.html";
}

/**
 * Find thumbnail image in docs folder
 */
function findThumbnailInDocs(?string $docsLink): ?string
{
    if (empty($docsLink)) {
        return null;
    }

    $folder = trim($docsLink, "/ \t\n\r\0\x0B");
    $imagesPath = "/var/www/public/docs/{$folder}/images/";

    // Security check: prevent directory traversal
    if (str_contains($folder, '..') || str_contains($folder, "\0")) {
        logError("Directory traversal attempt detected", ['folder' => $folder]);
        return null;
    }

    if (!is_dir($imagesPath)) {
        return null;
    }

    // Try common thumbnail filenames first
    $thumbnailNames = ['thumb.png', 'thumb.jpg', 'thumb.jpeg', 'thumb.webp', 'thumb.gif'];
    foreach ($thumbnailNames as $thumb) {
        $fullPath = $imagesPath . $thumb;
        if (file_exists($fullPath) && is_file($fullPath)) {
            return "/docs/{$folder}/images/{$thumb}";
        }
    }

    // Fallback: find first image in directory
    $allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    
    try {
        $files = @scandir($imagesPath);
        if ($files === false) {
            return null;
        }

        foreach ($files as $file) {
            // Skip hidden files and directories
            if ($file[0] === '.') {
                continue;
            }

            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (in_array($ext, $allowedExtensions, true)) {
                $fullPath = $imagesPath . $file;
                if (is_file($fullPath)) {
                    return "/docs/{$folder}/images/{$file}";
                }
            }
        }
    } catch (Throwable $e) {
        logError("Error scanning directory for thumbnails", ['error' => $e->getMessage()]);
    }

    return null;
}

/**
 * Process items array - format links and ensure all fields exist
 */
function processItems(array $items): array
{
    foreach ($items as &$item) {
        // Format docs link and find thumbnail
        if (!empty($item['docs_link'])) {
            $orig = $item['docs_link'];
            $item['docs_link'] = formatDocsLink($orig);
            $item['thumbnail'] ??= findThumbnailInDocs($orig);
        }

        // Ensure thumbnail has leading slash
        if (!empty($item['thumbnail']) && $item['thumbnail'][0] !== '/') {
            $item['thumbnail'] = '/' . $item['thumbnail'];
        }

        // Ensure quantity is integer
        if (isset($item['quantity'])) {
            $item['quantity'] = (int)$item['quantity'];
        }

        // Ensure all text fields exist (even if empty)
        $textFields = ['name', 'category', 'subcategory', 'brand', 'model', 
                       'serial', 'locker', 'notes'];
        foreach ($textFields as $field) {
            if (!isset($item[$field]) || $item[$field] === null) {
                $item[$field] = '';
            }
        }
    }

    return $items;
}

/**
 * Validate sort field
 */
function validateSortField(string $field): string
{
    $allowedFields = [
        'id', 'name', 'category', 'subcategory', 
        'brand', 'model', 'quantity', 'locker'
    ];
    
    return in_array($field, $allowedFields, true) ? $field : 'id';
}

/**
 * Validate sort order
 */
function validateSortOrder(string $order): string
{
    $order = strtoupper($order);
    return in_array($order, ['ASC', 'DESC'], true) ? $order : 'DESC';
}

/**
 * Validate limit
 */
function validateLimit($limit): int
{
    $limit = (int)$limit;
    return min(max($limit, 1), 200);
}

// =============================================================================
// CONFIG LADEN (ABSOLUT & FINAL)
// =============================================================================
$configPath = '/var/www/secure/config.php';

if (!file_exists($configPath)) {
    logError("Config file not found", ['path' => $configPath]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler: Datei nicht gefunden"
    ], 500);
}

if (!is_readable($configPath)) {
    logError("Config file not readable", ['path' => $configPath]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler: Keine Leserechte"
    ], 500);
}

try {
    require_once $configPath;
} catch (Throwable $e) {
    logError("Config load error", ['error' => $e->getMessage()]);
    sendJsonResponse([
        "success" => false,
        "error"   => "Konfigurationsfehler"
    ], 500);
}

// Verify Database class exists
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
$query     = sanitizeInput($_GET['query'] ?? '', 500);
$limit     = validateLimit($_GET['limit'] ?? 50);
$sortField = validateSortField(sanitizeInput($_GET['sort'] ?? 'id', 50));
$sortOrder = validateSortOrder($_GET['order'] ?? 'DESC');

// =============================================================================
// DATABASE CONNECTION
// =============================================================================
$db = null;
$stmt = null;

try {
    $db = Database::connect();
    
    if (!$db instanceof mysqli) {
        throw new Exception("Database connection returned invalid type");
    }

    // Set charset
    if (!$db->set_charset('utf8mb4')) {
        throw new Exception("Failed to set charset: " . $db->error);
    }

    // Verify connection
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
    // Build query based on whether search term exists
    if ($query === '') {
        // Simple query without search - use backticks for field names
        $sql = "SELECT * FROM items ORDER BY `{$sortField}` {$sortOrder} LIMIT ?";
        
        $stmt = $db->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $db->error);
        }

        if (!$stmt->bind_param("i", $limit)) {
            throw new Exception("Bind param failed: " . $stmt->error);
        }

    } else {
        // First, check which columns actually exist in the table
        $columnsResult = $db->query("SHOW COLUMNS FROM items");
        $existingColumns = [];
        while ($col = $columnsResult->fetch_assoc()) {
            $existingColumns[] = $col['Field'];
        }
        
        // Build WHERE clause dynamically based on existing columns
        $searchFields = ['id', 'name', 'category', 'subcategory', 'brand', 'model', 
                        'serial', 'quantity', 'locker', 'notes', 'docs_link'];
        
        $whereClauses = [];
        $params = [];
        $types = '';
        
        foreach ($searchFields as $field) {
            if (in_array($field, $existingColumns)) {
                // Use CAST for numeric fields
                if (in_array($field, ['id', 'quantity'])) {
                    $whereClauses[] = "CAST(`{$field}` AS CHAR) LIKE CONCAT('%', ?, '%')";
                } else {
                    $whereClauses[] = "`{$field}` LIKE CONCAT('%', ?, '%')";
                }
                $params[] = $query;
                $types .= 's';
            }
        }
        
        $whereClause = implode("\n                   OR ", $whereClauses);
        
        $sql = "SELECT * FROM items
                WHERE {$whereClause}
                ORDER BY `{$sortField}` {$sortOrder}
                LIMIT ?";
        
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
    
    // Process items (format links, find thumbnails, etc.)
    $items = processItems($items);
    $count = count($items);

    // Log successful search
    if ($query !== '') {
        logError("Search executed", [
            'query' => $query,
            'results' => $count,
            'sort' => "{$sortField} {$sortOrder}",
            'limit' => $limit
        ]);
    }

    // Send success response
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
        "message" => "Ein Fehler ist bei der Suche aufgetreten",
        "debug"   => $e->getMessage() // Remove in production!
    ], 500);

} finally {
    // Cleanup
    if ($stmt instanceof mysqli_stmt) {
        $stmt->close();
    }
    if ($db instanceof mysqli) {
        $db->close();
    }
}

// Should never reach here due to sendJsonResponse exit, but just in case
sendJsonResponse([
    "success" => false,
    "error"   => "Unerwarteter Fehler"
], 500);
