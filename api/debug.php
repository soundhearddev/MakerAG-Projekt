<?php
/**
 * debug.php
 * Nur lokal / Development zugänglich.
 * Zeigt Systeminfos, Config-Status, DB-Verbindung und erlaubt Test-Queries.
 *
 * WICHTIG: Vor Production-Deploy LÖSCHEN oder deaktivieren!
 */

// ─── Nur lokal erreichbar ─────────────────────────────────────────────────────
$allowedIps = ['127.0.0.1', '::1'];
if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', $allowedIps, true) && ($_SERVER['SERVER_NAME'] ?? '') !== 'localhost') {
    http_response_code(403);
    die('Access Denied');
}

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/html; charset=UTF-8');

// Bootstrap laden (für DB-Verbindung im Test-Query-Block)
$bootstrapLoaded = false;
try {
    require_once __DIR__ . '/init.php';
    $bootstrapLoaded = true;
} catch (Throwable $e) {
    // Wird weiter unten angezeigt
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Helper</title>
</head>
<body>
<div class="container">
    <h1> Debug Helper</h1>

    <?php
    // ── Bootstrap-Status ──────────────────────────────────────────────────────
    ?>
    <div class="section <?= $bootstrapLoaded ? 'success' : 'error' ?>">
        <h2>Bootstrap / Config</h2>
        <?php if ($bootstrapLoaded): ?>
            <p class="ok">✓ init.php erfolgreich geladen</p>
            <?php if (class_exists('Database')): ?>
                <p class="ok">✓ Database-Klasse gefunden</p>
                <?php
                try {
                    $testDb = Database::connect();
                    echo '<p class="ok">✓ Datenbankverbindung erfolgreich</p>';
                } catch (Throwable $e) {
                    echo '<p class="bad">✗ DB-Verbindung fehlgeschlagen: ' . htmlspecialchars($e->getMessage()) . '</p>';
                }
                ?>
            <?php else: ?>
                <p class="bad">✗ Database-Klasse nicht gefunden</p>
            <?php endif; ?>
        <?php else: ?>
            <p class="bad">✗ init.php konnte nicht geladen werden<?= isset($e) ? ': ' . htmlspecialchars($e->getMessage()) : '' ?></p>
        <?php endif; ?>
    </div>

    <?php
    // ── PHP-Umgebung ──────────────────────────────────────────────────────────
    ?>
    <div class="section info">
        <h2>PHP Environment</h2>
        <table>
            <tr><th>Parameter</th><th>Wert</th></tr>
            <tr><td>PHP Version</td>
                <td class="<?= version_compare(PHP_VERSION, '8.0.0', '>=') ? 'ok' : 'warn' ?>">
                    <?= PHP_VERSION ?> <?= version_compare(PHP_VERSION, '8.0.0', '>=') ? '✓' : '(< 8.0 empfohlen)' ?>
                </td></tr>
            <tr><td>Memory Limit</td><td><?= ini_get('memory_limit') ?></td></tr>
            <tr><td>Max Execution</td><td><?= ini_get('max_execution_time') ?>s</td></tr>
            <tr><td>Upload Max</td><td><?= ini_get('upload_max_filesize') ?></td></tr>
            <tr><td>Post Max</td><td><?= ini_get('post_max_size') ?></td></tr>
            <tr><td>Error Log</td><td><?= ini_get('error_log') ?: '(nicht konfiguriert)' ?></td></tr>
        </table>
    </div>

    <?php
    // ── Pfade & Permissions ───────────────────────────────────────────────────
    ?>
    <div class="section">
        <h2>Pfade & Permissions</h2>
        <table>
            <tr><th>Beschreibung</th><th>Pfad</th><th>Existiert</th><th>Lesbar</th><th>Schreibbar</th><th>Rechte</th></tr>
            <?php
            $checkPaths = [
                'init.php'     => __DIR__ . './init.php',
                'Log-Verzeichnis'   => '/var/www/logs',
                'PHP Error Log'     => '/var/www/logs/php_errors.log',
                'Public Dir'        => '/var/www/public',
                'Docs Dir'          => '/var/www/public/docs',
            ];
            foreach ($checkPaths as $desc => $path):
                $e  = file_exists($path);
                $r  = $e && is_readable($path);
                $w  = $e && is_writable($path);
                $p  = $e ? substr(sprintf('%o', fileperms($path)), -4) : 'N/A';
            ?>
            <tr>
                <td><strong><?= htmlspecialchars($desc) ?></strong></td>
                <td><code><?= htmlspecialchars($path) ?></code></td>
                <td class="<?= $e ? 'ok' : 'bad' ?>"><?= $e ? '✓' : '✗' ?></td>
                <td class="<?= $r ? 'ok' : 'bad' ?>"><?= $r ? '✓' : '✗' ?></td>
                <td class="<?= $w ? 'ok' : 'warn' ?>"><?= $w ? '✓' : '–' ?></td>
                <td><?= $p ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <?php
    // ── Extensions ────────────────────────────────────────────────────────────
    ?>
    <div class="section">
        <h2> PHP Extensions</h2>
        <table>
            <tr><th>Extension</th><th>Beschreibung</th><th>Status</th></tr>
            <?php
            foreach (['mysqli' => 'MySQL', 'json' => 'JSON', 'mbstring' => 'Multibyte', 'openssl' => 'SSL', 'curl' => 'cURL', 'fileinfo' => 'File Info'] as $ext => $desc):
                $loaded = extension_loaded($ext);
            ?>
            <tr>
                <td><code><?= $ext ?></code></td>
                <td><?= $desc ?></td>
                <td class="<?= $loaded ? 'ok' : 'bad' ?>"><?= $loaded ? '✓ Geladen' : '✗ Fehlt' ?></td>
            </tr>
            <?php endforeach; ?>
        </table>
    </div>

    <?php
    // ── Error Log ─────────────────────────────────────────────────────────────
    $logFile = ini_get('error_log');
    if ($logFile && file_exists($logFile)):
    ?>
    <div class="section warning">
        <h2>Error Log (letzte 50 Zeilen)</h2>
        <?php
        $lines = @file($logFile);
        echo '<pre>' . htmlspecialchars(implode('', array_slice($lines ?: [], -50))) . '</pre>';
        ?>
    </div>
    <?php endif; ?>

    <?php
    // ── Test-Query ────────────────────────────────────────────────────────────
    ?>
    <div class="section">
        <h2>Test-Query</h2>
        <?php if (isset($_GET['test_query']) && $bootstrapLoaded):
            $tq = mb_substr(strip_tags(trim($_GET['test_query'])), 0, 500, 'UTF-8');
            try {
                $db = Database::connect();
                $db->set_charset('utf8mb4');
                if ($tq === '') {
                    $stmt = $db->prepare("SELECT * FROM items ORDER BY id DESC LIMIT 10");
                    $stmt->execute();
                } else {
                    $stmt = $db->prepare("SELECT * FROM items WHERE name LIKE CONCAT('%',?,'%') OR brand LIKE CONCAT('%',?,'%') OR category LIKE CONCAT('%',?,'%') LIMIT 10");
                    $stmt->bind_param('sss', $tq, $tq, $tq);
                    $stmt->execute();
                }
                $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
                echo '<p class="ok">✓ ' . count($items) . ' Ergebnisse</p>';
                echo '<pre>' . htmlspecialchars(json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
            } catch (Throwable $ex) {
                echo '<p class="bad">Fehler: ' . htmlspecialchars($ex->getMessage()) . '</p>';
            }
        else: ?>
        <form method="get" style="margin-bottom:10px">
            <input type="text" name="test_query" placeholder="Suchbegriff (leer = alle)">
            <button type="submit" class="btn">Suche starten</button>
        </form>
        <?php endif; ?>
    </div>

    <div class="section info">
        <h2>🛠️ Schnellzugriff</h2>
        <a class="btn" href="?test_query=">Alle Items</a>
        <a class="btn" href="?">Seite neu laden</a>
        <a class="btn" href="../">Zurück zur App</a>
    </div>

    <div class="section warning">
        <h2>Hinweis</h2>
        <p>Diese Seite ist nur für Development gedacht. Vor dem Production-Deploy entfernen oder per IP sperren.</p>
    </div>
</div>
</body>
</html>
