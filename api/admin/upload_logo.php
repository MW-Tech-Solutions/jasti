<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
jasti_require_role($pdo, 'admin');

if (!isset($_FILES['logo']) || !is_array($_FILES['logo'])) {
    jasti_json(['message' => 'Logo file is required.'], 422);
}

$file = $_FILES['logo'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    jasti_json(['message' => 'Logo upload failed.'], 422);
}

$relativePath = jasti_store_uploaded_image($file, 'uploads/system', 'journal_logo');
jasti_upsert_setting($pdo, 'logo_path', $relativePath);

jasti_json([
    'message' => 'Logo updated successfully.',
    'logo_path' => $relativePath,
    'settings' => jasti_settings($pdo),
]);
