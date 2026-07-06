<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
jasti_ensure_manuscript_author_schema($pdo);
jasti_ensure_article_archive_schema($pdo);
$articleId = (int) ($_GET['article_id'] ?? 0);

if ($articleId <= 0) {
    jasti_json(['message' => 'A valid article identifier is required.'], 422);
}

try {
    $stmt = $pdo->prepare(
        'SELECT a.article_id, a.manuscript_id, a.doi, a.publication_date, a.article_url, a.page_numbers, a.introduction_text,
                m.title, m.abstract, m.article_type, m.keywords,
                i.issue_id, i.volume, i.issue_number, i.publication_year,
                j.journal_name, j.issn,
                COALESCE(am.downloads, 0) AS downloads,
                COALESCE(am.views, 0) AS views,
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
                ) AS author_names,
                (
                    SELECT mf.file_path
                    FROM manuscript_files mf
                    WHERE mf.manuscript_id = m.manuscript_id
                      AND mf.file_type IN ("revised_manuscript", "manuscript")
                    ORDER BY CASE WHEN LOWER(mf.file_path) LIKE "%.pdf" THEN 0 ELSE 1 END, mf.version DESC, mf.file_id DESC
                    LIMIT 1
                ) AS latest_file_path,
                (
                    SELECT mf.file_path
                    FROM manuscript_files mf
                    WHERE mf.manuscript_id = m.manuscript_id
                      AND mf.file_type IN ("revised_manuscript", "manuscript")
                      AND LOWER(mf.file_path) LIKE "%.pdf"
                    ORDER BY mf.version DESC, mf.file_id DESC
                    LIMIT 1
                ) AS pdf_path
         FROM articles a
         INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
         LEFT JOIN issues i ON i.issue_id = a.issue_id
         LEFT JOIN journals j ON j.journal_id = i.journal_id OR j.journal_id = m.journal_id
         LEFT JOIN (
             SELECT article_id,
                    SUM(COALESCE(downloads, 0)) AS downloads,
                    SUM(COALESCE(views, 0)) AS views,
                    SUM(COALESCE(citations, 0)) AS citations,
                    MAX(COALESCE(altmetric_score, 0)) AS altmetric_score
             FROM article_metrics
             GROUP BY article_id
         ) am ON am.article_id = a.article_id
         WHERE a.article_id = :article_id
           AND m.status = "published"
           AND COALESCE(a.archived, 0) = 0
         LIMIT 1'
    );
    $stmt->execute(['article_id' => $articleId]);
    $article = $stmt->fetch();
} catch (Throwable $exception) {
    jasti_json(['message' => 'Article detail data is not available yet.'], 503);
}

if (!$article) {
    jasti_json(['message' => 'Article not found.'], 404);
}

try {
    jasti_increment_article_metrics($pdo, $articleId, ['views' => 1]);
} catch (Throwable $exception) {
}

$keywords = array_values(array_filter(array_map('trim', explode(',', (string) ($article['keywords'] ?? '')))));
$authorNames = array_values(array_filter(array_map('trim', explode(',', (string) ($article['author_names'] ?? '')))));
$introduction = trim((string) ($article['introduction_text'] ?? ''));
$articleRoutePattern = '/^\/articles\/\d+$/i';
$articleUrl = trim((string) ($article['article_url'] ?? ''));
$latestFilePath = trim((string) ($article['latest_file_path'] ?? ''));
if ($articleUrl === '' || preg_match($articleRoutePattern, $articleUrl) === 1) {
    $articleUrl = $latestFilePath;
}
if ($introduction === '') {
    $introduction = 'This article is part of JASTI\'s published research archive. The introduction section can be populated during production while the published abstract and article files remain available to readers.';
}

jasti_json([
    'article' => [
        'article_id' => (int) $article['article_id'],
        'manuscript_id' => (int) $article['manuscript_id'],
        'title' => (string) ($article['title'] ?? ''),
        'abstract' => (string) ($article['abstract'] ?? ''),
        'introduction' => $introduction,
        'article_type' => (string) ($article['article_type'] ?? ''),
        'doi' => (string) ($article['doi'] ?? ''),
        'publication_date' => (string) ($article['publication_date'] ?? ''),
        'page_numbers' => (string) ($article['page_numbers'] ?? ''),
        'journal_name' => (string) ($article['journal_name'] ?? ''),
        'issn' => (string) ($article['issn'] ?? ''),
        'volume' => $article['volume'] !== null ? (int) $article['volume'] : null,
        'issue_number' => $article['issue_number'] !== null ? (int) $article['issue_number'] : null,
        'publication_year' => $article['publication_year'] !== null ? (int) $article['publication_year'] : null,
        'article_url' => $articleUrl,
        'pdf_path' => (string) ($article['pdf_path'] ?? ''),
        'downloads' => (int) ($article['downloads'] ?? 0),
        'views' => (int) ($article['views'] ?? 0) + 1,
        'citations' => (int) ($article['citations'] ?? 0),
        'altmetric_score' => (int) ($article['altmetric_score'] ?? 0),
        'authors' => $authorNames,
        'keywords' => $keywords,
    ],
]);
