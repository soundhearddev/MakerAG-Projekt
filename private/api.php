<?php
/**
 * api.php – Zentrales Backend
 * Handles: session/overlay, formdata laden, item speichern, logging
 */

session_start();

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

// ─── DB verbinden ─────────────────────────────────────────────────────────────

$db      = null;
$dbError = null;

foreach ([
    '/var/www/secure/config.php',
    __DIR__ . '/../secure/config.php',
    __DIR__ . '/../../secure/config.php',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/secure/config.php',
] as $path) {
    if (file_exists($path)) { require_once $path; break; }
}

if (class_exists('Database')) {
    try {
        $db = Database::connect();
        $db->set_charset('utf8mb4');
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function logAction(string $action, ?string $detail = null): void {
    $ua   = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $data = [
        'timestamp'   => date('Y-m-d H:i:s'),
        'action'      => $action,
        'detail'      => $detail,
        'ip'          => getClientIp(),
        'browser'     => parseBrowser($ua),
        'os'          => parseOS($ua),
        'device_type' => parseDeviceType($ua),
        'language'    => parseLanguage($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null),
        'referrer'    => $_SERVER['HTTP_REFERER']  ?? null,
        'method'      => $_SERVER['REQUEST_METHOD'] ?? null,
        'url'         => getCurrentUrl(),
        'session_id'  => session_id() ?: null,
    ];

    $line = str_repeat('─', 60);
    $out  = "\n{$line}\n  LOG ENTRY\n{$line}\n";
    foreach ($data as $k => $v) {
        $out .= '  ' . str_pad($k, 14) . '  ' . ($v ?? '–') . "\n";
    }
    $out .= "{$line}\n";
    error_log($out);

    // TODO: DB-Insert hier einfügen wenn Tabelle bereit:
    // global $db;
    // if (!$db) return;
    // $stmt = $db->prepare("INSERT INTO logs (action,detail,ip,browser,os,device_type,language,referrer,method,url,session_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    // $stmt->bind_param('sssssssssss', $action,$detail,$data['ip'],$data['browser'],$data['os'],$data['device_type'],$data['language'],$data['referrer'],$data['method'],$data['url'],$data['session_id']);
    // $stmt->execute();
}

function getClientIp(): string {
    foreach (['HTTP_X_FORWARDED_FOR','HTTP_X_REAL_IP','REMOTE_ADDR'] as $k) {
        $ip = trim(explode(',', $_SERVER[$k] ?? '')[0]);
        if ($ip && filter_var($ip, FILTER_VALIDATE_IP)) return substr($ip, 0, 45);
    }
    return '0.0.0.0';
}

function getCurrentUrl(): string {
    $s = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return substr("{$s}://" . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['REQUEST_URI'] ?? '/'), 0, 512);
}

function parseBrowser(?string $ua): ?string {
    if (!$ua) return null;
    foreach (['Edg'=>'Edge','OPR'=>'Opera','SamsungBrowser'=>'Samsung Browser','Chrome'=>'Chrome','Firefox'=>'Firefox','Safari'=>'Safari','Trident'=>'IE'] as $k=>$n) {
        if (stripos($ua, $k) !== false) {
            return $n . (preg_match("/{$k}[\/ ]([\d]+)/i", $ua, $m) ? ' '.$m[1] : '');
        }
    }
    return substr($ua, 0, 64);
}

function parseOS(?string $ua): ?string {
    if (!$ua) return null;
    foreach (['Windows NT 10.0'=>'Windows 10/11','iPhone'=>'iOS','iPad'=>'iPadOS','Android'=>'Android','Mac OS X'=>'macOS','Linux'=>'Linux','Windows'=>'Windows'] as $k=>$n) {
        if (stripos($ua, $k) !== false) {
            if ($k==='Android' && preg_match('/Android ([\d.]+)/i',$ua,$m)) return "Android {$m[1]}";
            if ($k==='Mac OS X' && preg_match('/Mac OS X ([\d_]+)/i',$ua,$m)) return 'macOS '.str_replace('_','.',$m[1]);
            return $n;
        }
    }
    return null;
}

function parseDeviceType(?string $ua): string {
    if (!$ua) return 'unknown';
    if (preg_match('/tablet|ipad|playbook|silk/i', $ua)) return 'tablet';
    if (preg_match('/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i', $ua)) return 'mobile';
    return 'desktop';
}

function parseLanguage(?string $l): ?string {
    return $l ? substr(explode(',', $l)[0], 0, 64) : null;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function docRoot(): string {
    return rtrim($_SERVER['DOCUMENT_ROOT'] ?? '/var/www/public', '/');
}

function makeDir(int $id, string $sub): string {
    $p = docRoot() . "/docs/{$id}/{$sub}/";
    if (!is_dir($p)) mkdir($p, 0775, true);
    return $p;
}

function respond(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── Router ───────────────────────────────────────────────────────────────────

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// ── GET: Formulardaten laden ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    if ($action === 'formdata') {
        logAction('page_view');
        if (!$db) respond(['error' => $dbError ?? 'Keine DB'], 503);

        $categories = $db->query("SELECT c.id, c.name, c.parent_id, p.name AS parent_name
                                   FROM categories c
                                   LEFT JOIN categories p ON p.id = c.parent_id
                                   ORDER BY p.name ASC, c.name ASC")->fetch_all(MYSQLI_ASSOC);
        $locations  = $db->query("SELECT * FROM locations ORDER BY schrank ASC, regal ASC")->fetch_all(MYSQLI_ASSOC);
        $tags       = $db->query("SELECT * FROM tags ORDER BY name ASC")->fetch_all(MYSQLI_ASSOC);

        respond(['categories' => $categories, 'locations' => $locations, 'tags' => $tags]);
    }

    respond(['error' => 'Unbekannte Action'], 400);
}

// ── POST-Actions ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // Overlay akzeptieren
    if ($action === 'accept_overlay') {
        $_SESSION['welcome_accepted'] = true;
        logAction('overlay_accepted');
        respond(['ok' => true, 'session_id' => session_id()]);
    }

    // Session-Status prüfen
    if ($action === 'session_status') {
        respond(['accepted' => !empty($_SESSION['welcome_accepted'])]);
    }

    // Item speichern
    if ($action === 'save_item') {
        if (!$db) respond(['error' => 'Keine Datenbankverbindung'], 503);

        try {
            // 1. Kategorie
            $categoryId = null;
            if (!empty($_POST['category_id'])) {
                $categoryId = (int)$_POST['category_id'];
            } elseif (!empty($_POST['new_category_name'])) {
                $cn  = trim($_POST['new_category_name']);
                $pid = !empty($_POST['new_category_parent']) ? (int)$_POST['new_category_parent'] : null;
                $s   = $db->prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)");
                $s->bind_param('si', $cn, $pid);
                $s->execute();
                $categoryId = $db->insert_id;
            }

            // 2. Standort
            $locationId = null;
            if (!empty($_POST['location_id'])) {
                $locationId = (int)$_POST['location_id'];
            } elseif (!empty($_POST['new_schrank'])) {
                $room = trim($_POST['new_room']     ?? '') ?: null;
                $sch  = trim($_POST['new_schrank']  ?? '') ?: null;
                $reg  = trim($_POST['new_regal']    ?? '') ?: null;
                $pos  = trim($_POST['new_position'] ?? '') ?: null;
                $s    = $db->prepare("INSERT INTO locations (room, schrank, regal, position) VALUES (?,?,?,?)");
                $s->bind_param('ssss', $room, $sch, $reg, $pos);
                $s->execute();
                $locationId = $db->insert_id;
            }

            // 3. Item
            $name   = trim($_POST['name']          ?? '');
            $brand  = trim($_POST['brand']         ?? '') ?: null;
            $model  = trim($_POST['model']         ?? '') ?: null;
            $serial = trim($_POST['serial_number'] ?? '') ?: null;
            $status = $_POST['status']             ?? 'verfügbar';
            $cond   = $_POST['item_condition']     ?? null ?: null;
            $notes  = trim($_POST['notes']         ?? '') ?: null;

            if (!$name) throw new Exception('Name darf nicht leer sein.');

            $s = $db->prepare("INSERT INTO items (name,brand,model,serial_number,category_id,status,item_condition,location_id,notes) VALUES (?,?,?,?,?,?,?,?,?)");
            $s->bind_param('ssssissis', $name,$brand,$model,$serial,$categoryId,$status,$cond,$locationId,$notes);
            $s->execute();
            $newId = $db->insert_id;

            // 4. Specs
            if (!empty($_POST['spec_key']) && is_array($_POST['spec_key'])) {
                $ss = $db->prepare("INSERT INTO specs (item_id,`key`,value) VALUES (?,?,?)");
                foreach ($_POST['spec_key'] as $i => $k) {
                    $k = trim($k); $v = trim($_POST['spec_value'][$i] ?? '');
                    if ($k && $v) { $ss->bind_param('iss', $newId, $k, $v); $ss->execute(); }
                }
            }

            // 5. Tags
            $tagIds = array_map('intval', $_POST['tags'] ?? []);
            if (!empty($_POST['new_tags'])) {
                foreach (array_map('trim', explode(',', $_POST['new_tags'])) as $nt) {
                    if (!$nt) continue;
                    $sc = $db->prepare("SELECT id FROM tags WHERE name=?");
                    $sc->bind_param('s', $nt); $sc->execute();
                    $ex = $sc->get_result()->fetch_assoc();
                    if ($ex) { $tagIds[] = (int)$ex['id']; }
                    else { $st = $db->prepare("INSERT INTO tags (name) VALUES (?)"); $st->bind_param('s',$nt); $st->execute(); $tagIds[] = $db->insert_id; }
                }
            }
            foreach (array_unique($tagIds) as $tid) {
                $si = $db->prepare("INSERT IGNORE INTO item_tags (item_id,tag_id) VALUES (?,?)");
                $si->bind_param('ii', $newId, $tid); $si->execute();
            }

            // 6. Uploads
            $uploaded = ['images'=>[], 'docs'=>[]];
            $imageExts = ['jpg','jpeg','png','gif','webp','svg','avif'];
            $docExts   = ['pdf','doc','docx','xls','xlsx','txt','csv','zip'];

            if (!empty($_FILES['uploads']['name'][0])) {
                $imgDir = makeDir($newId, 'images');
                $datDir = makeDir($newId, 'data');
                foreach ($_FILES['uploads']['name'] as $i => $orig) {
                    if ($_FILES['uploads']['error'][$i] !== UPLOAD_ERR_OK) continue;
                    $ext  = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
                    $safe = preg_replace('/[^a-z0-9_\-\.]/i', '_', $orig);
                    $tmp  = $_FILES['uploads']['tmp_name'][$i];
                    if (in_array($ext, $imageExts, true) && move_uploaded_file($tmp, $imgDir.$safe)) $uploaded['images'][] = $safe;
                    elseif (in_array($ext, $docExts, true) && move_uploaded_file($tmp, $datDir.$safe)) $uploaded['docs'][] = $safe;
                }
            }

            logAction('item_created', "ID {$newId}: {$name}");
            respond(['ok' => true, 'id' => $newId, 'name' => $name, 'uploaded' => $uploaded]);

        } catch (Exception $e) {
            logAction('item_error', $e->getMessage());
            respond(['error' => $e->getMessage()], 500);
        }
    }

    respond(['error' => 'Unbekannte Action'], 400);
}

respond(['error' => 'Methode nicht erlaubt'], 405);