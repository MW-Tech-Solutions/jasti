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
$finalDecision = trim((string) ($data['final_decision'] ?? ''));
$remarks = trim((string) ($data['remarks'] ?? ''));
if ($manuscriptId <= 0 || !in_array($finalDecision, ['accepted', 'rejected'], true)) {
    jasti_json(['message' => 'Manuscript and valid final decision are required.'], 422);
}

$manuscriptStmt = $pdo->prepare(
    'SELECT m.manuscript_id,
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
            ) AS corresponding_author_email
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

$stmt = $pdo->prepare(
    'INSERT INTO final_decisions (manuscript_id, editor_in_chief_id, final_decision, approval_date, remarks)
     VALUES (:manuscript_id, :editor_in_chief_id, :final_decision, CURRENT_TIMESTAMP, :remarks)'
);
$stmt->execute([
    'manuscript_id' => $manuscriptId,
    'editor_in_chief_id' => $userId,
    'final_decision' => $finalDecision,
    'remarks' => $remarks,
]);
$decisionId = (int) $pdo->lastInsertId();

$pdo->prepare('UPDATE manuscripts SET status = :status WHERE manuscript_id = :manuscript_id')->execute([
    'status' => $finalDecision === 'accepted' ? 'accepted' : 'rejected',
    'manuscript_id' => $manuscriptId,
]);

$emailSent = false;
$emailMessage = $finalDecision === 'accepted'
    ? 'The manuscript was accepted, but no author email is available for the payment notice.'
    : 'No payment email was sent because the manuscript was not accepted.';

if ($finalDecision === 'accepted') {
    $articleCheck = $pdo->prepare('SELECT article_id FROM articles WHERE manuscript_id = :manuscript_id LIMIT 1');
    $articleCheck->execute(['manuscript_id' => $manuscriptId]);
    if ($articleCheck->fetchColumn() === false) {
        $issueId = $pdo->query('SELECT issue_id FROM issues ORDER BY issue_id ASC LIMIT 1')->fetchColumn();
        $articleFileStmt = $pdo->prepare(
            'SELECT file_path
             FROM manuscript_files
             WHERE manuscript_id = :manuscript_id
               AND file_type IN ("revised_manuscript", "manuscript")
               AND LOWER(file_path) LIKE "%.pdf"
             ORDER BY version DESC, file_id DESC
             LIMIT 1'
        );
        $articleFileStmt->execute(['manuscript_id' => $manuscriptId]);
        $articleUrl = $articleFileStmt->fetchColumn();
        $articleStmt = $pdo->prepare(
            'INSERT INTO articles (manuscript_id, doi, issue_id, publication_date, article_url)
             VALUES (:manuscript_id, :doi, :issue_id, CURDATE(), :article_url)'
        );
        $articleStmt->execute([
            'manuscript_id' => $manuscriptId,
            'doi' => '10.0000/jasti.' . $manuscriptId,
            'issue_id' => $issueId !== false ? (int) $issueId : null,
            'article_url' => $articleUrl !== false ? (string) $articleUrl : null,
        ]);
        $articleId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO article_metrics (article_id, downloads, views, citations, altmetric_score, last_updated) VALUES (:article_id, 0, 0, 0, 0, CURRENT_TIMESTAMP)')
            ->execute(['article_id' => $articleId]);
    }

    $authorEmail = trim((string) ($manuscript['corresponding_author_email'] ?? ''));
    if ($authorEmail !== '' && filter_var($authorEmail, FILTER_VALIDATE_EMAIL) !== false) {
        $emailMessage = 'A payment notice email was sent to the corresponding author.';
        try {
            jasti_send_manuscript_payment_request_email(
                $authorEmail,
                trim((string) ($manuscript['corresponding_author_name'] ?? '')),
                [
                    'title' => (string) ($manuscript['title'] ?? ''),
                    'reference_number' => (string) ($manuscript['reference_number'] ?? ''),
                    'journal_name' => (string) ($manuscript['journal_name'] ?? 'JASTI'),
                    'decision_date' => date('F j, Y \a\t g:i A T'),
                    'remarks' => $remarks,
                    'author_login_link' => jasti_dashboard_action_url('author', 'metrics'),
                ]
            );
            $emailSent = true;
        } catch (Throwable $exception) {
            $emailMessage = 'The manuscript was accepted, but the payment notice email could not be sent right now.';
            error_log(sprintf('Manuscript acceptance payment email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
        }
    }
}

jasti_log($pdo, $userId, 'recorded final decision', 'final_decisions', $decisionId);
jasti_json([
    'message' => 'Final decision recorded successfully.',
    'email_sent' => $emailSent,
    'email_message' => $emailMessage,
]);
