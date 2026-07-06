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
    jasti_json(['message' => 'Online payment is not configured yet. Add Paystack keys in the server environment before using this feature.'], 503);
}

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$amount = is_numeric($data['amount'] ?? null) ? (float) $data['amount'] : 0.00;
$totalPages = max(1, (int) ($data['total_pages'] ?? 1));
if ($manuscriptId <= 0) {
    jasti_json(['message' => 'Manuscript is required for online payment.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT m.manuscript_id, m.title, m.reference_number, m.status, m.journal_id, j.journal_name
     FROM manuscripts m
     LEFT JOIN journals j ON j.journal_id = m.journal_id
     WHERE m.manuscript_id = :manuscript_id
       AND m.corresponding_author_id = :author_id
     LIMIT 1'
);
$ownership->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
]);
$manuscript = $ownership->fetch();
if (!$manuscript) {
    jasti_json(['message' => 'Manuscript not found for this author.'], 422);
}
if (strtolower((string) ($manuscript['status'] ?? '')) === 'published') {
    jasti_json(['message' => 'This manuscript has already been published and is no longer available for submission fee payment.'], 422);
}

$submissionAmount = jasti_submission_screening_payment_amount();
$publicationAmount = jasti_manuscript_payment_base_amount();
$submissionPaidStmt = $pdo->prepare(
    'SELECT 1 FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id AND author_id = :author_id
       AND payment_status IN ("confirmed", "reviewed") AND amount >= :amount
     LIMIT 1'
);
$submissionPaidStmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'amount' => $submissionAmount,
]);
$submissionPaid = (bool) $submissionPaidStmt->fetchColumn();
$paymentType = (in_array(strtolower((string) ($manuscript['status'] ?? '')), ['accepted', 'production'], true) && $submissionPaid)
    ? 'publication'
    : 'submission';
$expectedAmount = $paymentType === 'publication' ? $publicationAmount : $submissionAmount;
$paidStmt = $pdo->prepare(
    'SELECT 1
     FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id
       AND author_id = :author_id
       AND payment_status IN ("confirmed", "reviewed")
       AND amount >= :amount
     LIMIT 1'
);
$paidStmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'amount' => $expectedAmount,
]);
if ($paidStmt->fetchColumn()) {
    jasti_json(['message' => $paymentType === 'publication' ? 'The publication fee has already been paid for this manuscript.' : 'The submission fee has already been paid for this journal manuscript.'], 409);
}
if (abs($amount - $expectedAmount) > 0.01) {
    jasti_json([
        'message' => sprintf(
            '%s payment amount must be %s.',
            $paymentType === 'publication' ? 'Publication' : 'Submission',
            jasti_format_naira_amount($expectedAmount)
        ),
        'expected_amount' => $expectedAmount,
        'total_pages' => 1,
    ], 422);
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

$paymentDetails = sprintf(
    'Gateway: Paystack | Status: initialized | %s fee: %s',
    $paymentType === 'publication' ? 'Publication' : 'Submission screening',
    jasti_format_naira_amount($expectedAmount)
);
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
    'callback_url' => jasti_frontend_url() . '/dashboard?paystack_callback=1',
    'metadata' => [
        'author_id' => $userId,
        'manuscript_id' => $manuscriptId,
        'manuscript_title' => (string) ($manuscript['title'] ?? ''),
        'manuscript_reference' => (string) ($manuscript['reference_number'] ?? ''),
        'total_pages' => $totalPages,
        'expected_amount' => $expectedAmount,
        'payment_type' => $paymentType,
        'journal_id' => (int) ($manuscript['journal_id'] ?? 0),
        'journal' => (string) ($manuscript['journal_name'] ?? 'JASTI'),
    ],
];

try {
    $response = jasti_http_json_request(
        'POST',
        jasti_paystack_base_url() . '/transaction/initialize',
        [
            'Authorization: Bearer ' . jasti_paystack_secret_key(),
        ],
        $payload
    );
} catch (Throwable $exception) {
    jasti_json(['message' => 'Unable to initialize Paystack payment.', 'error' => $exception->getMessage()], 500);
}

$body = $response['body'];
if (($response['status_code'] < 200 || $response['status_code'] >= 300) || !($body['status'] ?? false)) {
    jasti_json(['message' => (string) ($body['message'] ?? 'Unable to initialize Paystack payment.')], 422);
}

jasti_json([
    'message' => 'Paystack payment initialized successfully.',
    'reference' => $reference,
    'authorization_url' => (string) ($body['data']['authorization_url'] ?? ''),
    'access_code' => (string) ($body['data']['access_code'] ?? ''),
]);
