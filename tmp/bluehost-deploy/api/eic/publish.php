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
$pageNumbers = trim((string) ($data['page_numbers'] ?? ''));
if ($manuscriptId <= 0 || $pageNumbers === '') {
    ajasti_json(['message' => 'Manuscript and page numbers are required.'], 422);
}

$manuscriptStmt = $pdo->prepare(
    'SELECT manuscript_id, status
     FROM manuscripts
     WHERE manuscript_id = :manuscript_id
     LIMIT 1'
);
$manuscriptStmt->execute(['manuscript_id' => $manuscriptId]);
$manuscript = $manuscriptStmt->fetch();
if (!$manuscript) {
    ajasti_json(['message' => 'Manuscript not found.'], 404);
}

$currentStatus = strtolower((string) ($manuscript['status'] ?? ''));
if ($currentStatus === 'published') {
    ajasti_json(['message' => 'This manuscript has already been published.'], 409);
}
if (!in_array($currentStatus, ['accepted', 'production'], true)) {
    ajasti_json(['message' => 'Only accepted or production manuscripts can be published.'], 422);
}

$issueId = $pdo->query(
    'SELECT issue_id
     FROM issues
     ORDER BY publication_year DESC, volume DESC, issue_number DESC, issue_id DESC
     LIMIT 1'
)->fetchColumn();
if ($issueId === false) {
    ajasti_json(['message' => 'No issue is available yet. Create an issue first from Manage Issues before publishing.'], 422);
}
$issueId = (int) $issueId;

$articleCheck = $pdo->prepare(
    'SELECT article_id
     FROM articles
     WHERE manuscript_id = :manuscript_id
     LIMIT 1'
);
$articleCheck->execute(['manuscript_id' => $manuscriptId]);
$articleId = $articleCheck->fetchColumn();
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

if ($articleId === false) {
    $articleInsert = $pdo->prepare(
        'INSERT INTO articles (manuscript_id, doi, issue_id, publication_date, page_numbers, article_url)
         VALUES (:manuscript_id, :doi, :issue_id, CURDATE(), :page_numbers, :article_url)'
    );
    $articleInsert->execute([
        'manuscript_id' => $manuscriptId,
        'doi' => '10.0000/ajasti.' . $manuscriptId,
        'issue_id' => $issueId,
        'page_numbers' => $pageNumbers,
        'article_url' => $articleUrl !== false ? (string) $articleUrl : null,
    ]);
    $articleId = (int) $pdo->lastInsertId();

    $pdo->prepare(
        'INSERT INTO article_metrics (article_id, downloads, views, citations, altmetric_score, last_updated)
         VALUES (:article_id, 0, 0, 0, 0, CURRENT_TIMESTAMP)'
    )->execute(['article_id' => $articleId]);
} else {
    $articleId = (int) $articleId;
    $pdo->prepare(
        'UPDATE articles
         SET issue_id = :issue_id,
             page_numbers = :page_numbers,
             article_url = COALESCE(:article_url, article_url),
             publication_date = COALESCE(publication_date, CURDATE())
         WHERE article_id = :article_id'
    )->execute([
        'issue_id' => $issueId,
        'page_numbers' => $pageNumbers,
        'article_url' => $articleUrl !== false ? (string) $articleUrl : null,
        'article_id' => $articleId,
    ]);
}

$pdo->prepare(
    'UPDATE manuscripts
     SET status = "published"
     WHERE manuscript_id = :manuscript_id'
)->execute(['manuscript_id' => $manuscriptId]);

ajasti_log($pdo, $userId, 'published manuscript', 'manuscripts', $manuscriptId);
ajasti_json([
    'message' => 'Manuscript published successfully.',
    'manuscript_id' => $manuscriptId,
    'article_id' => $articleId,
]);
