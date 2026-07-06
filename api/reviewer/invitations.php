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

$invitationId = (int) ($data['invitation_id'] ?? 0);
$response = trim((string) ($data['response'] ?? ''));
if ($invitationId <= 0 || !in_array($response, ['accepted', 'declined', 'extension_requested'], true)) {
    jasti_json(['message' => 'Invitation and valid response are required.'], 422);
}

if ($response === 'extension_requested') {
    $reason = trim((string) ($data['extension_reason'] ?? ''));
    $stmt = $pdo->prepare(
        'UPDATE review_invitations
         SET extension_requested = 1, extension_reason = :extension_reason, extension_requested_at = CURRENT_TIMESTAMP
         WHERE invitation_id = :invitation_id AND reviewer_id = :reviewer_id'
    );
    $stmt->execute([
        'extension_reason' => $reason,
        'invitation_id' => $invitationId,
        'reviewer_id' => $userId,
    ]);

    jasti_log($pdo, $userId, 'requested review extension', 'review_invitations', $invitationId);
    jasti_json(['message' => 'Extension request sent successfully.']);
}

$stmt = $pdo->prepare(
    'UPDATE review_invitations
     SET response = :response, response_date = CURRENT_TIMESTAMP
     WHERE invitation_id = :invitation_id AND reviewer_id = :reviewer_id'
);
$stmt->execute([
    'response' => $response,
    'invitation_id' => $invitationId,
    'reviewer_id' => $userId,
]);

jasti_log($pdo, $userId, 'responded to invitation', 'review_invitations', $invitationId);
jasti_json(['message' => 'Invitation response recorded successfully.']);
