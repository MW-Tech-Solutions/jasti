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
if ($manuscriptId <= 0) {
    ajasti_json(['message' => 'Manuscript is required.'], 422);
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

ajasti_log($pdo, $userId, 'claimed manuscript assignment', 'editor_assignments', $manuscriptId);
ajasti_json(['message' => 'Manuscript assigned to current editor.']);
