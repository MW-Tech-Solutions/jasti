<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
jasti_ensure_manuscript_author_schema($pdo);
jasti_ensure_article_archive_schema($pdo);
$requestedLimit = isset($_GET['limit']) ? (int) $_GET['limit'] : 6;
$limit = $requestedLimit > 0 ? min($requestedLimit, 200) : 6;

try {
    $stmt = $pdo->query(
        'SELECT a.article_id, a.manuscript_id, a.doi, a.publication_date, a.article_url,
                m.title, m.abstract, m.article_type, m.keywords,
                COALESCE(j.journal_name, "JASTI") AS journal_name,
                COALESCE(am.views, 0) AS views,
                COALESCE(am.downloads, 0) AS downloads,
                COALESCE(am.citations, 0) AS citations,
                COALESCE(am.altmetric_score, 0) AS altmetric_score,
                (
                    SELECT GROUP_CONCAT(
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, ""))), ""),
                            NULLIF(TRIM(COALESCE(ma.author_name, "")), ""),
                            NULLIF(TRIM(COALESCE(ma.author_email, "")), "")
                        )
                        ORDER BY ma.author_order SEPARATOR ", "
                    )
                    FROM manuscript_authors ma
                    LEFT JOIN users u ON u.user_id = ma.author_id
                    WHERE ma.manuscript_id = m.manuscript_id
                ) AS author_names
         FROM articles a
         INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
         LEFT JOIN issues i ON i.issue_id = a.issue_id
         LEFT JOIN journals j ON j.journal_id = i.journal_id OR j.journal_id = m.journal_id
         LEFT JOIN (
             SELECT article_id,
                    SUM(COALESCE(views, 0)) AS views,
                    SUM(COALESCE(downloads, 0)) AS downloads,
                    SUM(COALESCE(citations, 0)) AS citations,
                    MAX(COALESCE(altmetric_score, 0)) AS altmetric_score
             FROM article_metrics
             GROUP BY article_id
         ) am ON am.article_id = a.article_id
         WHERE m.status = "published"
           AND COALESCE(a.archived, 0) = 0
         ORDER BY a.publication_date DESC, a.article_id DESC
         LIMIT ' . $limit
    );

    $rows = $stmt->fetchAll();
    $articles = array_map(static function (array $row): array {
        $authors = array_values(array_filter(array_map('trim', explode(',', (string) ($row['author_names'] ?? '')))));

        return [
            'article_id' => (int) ($row['article_id'] ?? 0),
            'manuscript_id' => (int) ($row['manuscript_id'] ?? 0),
            'title' => (string) ($row['title'] ?? ''),
            'abstract' => (string) ($row['abstract'] ?? ''),
            'article_type' => (string) ($row['article_type'] ?? ''),
            'doi' => (string) ($row['doi'] ?? ''),
            'publication_date' => (string) ($row['publication_date'] ?? ''),
            'article_url' => (string) ($row['article_url'] ?? ''),
            'journal_name' => (string) ($row['journal_name'] ?? ''),
            'keywords' => (string) ($row['keywords'] ?? ''),
            'views' => (int) ($row['views'] ?? 0),
            'downloads' => (int) ($row['downloads'] ?? 0),
            'citations' => (int) ($row['citations'] ?? 0),
            'altmetric_score' => (int) ($row['altmetric_score'] ?? 0),
            'authors' => $authors,
        ];
    }, $rows);

    jasti_json([
        'articles' => $articles,
    ]);
} catch (Throwable $exception) {
    jasti_json([
        'articles' => [],
        'message' => 'Published article data is not available yet.',
    ]);
}
