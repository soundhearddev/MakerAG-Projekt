<?php

/**
 * API Endpoint: Count Items
 * Gibt die Gesamtanzahl der Items zurück
 */

// Error Logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/html/logs/php_errors.log');

// Security Headers
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
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

try {
    $db = Database::connect();

    // Gesamtanzahl der Items
    $result = $db->query("SELECT COUNT(*) as total FROM items");

    if (!$result) {
        throw new Exception("Query failed: " . $db->error);
    }

    $row = $result->fetch_assoc();
    $count = (int) $row['total'];

    // Optional: Zusätzliche Statistiken
    $categoryResult = $db->query("SELECT COUNT(DISTINCT category) as cat_count FROM items WHERE category IS NOT NULL");
    $categoryCount = $categoryResult ? (int) $categoryResult->fetch_assoc()['cat_count'] : 0;

    $brandResult = $db->query("SELECT COUNT(DISTINCT brand) as brand_count FROM items WHERE brand IS NOT NULL");
    $brandCount = $brandResult ? (int) $brandResult->fetch_assoc()['brand_count'] : 0;

    // Erfolgreiche Response
    sendJsonResponse([
        "success" => true,
        "count" => $count,
        "statistics" => [
            "total_items" => $count,
            "categories" => $categoryCount,
            "brands" => $brandCount
        ]
    ]);
} catch (Exception $e) {
    error_log("count.php Error: " . $e->getMessage());
    sendJsonResponse([
        "success" => false,
        "error" => "Datenbankfehler",
        "message" => "Fehler beim Zählen der Items",
        "debug" => $e->getMessage()
    ], 500);
}
