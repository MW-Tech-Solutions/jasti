<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
require_once __DIR__ . '/../support/copyleaks.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
jasti_ensure_plagiarism_scan_table($pdo);

$settings = jasti_plagiarism_integration_settings($pdo);
$secret = (string) ($_GET['token'] ?? '');
if ($settings['webhook_secret'] === '' || !hash_equals((string) $settings['webhook_secret'], $secret)) {
    jasti_json(['message' => 'Invalid webhook token.'], 403);
}

$payload = jasti_request_data();
$event = strtolower(trim((string) ($_GET['event'] ?? '')));

try {
    $result = match ($event) {
        'completed' => jasti_handle_copyleaks_completed_webhook($pdo, $payload),
        'error' => jasti_handle_copyleaks_error_webhook($pdo, $payload),
        'creditschecked', 'credits_checked' => jasti_handle_copyleaks_status_webhook($pdo, $payload, 'creditsChecked'),
        'indexed' => jasti_handle_copyleaks_status_webhook($pdo, $payload, 'indexed'),
        'new-results' => jasti_handle_copyleaks_status_webhook($pdo, $payload, 'new-results'),
        default => jasti_handle_copyleaks_status_webhook($pdo, $payload, $event !== '' ? $event : 'unknown'),
    };
} catch (Throwable $exception) {
    jasti_json(['message' => 'Unable to process Copyleaks webhook.', 'error' => $exception->getMessage()], 500);
}

jasti_json([
    'message' => 'Webhook processed.',
    'event' => $event,
    'result' => $result,
]);
