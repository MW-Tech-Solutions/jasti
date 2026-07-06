<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);

// Check if user is admin or editor_in_chief
$isAdmin = in_array('admin', $user['roles']);
$isEIC = in_array('editor_in_chief', $user['roles']);

if (!$isAdmin && !$isEIC) {
    jasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can review applications.'], 403);
}

$data = jasti_request_data();

// Validate required fields
if (!isset($data['application_id'])) {
    jasti_json(['message' => 'Application ID is required.'], 422);
}

$applicationId = (int) $data['application_id'];
$notes = trim((string) ($data['notes'] ?? ''));

// Get application
$application = jasti_get_editor_application($pdo, $applicationId);
if (!$application) {
    jasti_json(['message' => 'Application not found.'], 404);
}

if ($application['status'] !== 'pending') {
    jasti_json(['message' => 'Application has already been reviewed.'], 400);
}

// Accept application
if (!jasti_accept_editor_application($pdo, $applicationId, $user['user_id'], $notes)) {
    jasti_json(['message' => 'Failed to accept application.'], 500);
}

jasti_json([
    'message' => 'Application accepted successfully.',
    'application_id' => $applicationId,
], 200);
