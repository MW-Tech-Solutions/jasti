<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
ajasti_require_role($pdo, 'admin');

if (!isset($_FILES['logo']) || !is_array($_FILES['logo'])) {
    ajasti_json(['message' => 'Logo file is required.'], 422);
}

$file = $_FILES['logo'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    ajasti_json(['message' => 'Logo upload failed.'], 422);
}

$relativePath = ajasti_store_uploaded_image($file, 'uploads/system', 'journal_logo');
ajasti_upsert_setting($pdo, 'logo_path', $relativePath);

ajasti_json([
    'message' => 'Logo updated successfully.',
    'logo_path' => $relativePath,
    'settings' => ajasti_settings($pdo),
]);
