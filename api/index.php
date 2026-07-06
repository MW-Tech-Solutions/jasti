<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
jasti_bootstrap();

$pdo = jasti_db();
$version = $pdo->query('SELECT VERSION() AS version')->fetch();

jasti_json([
    'name' => 'JASTI PHP PDO API',
    'database' => jasti_env('DB_NAME', 'jasti_jms'),
    'mysql_version' => $version['version'] ?? null,
    'authenticated' => jasti_current_user($pdo) !== null,
]);
