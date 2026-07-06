<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'editor_in_chief');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$finalDecision = trim((string) ($data['final_decision'] ?? ''));
$remarks = trim((string) ($data['remarks'] ?? ''));
if ($manuscriptId <= 0 || !in_array($finalDecision, ['accepted', 'rejected'], true)) {
    ajasti_json(['message' => 'Manuscript and valid final decision are required.'], 422);
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

$pdo->prepare('UPDATE manuscripts SET status = :status WHERE manuscript_id = :manuscript_id')->execute([
    'status' => $finalDecision === 'accepted' ? 'accepted' : 'rejected',
    'manuscript_id' => $manuscriptId,
]);

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
            'doi' => '10.0000/ajasti.' . $manuscriptId,
            'issue_id' => $issueId !== false ? (int) $issueId : null,
            'article_url' => $articleUrl !== false ? (string) $articleUrl : null,
        ]);
        $articleId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO article_metrics (article_id, downloads, views, citations, altmetric_score, last_updated) VALUES (:article_id, 0, 0, 0, 0, CURRENT_TIMESTAMP)')
            ->execute(['article_id' => $articleId]);
    }
}

$decisionId = (int) $pdo->lastInsertId();
ajasti_log($pdo, $userId, 'recorded final decision', 'final_decisions', $decisionId);
ajasti_json(['message' => 'Final decision recorded successfully.']);
