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
$decisionType = trim((string) ($data['decision_type'] ?? ''));
$decisionLetter = trim((string) ($data['decision_letter'] ?? ''));
if ($manuscriptId <= 0 || !in_array($decisionType, ['accept', 'minor_revision', 'major_revision', 'reject'], true)) {
    ajasti_json(['message' => 'Manuscript and valid decision are required.'], 422);
}

$assignmentCheck = $pdo->prepare(
    'SELECT assignment_id
     FROM editor_assignments
     WHERE manuscript_id = :manuscript_id AND editor_id = :editor_id
     LIMIT 1'
);
$assignmentCheck->execute([
    'manuscript_id' => $manuscriptId,
    'editor_id' => $userId,
]);
if ($assignmentCheck->fetchColumn() === false) {
    ajasti_json(['message' => 'This manuscript is not assigned to you.'], 403);
}

$reviewCountStmt = $pdo->prepare('SELECT COUNT(*) FROM reviews WHERE manuscript_id = :manuscript_id');
$reviewCountStmt->execute(['manuscript_id' => $manuscriptId]);
if ((int) $reviewCountStmt->fetchColumn() <= 0) {
    ajasti_json(['message' => 'Editorial decisions require completed reviewer reports first.'], 422);
}

$stmt = $pdo->prepare(
    'INSERT INTO editor_decisions (manuscript_id, editor_id, decision_type, decision_letter)
     VALUES (:manuscript_id, :editor_id, :decision_type, :decision_letter)'
);
$stmt->execute([
    'manuscript_id' => $manuscriptId,
    'editor_id' => $userId,
    'decision_type' => $decisionType,
    'decision_letter' => $decisionLetter,
]);

$nextStatus = match ($decisionType) {
    'accept' => 'accepted',
    'reject' => 'rejected',
    default => 'revision_required',
};
$pdo->prepare('UPDATE manuscripts SET status = :status WHERE manuscript_id = :manuscript_id')->execute([
    'status' => $nextStatus,
    'manuscript_id' => $manuscriptId,
]);

$decisionId = (int) $pdo->lastInsertId();
ajasti_log($pdo, $userId, 'recorded editor decision', 'editor_decisions', $decisionId);
ajasti_json(['message' => 'Editorial decision recorded successfully.', 'decision_id' => $decisionId]);
