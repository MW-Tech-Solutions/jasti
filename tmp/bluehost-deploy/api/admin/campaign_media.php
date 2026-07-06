<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
ajasti_require_role($pdo, 'admin');

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    ajasti_json(['message' => 'File is required.'], 422);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    ajasti_json(['message' => ajasti_upload_error_message((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE))], 422);
}

$maxBytes = (int) ajasti_env('MAX_UPLOAD_SIZE_BYTES', '10485760');
if ((int) ($file['size'] ?? 0) <= 0) {
    ajasti_json(['message' => 'Empty upload.'], 422);
}
if ((int) $file['size'] > $maxBytes) {
    ajasti_json(['message' => 'File size exceeds limit.'], 422);
}

$tmp = (string) ($file['tmp_name'] ?? '');
if ($tmp === '' || !is_file($tmp)) {
    ajasti_json(['message' => 'Upload temp file is missing.'], 422);
}

$bytes = file_get_contents($tmp);
if ($bytes === false) {
    ajasti_json(['message' => 'Unable to read uploaded file.'], 500);
}

$filename = trim((string) ($_POST['filename'] ?? ''));
$altText = trim((string) ($_POST['alt_text'] ?? ''));
$mediaType = trim((string) ($_POST['media_type'] ?? 'image'));
$originalName = trim((string) ($file['name'] ?? ''));
$mime = trim((string) ($_POST['mime_type'] ?? ''));
if ($mime === '') {
    $mime = trim((string) ($file['type'] ?? 'application/octet-stream'));
}

if ($filename === '') {
    // normalize: keep extension if present
    $filename = preg_replace('/[^A-Za-z0-9._-]+/', '-', strtolower($originalName)) ?: ('media-' . time());
}

$mediaId = isset($_POST['media_id']) ? (int) $_POST['media_id'] : 0;

if (!in_array($mediaType, ['image', 'file'], true)) {
    ajasti_json(['message' => 'Invalid media_type.'], 422);
}

if ($mediaId > 0) {
    $stmt = $pdo->prepare(
        'UPDATE campaign_media
         SET media_type = :media_type,
             filename = :filename,
             original_name = :original_name,
             mime_type = :mime_type,
             byte_size = :byte_size,
             bytes = :bytes,
             alt_text = :alt_text
         WHERE media_id = :media_id'
    );
    $stmt->execute([
        'media_type' => $mediaType,
        'filename' => $filename,
        'original_name' => $originalName,
        'mime_type' => $mime,
        'byte_size' => (int) $file['size'],
        'bytes' => $bytes,
        'alt_text' => $altText,
        'media_id' => $mediaId,
    ]);
} else {
    $stmt = $pdo->prepare(
        'INSERT INTO campaign_media (media_type, filename, original_name, mime_type, byte_size, bytes, alt_text)
         VALUES (:media_type, :filename, :original_name, :mime_type, :byte_size, :bytes, :alt_text)'
    );
    $stmt->execute([
        'media_type' => $mediaType,
        'filename' => $filename,
        'original_name' => $originalName,
        'mime_type' => $mime,
        'byte_size' => (int) $file['size'],
        'bytes' => $bytes,
        'alt_text' => $altText,
    ]);
    $mediaId = (int) $pdo->lastInsertId();
}

$rowStmt = $pdo->prepare('SELECT media_id, media_type, filename, original_name, mime_type, byte_size, alt_text, created_at FROM campaign_media WHERE media_id = :id');
$rowStmt->execute(['id' => $mediaId]);
$row = $rowStmt->fetch();

ajasti_json(['message' => 'Media saved.', 'media' => $row]);

