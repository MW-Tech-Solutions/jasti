<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'editor');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$reviewerIds = array_values(array_filter(array_map('intval', (array) ($data['reviewer_ids'] ?? []))));
if ($reviewerIds === []) {
    $singleReviewerId = (int) ($data['reviewer_id'] ?? 0);
    if ($singleReviewerId > 0) {
        $reviewerIds[] = $singleReviewerId;
    }
}
if ($manuscriptId <= 0 || $reviewerIds === []) {
    ajasti_json(['message' => 'Manuscript and at least one reviewer are required.'], 422);
}

$reviewerLookup = $pdo->prepare('SELECT email, first_name, last_name FROM users WHERE user_id = :reviewer_id LIMIT 1');
$check = $pdo->prepare('SELECT invitation_id FROM review_invitations WHERE manuscript_id = :manuscript_id AND reviewer_id = :reviewer_id LIMIT 1');
$stmt = $pdo->prepare(
    'INSERT INTO review_invitations (manuscript_id, reviewer_id, invited_by_editor, response)
     VALUES (:manuscript_id, :reviewer_id, :invited_by_editor, :response)'
);

$created = [];
foreach ($reviewerIds as $reviewerId) {
    $check->execute(['manuscript_id' => $manuscriptId, 'reviewer_id' => $reviewerId]);
    if ($check->fetchColumn() !== false) {
        continue;
    }

    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'reviewer_id' => $reviewerId,
        'invited_by_editor' => $userId,
        'response' => 'pending',
    ]);
    $created[] = (int) $pdo->lastInsertId();
    ajasti_log($pdo, $userId, 'invited reviewer', 'review_invitations', (int) $pdo->lastInsertId());

    $reviewerLookup->execute(['reviewer_id' => $reviewerId]);
    $reviewer = $reviewerLookup->fetch();
    if ($reviewer) {
        ajasti_send_mail(
            (string) $reviewer['email'],
            'JASTI review invitation',
            "You have been invited to review manuscript #{$manuscriptId} on JASTI. Sign in to accept or decline the invitation."
        );
    }
}

if ($created === []) {
    ajasti_json(['message' => 'Selected reviewers have already been invited for this manuscript.'], 409);
}

$pdo->prepare('UPDATE manuscripts SET status = "under_review" WHERE manuscript_id = :manuscript_id')->execute(['manuscript_id' => $manuscriptId]);
ajasti_json(['message' => 'Reviewer invitation(s) created successfully.', 'invitation_ids' => $created]);
