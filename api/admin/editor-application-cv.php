<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);

// Check if user is admin or editor_in_chief
$isAdmin = in_array('admin', $user['roles']);
$isEIC = in_array('editor_in_chief', $user['roles']);

if (!$isAdmin && !$isEIC) {
    jasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can view CVs.'], 403);
}

// Get application ID from route
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', $path);
$applicationId = (int) end($segments);

if (!$applicationId) {
    jasti_json(['message' => 'Application ID is required.'], 400);
}

// Get application
$application = jasti_get_editor_application($pdo, $applicationId);
if (!$application) {
    jasti_json(['message' => 'Application not found.'], 404);
}

if (!$application['cv_file_path']) {
    jasti_json(['message' => 'No CV file uploaded for this application.'], 404);
}

// Get absolute file path
$filePath = jasti_root_path('.' . $application['cv_file_path']);

if (!file_exists($filePath)) {
    jasti_json(['message' => 'CV file not found on server.'], 404);
}

// Return PDF file path and metadata for client-side viewing
jasti_json([
    'cv' => [
        'file_url' => $application['cv_file_path'],
        'original_filename' => $application['cv_original_filename'],
        'file_size' => filesize($filePath),
        'upload_date' => date('Y-m-d H:i:s', filemtime($filePath)),
    ],
], 200);
