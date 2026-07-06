<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
jasti_ensure_article_archive_schema($pdo);
$articleId = (int) ($_GET['article_id'] ?? 0);
$target = strtolower(trim((string) ($_GET['target'] ?? 'pdf')));
$disposition = strtolower(trim((string) ($_GET['disposition'] ?? 'inline')));

if ($articleId <= 0 || !in_array($target, ['pdf', 'article'], true) || !in_array($disposition, ['inline', 'attachment'], true)) {
    jasti_json(['message' => 'A valid article and download target are required.'], 422);
}

try {
    $stmt = $pdo->prepare(
        'SELECT a.article_id, m.title, a.article_url,
                (
                    SELECT mf.file_path
                    FROM manuscript_files mf
                    WHERE mf.manuscript_id = a.manuscript_id
                      AND mf.file_type IN ("revised_manuscript", "manuscript")
                    ORDER BY CASE WHEN LOWER(mf.file_path) LIKE "%.pdf" THEN 0 ELSE 1 END, mf.version DESC, mf.file_id DESC
                    LIMIT 1
                ) AS latest_file_path,
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
           AND COALESCE(a.archived, 0) = 0
         LIMIT 1'
    );
    $stmt->execute(['article_id' => $articleId]);
    $article = $stmt->fetch();
} catch (Throwable $exception) {
    jasti_json(['message' => 'Article download is not available yet.'], 503);
}

if (!$article) {
    jasti_json(['message' => 'Article not found.'], 404);
}

$pdfPath = trim((string) ($article['pdf_path'] ?? ''));
$articlePath = trim((string) ($article['article_url'] ?? ''));
$latestFilePath = trim((string) ($article['latest_file_path'] ?? ''));
$articleRoutePattern = '/^\/articles\/\d+$/i';
if ($articlePath === '' || preg_match($articleRoutePattern, $articlePath) === 1) {
    $articlePath = $latestFilePath;
}

if ($target === 'article') {
    $downloadPath = $articlePath !== '' && preg_match($articleRoutePattern, $articlePath) !== 1
        ? $articlePath
        : $pdfPath;
} else {
    $downloadPath = $pdfPath !== '' ? $pdfPath : $articlePath;
}

$redirectUrl = jasti_public_asset_url($downloadPath);
if ($redirectUrl === '') {
    jasti_json(['message' => 'No downloadable file is available for this article yet.'], 404);
}

try {
    jasti_increment_article_metrics($pdo, $articleId, ['downloads' => 1]);
} catch (Throwable $exception) {
}

if ($disposition === 'attachment' && preg_match('/^https?:\/\//i', $downloadPath) !== 1) {
    $relativePath = (string) (parse_url($downloadPath, PHP_URL_PATH) ?: $downloadPath);
    $absolutePath = jasti_root_path('.' . $relativePath);

    if (is_file($absolutePath) && is_readable($absolutePath)) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        $extension = strtolower((string) pathinfo($absolutePath, PATHINFO_EXTENSION));
        $safeTitle = preg_replace('/[^A-Za-z0-9._-]+/', '-', trim((string) ($article['title'] ?? 'article'))) ?: 'article';
        $downloadName = $safeTitle . ($extension !== '' ? '.' . $extension : '');
        $mimeType = mime_content_type($absolutePath) ?: 'application/octet-stream';

        http_response_code(200);
        header_remove('Content-Type');
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . (string) filesize($absolutePath));
        header('Content-Disposition: attachment; filename="' . addslashes($downloadName) . '"');
        header('Cache-Control: private, max-age=0, must-revalidate');
        readfile($absolutePath);
        exit;
    }
}

http_response_code(302);
header('Location: ' . $redirectUrl);
exit;
