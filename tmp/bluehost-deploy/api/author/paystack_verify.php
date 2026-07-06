<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

if (ajasti_paystack_secret_key() === '') {
    ajasti_json(['message' => 'Online payment verification is not configured yet.'], 503);
}

$reference = trim((string) ($data['reference'] ?? ($data['trxref'] ?? '')));
if ($reference === '') {
    ajasti_json(['message' => 'Payment reference is required.'], 422);
}

try {
    $response = ajasti_http_json_request(
        'GET',
        ajasti_paystack_base_url() . '/transaction/verify/' . rawurlencode($reference),
        [
            'Authorization: Bearer ' . ajasti_paystack_secret_key(),
        ]
    );
} catch (Throwable $exception) {
    ajasti_json(['message' => 'Unable to verify Paystack payment.', 'error' => $exception->getMessage()], 500);
}

$body = $response['body'];
if (($response['status_code'] < 200 || $response['status_code'] >= 300) || !($body['status'] ?? false)) {
    ajasti_json(['message' => (string) ($body['message'] ?? 'Unable to verify payment.')], 422);
}

$paymentData = $body['data'] ?? [];
if (($paymentData['status'] ?? '') !== 'success') {
    ajasti_json(['message' => 'Payment has not been completed successfully.'], 422);
}

$metadata = is_array($paymentData['metadata'] ?? null) ? $paymentData['metadata'] : [];
$manuscriptId = (int) ($metadata['manuscript_id'] ?? 0);
if ($manuscriptId <= 0) {
    ajasti_json(['message' => 'Verified payment is missing manuscript context.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT manuscript_id
     FROM manuscripts
     WHERE manuscript_id = :manuscript_id AND corresponding_author_id = :author_id
     LIMIT 1'
);
$ownership->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
]);
if (!$ownership->fetch()) {
    ajasti_json(['message' => 'This verified payment does not belong to the current author.'], 403);
}

$amount = ((float) ($paymentData['amount'] ?? 0)) / 100;
$paymentDetails = sprintf(
    'Gateway: Paystack | Channel: %s | Paid at: %s | Currency: %s',
    (string) ($paymentData['channel'] ?? 'unknown'),
    (string) ($paymentData['paid_at'] ?? ''),
    (string) ($paymentData['currency'] ?? 'NGN')
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

ajasti_log($pdo, $userId, 'verified paystack payment', 'manuscript_payments', $paymentId);
ajasti_json([
    'message' => 'Paystack payment verified successfully.',
    'payment_id' => $paymentId,
    'reference' => $reference,
    'manuscript_id' => $manuscriptId,
]);
