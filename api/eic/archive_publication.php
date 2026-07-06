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
    jasti_json(['message' => 'Only administrators and the Editor-in-Chief can archive publications.'], 403);
}

$userId = (int) $user['user_id'];
$data = jasti_request_data();
$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$articleId = (int) ($data['article_id'] ?? 0);

if ($manuscriptId <= 0 && $articleId <= 0) {
    jasti_json(['message' => 'A manuscript or article identifier is required.'], 422);
}

$lookupSql = 'SELECT a.article_id, a.manuscript_id, COALESCE(a.archived, 0) AS archived, m.status
              FROM articles a
              INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
              WHERE ' . ($articleId > 0 ? 'a.article_id = :id' : 'a.manuscript_id = :id') . '
              LIMIT 1';
$stmt = $pdo->prepare($lookupSql);
$stmt->execute(['id' => $articleId > 0 ? $articleId : $manuscriptId]);
$article = $stmt->fetch();

if (!$article) {
    jasti_json(['message' => 'Published article not found.'], 404);
}
if (strtolower((string) ($article['status'] ?? '')) !== 'published') {
    jasti_json(['message' => 'Only published manuscripts can be archived.'], 422);
}
if ((int) ($article['archived'] ?? 0) === 1) {
    jasti_json(['message' => 'Publication is already archived.']);
}

$update = $pdo->prepare(
    'UPDATE articles
     SET archived = 1,
         archived_at = CURRENT_TIMESTAMP,
         archived_by = :archived_by
     WHERE article_id = :article_id'
);
$update->execute([
    'archived_by' => $userId,
    'article_id' => (int) $article['article_id'],
]);

jasti_log($pdo, $userId, 'archived publication', 'articles', (int) $article['article_id']);

jasti_json([
    'message' => 'Publication archived successfully. It remains preserved internally and is no longer public.',
    'article_id' => (int) $article['article_id'],
    'manuscript_id' => (int) $article['manuscript_id'],
]);
