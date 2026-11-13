<?php

/**
 * Gibt die LAN-Adresse (10.x.x.x) des Servers als Text zurück.
 * Wird auf der How-To-Seite angezeigt.
 */

header('Content-Type: text/plain');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const FALLBACK_ADDRESS = '<serveradresse>';

function findLanIp(string $text): ?string
{
    preg_match_all('/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/', $text, $matches);
    foreach ($matches[0] as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return null;
}

foreach (['ip addr show', 'hostname -I'] as $command) {
    $output = @shell_exec($command . ' 2>/dev/null');
    if ($output && ($ip = findLanIp($output)) !== null) {
        echo $ip;
        exit;
    }
}

$host = gethostname();
foreach ($host ? (gethostbynamel($host) ?: []) : [] as $ip) {
    if (str_starts_with($ip, '10.')) {
        echo $ip;
        exit;
    }
}

echo FALLBACK_ADDRESS;
