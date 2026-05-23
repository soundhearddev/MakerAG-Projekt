<?php
header('Content-Type: text/plain');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$fallback = '<serveradresse>';

function findLanIP($str) {
    preg_match_all('/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/', $str, $m);
    foreach ($m[0] as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    return null;
}


$out = @shell_exec("ip addr show 2>/dev/null");
if ($out && $ip = findLanIP($out)) { echo $ip; exit; }

$out = @shell_exec("hostname -I 2>/dev/null");
if ($out && $ip = findLanIP($out)) { echo $ip; exit; }

$host = gethostname();
if ($host) {
    foreach ((array) gethostbynamel($host) as $ip) {
        if (str_starts_with($ip, '10.')) { echo $ip; exit; }
    }
}

echo $fallback;