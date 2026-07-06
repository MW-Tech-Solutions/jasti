<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);

// Check if user is admin or editor_in_chief
$isAdmin = in_array('admin', $user['roles']);
$isEIC = in_array('editor_in_chief', $user['roles']);

if (!$isAdmin && !$isEIC) {
    ajasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can review applications.'], 403);
}

$data = ajasti_request_data();

// Validate required fields
if (!isset($data['application_id'])) {
    ajasti_json(['message' => 'Application ID is required.'], 422);
}

if (!isset($data['reason'])) {
    ajasti_json(['message' => 'Rejection reason is required.'], 422);
}

$applicationId = (int) $data['application_id'];
$reason = trim((string) $data['reason']);

if (strlen($reason) < 10) {
    ajasti_json(['message' => 'Rejection reason must be at least 10 characters.'], 422);
}

// Get application
$application = ajasti_get_editor_application($pdo, $applicationId);
if (!$application) {
    ajasti_json(['message' => 'Application not found.'], 404);
}

if ($application['status'] !== 'pending') {
    ajasti_json(['message' => 'Application has already been reviewed.'], 400);
}

// Reject application
if (!ajasti_reject_editor_application($pdo, $applicationId, $user['user_id'], $reason)) {
    ajasti_json(['message' => 'Failed to reject application.'], 500);
}

ajasti_json([
    'message' => 'Application rejected successfully.',
    'application_id' => $applicationId,
], 200);
