<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
$roles = (array) ($user['roles'] ?? []);
if (!jasti_has_editor_workspace_role($roles) || (in_array('technical_editor', $roles, true) && count(array_intersect($roles, ['editor', 'managing_editor', 'section_editor', 'advisory_board'])) === 0)) {
    jasti_json(['message' => 'Insufficient permissions.'], 403);
}
$userId = (int) $user['user_id'];
$data = jasti_request_data();
$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
if ($manuscriptId <= 0) {
    jasti_json(['message' => 'Manuscript is required.'], 422);
}

jasti_ensure_technical_screening_schema($pdo);
$technicalCheck = $pdo->prepare(
    'SELECT status
     FROM technical_screenings
     WHERE manuscript_id = :manuscript_id
     LIMIT 1'
);
$technicalCheck->execute(['manuscript_id' => $manuscriptId]);
$technicalStatus = (string) ($technicalCheck->fetchColumn() ?: '');
if ($technicalStatus !== 'approved') {
    jasti_json(['message' => 'The editor can claim this manuscript only after technical screening has been approved.'], 422);
}

$check = $pdo->prepare('SELECT assignment_id FROM editor_assignments WHERE manuscript_id = :manuscript_id AND editor_id = :editor_id LIMIT 1');
$check->execute(['manuscript_id' => $manuscriptId, 'editor_id' => $userId]);
if ($check->fetchColumn() === false) {
    $stmt = $pdo->prepare('INSERT INTO editor_assignments (manuscript_id, editor_id, status) VALUES (:manuscript_id, :editor_id, :status)');
    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'editor_id' => $userId,
        'status' => 'active',
    ]);
}

$pdo->prepare('UPDATE manuscripts SET current_editor_id = :editor_id, status = :status WHERE manuscript_id = :manuscript_id')
    ->execute([
        'editor_id' => $userId,
        'status' => 'editor_screening',
        'manuscript_id' => $manuscriptId,
    ]);

jasti_log($pdo, $userId, 'claimed manuscript assignment', 'editor_assignments', $manuscriptId);
jasti_json(['message' => 'Manuscript assigned to current editor.']);
