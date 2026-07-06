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

if (!isset($data['reason'])) {
    jasti_json(['message' => 'Rejection reason is required.'], 422);
}

$applicationId = (int) $data['application_id'];
$reason = trim((string) $data['reason']);

if (strlen($reason) < 10) {
    jasti_json(['message' => 'Rejection reason must be at least 10 characters.'], 422);
}

// Get application
$application = jasti_get_editor_application($pdo, $applicationId);
if (!$application) {
    jasti_json(['message' => 'Application not found.'], 404);
}

if ($application['status'] !== 'pending') {
    jasti_json(['message' => 'Application has already been reviewed.'], 400);
}

// Reject application
if (!jasti_reject_editor_application($pdo, $applicationId, $user['user_id'], $reason)) {
    jasti_json(['message' => 'Failed to reject application.'], 500);
}

jasti_json([
    'message' => 'Application rejected successfully.',
    'application_id' => $applicationId,
], 200);
