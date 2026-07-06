<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$user = jasti_current_user($pdo);
if ($user === null) {
    jasti_json(['authenticated' => false]);
}

jasti_json([
    'authenticated' => true,
    'user' => $user,
    'dashboards' => jasti_dashboard_payload($pdo, $user),
]);
