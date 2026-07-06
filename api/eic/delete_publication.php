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
    jasti_json(['message' => 'Only administrators and the Editor-in-Chief can delete publications.'], 403);
}

$data = jasti_request_data();
$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$articleId = (int) ($data['article_id'] ?? 0);

if ($manuscriptId <= 0 && $articleId <= 0) {
    jasti_json(['message' => 'A manuscript or article identifier is required.'], 422);
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

function jasti_publication_delete_files(PDO $pdo, int $manuscriptId): void
{
    $paths = [];

    foreach ([
        ['table' => 'manuscript_files', 'column' => 'file_path'],
        ['table' => 'manuscript_payments', 'column' => 'proof_file_path'],
        ['table' => 'copyright_forms', 'column' => 'signed_file_path'],
        ['table' => 'technical_screenings', 'column' => 'anonymized_file_path'],
    ] as $source) {
        if (!jasti_table_exists($pdo, $source['table']) || !jasti_column_exists($pdo, $source['table'], $source['column'])) {
            continue;
        }

        $fileStmt = $pdo->prepare(sprintf(
            'SELECT %s AS file_path FROM %s WHERE manuscript_id = :manuscript_id',
            $source['column'],
            $source['table']
        ));
        $fileStmt->execute(['manuscript_id' => $manuscriptId]);
        foreach ($fileStmt->fetchAll() as $row) {
            $path = trim((string) ($row['file_path'] ?? ''));
            if ($path !== '') {
                $paths[] = $path;
            }
        }
    }

    $apiRoot = realpath(__DIR__ . '/..');
    if ($apiRoot === false) {
        return;
    }

    foreach (array_unique($paths) as $path) {
        if (preg_match('/^https?:\/\//i', $path)) {
            continue;
        }

        $relativePath = preg_replace('/^\/?api\//i', '', $path);
        $relativePath = preg_replace('/^\/+/', '', (string) $relativePath);
        if ($relativePath === '' || str_contains($relativePath, '..')) {
            continue;
        }

        $absolutePath = realpath($apiRoot . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath));
        if ($absolutePath === false || !str_starts_with($absolutePath, $apiRoot) || !is_file($absolutePath)) {
            continue;
        }

        @unlink($absolutePath);
    }
}

function jasti_delete_publication_table_rows(PDO $pdo, string $table, string $column, int $id): void
{
    if (!jasti_table_exists($pdo, $table) || !jasti_column_exists($pdo, $table, $column)) {
        return;
    }

    $stmt = $pdo->prepare(sprintf('DELETE FROM %s WHERE %s = :id', $table, $column));
    $stmt->execute(['id' => $id]);
}

try {
    $pdo->beginTransaction();

    jasti_publication_delete_files($pdo, $manuscriptId);

    jasti_delete_publication_table_rows($pdo, 'article_metrics', 'article_id', $articleId);
    jasti_delete_publication_table_rows($pdo, 'articles', 'article_id', $articleId);

    foreach ([
        'copyright_forms',
        'manuscript_payments',
        'messages',
        'final_decisions',
        'editor_decisions',
        'reviews',
        'review_invitations',
        'editor_assignments',
        'revisions',
        'technical_screenings',
        'manuscript_plagiarism_scans',
        'manuscript_authors',
        'manuscript_files',
    ] as $table) {
        jasti_delete_publication_table_rows($pdo, $table, 'manuscript_id', $manuscriptId);
    }

    if (jasti_table_exists($pdo, 'system_logs')) {
        $logStmt = $pdo->prepare(
            'DELETE FROM system_logs
             WHERE (entity_type IN ("articles", "article_metrics") AND entity_id = :article_id)
                OR (entity_type IN ("manuscripts", "manuscript_files", "manuscript_payments", "copyright_forms", "final_decisions", "editor_decisions", "reviews", "review_invitations", "editor_assignments", "revisions", "technical_screenings", "manuscript_plagiarism_scans") AND entity_id = :manuscript_id)'
        );
        $logStmt->execute([
            'article_id' => $articleId,
            'manuscript_id' => $manuscriptId,
        ]);
    }

    jasti_delete_publication_table_rows($pdo, 'manuscripts', 'manuscript_id', $manuscriptId);

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('JASTI publication delete failed: ' . $exception->getMessage());
    jasti_json(['message' => 'Unable to delete publication and related records.'], 500);
}

jasti_json([
    'message' => 'Publication and all related records were deleted successfully.',
    'article_id' => $articleId,
    'manuscript_id' => $manuscriptId,
]);
