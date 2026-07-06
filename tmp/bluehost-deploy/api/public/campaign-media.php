<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => 'Media id is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT mime_type, bytes, filename FROM campaign_media WHERE media_id = :id LIMIT 1');
$stmt->execute(['id' => $id]);
$row = $stmt->fetch();

if (!$row || empty($row['bytes'])) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => 'Media not found.']);
    exit;
}

$mime = trim((string) ($row['mime_type'] ?? 'application/octet-stream')) ?: 'application/octet-stream';
$filename = (string) ($row['filename'] ?? 'media');

header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=86400');
header('Content-Disposition: inline; filename="' . addslashes($filename) . '"');

echo $row['bytes'];

