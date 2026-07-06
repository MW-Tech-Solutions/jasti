<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);

jasti_json([
    'user' => $user,
    'dashboards' => jasti_dashboard_payload($pdo, $user),
]);
