<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);

$isAdmin = in_array('admin', $user['roles'], true);
$isEIC = in_array('editor_in_chief', $user['roles'], true);
if (!$isAdmin && !$isEIC) {
    jasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can approve reviewer applications.'], 403);
}

jasti_ensure_onboarding_review_columns($pdo, 'reviewers');

$data = jasti_request_data();
$reviewerId = (int) ($data['reviewer_id'] ?? 0);
$notes = trim((string) ($data['notes'] ?? ''));

if ($reviewerId <= 0) {
    jasti_json(['message' => 'Reviewer ID is required.'], 422);
}

$stmt = $pdo->prepare('SELECT reviewer_id, status, application_completed, cv_file FROM reviewers WHERE reviewer_id = :id LIMIT 1');
$stmt->execute(['id' => $reviewerId]);
$application = $stmt->fetch();
if (!$application) {
    jasti_json(['message' => 'Reviewer application not found.'], 404);
}

if ((string) $application['status'] !== 'pending') {
    jasti_json(['message' => 'Reviewer application has already been reviewed.'], 400);
}

if ((int) ($application['application_completed'] ?? 0) !== 1 || empty($application['cv_file'])) {
    jasti_json(['message' => 'Reviewer application must be completed and include a PDF CV before approval.'], 400);
}

$update = $pdo->prepare(
    'UPDATE reviewers
     SET status = "approved",
         reviewed_at = NOW(),
         reviewed_by = :reviewed_by,
         acceptance_notes = :notes
     WHERE reviewer_id = :id'
);
$update->execute([
    'id' => $reviewerId,
    'reviewed_by' => (int) $user['user_id'],
    'notes' => $notes !== '' ? $notes : null,
]);

jasti_json(['message' => 'Reviewer application approved.', 'reviewer_id' => $reviewerId], 200);

