<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'reviewer');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

$invitationId = (int) ($data['invitation_id'] ?? 0);
$response = trim((string) ($data['response'] ?? ''));
if ($invitationId <= 0 || !in_array($response, ['accepted', 'declined'], true)) {
    ajasti_json(['message' => 'Invitation and valid response are required.'], 422);
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

ajasti_log($pdo, $userId, 'responded to invitation', 'review_invitations', $invitationId);
ajasti_json(['message' => 'Invitation response recorded successfully.']);
