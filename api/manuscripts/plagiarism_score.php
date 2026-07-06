<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
$userId = (int) $user['user_id'];
$roles = array_map('strtolower', (array) ($user['roles'] ?? []));

if (!in_array('editor', $roles, true) && !in_array('admin', $roles, true)) {
    jasti_json(['message' => 'Only editors and administrators can update plagiarism scores.'], 403);
}

$data = jasti_request_data();
$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$rawScore = trim((string) ($data['plagiarism_score'] ?? ''));

if ($manuscriptId <= 0) {
    jasti_json(['message' => 'A manuscript is required.'], 422);
}

$score = null;
if ($rawScore !== '') {
    if (!is_numeric($rawScore)) {
        jasti_json(['message' => 'Plagiarism score must be numeric.'], 422);
    }
    $score = round((float) $rawScore, 2);
    if ($score < 0 || $score > 100) {
        jasti_json(['message' => 'Plagiarism score must be between 0 and 100.'], 422);
    }
}

$manuscriptStmt = $pdo->prepare(
    'SELECT manuscript_id, title, plagiarism_score
     FROM manuscripts
     WHERE manuscript_id = :manuscript_id
     LIMIT 1'
);
$manuscriptStmt->execute(['manuscript_id' => $manuscriptId]);
$manuscript = $manuscriptStmt->fetch();

if (!$manuscript) {
    jasti_json(['message' => 'Manuscript not found.'], 404);
}

if (!in_array('admin', $roles, true)) {
    $assignmentStmt = $pdo->prepare(
        'SELECT assignment_id
         FROM editor_assignments
         WHERE manuscript_id = :manuscript_id
           AND editor_id = :editor_id
         LIMIT 1'
    );
    $assignmentStmt->execute([
        'manuscript_id' => $manuscriptId,
        'editor_id' => $userId,
    ]);

    if ($assignmentStmt->fetchColumn() === false) {
        jasti_json(['message' => 'This manuscript is not assigned to you.'], 403);
    }
}

$updateStmt = $pdo->prepare(
    'UPDATE manuscripts
     SET plagiarism_score = :plagiarism_score
     WHERE manuscript_id = :manuscript_id'
);
$updateStmt->bindValue(':manuscript_id', $manuscriptId, PDO::PARAM_INT);
if ($score === null) {
    $updateStmt->bindValue(':plagiarism_score', null, PDO::PARAM_NULL);
} else {
    $updateStmt->bindValue(':plagiarism_score', $score);
}
$updateStmt->execute();

jasti_log($pdo, $userId, 'updated plagiarism score', 'manuscripts', $manuscriptId);

jasti_json([
    'message' => 'Plagiarism score saved successfully.',
    'manuscript' => [
        'manuscript_id' => $manuscriptId,
        'title' => $manuscript['title'],
        'plagiarism_score' => $score,
    ],
]);
