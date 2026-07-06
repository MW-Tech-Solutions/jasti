<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
$articleId = (int) ($_GET['article_id'] ?? 0);
$target = strtolower(trim((string) ($_GET['target'] ?? 'pdf')));

if ($articleId <= 0 || !in_array($target, ['pdf', 'article'], true)) {
    ajasti_json(['message' => 'A valid article and download target are required.'], 422);
}

try {
    $stmt = $pdo->prepare(
        'SELECT a.article_id, a.article_url,
                (
                    SELECT mf.file_path
                    FROM manuscript_files mf
                    WHERE mf.manuscript_id = a.manuscript_id
                      AND mf.file_type IN ("revised_manuscript", "manuscript")
                      AND LOWER(mf.file_path) LIKE "%.pdf"
                    ORDER BY mf.version DESC, mf.file_id DESC
                    LIMIT 1
                ) AS pdf_path
         FROM articles a
         INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
         WHERE a.article_id = :article_id
           AND m.status = "published"
         LIMIT 1'
    );
    $stmt->execute(['article_id' => $articleId]);
    $article = $stmt->fetch();
} catch (Throwable $exception) {
    ajasti_json(['message' => 'Article download is not available yet.'], 503);
}

if (!$article) {
    ajasti_json(['message' => 'Article not found.'], 404);
}

$pdfPath = trim((string) ($article['pdf_path'] ?? ''));
$articlePath = trim((string) ($article['article_url'] ?? ''));
$articleRoutePattern = '/^\/articles\/\d+$/i';

if ($target === 'article') {
    $downloadPath = $articlePath !== '' && preg_match($articleRoutePattern, $articlePath) !== 1
        ? $articlePath
        : $pdfPath;
} else {
    $downloadPath = $pdfPath !== '' ? $pdfPath : $articlePath;
}

$redirectUrl = ajasti_public_asset_url($downloadPath);
if ($redirectUrl === '') {
    ajasti_json(['message' => 'No downloadable file is available for this article yet.'], 404);
}

try {
    ajasti_increment_article_metrics($pdo, $articleId, ['downloads' => 1]);
} catch (Throwable $exception) {
}

http_response_code(302);
header('Location: ' . $redirectUrl);
exit;
