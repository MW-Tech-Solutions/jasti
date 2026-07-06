<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
ajasti_bootstrap();

$pdo = ajasti_db();
$version = $pdo->query('SELECT VERSION() AS version')->fetch();

ajasti_json([
    'name' => 'JASTI PHP PDO API',
    'database' => ajasti_env('DB_NAME', 'ajasti_jms'),
    'mysql_version' => $version['version'] ?? null,
    'authenticated' => ajasti_current_user($pdo) !== null,
]);
