<?php
/**
 * API Endpoint: fetch_catagory.php
 * Gibt alle vorhandenen Kategorien aus der Datenbank zurück.
 *
 * GET → Liste aller Kategorien
 */

require_once __DIR__ . './init.php';


try {
    $result     = $db->query("SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category ASC");
    $categories = $result->fetch_all(MYSQLI_ASSOC);

    sendSuccess($categories, ['count' => count($categories)]);
} catch (Exception $e) {
    error_log('fetch_catagory.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}