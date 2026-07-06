<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);

ajasti_json([
    'user' => $user,
    'dashboards' => ajasti_dashboard_payload($pdo, $user),
]);
