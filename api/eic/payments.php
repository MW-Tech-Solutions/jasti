<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'editor_in_chief');
$userId = (int) $user['user_id'];
$data = jasti_request_data();

$paymentId = (int) ($data['payment_id'] ?? 0);
$action = trim((string) ($data['action'] ?? 'review'));
if ($paymentId <= 0 || !in_array($action, ['review', 'reject'], true)) {
    jasti_json(['message' => 'Payment and valid action are required.'], 422);
}

$paymentStmt = $pdo->prepare(
    'SELECT mp.payment_id, mp.proof_file_path, mp.amount, mp.manuscript_id, m.title, m.reference_number
     FROM manuscript_payments mp
     LEFT JOIN manuscripts m ON m.manuscript_id = mp.manuscript_id
     WHERE mp.payment_id = :payment_id
     LIMIT 1'
);
$paymentStmt->execute(['payment_id' => $paymentId]);
$payment = $paymentStmt->fetch();
if (!$payment) {
    jasti_json(['message' => 'Payment record not found.'], 404);
}

if (trim((string) ($payment['proof_file_path'] ?? '')) === '') {
    jasti_json(['message' => 'Receipt review requires an uploaded payment proof.'], 422);
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

jasti_log($pdo, $userId, $action === 'review' ? 'reviewed payment receipt' : 'rejected payment receipt', 'manuscript_payments', $paymentId);
if ($action === 'review' && (float) ($payment['amount'] ?? 0) >= jasti_manuscript_payment_base_amount()) {
    jasti_notify_role_users(
        $pdo,
        ['technical_editor'],
        'JASTI publication payment reviewed',
        'Final PDF upload needed',
        sprintf(
            "The publication payment receipt has been reviewed for manuscript %s.\n\nTitle: %s\n\nPlease upload the approved final PDF for publication.",
            (string) ($payment['reference_number'] ?? '#' . (int) ($payment['manuscript_id'] ?? 0)),
            (string) ($payment['title'] ?? '')
        ),
        'Open final PDF queue',
        jasti_dashboard_action_url('technical_editor', 'technical-screening')
    );
} elseif ($action === 'review' && (float) ($payment['amount'] ?? 0) >= jasti_submission_screening_payment_amount()) {
    jasti_notify_role_users(
        $pdo,
        ['technical_editor'],
        'JASTI submission payment reviewed',
        'Manuscript ready for technical screening',
        sprintf(
            "The submission payment receipt has been reviewed for manuscript %s.\n\nTitle: %s\n\nPlease log in as Technical Editor to view/download the submitted file and complete technical screening.",
            (string) ($payment['reference_number'] ?? '#' . (int) ($payment['manuscript_id'] ?? 0)),
            (string) ($payment['title'] ?? '')
        ),
        'Open technical screening',
        jasti_dashboard_action_url('technical_editor', 'technical-screening')
    );
}
jasti_json(['message' => $action === 'review' ? 'Payment receipt marked as reviewed.' : 'Payment receipt rejected.']);
