<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
jasti_ensure_article_archive_schema($pdo);
$user = jasti_require_auth($pdo);
$roles = $user['roles'] ?? [];
if (!in_array('admin', $roles, true) && !in_array('editor_in_chief', $roles, true)) {
    jasti_json(['message' => 'Only administrators and the Editor-in-Chief can edit publications.'], 403);
}

$data = jasti_request_data();
$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$articleId = (int) ($data['article_id'] ?? 0);
$title = trim((string) ($data['title'] ?? ''));
$referenceNumber = trim((string) ($data['reference_number'] ?? ''));
$publicationDate = trim((string) ($data['publication_date'] ?? ''));

if ($manuscriptId <= 0 && $articleId <= 0) {
    jasti_json(['message' => 'A manuscript or article identifier is required.'], 422);
}
if ($title === '' || $referenceNumber === '') {
    jasti_json(['message' => 'Author publication title and reference number are required.'], 422);
}

if ($articleId > 0) {
    $lookupSql = 'SELECT a.article_id, a.manuscript_id, m.status
                  FROM articles a
                  INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
                  WHERE a.article_id = :id
                  LIMIT 1';
    $stmt = $pdo->prepare($lookupSql);
    $stmt->execute(['id' => $articleId]);
    $row = $stmt->fetch();
    if (!$row) {
        jasti_json(['message' => 'Published article not found.'], 404);
    }
    $manuscriptId = (int) $row['manuscript_id'];
} else {
    $lookupSql = 'SELECT m.manuscript_id, m.status, a.article_id
                  FROM manuscripts m
                  LEFT JOIN articles a ON a.manuscript_id = m.manuscript_id
                  WHERE m.manuscript_id = :id
                  LIMIT 1';
    $stmt = $pdo->prepare($lookupSql);
    $stmt->execute(['id' => $manuscriptId]);
    $row = $stmt->fetch();
    if (!$row) {
        jasti_json(['message' => 'Manuscript not found.'], 404);
    }
    $articleId = $row['article_id'] ? (int) $row['article_id'] : 0;
}

$manuscriptId = (int) $row['manuscript_id'];
$status = strtolower((string) ($row['status'] ?? ''));

if ($status === 'published' || $articleId > 0) {
    if ($publicationDate === '') {
        jasti_json(['message' => 'Publication date is required for published articles.'], 422);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $publicationDate)) {
        jasti_json(['message' => 'Publication date must use YYYY-MM-DD format.'], 422);
    }
}

$duplicateStmt = $pdo->prepare(
    'SELECT manuscript_id
     FROM manuscripts
     WHERE reference_number = :reference_number
       AND manuscript_id <> :manuscript_id
     LIMIT 1'
);
$duplicateStmt->execute([
    'reference_number' => $referenceNumber,
    'manuscript_id' => $manuscriptId,
]);
if ($duplicateStmt->fetch()) {
    jasti_json(['message' => 'Another manuscript already uses this reference number.'], 409);
}

try {
    $pdo->beginTransaction();

    $manuscriptUpdate = $pdo->prepare(
        'UPDATE manuscripts
         SET title = :title,
             reference_number = :reference_number
         WHERE manuscript_id = :manuscript_id'
    );
    $manuscriptUpdate->execute([
        'title' => $title,
        'reference_number' => $referenceNumber,
        'manuscript_id' => $manuscriptId,
    ]);

    if ($articleId > 0) {
        $articleUpdate = $pdo->prepare(
            'UPDATE articles
             SET publication_date = :publication_date
             WHERE article_id = :article_id'
        );
        $articleUpdate->execute([
            'publication_date' => $publicationDate,
            'article_id' => $articleId,
        ]);
    }

    jasti_log($pdo, (int) $user['user_id'], 'updated publication', 'articles', $articleId > 0 ? $articleId : $manuscriptId);
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('JASTI publication update failed: ' . $exception->getMessage());
    jasti_json(['message' => 'Unable to update publication.'], 500);
}

jasti_json([
    'message' => 'Publication updated successfully.',
    'article_id' => $articleId,
    'manuscript_id' => $manuscriptId,
]);
