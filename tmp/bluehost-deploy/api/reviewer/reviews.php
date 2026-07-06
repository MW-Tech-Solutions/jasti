<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'reviewer');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$recommendation = trim((string) ($data['recommendation'] ?? ''));
if ($manuscriptId <= 0 || !in_array($recommendation, ['accept', 'minor_revision', 'major_revision', 'reject'], true)) {
    ajasti_json(['message' => 'Manuscript and recommendation are required.'], 422);
}

$invitation = $pdo->prepare('SELECT invitation_id FROM review_invitations WHERE manuscript_id = :manuscript_id AND reviewer_id = :reviewer_id AND response = "accepted" LIMIT 1');
$invitation->execute(['manuscript_id' => $manuscriptId, 'reviewer_id' => $userId]);
if ($invitation->fetchColumn() === false) {
    ajasti_json(['message' => 'Accepted invitation required before review submission.'], 403);
}

$stmt = $pdo->prepare(
    'INSERT INTO reviews (manuscript_id, reviewer_id, review_date, recommendation, confidential_comments, comments_to_author, score_novelty, score_methodology, score_clarity, score_significance)
     VALUES (:manuscript_id, :reviewer_id, CURRENT_TIMESTAMP, :recommendation, :confidential_comments, :comments_to_author, :score_novelty, :score_methodology, :score_clarity, :score_significance)'
);
$stmt->execute([
    'manuscript_id' => $manuscriptId,
    'reviewer_id' => $userId,
    'recommendation' => $recommendation,
    'confidential_comments' => trim((string) ($data['confidential_comments'] ?? '')),
    'comments_to_author' => trim((string) ($data['comments_to_author'] ?? '')),
    'score_novelty' => (int) ($data['score_novelty'] ?? 0),
    'score_methodology' => (int) ($data['score_methodology'] ?? 0),
    'score_clarity' => (int) ($data['score_clarity'] ?? 0),
    'score_significance' => (int) ($data['score_significance'] ?? 0),
]);

$pdo->prepare('UPDATE reviewer_profiles SET total_reviews = total_reviews + 1 WHERE reviewer_id = :reviewer_id')
    ->execute(['reviewer_id' => $userId]);
$pdo->prepare('UPDATE manuscripts SET status = "under_review" WHERE manuscript_id = :manuscript_id')
    ->execute(['manuscript_id' => $manuscriptId]);

$reviewId = (int) $pdo->lastInsertId();
ajasti_log($pdo, $userId, 'submitted review', 'reviews', $reviewId);
ajasti_json(['message' => 'Review submitted successfully.', 'review_id' => $reviewId]);
