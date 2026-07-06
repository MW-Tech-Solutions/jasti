<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
jasti_ensure_peer_review_schema($pdo);
$user = jasti_require_role($pdo, 'reviewer');
$userId = (int) $user['user_id'];
$data = jasti_request_data();

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$recommendation = trim((string) ($data['recommendation'] ?? ''));
if ($manuscriptId <= 0 || !in_array($recommendation, ['accept', 'minor_revision', 'major_revision', 'reject', 'resubmit_new_review'], true)) {
    jasti_json(['message' => 'Manuscript and recommendation are required.'], 422);
}

$boolValue = static fn (string $key): int => in_array((string) ($data[$key] ?? ''), ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
foreach (['no_personal_conflict', 'no_institutional_conflict', 'no_financial_conflict', 'conflict_confirmed', 'confidentiality_agreed'] as $requiredCheckbox) {
    if ($boolValue($requiredCheckbox) !== 1) {
        jasti_json(['message' => 'Conflict of interest and confidentiality declarations are required before submitting a review.'], 422);
    }
}

$invitation = $pdo->prepare('SELECT invitation_id FROM review_invitations WHERE manuscript_id = :manuscript_id AND reviewer_id = :reviewer_id AND response = "accepted" LIMIT 1');
$invitation->execute(['manuscript_id' => $manuscriptId, 'reviewer_id' => $userId]);
if ($invitation->fetchColumn() === false) {
    jasti_json(['message' => 'Accepted invitation required before review submission.'], 403);
}

$existingReview = $pdo->prepare(
    'SELECT review_id
     FROM reviews
     WHERE manuscript_id = :manuscript_id
       AND reviewer_id = :reviewer_id
     LIMIT 1'
);
$existingReview->execute([
    'manuscript_id' => $manuscriptId,
    'reviewer_id' => $userId,
]);
if ($existingReview->fetchColumn() !== false) {
    jasti_json(['message' => 'You have already submitted a review for this manuscript.'], 409);
}

$scoreKeys = [
    'score_novelty',
    'score_relevance',
    'score_technical_quality',
    'score_methodology',
    'score_literature_review',
    'score_data_analysis',
    'score_clarity',
    'score_grammar_language',
    'score_references_quality',
    'score_ethical_compliance',
    'score_contribution',
];
$scores = [];
foreach ($scoreKeys as $scoreKey) {
    $score = (int) ($data[$scoreKey] ?? 0);
    if ($score < 1 || $score > 10) {
        jasti_json(['message' => 'Each review score must be between 1 and 10.'], 422);
    }
    $scores[$scoreKey] = $score;
}
$totalScore = array_sum($scores);
$scorePercent = round(($totalScore / 110) * 100, 2);
$screenshotAttachment = null;
if (isset($_FILES['screenshot_attachment']) && is_array($_FILES['screenshot_attachment']) && (int) ($_FILES['screenshot_attachment']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $screenshotAttachment = jasti_store_uploaded_file(
        $_FILES['screenshot_attachment'],
        'review-attachments',
        'review_screenshot',
        [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
        ]
    );
}

$stmt = $pdo->prepare(
    'INSERT INTO reviews (
        manuscript_id, reviewer_id, review_date, recommendation, confidential_comments, comments_to_author,
        no_personal_conflict, no_institutional_conflict, no_financial_conflict, conflict_confirmed, confidentiality_agreed,
        comments_strengths, comments_weaknesses, comments_required_corrections, comments_suggestions,
        ethical_concerns, suspected_plagiarism, recommendation_justification, publication_risk_concerns,
        score_novelty, score_relevance, score_technical_quality, score_methodology, score_literature_review,
        score_data_analysis, score_clarity, score_grammar_language, score_references_quality,
        score_ethical_compliance, score_significance, score_contribution, total_score, score_percent,
        possible_plagiarism_detected, ai_generated_content_suspected, fabricated_data_concerns,
        ethical_approval_missing, citation_manipulation, duplicate_publication_suspicion, screenshot_attachment
     )
     VALUES (
        :manuscript_id, :reviewer_id, CURRENT_TIMESTAMP, :recommendation, :confidential_comments, :comments_to_author,
        :no_personal_conflict, :no_institutional_conflict, :no_financial_conflict, :conflict_confirmed, :confidentiality_agreed,
        :comments_strengths, :comments_weaknesses, :comments_required_corrections, :comments_suggestions,
        :ethical_concerns, :suspected_plagiarism, :recommendation_justification, :publication_risk_concerns,
        :score_novelty, :score_relevance, :score_technical_quality, :score_methodology, :score_literature_review,
        :score_data_analysis, :score_clarity, :score_grammar_language, :score_references_quality,
        :score_ethical_compliance, :score_significance, :score_contribution, :total_score, :score_percent,
        :possible_plagiarism_detected, :ai_generated_content_suspected, :fabricated_data_concerns,
        :ethical_approval_missing, :citation_manipulation, :duplicate_publication_suspicion, :screenshot_attachment
     )'
);
$stmt->execute([
    'manuscript_id' => $manuscriptId,
    'reviewer_id' => $userId,
    'recommendation' => $recommendation,
    'confidential_comments' => trim((string) ($data['confidential_comments'] ?? '')),
    'comments_to_author' => trim((string) ($data['comments_to_author'] ?? '')),
    'no_personal_conflict' => $boolValue('no_personal_conflict'),
    'no_institutional_conflict' => $boolValue('no_institutional_conflict'),
    'no_financial_conflict' => $boolValue('no_financial_conflict'),
    'conflict_confirmed' => $boolValue('conflict_confirmed'),
    'confidentiality_agreed' => $boolValue('confidentiality_agreed'),
    'comments_strengths' => trim((string) ($data['comments_strengths'] ?? '')),
    'comments_weaknesses' => trim((string) ($data['comments_weaknesses'] ?? '')),
    'comments_required_corrections' => trim((string) ($data['comments_required_corrections'] ?? '')),
    'comments_suggestions' => trim((string) ($data['comments_suggestions'] ?? '')),
    'ethical_concerns' => trim((string) ($data['ethical_concerns'] ?? '')),
    'suspected_plagiarism' => trim((string) ($data['suspected_plagiarism'] ?? '')),
    'recommendation_justification' => trim((string) ($data['recommendation_justification'] ?? '')),
    'publication_risk_concerns' => trim((string) ($data['publication_risk_concerns'] ?? '')),
    ...$scores,
    'score_significance' => $scores['score_contribution'],
    'total_score' => $totalScore,
    'score_percent' => $scorePercent,
    'possible_plagiarism_detected' => $boolValue('possible_plagiarism_detected'),
    'ai_generated_content_suspected' => $boolValue('ai_generated_content_suspected'),
    'fabricated_data_concerns' => $boolValue('fabricated_data_concerns'),
    'ethical_approval_missing' => $boolValue('ethical_approval_missing'),
    'citation_manipulation' => $boolValue('citation_manipulation'),
    'duplicate_publication_suspicion' => $boolValue('duplicate_publication_suspicion'),
    'screenshot_attachment' => $screenshotAttachment,
]);

$pdo->prepare('UPDATE reviewer_profiles SET total_reviews = total_reviews + 1 WHERE reviewer_id = :reviewer_id')
    ->execute(['reviewer_id' => $userId]);
$pdo->prepare('UPDATE manuscripts SET status = "under_review" WHERE manuscript_id = :manuscript_id')
    ->execute(['manuscript_id' => $manuscriptId]);

$reviewId = (int) $pdo->lastInsertId();
jasti_log($pdo, $userId, 'submitted review', 'reviews', $reviewId);
jasti_json(['message' => 'Review submitted successfully.', 'review_id' => $reviewId]);
