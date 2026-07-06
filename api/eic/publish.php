<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
jasti_ensure_manuscript_author_schema($pdo);
$user = jasti_require_role($pdo, 'editor_in_chief');
$userId = (int) $user['user_id'];
$data = jasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$pageNumbers = trim((string) ($data['page_numbers'] ?? ''));
if ($manuscriptId <= 0 || $pageNumbers === '') {
    jasti_json(['message' => 'Manuscript and page numbers are required.'], 422);
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

$currentStatus = strtolower((string) ($manuscript['status'] ?? ''));
if ($currentStatus === 'published') {
    jasti_json(['message' => 'This manuscript has already been published.'], 409);
}
if (!in_array($currentStatus, ['accepted', 'production'], true)) {
    jasti_json(['message' => 'Only accepted or production manuscripts can be published.'], 422);
}

$issue = $pdo->query(
    'SELECT issue_id, volume, issue_number, publication_year
     FROM issues
     ORDER BY publication_year DESC, volume DESC, issue_number DESC, issue_id DESC
     LIMIT 1'
)->fetch();
if (!$issue) {
    jasti_json(['message' => 'No issue is available yet. Create an issue first from Manage Issues before publishing.'], 422);
}
$issueId = (int) $issue['issue_id'];

$articleCheck = $pdo->prepare(
    'SELECT article_id, doi, publication_date
     FROM articles
     WHERE manuscript_id = :manuscript_id
     LIMIT 1'
);
$articleCheck->execute(['manuscript_id' => $manuscriptId]);
$existingArticle = $articleCheck->fetch();
$articleFileStmt = $pdo->prepare(
    'SELECT file_path
     FROM manuscript_files
     WHERE manuscript_id = :manuscript_id
       AND file_type = "publication_pdf"
       AND LOWER(file_path) LIKE "%.pdf"
     ORDER BY version DESC, file_id DESC
     LIMIT 1'
);
$articleFileStmt->execute(['manuscript_id' => $manuscriptId]);
$articleUrl = $articleFileStmt->fetchColumn();
if ($articleUrl === false || trim((string) $articleUrl) === '') {
    jasti_json(['message' => 'The Technical Editor must upload the approved final PDF before publication.'], 422);
}
$doi = '10.0000/jasti.' . $manuscriptId;
$publicationDate = date('Y-m-d');

if (!$existingArticle) {
    $articleInsert = $pdo->prepare(
        'INSERT INTO articles (manuscript_id, doi, issue_id, publication_date, page_numbers, article_url)
         VALUES (:manuscript_id, :doi, :issue_id, CURDATE(), :page_numbers, :article_url)'
    );
    $articleInsert->execute([
        'manuscript_id' => $manuscriptId,
        'doi' => $doi,
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
    $articleId = (int) ($existingArticle['article_id'] ?? 0);
    $doi = trim((string) ($existingArticle['doi'] ?? '')) !== '' ? (string) $existingArticle['doi'] : $doi;
    $publicationDate = trim((string) ($existingArticle['publication_date'] ?? '')) !== ''
        ? (string) $existingArticle['publication_date']
        : $publicationDate;
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

jasti_log($pdo, $userId, 'published manuscript', 'manuscripts', $manuscriptId);

$issueLabelParts = [];
if (($issue['volume'] ?? null) !== null) {
    $issueLabelParts[] = 'Vol. ' . (int) $issue['volume'];
}
if (($issue['issue_number'] ?? null) !== null) {
    $issueLabelParts[] = 'No. ' . (int) $issue['issue_number'];
}
if (($issue['publication_year'] ?? null) !== null) {
    $issueLabelParts[] = (string) (int) $issue['publication_year'];
}
$issueLabel = implode(', ', $issueLabelParts);

$emailSent = false;
$emailMessage = 'The manuscript was published, but no author email is available for a publication notice.';
$authorEmail = trim((string) ($manuscript['corresponding_author_email'] ?? ''));
if ($authorEmail !== '' && filter_var($authorEmail, FILTER_VALIDATE_EMAIL) !== false) {
    $emailMessage = 'A publication email was sent to the corresponding author.';
    try {
        jasti_send_manuscript_published_email(
            $authorEmail,
            trim((string) ($manuscript['corresponding_author_name'] ?? '')),
            [
                'title' => (string) ($manuscript['title'] ?? ''),
                'reference_number' => (string) ($manuscript['reference_number'] ?? ''),
                'journal_name' => (string) ($manuscript['journal_name'] ?? 'JASTI'),
                'issue_label' => $issueLabel,
                'publication_date' => date('F j, Y', strtotime($publicationDate) ?: time()),
                'page_numbers' => $pageNumbers,
                'doi' => $doi,
                'article_link' => jasti_frontend_url('articles/' . $articleId),
                'pdf_link' => jasti_backend_url('api/public/download.php?article_id=' . $articleId . '&target=pdf'),
            ]
        );
        $emailSent = true;
    } catch (Throwable $exception) {
        $emailMessage = 'The manuscript was published, but the publication email could not be sent right now.';
        error_log(sprintf('Manuscript publication email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
    }
}

jasti_json([
    'message' => 'Manuscript published successfully.',
    'manuscript_id' => $manuscriptId,
    'article_id' => $articleId,
    'email_sent' => $emailSent,
    'email_message' => $emailMessage,
]);
