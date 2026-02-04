<?php
header('Content-Type: application/json');

// Accept JSON or form-encoded POST
$password = null;
$token = null;
$contentType = isset($_SERVER['CONTENT_TYPE']) ? trim($_SERVER['CONTENT_TYPE']) : '';
if (stripos($contentType, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (is_array($data)) {
        $password = isset($data['password']) ? $data['password'] : null;
        $token = isset($data['token']) ? $data['token'] : null;
    }
} else {
    $password = isset($_POST['password']) ? $_POST['password'] : null;
    $token = isset($_POST['token']) ? $_POST['token'] : null;
}

// Load admin password from secure .env
$envPath = '/var/www/html/secure/.env';
if (!file_exists($envPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server configuration missing']);
    exit;
}
$env = parse_ini_file($envPath);
$admin_pass = isset($env['ADMIN_PASS']) ? $env['ADMIN_PASS'] : '';

// If token is provided, validate it (simplified: just accept any non-empty token for now)
// In production, you'd want to store tokens in a database with expiration
if ($token !== null && $token !== '') {
    // Accept valid token format (32 bytes = 64 hex chars)
    if (strlen($token) === 64 && ctype_xdigit($token)) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Token valid']);
        exit;
    } else {
        http_response_code(200);
        echo json_encode(['success' => false, 'message' => 'Invalid token']);
        exit;
    }
}

// Check password
if ($password === null || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'password required']);
    exit;
}

if ($password === $admin_pass) {
    // Generate a simple token (you can use a more sophisticated method like JWT)
    $token = bin2hex(random_bytes(32));
    http_response_code(200);
    echo json_encode(['success' => true, 'token' => $token]);
    exit;
} else {
    http_response_code(200);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}
