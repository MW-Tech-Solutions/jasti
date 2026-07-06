<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();

try {
    $stmt = $pdo->query(
        'SELECT a.article_id, a.manuscript_id, a.doi, a.publication_date, a.article_url,
                m.title, m.abstract, m.article_type,
                COALESCE(am.downloads, 0) AS downloads,
                COALESCE(am.citations, 0) AS citations,
                COALESCE(am.altmetric_score, 0) AS altmetric_score
         FROM articles a
         INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
         LEFT JOIN (
             SELECT article_id,
                    SUM(COALESCE(downloads, 0)) AS downloads,
                    SUM(COALESCE(citations, 0)) AS citations,
                    MAX(COALESCE(altmetric_score, 0)) AS altmetric_score
             FROM article_metrics
             GROUP BY article_id
         ) am ON am.article_id = a.article_id
         WHERE m.status = "published"
         ORDER BY a.publication_date DESC, a.article_id DESC
         LIMIT 6'
    );

    ajasti_json([
        'articles' => $stmt->fetchAll(),
    ]);
} catch (Throwable $exception) {
    ajasti_json([
        'articles' => [],
        'message' => 'Published article data is not available yet.',
    ]);
}
