<?php

/**
 * API Endpoint: Fetch All Items
 * Thumbnail wird immer aus /docs/{ordnername}/images/thumb.png geladen
 */

// Error Logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');

// Security Headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("X-Content-Type-Options: nosniff");

// Helper function
function sendJsonResponse($data, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Config laden
$configPaths = [
    "/var/www/secure/config.php",
    __DIR__ . "/../secure/config.php",
    $_SERVER['DOCUMENT_ROOT'] . "/secure/config.php"
];

$configLoaded = false;
foreach ($configPaths as $path) {
    if (file_exists($path)) {
        require_once $path;
        $configLoaded = true;
        break;
    }
}

if (!$configLoaded) {
    sendJsonResponse([
        "success" => false,
        "error" => "Konfigurationsfehler",
        "message" => "Datenbankverbindung konnte nicht hergestellt werden"
    ], 500);
}

// Input Parameter
$limit = isset($_GET['limit']) ? max(1, min((int) $_GET['limit'], 1000)) : 100;
$offset = isset($_GET['offset']) ? max(0, (int) $_GET['offset']) : 0;
$category = isset($_GET['category']) ? trim($_GET['category']) : '';
$random = isset($_GET['random']) && $_GET['random'] === 'true';
$latest = isset($_GET['latest']) && $_GET['latest'] === 'true';

/**
 * Konvertiert docs_link zu vollständigem Pfad
 */
function formatDocsLink($docsLink)
{
    if (empty($docsLink)) {
        return null;
    }

    $docsLink = trim($docsLink, "/ \t\n\r\0\x0B");

    if (strpos($docsLink, '/') !== false || strpos($docsLink, '.html') !== false) {
        return $docsLink;
    }

    return "/docs/" . $docsLink . "/index.html";
}

/**
 * Findet Thumbnail in docs/{ordnername}/images/
 * Priorität: thumb.png -> thumb.jpg -> erstes gefundenes Bild
 */
function findThumbnailInDocs($docsLink)
{
    if (empty($docsLink)) {
        return null;
    }

    $folderName = trim($docsLink, "/ \t\n\r\0\x0B");

    $possiblePaths = [
        $_SERVER['DOCUMENT_ROOT'] . "/docs/" . $folderName . "/images/",
        "/var/www/public/docs/" . $folderName . "/images/"
    ];

    foreach ($possiblePaths as $imagesPath) {
        if (!is_dir($imagesPath)) {
            continue;
        }

        // PRIORITÄT 1: thumb.png
        if (file_exists($imagesPath . "thumb.png")) {
            return "/docs/" . $folderName . "/images/thumb.png";
        }

        // PRIORITÄT 2: thumb.jpg
        if (file_exists($imagesPath . "thumb.jpg")) {
            return "/docs/" . $folderName . "/images/thumb.jpg";
        }

        // PRIORITÄT 3: thumb.jpeg
        if (file_exists($imagesPath . "thumb.jpeg")) {
            return "/docs/" . $folderName . "/images/thumb.jpeg";
        }

        // PRIORITÄT 4: thumb.webp
        if (file_exists($imagesPath . "thumb.webp")) {
            return "/docs/" . $folderName . "/images/thumb.webp";
        }

        // FALLBACK: Suche nach beliebigem Bild
        $imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        $files = scandir($imagesPath);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (in_array($ext, $imageExtensions)) {
                return "/docs/" . $folderName . "/images/" . $file;
            }
        }
    }

    return null;
}

/**
 * Post-Processing für Items
 */
function processItems($items)
{
    foreach ($items as &$item) {
        // Formatiere docs_link
        if (isset($item['docs_link']) && !empty($item['docs_link'])) {
            $originalDocsLink = $item['docs_link'];
            $item['docs_link'] = formatDocsLink($originalDocsLink);

            // Suche IMMER nach Thumbnail in docs/images/thumb.png
            $foundThumbnail = findThumbnailInDocs($originalDocsLink);
            if ($foundThumbnail) {
                $item['thumbnail'] = $foundThumbnail;
            }
        }

        // Falls immer noch kein Thumbnail und manueller Pfad vorhanden
        if (isset($item['thumbnail']) && !empty($item['thumbnail'])) {
            if (!preg_match('/^https?:\/\//', $item['thumbnail'])) {
                if ($item['thumbnail'][0] !== '/') {
                    $item['thumbnail'] = '/' . $item['thumbnail'];
                }
            }
        }

        // Füge has_docs Flag hinzu
        $item['has_docs'] = !empty($item['docs_link']);
    }
    return $items;
}

try {
    $db = Database::connect();

    // SQL Query dynamisch bauen
    $sql = "SELECT * FROM items";
    $conditions = [];
    $params = [];
    $types = "";

    // Filter nach Kategorie
    if (!empty($category)) {
        $conditions[] = "category = ?";
        $params[] = $category;
        $types .= "s";
    }

    // WHERE Clause hinzufügen
    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }

    // Sortierung
    if ($random) {
        $sql .= " ORDER BY RAND()";
    } elseif ($latest) {
        $sql .= " ORDER BY id DESC";
    } else {
        $sql .= " ORDER BY id DESC";
    }

    // Limit und Offset
    $sql .= " LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= "ii";

    // Query vorbereiten und ausführen
    $stmt = $db->prepare($sql);

    if (!$stmt) {
        throw new Exception("Prepare failed: " . $db->error);
    }

    // Parameter binden wenn vorhanden
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt->execute()) {
        throw new Exception("Execute failed: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $items = $result->fetch_all(MYSQLI_ASSOC);

    // Post-Processing
    $items = processItems($items);

    // Gesamtanzahl für Pagination
    $countSql = "SELECT COUNT(*) as total FROM items";
    if (!empty($conditions)) {
        $countSql .= " WHERE " . implode(" AND ", array_slice($conditions, 0, count($conditions)));
    }

    $countStmt = $db->prepare($countSql);
    if (!empty($category)) {
        $countStmt->bind_param("s", $category);
    }
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $totalCount = $countResult->fetch_assoc()['total'];

    // Erfolgreiche Response
    sendJsonResponse([
        "success" => true,
        "count" => count($items),
        "total" => (int) $totalCount,
        "limit" => $limit,
        "offset" => $offset,
        "has_more" => ($offset + count($items)) < $totalCount,
        "filters" => [
            "category" => $category ?: null,
            "random" => $random,
            "latest" => $latest
        ],
        "data" => $items
    ]);
} catch (Exception $e) {
    error_log("fetch_all_items Error: " . $e->getMessage());
    sendJsonResponse([
        "success" => false,
        "error" => "Datenbankfehler",
        "message" => "Fehler beim Laden der Items",
        "debug" => $e->getMessage()
    ], 500);
}
