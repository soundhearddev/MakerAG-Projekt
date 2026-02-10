<?php
// NUTZUNG FÜR docs items

header("Content-Type: application/json");
require_once "/var/www/html/secure/config.php";

try {
    $db = Database::connect();

    // ID per GET abfragen, wenn vorhanden
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if ($id > 0) {
        $stmt = $db->prepare("SELECT id FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();

        if ($item) {
            // Pfade hinzufügen
            $item['docs_link'] = "/docs/{$item['id']}";
            $item['thumbnail'] = getThumbnailPath($item['id']);
        }

        echo json_encode($item ?: []);
    } else {
        // Alle Items abfragen
        $res = $db->query("SELECT id FROM items");
        $items = $res->fetch_all(MYSQLI_ASSOC);

        foreach ($items as &$item) {
            $item['docs_link'] = "/docs/{$item['id']}";
            $item['thumbnail'] = getThumbnailPath($item['id']);
        }

        echo json_encode($items);
    }

} catch (Exception $e) {
    echo json_encode([
        "error" => true,
        "message" => $e->getMessage()
    ]);
}

/**
 * Prüft, ob ein Thumbnail existiert und gibt den Pfad zurück.
 * Priorität: jpg > png > webp
 */
function getThumbnailPath($id) {
    $basePath = __DIR__ . "/docs/{$id}/images/thumb";
    $webPath  = "/docs/{$id}/images/thumb";

    $extensions = ['jpg', 'png', 'webp'];
    foreach ($extensions as $ext) {
        if (file_exists("{$basePath}.{$ext}")) {
            return "{$webPath}.{$ext}";
        }
    }

    // Falls kein Thumbnail existiert
    return null;
}

