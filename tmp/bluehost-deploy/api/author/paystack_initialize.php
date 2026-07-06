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
    ajasti_json(['message' => 'Online payment is not configured yet. Add Paystack keys in the server environment before using this feature.'], 503);
}

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$amount = is_numeric($data['amount'] ?? null) ? (float) $data['amount'] : 0.00;
if ($manuscriptId <= 0 || $amount <= 0) {
    ajasti_json(['message' => 'Manuscript and amount are required for online payment.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT manuscript_id, title, reference_number, status
     FROM manuscripts
     WHERE manuscript_id = :manuscript_id
       AND corresponding_author_id = :author_id
       AND status IN ("accepted", "production", "published")
     LIMIT 1'
);
$ownership->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
]);
$manuscript = $ownership->fetch();
if (!$manuscript) {
    ajasti_json(['message' => 'Only accepted or production-ready manuscripts can proceed to payment.'], 422);
}

$reference = 'JASTI-' . $manuscriptId . '-' . strtoupper(bin2hex(random_bytes(4)));
$existingStmt = $pdo->prepare(
    'SELECT payment_id
     FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id
       AND author_id = :author_id
       AND payment_status IN ("initialized", "submitted")
     ORDER BY submitted_at DESC
     LIMIT 1'
);
$existingStmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
]);
$existingPaymentId = $existingStmt->fetchColumn();

$paymentDetails = 'Gateway: Paystack | Status: initialized';
if ($existingPaymentId !== false) {
    $update = $pdo->prepare(
        'UPDATE manuscript_payments
         SET amount = :amount,
             payment_reference = :payment_reference,
             payment_details = :payment_details,
             payment_status = "initialized"
         WHERE payment_id = :payment_id'
    );
    $update->execute([
        'amount' => $amount,
        'payment_reference' => $reference,
        'payment_details' => $paymentDetails,
        'payment_id' => (int) $existingPaymentId,
    ]);
} else {
    $insert = $pdo->prepare(
        'INSERT INTO manuscript_payments (manuscript_id, author_id, amount, payment_reference, payment_details, payment_status)
         VALUES (:manuscript_id, :author_id, :amount, :payment_reference, :payment_details, "initialized")'
    );
    $insert->execute([
        'manuscript_id' => $manuscriptId,
        'author_id' => $userId,
        'amount' => $amount,
        'payment_reference' => $reference,
        'payment_details' => $paymentDetails,
    ]);
}

$payload = [
    'email' => (string) $user['email'],
    'amount' => (int) round($amount * 100),
    'reference' => $reference,
    'currency' => 'NGN',
    'callback_url' => ajasti_frontend_url() . '/dashboard?paystack_callback=1',
    'metadata' => [
        'author_id' => $userId,
        'manuscript_id' => $manuscriptId,
        'manuscript_title' => (string) ($manuscript['title'] ?? ''),
        'manuscript_reference' => (string) ($manuscript['reference_number'] ?? ''),
        'journal' => 'JASTI',
    ],
];

try {
    $response = ajasti_http_json_request(
        'POST',
        ajasti_paystack_base_url() . '/transaction/initialize',
        [
            'Authorization: Bearer ' . ajasti_paystack_secret_key(),
        ],
        $payload
    );
} catch (Throwable $exception) {
    ajasti_json(['message' => 'Unable to initialize Paystack payment.', 'error' => $exception->getMessage()], 500);
}

$body = $response['body'];
if (($response['status_code'] < 200 || $response['status_code'] >= 300) || !($body['status'] ?? false)) {
    ajasti_json(['message' => (string) ($body['message'] ?? 'Unable to initialize Paystack payment.')], 422);
}

ajasti_json([
    'message' => 'Paystack payment initialized successfully.',
    'reference' => $reference,
    'authorization_url' => (string) ($body['data']['authorization_url'] ?? ''),
    'access_code' => (string) ($body['data']['access_code'] ?? ''),
]);
