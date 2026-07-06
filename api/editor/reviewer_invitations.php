<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
jasti_ensure_peer_review_schema($pdo);
$user = jasti_require_auth($pdo);
$roles = (array) ($user['roles'] ?? []);
if (!jasti_has_editor_workspace_role($roles) || (in_array('technical_editor', $roles, true) && count(array_intersect($roles, ['editor', 'managing_editor', 'section_editor', 'advisory_board'])) === 0)) {
    jasti_json(['message' => 'Insufficient permissions.'], 403);
}
$userId = (int) $user['user_id'];
$data = jasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$reviewerIds = array_values(array_filter(array_map('intval', (array) ($data['reviewer_ids'] ?? []))));
if ($reviewerIds === []) {
    $singleReviewerId = (int) ($data['reviewer_id'] ?? 0);
    if ($singleReviewerId > 0) {
        $reviewerIds[] = $singleReviewerId;
    }
}
if ($manuscriptId <= 0 || $reviewerIds === []) {
    jasti_json(['message' => 'Manuscript and at least one reviewer are required.'], 422);
}
$reviewerIds = array_values(array_unique($reviewerIds));

$manuscriptStatusStmt = $pdo->prepare(
    'SELECT m.status, m.title, m.reference_number, ts.status AS technical_status
     FROM manuscripts m
     LEFT JOIN technical_screenings ts ON ts.manuscript_id = m.manuscript_id
     WHERE m.manuscript_id = :manuscript_id
     LIMIT 1'
);
$manuscriptStatusStmt->execute(['manuscript_id' => $manuscriptId]);
$manuscriptStatusRow = $manuscriptStatusStmt->fetch() ?: [];
$manuscriptStatus = strtolower((string) ($manuscriptStatusRow['status'] ?? ''));
if ($manuscriptStatus === 'published') {
    jasti_json(['message' => 'Published manuscripts cannot be assigned to reviewers.'], 422);
}
if ((string) ($manuscriptStatusRow['technical_status'] ?? '') !== 'approved') {
    jasti_json(['message' => 'Reviewers can be assigned only after the editor approves the technical editor file.'], 422);
}
$assignmentStmt = $pdo->prepare(
    'SELECT assignment_id
     FROM editor_assignments
     WHERE manuscript_id = :manuscript_id
       AND editor_id = :editor_id
       AND status IN ("pending", "active")
     LIMIT 1'
);
$assignmentStmt->execute([
    'manuscript_id' => $manuscriptId,
    'editor_id' => $userId,
]);
if ($assignmentStmt->fetchColumn() === false) {
    jasti_json(['message' => 'This manuscript must be in your editor assignment queue before you can assign reviewers.'], 403);
}
$reviewModel = trim((string) ($data['review_model'] ?? 'single_blind'));
if (!in_array($reviewModel, ['single_blind', 'double_blind', 'open_review'], true)) {
    jasti_json(['message' => 'Select a valid review model.'], 422);
}

$reviewDeadline = trim((string) ($data['review_deadline'] ?? ''));
if ($reviewDeadline === '') {
    $reviewDeadline = (new DateTimeImmutable('+21 days'))->format('Y-m-d H:i:s');
} else {
    $reviewDeadline = str_replace('T', ' ', $reviewDeadline);
    if (strlen($reviewDeadline) === 16) {
        $reviewDeadline .= ':00';
    }
}

$existingCountStmt = $pdo->prepare('SELECT COUNT(*) FROM review_invitations WHERE manuscript_id = :manuscript_id');
$existingCountStmt->execute(['manuscript_id' => $manuscriptId]);
$existingCount = (int) $existingCountStmt->fetchColumn();
$duplicateCheck = $pdo->prepare('SELECT invitation_id FROM review_invitations WHERE manuscript_id = :manuscript_id AND reviewer_id = :reviewer_id LIMIT 1');
$newReviewerIds = [];
foreach ($reviewerIds as $reviewerId) {
    $duplicateCheck->execute(['manuscript_id' => $manuscriptId, 'reviewer_id' => $reviewerId]);
    if ($duplicateCheck->fetchColumn() === false) {
        $newReviewerIds[] = $reviewerId;
    }
}
if ($newReviewerIds === []) {
    jasti_json(['message' => 'Selected reviewers have already been invited for this manuscript.'], 409);
}
$totalReviewerCount = $existingCount + count($newReviewerIds);
if ($totalReviewerCount < 2) {
    jasti_json(['message' => 'Peer review requires at least 2 total reviewer invitations. Select enough reviewers to reach 2.'], 422);
}
if ($totalReviewerCount > 3) {
    jasti_json(['message' => 'A manuscript can have no more than 3 reviewer invitations.'], 422);
}

$reviewerLookup = $pdo->prepare('SELECT email, first_name, last_name FROM users WHERE user_id = :reviewer_id LIMIT 1');
$check = $pdo->prepare('SELECT invitation_id FROM review_invitations WHERE manuscript_id = :manuscript_id AND reviewer_id = :reviewer_id LIMIT 1');
$stmt = $pdo->prepare(
    'INSERT INTO review_invitations (manuscript_id, reviewer_id, invited_by_editor, response, review_deadline, review_model)
     VALUES (:manuscript_id, :reviewer_id, :invited_by_editor, :response, :review_deadline, :review_model)'
);

$created = [];
foreach ($newReviewerIds as $reviewerId) {
    $check->execute(['manuscript_id' => $manuscriptId, 'reviewer_id' => $reviewerId]);
    if ($check->fetchColumn() !== false) {
        continue;
    }

    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'reviewer_id' => $reviewerId,
        'invited_by_editor' => $userId,
        'response' => 'pending',
        'review_deadline' => $reviewDeadline,
        'review_model' => $reviewModel,
    ]);
    $created[] = (int) $pdo->lastInsertId();
    jasti_log($pdo, $userId, 'invited reviewer', 'review_invitations', (int) $pdo->lastInsertId());

    $reviewerLookup->execute(['reviewer_id' => $reviewerId]);
    $reviewer = $reviewerLookup->fetch();
    if ($reviewer) {
        $reviewerName = trim((string) ($reviewer['first_name'] ?? '') . ' ' . (string) ($reviewer['last_name'] ?? ''));
        $reference = trim((string) ($manuscriptStatusRow['reference_number'] ?? ''));
        $title = trim((string) ($manuscriptStatusRow['title'] ?? ''));
        try {
            jasti_send_action_needed_email(
                (string) $reviewer['email'],
                'JASTI review invitation',
                'Review invitation pending',
                sprintf(
                    "Dear %s,\n\nYou have been invited to review manuscript %s%s. Please log in to accept or decline the invitation.",
                    $reviewerName !== '' ? $reviewerName : 'Reviewer',
                    $reference !== '' ? $reference : '#' . $manuscriptId,
                    $title !== '' ? ' titled "' . $title . '"' : ''
                ),
                'Open reviewer invitation',
                jasti_dashboard_action_url('reviewer', 'invitations')
            );
        } catch (Throwable $exception) {
            error_log(sprintf('Reviewer invitation email failed for reviewer %d: %s', $reviewerId, $exception->getMessage()));
        }
    }
}

if ($created === []) {
    jasti_json(['message' => 'Selected reviewers have already been invited for this manuscript.'], 409);
}

$pdo->prepare('UPDATE manuscripts SET status = "under_review" WHERE manuscript_id = :manuscript_id')->execute(['manuscript_id' => $manuscriptId]);
jasti_json(['message' => 'Reviewer invitation(s) created successfully.', 'invitation_ids' => $created]);
