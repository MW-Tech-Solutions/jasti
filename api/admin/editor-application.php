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
    jasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can view applications.'], 403);
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

jasti_json([
    'application' => [
        'application_id' => (int) $application['application_id'],
        'user_id' => (int) $application['user_id'],
        'applicant_name' => $application['first_name'] . ' ' . $application['last_name'],
        'applicant_email' => $application['email'],
        'editor_type' => $application['type_name'],
        'editor_title' => $application['title'],
        'status' => $application['status'],
        'subject_areas' => $application['subject_areas'],
        'expertise_description' => $application['expertise_description'],
        'bio' => $application['bio'],
        'cv_file_path' => $application['cv_file_path'],
        'cv_original_filename' => $application['cv_original_filename'],
        'applied_at' => $application['applied_at'],
        'reviewed_at' => $application['reviewed_at'],
        'rejection_reason' => $application['rejection_reason'],
        'acceptance_notes' => $application['acceptance_notes'],
    ],
], 200);
