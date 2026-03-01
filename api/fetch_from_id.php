<?php
require_once __DIR__ . '/init.php';

$id = getIntParam('id');

if ($id <= 0) {
    sendError('Gültige id (> 0) erforderlich');
}

try {
    $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    // fetch_all auch wenn wir nur ein Item erwarten → gibt immer Array zurück
    // (konsistentes API-Format, Frontend muss nicht unterscheiden)
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    sendSuccess(enrichItems($items), ['count' => count($items)]);

} catch (Throwable $e) {
    // Throwable statt Exception: fängt auch PHP-interne Fehler (TypeError usw.)
    // basename($e->getFile()) = nur den Dateinamen ohne vollen Pfad loggen
    error_log('fetch_from_id.php: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    sendError(
        'Datenbankfehler',
        500,
        [],
        $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')'
    );
}
