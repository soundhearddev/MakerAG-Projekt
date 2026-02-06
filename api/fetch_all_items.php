<?php

/**
 * API Endpoint: Fetch All Items
 * Verwendet Item-ID für docs und thumbnails: /docs/{id}/ und /docs/{id}/images/thumb.*
 */

// Error Logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/logs/php_errors.log');


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
 * Generiert docs_link basierend auf Item-ID
 */
function generateDocsLink($itemId)
{
    if (empty($itemId)) {
        return null;
    }
    
    // Prüfe ob /docs/{id}/index.html existiert
    $possiblePaths = [
        $_SERVER['DOCUMENT_ROOT'] . "/docs/" . $itemId . "/index.html",
        "/var/www/public/docs/" . $itemId . "/index.html"
    ];
    
    foreach ($possiblePaths as $path) {
        if (file_exists($path)) {
            return "/docs/" . $itemId . "/index.html";
        }
    }
    
    return null;
}

/**
 * Findet Thumbnail in /docs/{id}/images/
 * Priorität: thumb.png -> thumb.jpg -> thumb.jpeg -> thumb.webp -> erstes Bild
 */
function findThumbnail($itemId)
{
    if (empty($itemId)) {
        return null;
    }

    $possibleBasePaths = [
        $_SERVER['DOCUMENT_ROOT'] . "/docs/" . $itemId . "/images/",
        "/var/www/public/docs/" . $itemId . "/images/"
    ];

    foreach ($possibleBasePaths as $imagesPath) {
        if (!is_dir($imagesPath)) {
            continue;
        }

        // PRIORITÄT 1: thumb.png
        if (file_exists($imagesPath . "thumb.png")) {
            return "/docs/" . $itemId . "/images/thumb.png";
        }

        // PRIORITÄT 2: thumb.jpg
        if (file_exists($imagesPath . "thumb.jpg")) {
            return "/docs/" . $itemId . "/images/thumb.jpg";
        }

        // PRIORITÄT 3: thumb.jpeg
        if (file_exists($imagesPath . "thumb.jpeg")) {
            return "/docs/" . $itemId . "/images/thumb.jpeg";
        }

        // PRIORITÄT 4: thumb.webp
        if (file_exists($imagesPath . "thumb.webp")) {
            return "/docs/" . $itemId . "/images/thumb.webp";
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
                return "/docs/" . $itemId . "/images/" . $file;
            }
        }
    }

    return null;
}

/**
 * Post-Processing für Items - Generiert Pfade basierend auf ID
 */
function processItems($items)
{
    foreach ($items as &$item) {
        $itemId = $item['id'];
        
        // Generiere docs_link basierend auf ID
        $item['docs_link'] = generateDocsLink($itemId);
        $item['has_docs'] = !empty($item['docs_link']);
        
        // Generiere thumbnail basierend auf ID
        $item['thumbnail'] = findThumbnail($itemId);
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

    // Post-Processing - Generiert Pfade basierend auf ID
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