<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);

$isAdmin = in_array('admin', $user['roles'], true);
$isEIC = in_array('editor_in_chief', $user['roles'], true);
if (!$isAdmin && !$isEIC) {
    ajasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can reject editor applications.'], 403);
}

ajasti_ensure_onboarding_review_columns($pdo, 'editors');

if (!ajasti_table_exists($pdo, 'editors')) {
    ajasti_json(['message' => 'Editor onboarding storage is not available yet.'], 404);
}

$data = ajasti_request_data();
$editorId = (int) ($data['editor_id'] ?? 0);
$reason = trim((string) ($data['reason'] ?? ''));

if ($editorId <= 0) {
    ajasti_json(['message' => 'Editor ID is required.'], 422);
}
if ($reason === '') {
    ajasti_json(['message' => 'Rejection reason is required.'], 422);
}

$stmt = $pdo->prepare('SELECT editor_id, status FROM editors WHERE editor_id = :id LIMIT 1');
$stmt->execute(['id' => $editorId]);
$application = $stmt->fetch();
if (!$application) {
    ajasti_json(['message' => 'Editor application not found.'], 404);
}

if ((string) $application['status'] !== 'pending') {
    ajasti_json(['message' => 'Editor application has already been reviewed.'], 400);
}

$update = $pdo->prepare(
    'UPDATE editors
     SET status = "rejected",
         reviewed_at = NOW(),
         reviewed_by = :reviewed_by,
         rejection_reason = :reason
     WHERE editor_id = :id'
);
$update->execute([
    'id' => $editorId,
    'reviewed_by' => (int) $user['user_id'],
    'reason' => $reason,
]);

ajasti_json(['message' => 'Editor application rejected.', 'editor_id' => $editorId], 200);
