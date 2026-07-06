<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
jasti_ensure_editor_applications($pdo);

// Check if user has an editor application
$application = jasti_get_user_editor_application($pdo, $user['user_id']);
if (!$application) {
    jasti_json(['message' => 'No pending or accepted editor application found.'], 404);
}

// Check if CV is already uploaded
if ($application['status'] === 'accepted') {
    jasti_json(['message' => 'Application has been accepted. You can now verify your email.'], 400);
}

// Handle file upload
$file = $_FILES['cv_file'] ?? null;
if (!$file) {
    jasti_json(['message' => 'CV file is required.'], 422);
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    jasti_json(['message' => jasti_upload_error_message($file['error'])], 422);
}

// Validate file is PDF
$mimeType = mime_content_type($file['tmp_name']);
if ($mimeType !== 'application/pdf') {
    jasti_json(['message' => 'Only PDF files are allowed.'], 422);
}

// Check file size (max 10MB)
$maxSize = 10 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    jasti_json(['message' => 'File size must not exceed 10MB.'], 422);
}

$publicPath = jasti_store_uploaded_file(
    $file,
    'uploads/cv',
    sprintf('cv_%d', $user['user_id']),
    ['application/pdf' => 'pdf'],
    $maxSize
);

// Update application with CV file path
$stmt = $pdo->prepare(
    'UPDATE editor_applications 
     SET cv_file_path = :path, cv_original_filename = :original_name
     WHERE application_id = :app_id'
);

$success = $stmt->execute([
    'path' => $publicPath,
    'original_name' => $file['name'],
    'app_id' => $application['application_id'],
]);

if (!$success) {
    $absolutePath = jasti_root_path('.' . $publicPath);
    if (is_file($absolutePath)) {
        unlink($absolutePath);
    }
    jasti_json(['message' => 'Failed to save CV information.'], 500);
}

jasti_json([
    'message' => 'CV uploaded successfully.',
    'file_path' => $publicPath,
    'file_name' => $file['name'],
    'application_id' => $application['application_id'],
], 200);
