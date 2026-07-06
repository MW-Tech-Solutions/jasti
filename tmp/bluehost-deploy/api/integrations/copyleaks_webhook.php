<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
require_once __DIR__ . '/../support/copyleaks.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
ajasti_ensure_plagiarism_scan_table($pdo);

$settings = ajasti_plagiarism_integration_settings($pdo);
$secret = (string) ($_GET['token'] ?? '');
if ($settings['webhook_secret'] === '' || !hash_equals((string) $settings['webhook_secret'], $secret)) {
    ajasti_json(['message' => 'Invalid webhook token.'], 403);
}

$payload = ajasti_request_data();
$event = strtolower(trim((string) ($_GET['event'] ?? '')));

try {
    $result = match ($event) {
        'completed' => ajasti_handle_copyleaks_completed_webhook($pdo, $payload),
        'error' => ajasti_handle_copyleaks_error_webhook($pdo, $payload),
        'creditschecked', 'credits_checked' => ajasti_handle_copyleaks_status_webhook($pdo, $payload, 'creditsChecked'),
        'indexed' => ajasti_handle_copyleaks_status_webhook($pdo, $payload, 'indexed'),
        'new-results' => ajasti_handle_copyleaks_status_webhook($pdo, $payload, 'new-results'),
        default => ajasti_handle_copyleaks_status_webhook($pdo, $payload, $event !== '' ? $event : 'unknown'),
    };
} catch (Throwable $exception) {
    ajasti_json(['message' => 'Unable to process Copyleaks webhook.', 'error' => $exception->getMessage()], 500);
}

ajasti_json([
    'message' => 'Webhook processed.',
    'event' => $event,
    'result' => $result,
]);
