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
$decisionType = trim((string) ($data['decision_type'] ?? ''));
$decisionLetter = trim((string) ($data['decision_letter'] ?? ''));
if ($manuscriptId <= 0 || !in_array($decisionType, ['accept', 'minor_revision', 'major_revision', 'reject'], true)) {
    jasti_json(['message' => 'Manuscript and valid decision are required.'], 422);
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
    jasti_json(['message' => 'This manuscript is not assigned to you.'], 403);
}

$reviewCountStmt = $pdo->prepare('SELECT COUNT(*) FROM reviews WHERE manuscript_id = :manuscript_id');
$reviewCountStmt->execute(['manuscript_id' => $manuscriptId]);
if ((int) $reviewCountStmt->fetchColumn() < 2) {
    jasti_json(['message' => 'Editorial decisions require at least 2 completed reviewer reports first.'], 422);
}

$stmt = $pdo->prepare(
    'INSERT INTO editor_decisions (
        manuscript_id, editor_id, decision_type, decision_letter,
        journal_suitability, scientific_merit, innovation_level, ethical_compliance, language_quality,
        editorial_notes, decision_justification, transfer_journal, send_additional_review
     )
     VALUES (
        :manuscript_id, :editor_id, :decision_type, :decision_letter,
        :journal_suitability, :scientific_merit, :innovation_level, :ethical_compliance, :language_quality,
        :editorial_notes, :decision_justification, :transfer_journal, :send_additional_review
     )'
);
$stmt->execute([
    'manuscript_id' => $manuscriptId,
    'editor_id' => $userId,
    'decision_type' => $decisionType,
    'decision_letter' => $decisionLetter,
    'journal_suitability' => trim((string) ($data['journal_suitability'] ?? '')),
    'scientific_merit' => trim((string) ($data['scientific_merit'] ?? '')),
    'innovation_level' => trim((string) ($data['innovation_level'] ?? '')),
    'ethical_compliance' => trim((string) ($data['ethical_compliance'] ?? '')),
    'language_quality' => trim((string) ($data['language_quality'] ?? '')),
    'editorial_notes' => trim((string) ($data['editorial_notes'] ?? '')),
    'decision_justification' => trim((string) ($data['decision_justification'] ?? '')),
    'transfer_journal' => trim((string) ($data['transfer_journal'] ?? '')),
    'send_additional_review' => in_array((string) ($data['send_additional_review'] ?? ''), ['1', 'true', 'yes', 'on'], true) ? 1 : 0,
]);
$decisionId = (int) $pdo->lastInsertId();

$nextStatus = match ($decisionType) {
    'accept' => 'accepted',
    'reject' => 'rejected',
    default => 'revision_required',
};
$pdo->prepare('UPDATE manuscripts SET status = :status WHERE manuscript_id = :manuscript_id')->execute([
    'status' => $nextStatus,
    'manuscript_id' => $manuscriptId,
]);

$manuscriptNotifyStmt = $pdo->prepare(
    'SELECT m.title, m.reference_number, u.email, CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name
     FROM manuscripts m
     LEFT JOIN users u ON u.user_id = m.corresponding_author_id
     WHERE m.manuscript_id = :manuscript_id
     LIMIT 1'
);
$manuscriptNotifyStmt->execute(['manuscript_id' => $manuscriptId]);
$manuscriptNotify = $manuscriptNotifyStmt->fetch() ?: [];

if (in_array($decisionType, ['minor_revision', 'major_revision'], true)) {
    try {
        jasti_send_action_needed_email(
            (string) ($manuscriptNotify['email'] ?? ''),
            'JASTI manuscript revision required',
            'Revision required for your manuscript',
            sprintf(
                "Dear %s,\n\nThe editor has requested a %s for manuscript %s.\n\nTitle: %s\n\nPlease log in to view the decision letter and upload your revised DOC/DOCX file.",
                trim((string) ($manuscriptNotify['author_name'] ?? '')) !== '' ? trim((string) ($manuscriptNotify['author_name'] ?? '')) : 'Author',
                $decisionType === 'minor_revision' ? 'minor revision' : 'major revision',
                (string) ($manuscriptNotify['reference_number'] ?? '#' . $manuscriptId),
                (string) ($manuscriptNotify['title'] ?? '')
            ),
            'Open revision page',
            jasti_dashboard_action_url('author', 'revision')
        );
    } catch (Throwable $exception) {
        error_log(sprintf('Revision request email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
    }
}

jasti_log($pdo, $userId, 'recorded editor decision', 'editor_decisions', $decisionId);
jasti_json(['message' => 'Editorial decision recorded successfully.', 'decision_id' => $decisionId]);
