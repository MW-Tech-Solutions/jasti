<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = jasti_request_data();

if (jasti_paystack_secret_key() === '') {
    jasti_json(['message' => 'Online payment verification is not configured yet.'], 503);
}

$reference = trim((string) ($data['reference'] ?? ($data['trxref'] ?? '')));
if ($reference === '') {
    jasti_json(['message' => 'Payment reference is required.'], 422);
}

try {
    $response = jasti_http_json_request(
        'GET',
        jasti_paystack_base_url() . '/transaction/verify/' . rawurlencode($reference),
        [
            'Authorization: Bearer ' . jasti_paystack_secret_key(),
        ]
    );
} catch (Throwable $exception) {
    jasti_json(['message' => 'Unable to verify Paystack payment.', 'error' => $exception->getMessage()], 500);
}

$body = $response['body'];
if (($response['status_code'] < 200 || $response['status_code'] >= 300) || !($body['status'] ?? false)) {
    jasti_json(['message' => (string) ($body['message'] ?? 'Unable to verify payment.')], 422);
}

$paymentData = $body['data'] ?? [];
if (($paymentData['status'] ?? '') !== 'success') {
    jasti_json(['message' => 'Payment has not been completed successfully.'], 422);
}

$metadata = is_array($paymentData['metadata'] ?? null) ? $paymentData['metadata'] : [];
$manuscriptId = (int) ($metadata['manuscript_id'] ?? 0);
if ($manuscriptId <= 0) {
    jasti_json(['message' => 'Verified payment is missing manuscript context.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT m.manuscript_id, m.title, m.reference_number, m.status, m.journal_id, j.journal_name
     FROM manuscripts m
     LEFT JOIN journals j ON j.journal_id = m.journal_id
     WHERE m.manuscript_id = :manuscript_id AND m.corresponding_author_id = :author_id
     LIMIT 1'
);
$ownership->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
]);
$manuscript = $ownership->fetch();
if (!$manuscript) {
    jasti_json(['message' => 'This verified payment does not belong to the current author.'], 403);
}
if (strtolower((string) ($manuscript['status'] ?? '')) === 'published') {
    jasti_json(['message' => 'This manuscript has already been published and is no longer available for submission fee payment.'], 422);
}

$amount = ((float) ($paymentData['amount'] ?? 0)) / 100;
$totalPages = max(1, (int) ($metadata['total_pages'] ?? 1));
$paymentType = strtolower(trim((string) ($metadata['payment_type'] ?? 'submission')));
if (!in_array($paymentType, ['submission', 'publication'], true)) {
    $paymentType = 'submission';
}
$expectedAmount = $paymentType === 'publication'
    ? jasti_manuscript_payment_base_amount()
    : jasti_submission_screening_payment_amount();
if ($paymentType === 'publication' && !in_array(strtolower((string) ($manuscript['status'] ?? '')), ['accepted', 'production'], true)) {
    jasti_json(['message' => 'Publication payment is available only after manuscript acceptance.'], 422);
}
$paidStmt = $pdo->prepare(
    'SELECT payment_id
     FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id
       AND author_id = :author_id
       AND payment_status IN ("confirmed", "reviewed")
       AND amount >= :amount
       AND payment_reference <> :payment_reference
     LIMIT 1'
);
$paidStmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'amount' => $expectedAmount,
    'payment_reference' => $reference,
]);
if ($paidStmt->fetchColumn()) {
    jasti_json(['message' => 'The submission fee has already been paid for this journal manuscript.'], 409);
}
if (abs($amount - $expectedAmount) > 0.01) {
    jasti_json([
        'message' => sprintf(
            'Verified payment amount does not match the required %s fee. Expected %s.',
            $paymentType === 'publication' ? 'publication' : 'submission screening',
            jasti_format_naira_amount($expectedAmount)
        ),
    ], 422);
}
$paymentDetails = sprintf(
    'Gateway: Paystack | Channel: %s | Paid at: %s | Currency: %s | %s fee',
    (string) ($paymentData['channel'] ?? 'unknown'),
    (string) ($paymentData['paid_at'] ?? ''),
    (string) ($paymentData['currency'] ?? 'NGN'),
    $paymentType === 'publication' ? 'Publication' : 'Submission screening'
);

$existing = $pdo->prepare(
    'SELECT payment_id
     FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id
       AND author_id = :author_id
       AND payment_reference = :payment_reference
     LIMIT 1'
);
$existing->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'payment_reference' => $reference,
]);
$existingId = $existing->fetchColumn();

if ($existingId !== false) {
    $update = $pdo->prepare(
        'UPDATE manuscript_payments
         SET amount = :amount,
             payment_details = :payment_details,
             payment_status = "confirmed"
         WHERE payment_id = :payment_id'
    );
    $update->execute([
        'amount' => $amount,
        'payment_details' => $paymentDetails,
        'payment_id' => (int) $existingId,
    ]);
    $paymentId = (int) $existingId;
} else {
    $insert = $pdo->prepare(
        'INSERT INTO manuscript_payments (manuscript_id, author_id, amount, payment_reference, payment_details, payment_status)
         VALUES (:manuscript_id, :author_id, :amount, :payment_reference, :payment_details, "confirmed")'
    );
    $insert->execute([
        'manuscript_id' => $manuscriptId,
        'author_id' => $userId,
        'amount' => $amount,
        'payment_reference' => $reference,
        'payment_details' => $paymentDetails,
    ]);
    $paymentId = (int) $pdo->lastInsertId();
}

jasti_log($pdo, $userId, 'verified paystack payment', 'manuscript_payments', $paymentId);
if ($paymentType === 'publication') {
    jasti_notify_role_users(
        $pdo,
        ['technical_editor'],
        'JASTI publication payment confirmed',
        'Final PDF upload needed',
        sprintf("The author has completed the publication payment for manuscript %s.\n\nTitle: %s\n\nPlease upload the approved final PDF for publication.", (string) ($manuscript['reference_number'] ?? '#' . $manuscriptId), (string) ($manuscript['title'] ?? '')),
        'Open final PDF queue',
        jasti_dashboard_action_url('technical_editor', 'technical-screening')
    );
} else {
    jasti_notify_role_users(
        $pdo,
        ['technical_editor'],
        'JASTI submission payment confirmed',
        'Manuscript ready for technical screening',
        sprintf("The author has completed the submission screening payment for manuscript %s.\n\nTitle: %s\n\nPlease log in as Technical Editor to view/download the submitted file and complete technical screening.", (string) ($manuscript['reference_number'] ?? '#' . $manuscriptId), (string) ($manuscript['title'] ?? '')),
        'Open technical screening',
        jasti_dashboard_action_url('technical_editor', 'technical-screening')
    );
}
jasti_json([
    'message' => 'Paystack payment verified successfully.',
    'payment_id' => $paymentId,
    'reference' => $reference,
    'manuscript_id' => $manuscriptId,
]);
