<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$secret = trim((string) jasti_env('CRON_SECRET', ''));
if ($secret !== '') {
    $provided = trim((string) ($_GET['secret'] ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '')));
    if (!hash_equals($secret, $provided)) {
        jasti_json(['message' => 'Invalid cron secret.'], 403);
    }
}

$pdo = jasti_db();
jasti_ensure_peer_review_schema($pdo);
jasti_process_review_deadline_reminders($pdo);

jasti_json(['message' => 'Review deadline reminders processed.']);
