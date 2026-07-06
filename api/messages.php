<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
jasti_bootstrap();

$pdo = jasti_db();
jasti_ensure_message_thread_schema($pdo);
$user = jasti_require_auth($pdo);
$userId = (int) $user['user_id'];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT m.message_id, m.parent_message_id, m.subject, m.message_body, m.sent_date, m.read_status, m.email_sent, m.email_status, m.manuscript_id,
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
    jasti_json(['messages' => $messages]);
}

jasti_require_method('POST');
$data = jasti_request_data();
$receiverId = (int) ($data['receiver_id'] ?? 0);
$recipientType = strtolower(trim((string) ($data['recipient_type'] ?? '')));
$subject = trim((string) ($data['subject'] ?? ''));
$messageBody = trim((string) ($data['message_body'] ?? ''));
$manuscriptId = isset($data['manuscript_id']) && (int) $data['manuscript_id'] > 0 ? (int) $data['manuscript_id'] : null;
$parentMessageId = (int) ($data['parent_message_id'] ?? 0);

if ($parentMessageId > 0) {
    $parentStmt = $pdo->prepare(
        'SELECT message_id, parent_message_id, sender_id, receiver_id, manuscript_id, subject
         FROM messages
         WHERE message_id = :message_id
           AND (sender_id = :user_id OR receiver_id = :user_id)
         LIMIT 1'
    );
    $parentStmt->execute([
        'message_id' => $parentMessageId,
        'user_id' => $userId,
    ]);
    $parent = $parentStmt->fetch();
    if (!$parent) {
        jasti_json(['message' => 'Original message not found for reply.'], 404);
    }
    $parentMessageId = (int) ($parent['parent_message_id'] ?? 0) > 0 ? (int) $parent['parent_message_id'] : (int) $parent['message_id'];
    $receiverId = ((int) $parent['sender_id'] === $userId) ? (int) $parent['receiver_id'] : (int) $parent['sender_id'];
    $manuscriptId = (int) ($parent['manuscript_id'] ?? 0) > 0 ? (int) $parent['manuscript_id'] : $manuscriptId;
    if ($subject === '') {
        $subject = 'Re: ' . preg_replace('/^Re:\s*/i', '', (string) ($parent['subject'] ?? 'Message'));
    }
}

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

if ($receiverId <= 0 && jasti_has_editor_workspace_role($user['roles'] ?? []) && $manuscriptId !== null && in_array($recipientType, ['author', 'reviewer'], true)) {
    if ($recipientType === 'author') {
        $authorStmt = $pdo->prepare(
            'SELECT corresponding_author_id
             FROM manuscripts m
             WHERE m.manuscript_id = :manuscript_id
               AND EXISTS (
                   SELECT 1 FROM editor_assignments ea
                   WHERE ea.manuscript_id = m.manuscript_id
                     AND ea.editor_id = :editor_id
               )
             LIMIT 1'
        );
        $authorStmt->execute([
            'manuscript_id' => $manuscriptId,
            'editor_id' => $userId,
        ]);
        $receiverId = (int) ($authorStmt->fetchColumn() ?: 0);
    } elseif ($recipientType === 'reviewer') {
        $reviewerStmt = $pdo->prepare(
            'SELECT ri.reviewer_id
             FROM review_invitations ri
             INNER JOIN editor_assignments ea ON ea.manuscript_id = ri.manuscript_id
             WHERE ri.manuscript_id = :manuscript_id
               AND ea.editor_id = :editor_id
               AND ri.reviewer_id = :reviewer_id
             LIMIT 1'
        );
        $reviewerStmt->execute([
            'manuscript_id' => $manuscriptId,
            'editor_id' => $userId,
            'reviewer_id' => (int) ($data['reviewer_id'] ?? 0),
        ]);
        $receiverId = (int) ($reviewerStmt->fetchColumn() ?: 0);
    }
}

if ($receiverId <= 0 || $subject === '' || $messageBody === '') {
    jasti_json(['message' => 'Receiver, subject, and message body are required.'], 422);
}

$stmt = $pdo->prepare(
    'INSERT INTO messages (parent_message_id, sender_id, receiver_id, manuscript_id, subject, message_body, read_status)
     VALUES (:parent_message_id, :sender_id, :receiver_id, :manuscript_id, :subject, :message_body, 0)'
);
$stmt->execute([
    'parent_message_id' => $parentMessageId > 0 ? $parentMessageId : null,
    'sender_id' => $userId,
    'receiver_id' => $receiverId,
    'manuscript_id' => $manuscriptId,
    'subject' => $subject,
    'message_body' => $messageBody,
]);

$messageId = (int) $pdo->lastInsertId();
jasti_log($pdo, $userId, 'sent message', 'messages', $messageId);

$emailSent = false;
$emailMessage = 'Message saved in the workspace. No email was sent because the receiver email was unavailable.';
$nextEmailRetryAt = null;
$receiverStmt = $pdo->prepare(
    'SELECT email, first_name, last_name
     FROM users
     WHERE user_id = :receiver_id
     LIMIT 1'
);
$receiverStmt->execute(['receiver_id' => $receiverId]);
$receiver = $receiverStmt->fetch();
$receiverEmail = trim((string) ($receiver['email'] ?? ''));
if ($receiverEmail !== '' && filter_var($receiverEmail, FILTER_VALIDATE_EMAIL) !== false) {
    $senderName = trim((string) (($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''))) ?: 'JASTI editorial office';
    $receiverName = trim((string) (($receiver['first_name'] ?? '') . ' ' . ($receiver['last_name'] ?? ''))) ?: $receiverEmail;
    $mailText = "Dear {$receiverName},\n\n{$senderName} sent you a JASTI workspace message.\n\nSubject: {$subject}\n\n{$messageBody}\n\nPlease sign in to your dashboard to reply or view the full communication history.";
    try {
        jasti_send_html_email(
            $receiverEmail,
            'JASTI message: ' . $subject,
            nl2br(htmlspecialchars($mailText, ENT_QUOTES, 'UTF-8')),
            $mailText
        );
        $emailSent = true;
        $emailMessage = 'Message and email sent successfully.';
    } catch (Throwable $exception) {
        $emailMessage = 'Message saved, but email delivery failed right now.';
        $nextEmailRetryAt = date('Y-m-d H:i:s', time() + 300);
        error_log(sprintf('Workspace message email failed for message %d: %s', $messageId, $exception->getMessage()));
    }
}

$pdo->prepare(
    'UPDATE messages
     SET email_sent = :email_sent,
         email_status = :email_status,
         email_attempts = email_attempts + 1,
         next_email_retry_at = :next_email_retry_at
     WHERE message_id = :message_id'
)->execute([
    'email_sent' => $emailSent ? 1 : 0,
    'email_status' => $emailMessage,
    'next_email_retry_at' => $emailSent ? null : $nextEmailRetryAt,
    'message_id' => $messageId,
]);

jasti_json([
    'message' => 'Message sent successfully.',
    'message_id' => $messageId,
    'email_sent' => $emailSent,
    'email_message' => $emailMessage,
]);
