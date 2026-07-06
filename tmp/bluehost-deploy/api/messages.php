<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
ajasti_bootstrap();

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);
$userId = (int) $user['user_id'];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT m.message_id, m.subject, m.message_body, m.sent_date, m.read_status, m.manuscript_id,
                m.sender_id, m.receiver_id,
                CONCAT(COALESCE(s.first_name, ""), " ", COALESCE(s.last_name, "")) AS sender_name,
                CONCAT(COALESCE(r.first_name, ""), " ", COALESCE(r.last_name, "")) AS receiver_name
         FROM messages m
         LEFT JOIN users s ON s.user_id = m.sender_id
         LEFT JOIN users r ON r.user_id = m.receiver_id
         WHERE m.sender_id = :user_id OR m.receiver_id = :user_id
         ORDER BY m.sent_date DESC'
    );
    $stmt->execute(['user_id' => $userId]);
    $messages = array_map(static function (array $row) use ($user): array {
        $roles = $user['roles'] ?? [];
        if (in_array('reviewer', $roles, true) && (int) ($row['manuscript_id'] ?? 0) > 0) {
            $row['receiver_name'] = ((int) $row['receiver_id'] === (int) $user['user_id']) ? (string) $row['sender_name'] : 'Corresponding Author';
        }
        if (in_array('author', $roles, true) && (int) ($row['manuscript_id'] ?? 0) > 0 && (string) $row['sender_name'] !== '') {
            $row['sender_name'] = ((int) $row['sender_id'] === (int) $user['user_id']) ? (string) $row['receiver_name'] : 'Assigned Reviewer';
        }
        return $row;
    }, $stmt->fetchAll());
    ajasti_json(['messages' => $messages]);
}

ajasti_require_method('POST');
$data = ajasti_request_data();
$receiverId = (int) ($data['receiver_id'] ?? 0);
$subject = trim((string) ($data['subject'] ?? ''));
$messageBody = trim((string) ($data['message_body'] ?? ''));
$manuscriptId = isset($data['manuscript_id']) && (int) $data['manuscript_id'] > 0 ? (int) $data['manuscript_id'] : null;

if ($receiverId <= 0 && in_array('reviewer', $user['roles'], true) && $manuscriptId !== null) {
    $resolveAuthor = $pdo->prepare(
        'SELECT corresponding_author_id
         FROM manuscripts
         WHERE manuscript_id = :manuscript_id
           AND EXISTS (
               SELECT 1 FROM review_invitations
               WHERE manuscript_id = :manuscript_id_check
                 AND reviewer_id = :reviewer_id
                 AND response = "accepted"
           )
         LIMIT 1'
    );
    $resolveAuthor->execute([
        'manuscript_id' => $manuscriptId,
        'manuscript_id_check' => $manuscriptId,
        'reviewer_id' => $userId,
    ]);
    $receiverId = (int) ($resolveAuthor->fetchColumn() ?: 0);
}

if ($receiverId <= 0 || $subject === '' || $messageBody === '') {
    ajasti_json(['message' => 'Receiver, subject, and message body are required.'], 422);
}

$stmt = $pdo->prepare(
    'INSERT INTO messages (sender_id, receiver_id, manuscript_id, subject, message_body, read_status)
     VALUES (:sender_id, :receiver_id, :manuscript_id, :subject, :message_body, 0)'
);
$stmt->execute([
    'sender_id' => $userId,
    'receiver_id' => $receiverId,
    'manuscript_id' => $manuscriptId,
    'subject' => $subject,
    'message_body' => $messageBody,
]);

$messageId = (int) $pdo->lastInsertId();
ajasti_log($pdo, $userId, 'sent message', 'messages', $messageId);
ajasti_json(['message' => 'Message sent successfully.', 'message_id' => $messageId]);
