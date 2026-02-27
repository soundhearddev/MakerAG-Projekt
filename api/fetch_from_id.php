<?php

/**
 * GET ?id=42   → ein Item (als Array mit einem Element)
 */

require_once __DIR__ . '/init.php';

$id = getIntParam('id');

if ($id <= 0) {
    sendError('Gültige id (> 0) erforderlich');
}

try {
    $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    sendSuccess(enrichItems($items), ['count' => count($items)]);

} catch (Throwable $e) {
    error_log('fetch_from_id.php: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    sendError(
        'Datenbankfehler',
        500,
        [],
        $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')'
    );
}