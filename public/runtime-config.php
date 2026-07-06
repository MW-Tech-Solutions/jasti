<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

function jasti_read_env_file(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $values = [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return [];
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        $parts = explode('=', $trimmed, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);
        $value = trim($value, "\"'");

        if ($key !== '') {
            $values[$key] = $value;
        }
    }

    return $values;
}

$env = array_merge(
    jasti_read_env_file(__DIR__ . '/.env'),
    jasti_read_env_file(dirname(__DIR__) . '/.env')
);

$apiUrl = trim((string)($env['VITE_API_URL'] ?? ''));

echo json_encode([
    'apiUrl' => $apiUrl,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

