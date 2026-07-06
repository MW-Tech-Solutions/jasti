<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
jasti_ensure_editor_applications($pdo);

// Get user's pending or accepted editor application
$application = jasti_get_user_editor_application($pdo, $user['user_id']);
if (!$application) {
    jasti_json(['message' => 'No pending or accepted editor application found.'], 404);
}

jasti_json([
    'application' => [
        'application_id' => (int) $application['application_id'],
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
