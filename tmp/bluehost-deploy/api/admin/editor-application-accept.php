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

$applicationId = (int) $data['application_id'];
$notes = trim((string) ($data['notes'] ?? ''));

// Get application
$application = ajasti_get_editor_application($pdo, $applicationId);
if (!$application) {
    ajasti_json(['message' => 'Application not found.'], 404);
}

if ($application['status'] !== 'pending') {
    ajasti_json(['message' => 'Application has already been reviewed.'], 400);
}

// Accept application
if (!ajasti_accept_editor_application($pdo, $applicationId, $user['user_id'], $notes)) {
    ajasti_json(['message' => 'Failed to accept application.'], 500);
}

ajasti_json([
    'message' => 'Application accepted successfully.',
    'application_id' => $applicationId,
], 200);
