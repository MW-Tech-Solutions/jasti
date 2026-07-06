<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);

// Check if user is admin or editor_in_chief
$isAdmin = in_array('admin', $user['roles']);
$isEIC = in_array('editor_in_chief', $user['roles']);

if (!$isAdmin && !$isEIC) {
    ajasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can view CVs.'], 403);
}

// Get application ID from route
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', $path);
$applicationId = (int) end($segments);

if (!$applicationId) {
    ajasti_json(['message' => 'Application ID is required.'], 400);
}

// Get application
$application = ajasti_get_editor_application($pdo, $applicationId);
if (!$application) {
    ajasti_json(['message' => 'Application not found.'], 404);
}

if (!$application['cv_file_path']) {
    ajasti_json(['message' => 'No CV file uploaded for this application.'], 404);
}

// Get absolute file path
$filePath = ajasti_root_path('.' . $application['cv_file_path']);

if (!file_exists($filePath)) {
    ajasti_json(['message' => 'CV file not found on server.'], 404);
}

// Return PDF file path and metadata for client-side viewing
ajasti_json([
    'cv' => [
        'file_url' => $application['cv_file_path'],
        'original_filename' => $application['cv_original_filename'],
        'file_size' => filesize($filePath),
        'upload_date' => date('Y-m-d H:i:s', filemtime($filePath)),
    ],
], 200);
