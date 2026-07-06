<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'editor_in_chief');
$userId = (int) $user['user_id'];
$data = jasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
if ($manuscriptId <= 0) {
    jasti_json(['message' => 'A valid manuscript is required.'], 422);
}

$manuscriptStmt = $pdo->prepare(
    'SELECT m.manuscript_id,
            m.status,
            m.title,
            m.reference_number,
            COALESCE(j.journal_name, "JASTI") AS journal_name,
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, ""))), ""),
                (
                    SELECT NULLIF(TRIM(ma.author_name), "")
                    FROM manuscript_authors ma
                    WHERE ma.manuscript_id = m.manuscript_id
                      AND ma.is_corresponding = 1
                    ORDER BY ma.author_order ASC, ma.id ASC
                    LIMIT 1
                ),
                NULLIF(TRIM(COALESCE(u.email, "")), ""),
                (
                    SELECT NULLIF(TRIM(ma.author_email), "")
                    FROM manuscript_authors ma
                    WHERE ma.manuscript_id = m.manuscript_id
                      AND ma.is_corresponding = 1
                    ORDER BY ma.author_order ASC, ma.id ASC
                    LIMIT 1
                )
            ) AS corresponding_author_name,
            COALESCE(
                NULLIF(TRIM(COALESCE(u.email, "")), ""),
                (
                    SELECT NULLIF(TRIM(ma.author_email), "")
                    FROM manuscript_authors ma
                    WHERE ma.manuscript_id = m.manuscript_id
                      AND ma.is_corresponding = 1
                    ORDER BY ma.author_order ASC, ma.id ASC
                    LIMIT 1
                )
            ) AS corresponding_author_email,
            EXISTS(
                SELECT 1
                FROM manuscript_payments mp
                WHERE mp.manuscript_id = m.manuscript_id
                  AND mp.payment_status IN ("confirmed", "reviewed")
            ) AS payment_completed
     FROM manuscripts m
     LEFT JOIN users u ON u.user_id = m.corresponding_author_id
     LEFT JOIN journals j ON j.journal_id = m.journal_id
     WHERE m.manuscript_id = :manuscript_id
     LIMIT 1'
);
$manuscriptStmt->execute(['manuscript_id' => $manuscriptId]);
$manuscript = $manuscriptStmt->fetch();
if (!$manuscript) {
    jasti_json(['message' => 'Manuscript not found.'], 404);
}

$status = strtolower(trim((string) ($manuscript['status'] ?? '')));
if (!in_array($status, ['accepted', 'production'], true)) {
    jasti_json(['message' => 'Payment reminders can only be sent for accepted manuscripts awaiting publication.'], 422);
}

if ((int) ($manuscript['payment_completed'] ?? 0) === 1) {
    jasti_json(['message' => 'Payment is already recorded for this manuscript.'], 409);
}

$authorEmail = trim((string) ($manuscript['corresponding_author_email'] ?? ''));
if ($authorEmail === '' || filter_var($authorEmail, FILTER_VALIDATE_EMAIL) === false) {
    jasti_json(['message' => 'No valid corresponding author email is available for this manuscript.'], 422);
}

try {
    jasti_send_manuscript_payment_request_email(
        $authorEmail,
        trim((string) ($manuscript['corresponding_author_name'] ?? '')),
        [
            'title' => (string) ($manuscript['title'] ?? ''),
            'reference_number' => (string) ($manuscript['reference_number'] ?? ''),
            'journal_name' => (string) ($manuscript['journal_name'] ?? 'JASTI'),
            'decision_date' => date('F j, Y \a\t g:i A T'),
            'author_login_link' => jasti_dashboard_action_url('author', 'metrics'),
        ],
        true
    );
} catch (Throwable $exception) {
    error_log(sprintf('Manuscript payment reminder email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
    jasti_json(['message' => 'The reminder could not be sent right now.'], 500);
}

jasti_log($pdo, $userId, 'sent manuscript payment reminder', 'manuscripts', $manuscriptId);
jasti_json(['message' => 'Payment reminder email sent successfully.']);
