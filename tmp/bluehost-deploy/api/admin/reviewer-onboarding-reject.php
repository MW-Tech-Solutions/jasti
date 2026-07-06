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
    ajasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can reject reviewer applications.'], 403);
}

ajasti_ensure_onboarding_review_columns($pdo, 'reviewers');

$data = ajasti_request_data();
$reviewerId = (int) ($data['reviewer_id'] ?? 0);
$reason = trim((string) ($data['reason'] ?? ''));

if ($reviewerId <= 0) {
    ajasti_json(['message' => 'Reviewer ID is required.'], 422);
}
if ($reason === '') {
    ajasti_json(['message' => 'Rejection reason is required.'], 422);
}

$stmt = $pdo->prepare('SELECT reviewer_id, status FROM reviewers WHERE reviewer_id = :id LIMIT 1');
$stmt->execute(['id' => $reviewerId]);
$application = $stmt->fetch();
if (!$application) {
    ajasti_json(['message' => 'Reviewer application not found.'], 404);
}

if ((string) $application['status'] !== 'pending') {
    ajasti_json(['message' => 'Reviewer application has already been reviewed.'], 400);
}

$update = $pdo->prepare(
    'UPDATE reviewers
     SET status = "rejected",
         reviewed_at = NOW(),
         reviewed_by = :reviewed_by,
         rejection_reason = :reason
     WHERE reviewer_id = :id'
);
$update->execute([
    'id' => $reviewerId,
    'reviewed_by' => (int) $user['user_id'],
    'reason' => $reason,
]);

ajasti_json(['message' => 'Reviewer application rejected.', 'reviewer_id' => $reviewerId], 200);

