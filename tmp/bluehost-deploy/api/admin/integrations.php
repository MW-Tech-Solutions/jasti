<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
require_once __DIR__ . '/../support/copyleaks.php';
ajasti_bootstrap();

$pdo = ajasti_db();
ajasti_require_role($pdo, 'admin');
ajasti_ensure_plagiarism_scan_table($pdo);

function ajasti_admin_plagiarism_settings_payload(array $settings): array
{
    $payload = $settings;
    $payload['api_key_configured'] = trim((string) ($settings['api_key'] ?? '')) !== '';
    $payload['api_key'] = '';

    return $payload;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $settings = ajasti_plagiarism_integration_settings($pdo);
    $settings['webhook_url_template'] = ajasti_copyleaks_status_webhook_template($pdo);
    $settings['new_results_webhook_url'] = ajasti_copyleaks_webhook_url($pdo, 'new-results');

    ajasti_json([
        'settings' => ajasti_admin_plagiarism_settings_payload($settings),
        'recent_scans' => ajasti_recent_plagiarism_scans($pdo),
    ]);
}

ajasti_require_method('POST');
$data = ajasti_request_data();
$currentSettings = ajasti_plagiarism_integration_settings($pdo);
$providedApiKey = trim((string) ($data['plagiarism_api_key'] ?? ''));

$updates = [
    'plagiarism_provider' => 'copyleaks',
    'plagiarism_enabled' => !empty($data['plagiarism_enabled']) ? '1' : '0',
    'plagiarism_api_email' => trim((string) ($data['plagiarism_api_email'] ?? '')),
    'plagiarism_api_key' => $providedApiKey !== '' ? $providedApiKey : trim((string) ($currentSettings['api_key'] ?? '')),
    'plagiarism_sandbox' => !empty($data['plagiarism_sandbox']) ? '1' : '0',
    'plagiarism_require_completion' => !empty($data['plagiarism_require_completion']) ? '1' : '0',
];

if ($updates['plagiarism_enabled'] === '1' && ($updates['plagiarism_api_email'] === '' || $updates['plagiarism_api_key'] === '')) {
    ajasti_json(['message' => 'Copyleaks email and API key are required before enabling web-scale plagiarism scanning.'], 422);
}

$pdo->beginTransaction();
try {
    foreach ($updates as $key => $value) {
        ajasti_upsert_setting($pdo, $key, $value);
    }
    ajasti_ensure_plagiarism_webhook_secret($pdo);
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ajasti_json(['message' => 'Unable to update plagiarism integration settings.', 'error' => $exception->getMessage()], 500);
}

$settings = ajasti_plagiarism_integration_settings($pdo);
$settings['webhook_url_template'] = ajasti_copyleaks_status_webhook_template($pdo);
$settings['new_results_webhook_url'] = ajasti_copyleaks_webhook_url($pdo, 'new-results');

ajasti_json([
    'message' => 'Plagiarism integration settings updated successfully.',
    'settings' => ajasti_admin_plagiarism_settings_payload($settings),
    'recent_scans' => ajasti_recent_plagiarism_scans($pdo),
]);
