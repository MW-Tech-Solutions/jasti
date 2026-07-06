<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function ajasti_ensure_plagiarism_scan_table(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS manuscript_plagiarism_scans (
            scan_row_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            manuscript_id INT NULL,
            user_id INT NOT NULL,
            provider VARCHAR(50) NOT NULL DEFAULT "local_archive",
            draft_token VARCHAR(80) DEFAULT NULL,
            external_scan_id VARCHAR(120) DEFAULT NULL,
            source_filename VARCHAR(255) DEFAULT NULL,
            source_sha256 CHAR(64) DEFAULT NULL,
            status VARCHAR(50) NOT NULL DEFAULT "pending",
            similarity_score DECIMAL(5,2) DEFAULT NULL,
            top_matches_json LONGTEXT NULL,
            raw_response_json LONGTEXT NULL,
            last_error TEXT NULL,
            submitted_at TIMESTAMP NULL DEFAULT NULL,
            completed_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_plagiarism_draft_token (draft_token),
            UNIQUE KEY uniq_plagiarism_external_scan_id (external_scan_id),
            UNIQUE KEY uniq_plagiarism_manuscript_id (manuscript_id),
            KEY idx_plagiarism_user_id (user_id),
            CONSTRAINT fk_plagiarism_scan_manuscript FOREIGN KEY (manuscript_id) REFERENCES manuscripts (manuscript_id) ON DELETE CASCADE,
            CONSTRAINT fk_plagiarism_scan_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci'
    );

    $ready = true;
}

function ajasti_plagiarism_integration_settings(PDO $pdo): array
{
    $settings = ajasti_settings($pdo);

    $provider = trim((string) ($settings['plagiarism_provider'] ?? ajasti_env('PLAGIARISM_PROVIDER', 'copyleaks')));
    $enabledValue = (string) ($settings['plagiarism_enabled'] ?? ajasti_env('PLAGIARISM_ENABLED', '0'));
    $sandboxValue = (string) ($settings['plagiarism_sandbox'] ?? ajasti_env('COPYLEAKS_SANDBOX', '1'));
    $requireCompletionValue = (string) ($settings['plagiarism_require_completion'] ?? ajasti_env('PLAGIARISM_REQUIRE_COMPLETION', '1'));
    $apiEmail = trim((string) ($settings['plagiarism_api_email'] ?? ajasti_env('COPYLEAKS_EMAIL', '')));
    $apiKey = trim((string) ($settings['plagiarism_api_key'] ?? ajasti_env('COPYLEAKS_API_KEY', '')));
    $webhookSecret = trim((string) ($settings['plagiarism_webhook_secret'] ?? ajasti_env('COPYLEAKS_WEBHOOK_SECRET', '')));

    $enabled = in_array(strtolower($enabledValue), ['1', 'true', 'yes', 'on'], true);
    $sandbox = in_array(strtolower($sandboxValue), ['1', 'true', 'yes', 'on'], true);
    $requireCompletion = !in_array(strtolower($requireCompletionValue), ['0', 'false', 'no', 'off'], true);

    return [
        'provider' => $provider !== '' ? $provider : 'copyleaks',
        'enabled' => $enabled,
        'api_email' => $apiEmail,
        'api_key' => $apiKey,
        'sandbox' => $sandbox,
        'require_completion' => $requireCompletion,
        'webhook_secret' => $webhookSecret,
        'configured' => $enabled && $apiEmail !== '' && $apiKey !== '',
    ];
}

function ajasti_ensure_plagiarism_webhook_secret(PDO $pdo): string
{
    $settings = ajasti_plagiarism_integration_settings($pdo);
    if ($settings['webhook_secret'] !== '') {
        return (string) $settings['webhook_secret'];
    }

    $secret = bin2hex(random_bytes(24));
    ajasti_upsert_setting($pdo, 'plagiarism_webhook_secret', $secret);

    return $secret;
}

function ajasti_copyleaks_webhook_url(PDO $pdo, string $event): string
{
    $secret = ajasti_ensure_plagiarism_webhook_secret($pdo);
    return ajasti_backend_url('api/integrations/copyleaks_webhook.php?token=' . urlencode($secret) . '&event=' . urlencode($event));
}

function ajasti_copyleaks_status_webhook_template(PDO $pdo): string
{
    $secret = ajasti_ensure_plagiarism_webhook_secret($pdo);
    return ajasti_backend_url('api/integrations/copyleaks_webhook.php?token=' . urlencode($secret) . '&event={STATUS}');
}

function ajasti_copyleaks_sdk_bootstrap(): void
{
    $autoloadPath = ajasti_root_path('vendor/autoload.php');
    if (!is_file($autoloadPath)) {
        throw new RuntimeException('Composer autoload is missing. Run composer install to enable Copyleaks integration.');
    }

    require_once $autoloadPath;
}

function ajasti_copyleaks_client(): \Copyleaks\Copyleaks
{
    ajasti_copyleaks_sdk_bootstrap();
    \Copyleaks\CopyleaksConfig::SET_IDENTITY_SERVER_URI('https://id.copyleaks.com');
    \Copyleaks\CopyleaksConfig::SET_API_SERVER_URI('https://api.copyleaks.com');
    return new \Copyleaks\Copyleaks();
}

function ajasti_copyleaks_token(PDO $pdo): \Copyleaks\CopyleaksAuthToken
{
    $settings = ajasti_plagiarism_integration_settings($pdo);
    if (!$settings['configured']) {
        throw new RuntimeException('Copyleaks is not configured yet. Add the API email and key in Admin > Integrations.');
    }

    $client = ajasti_copyleaks_client();
    return $client->login((string) $settings['api_email'], (string) $settings['api_key']);
}

function ajasti_plagiarism_file_sha256(array $file): string
{
    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_file($tmpName)) {
        throw new RuntimeException('Uploaded manuscript file is unavailable for plagiarism analysis.');
    }

    $hash = hash_file('sha256', $tmpName);
    if (!is_string($hash) || $hash === '') {
        throw new RuntimeException('Unable to fingerprint the uploaded manuscript file.');
    }

    return $hash;
}

function ajasti_create_web_plagiarism_scan(PDO $pdo, int $userId, array $file): array
{
    ajasti_ensure_plagiarism_scan_table($pdo);

    $settings = ajasti_plagiarism_integration_settings($pdo);
    if (!$settings['configured']) {
        throw new RuntimeException('Copyleaks is not configured yet. Add the API email and key in Admin > Integrations.');
    }

    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException(ajasti_upload_error_message($error));
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_file($tmpPath)) {
        throw new RuntimeException('Uploaded manuscript file is unavailable for plagiarism analysis.');
    }

    $base64 = base64_encode((string) file_get_contents($tmpPath));
    if ($base64 === '') {
        throw new RuntimeException('Unable to read the uploaded manuscript file.');
    }

    $draftToken = bin2hex(random_bytes(20));
    $externalScanId = 'ajasti_' . time() . '_' . bin2hex(random_bytes(6));
    $sha256 = ajasti_plagiarism_file_sha256($file);
    $filename = trim((string) ($file['name'] ?? 'manuscript.pdf'));

    $insert = $pdo->prepare(
        'INSERT INTO manuscript_plagiarism_scans
            (manuscript_id, user_id, provider, draft_token, external_scan_id, source_filename, source_sha256, status, submitted_at)
         VALUES
            (NULL, :user_id, :provider, :draft_token, :external_scan_id, :source_filename, :source_sha256, :status, CURRENT_TIMESTAMP)'
    );
    $insert->execute([
        'user_id' => $userId,
        'provider' => 'copyleaks',
        'draft_token' => $draftToken,
        'external_scan_id' => $externalScanId,
        'source_filename' => $filename,
        'source_sha256' => $sha256,
        'status' => 'queued',
    ]);

    try {
        $token = ajasti_copyleaks_token($pdo);
        $webhooks = new \Copyleaks\SubmissionWebhooks(
            ajasti_copyleaks_status_webhook_template($pdo),
            ajasti_copyleaks_webhook_url($pdo, 'new-results')
        );
        $properties = new \Copyleaks\SubmissionProperties($webhooks);
        $properties->setSandbox((bool) $settings['sandbox']);
        $properties->setDeveloperPayload($draftToken);

        $submission = new \Copyleaks\CopyleaksFileSubmissionModel($base64, $filename, $properties);
        $client = ajasti_copyleaks_client();
        $response = $client->submitFile($token, $externalScanId, $submission);

        $update = $pdo->prepare(
            'UPDATE manuscript_plagiarism_scans
             SET status = :status,
                 raw_response_json = :raw_response_json,
                 updated_at = CURRENT_TIMESTAMP
             WHERE draft_token = :draft_token'
        );
        $update->execute([
            'status' => 'submitted',
            'raw_response_json' => json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'draft_token' => $draftToken,
        ]);
    } catch (Throwable $exception) {
        $update = $pdo->prepare(
            'UPDATE manuscript_plagiarism_scans
             SET status = :status,
                 last_error = :last_error,
                 updated_at = CURRENT_TIMESTAMP
             WHERE draft_token = :draft_token'
        );
        $update->execute([
            'status' => 'error',
            'last_error' => $exception->getMessage(),
            'draft_token' => $draftToken,
        ]);
        throw new RuntimeException('Unable to submit the manuscript to Copyleaks: ' . $exception->getMessage(), previous: $exception);
    }

    return ajasti_plagiarism_scan_by_token($pdo, $userId, $draftToken) ?? [];
}

function ajasti_plagiarism_scan_by_token(PDO $pdo, int $userId, string $draftToken): ?array
{
    ajasti_ensure_plagiarism_scan_table($pdo);

    $stmt = $pdo->prepare(
        'SELECT scan_row_id, manuscript_id, provider, draft_token, external_scan_id, source_filename, source_sha256,
                status, similarity_score, top_matches_json, raw_response_json, last_error, submitted_at, completed_at, updated_at
         FROM manuscript_plagiarism_scans
         WHERE user_id = :user_id AND draft_token = :draft_token
         LIMIT 1'
    );
    $stmt->execute([
        'user_id' => $userId,
        'draft_token' => $draftToken,
    ]);

    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }

    $row['top_matches'] = json_decode((string) ($row['top_matches_json'] ?? '[]'), true) ?: [];
    return $row;
}

function ajasti_plagiarism_status_message(array $scan): string
{
    $status = strtolower((string) ($scan['status'] ?? 'pending'));
    return match ($status) {
        'completed' => 'Web-scale plagiarism scan completed successfully.',
        'submitted', 'queued', 'creditschecked', 'credits_checked', 'indexed' => 'Web-scale plagiarism scan is still processing. The score will appear automatically once Copyleaks completes the scan.',
        'error' => (string) ($scan['last_error'] ?? 'The plagiarism provider returned an error while processing this manuscript.'),
        default => 'Plagiarism scan is pending.',
    };
}

function ajasti_validate_plagiarism_scan_for_submission(PDO $pdo, int $userId, string $draftToken, string $sourceSha256): array
{
    ajasti_ensure_plagiarism_scan_table($pdo);

    $scan = ajasti_plagiarism_scan_by_token($pdo, $userId, $draftToken);
    if ($scan === null) {
        throw new RuntimeException('No completed plagiarism scan was found for this manuscript upload.');
    }

    $status = strtolower((string) ($scan['status'] ?? ''));
    if ($status === 'error') {
        throw new RuntimeException((string) ($scan['last_error'] ?? 'The plagiarism provider returned an error while processing this manuscript.'));
    }

    $settings = ajasti_plagiarism_integration_settings($pdo);
    if ($status !== 'completed' && (bool) ($settings['require_completion'] ?? true)) {
        throw new RuntimeException('Wait for the web-scale plagiarism scan to finish before submitting the manuscript.');
    }

    if (!hash_equals((string) ($scan['source_sha256'] ?? ''), $sourceSha256)) {
        throw new RuntimeException('The manuscript file changed after the plagiarism scan was started. Upload the same file again to generate a fresh scan.');
    }

    return $scan;
}

function ajasti_recent_plagiarism_scans(PDO $pdo, int $limit = 20): array
{
    ajasti_ensure_plagiarism_scan_table($pdo);

    $stmt = $pdo->prepare(
        'SELECT s.scan_row_id, s.provider, s.status, s.similarity_score, s.source_filename, s.last_error,
                s.submitted_at, s.completed_at, s.updated_at, s.manuscript_id,
                m.title
         FROM manuscript_plagiarism_scans s
         LEFT JOIN manuscripts m ON m.manuscript_id = s.manuscript_id
         ORDER BY s.updated_at DESC, s.scan_row_id DESC
         LIMIT :limit_rows'
    );
    $stmt->bindValue(':limit_rows', $limit, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function ajasti_update_scan_row(PDO $pdo, string $externalScanId, array $updates): void
{
    ajasti_ensure_plagiarism_scan_table($pdo);

    if ($updates === []) {
        return;
    }

    $assignments = [];
    $params = ['external_scan_id' => $externalScanId];
    foreach ($updates as $key => $value) {
        $assignments[] = $key . ' = :' . $key;
        $params[$key] = $value;
    }
    $assignments[] = 'updated_at = CURRENT_TIMESTAMP';

    $sql = 'UPDATE manuscript_plagiarism_scans SET ' . implode(', ', $assignments) . ' WHERE external_scan_id = :external_scan_id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}

function ajasti_handle_copyleaks_completed_webhook(PDO $pdo, array $payload): array
{
    ajasti_copyleaks_sdk_bootstrap();
    $webhook = \Copyleaks\CompletedWebhook::fromArray($payload);

    $score = $webhook->results?->score?->aggregatedScore;
    $internetResults = $webhook->results?->internet ?? [];
    $topMatches = [];
    foreach (array_slice($internetResults, 0, 5) as $result) {
        $topMatches[] = [
            'id' => $result->id,
            'title' => $result->title,
            'url' => $result->url,
            'view_url' => $result->scanViewUrl,
            'matched_words' => $result->matchedWords,
            'score' => $result->score,
        ];
    }

    ajasti_update_scan_row($pdo, $webhook->scanId, [
        'status' => 'completed',
        'similarity_score' => $score,
        'top_matches_json' => json_encode($topMatches, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'raw_response_json' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'completed_at' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        'last_error' => null,
    ]);

    $sync = $pdo->prepare(
        'UPDATE manuscripts m
         INNER JOIN manuscript_plagiarism_scans s ON s.manuscript_id = m.manuscript_id
         SET m.plagiarism_score = :score
         WHERE s.external_scan_id = :external_scan_id'
    );
    $sync->execute([
        'score' => is_numeric($score) ? (float) $score : 0.00,
        'external_scan_id' => $webhook->scanId,
    ]);

    return [
        'scan_id' => $webhook->scanId,
        'status' => 'completed',
        'score' => $score,
        'top_matches' => $topMatches,
    ];
}

function ajasti_handle_copyleaks_error_webhook(PDO $pdo, array $payload): array
{
    ajasti_copyleaks_sdk_bootstrap();
    $webhook = \Copyleaks\ErrorWebhook::fromArray($payload);
    $message = trim((string) ($webhook->error?->message ?? 'Copyleaks returned an error.'));

    ajasti_update_scan_row($pdo, $webhook->scanId, [
        'status' => 'error',
        'last_error' => $message,
        'raw_response_json' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);

    return [
        'scan_id' => $webhook->scanId,
        'status' => 'error',
        'message' => $message,
    ];
}

function ajasti_handle_copyleaks_status_webhook(PDO $pdo, array $payload, string $status): array
{
    ajasti_update_scan_row($pdo, (string) ($payload['scanId'] ?? ''), [
        'status' => $status,
        'raw_response_json' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);

    return [
        'scan_id' => (string) ($payload['scanId'] ?? ''),
        'status' => $status,
    ];
}
