<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'editor_in_chief');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

$paymentId = (int) ($data['payment_id'] ?? 0);
$action = trim((string) ($data['action'] ?? 'review'));
if ($paymentId <= 0 || !in_array($action, ['review', 'reject'], true)) {
    ajasti_json(['message' => 'Payment and valid action are required.'], 422);
}

$paymentStmt = $pdo->prepare(
    'SELECT payment_id, proof_file_path
     FROM manuscript_payments
     WHERE payment_id = :payment_id
     LIMIT 1'
);
$paymentStmt->execute(['payment_id' => $paymentId]);
$payment = $paymentStmt->fetch();
if (!$payment) {
    ajasti_json(['message' => 'Payment record not found.'], 404);
}

if (trim((string) ($payment['proof_file_path'] ?? '')) === '') {
    ajasti_json(['message' => 'Receipt review requires an uploaded payment proof.'], 422);
}

$status = $action === 'review' ? 'reviewed' : 'rejected';
$update = $pdo->prepare(
    'UPDATE manuscript_payments
     SET payment_status = :payment_status
     WHERE payment_id = :payment_id'
);
$update->execute([
    'payment_status' => $status,
    'payment_id' => $paymentId,
]);

ajasti_log($pdo, $userId, $action === 'review' ? 'reviewed payment receipt' : 'rejected payment receipt', 'manuscript_payments', $paymentId);
ajasti_json(['message' => $action === 'review' ? 'Payment receipt marked as reviewed.' : 'Payment receipt rejected.']);
