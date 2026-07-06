<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
require_once __DIR__ . '/../support/copyleaks.php';
jasti_bootstrap();

$pdo = jasti_db();
jasti_require_role($pdo, 'admin');
jasti_ensure_plagiarism_scan_table($pdo);

function jasti_admin_plagiarism_settings_payload(array $settings): array
{
    $payload = $settings;
    $payload['api_key_configured'] = trim((string) ($settings['api_key'] ?? '')) !== '';
    $payload['api_key'] = '';

    return $payload;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $settings = jasti_plagiarism_integration_settings($pdo);
    $settings['webhook_url_template'] = jasti_copyleaks_status_webhook_template($pdo);
    $settings['new_results_webhook_url'] = jasti_copyleaks_webhook_url($pdo, 'new-results');

    jasti_json([
        'settings' => jasti_admin_plagiarism_settings_payload($settings),
        'recent_scans' => jasti_recent_plagiarism_scans($pdo),
    ]);
}

jasti_require_method('POST');
$data = jasti_request_data();
$currentSettings = jasti_plagiarism_integration_settings($pdo);
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
    jasti_json(['message' => 'Copyleaks email and API key are required before enabling web-scale plagiarism scanning.'], 422);
}

$pdo->beginTransaction();
try {
    foreach ($updates as $key => $value) {
        jasti_upsert_setting($pdo, $key, $value);
    }
    jasti_ensure_plagiarism_webhook_secret($pdo);
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jasti_json(['message' => 'Unable to update plagiarism integration settings.', 'error' => $exception->getMessage()], 500);
}

$settings = jasti_plagiarism_integration_settings($pdo);
$settings['webhook_url_template'] = jasti_copyleaks_status_webhook_template($pdo);
$settings['new_results_webhook_url'] = jasti_copyleaks_webhook_url($pdo, 'new-results');

jasti_json([
    'message' => 'Plagiarism integration settings updated successfully.',
    'settings' => jasti_admin_plagiarism_settings_payload($settings),
    'recent_scans' => jasti_recent_plagiarism_scans($pdo),
]);
