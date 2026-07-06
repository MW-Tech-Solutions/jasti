<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = jasti_request_data();
$uploadedProofFile = null;
if (isset($_FILES['payment_proof']) && is_array($_FILES['payment_proof']) && (int) ($_FILES['payment_proof']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $uploadedProofFile = jasti_store_uploaded_file(
        $_FILES['payment_proof'],
        'uploads/payments',
        'payment_proof',
        [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ]
    );
}

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$amount = is_numeric($data['amount'] ?? null) ? (float) $data['amount'] : 0.00;
$paymentReference = trim((string) ($data['payment_reference'] ?? ''));
$paymentDetails = trim((string) ($data['payment_details'] ?? ''));
$proofFilePath = $uploadedProofFile ?? trim((string) ($data['proof_file_path'] ?? ''));

if ($manuscriptId <= 0 || $paymentReference === '') {
    jasti_json(['message' => 'Manuscript and payment reference are required.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT m.manuscript_id, m.status, m.reference_number, m.journal_id, j.journal_name
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
    jasti_json(['message' => 'Manuscript not found for this author.'], 404);
}
if (strtolower((string) ($manuscript['status'] ?? '')) === 'published') {
    jasti_json(['message' => 'This manuscript has already been published and is no longer available for submission fee payment.'], 422);
}

$requiredSubmissionFee = jasti_submission_screening_payment_amount();
$requiredPublicationFee = jasti_manuscript_payment_base_amount();
$submissionPaidStmt = $pdo->prepare(
    'SELECT 1 FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id AND author_id = :author_id
       AND payment_status IN ("confirmed", "reviewed") AND amount >= :amount
     LIMIT 1'
);
$submissionPaidStmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'amount' => $requiredSubmissionFee,
]);
$submissionPaid = (bool) $submissionPaidStmt->fetchColumn();
$paymentType = (in_array(strtolower((string) ($manuscript['status'] ?? '')), ['accepted', 'production'], true) && $submissionPaid)
    ? 'publication'
    : 'submission';
$requiredAmount = $paymentType === 'publication' ? $requiredPublicationFee : $requiredSubmissionFee;
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
    'amount' => $requiredAmount,
]);
if ($paidStmt->fetchColumn()) {
    jasti_json(['message' => $paymentType === 'publication' ? 'The publication fee has already been paid for this manuscript.' : 'The submission fee has already been paid for this journal manuscript.'], 409);
}

$existingStmt = $pdo->prepare(
    'SELECT payment_id, amount, payment_status, proof_file_path, payment_details
     FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id
       AND author_id = :author_id
       AND payment_reference = :payment_reference
     LIMIT 1'
);
$existingStmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'payment_reference' => $paymentReference,
]);
$existingPayment = $existingStmt->fetch();

if ($existingPayment) {
    $effectiveAmount = $amount > 0 ? $amount : (float) ($existingPayment['amount'] ?? 0);
    $effectiveDetails = $paymentDetails !== '' ? $paymentDetails : (string) ($existingPayment['payment_details'] ?? '');
    $effectiveProof = $proofFilePath !== '' ? $proofFilePath : (string) ($existingPayment['proof_file_path'] ?? '');
    $status = (string) ($existingPayment['payment_status'] ?? 'submitted');
    $update = $pdo->prepare(
        'UPDATE manuscript_payments
         SET amount = :amount,
             payment_details = :payment_details,
             proof_file_path = :proof_file_path,
             payment_status = :payment_status
         WHERE payment_id = :payment_id'
    );
    $update->execute([
        'amount' => $effectiveAmount,
        'payment_details' => $effectiveDetails !== '' ? $effectiveDetails : null,
        'proof_file_path' => $effectiveProof !== '' ? $effectiveProof : null,
        'payment_status' => in_array($status, ['confirmed', 'reviewed'], true) ? 'confirmed' : 'submitted',
        'payment_id' => (int) $existingPayment['payment_id'],
    ]);
    $paymentId = (int) $existingPayment['payment_id'];
} else {
    if ($amount <= 0) {
        jasti_json(['message' => 'Amount is required when creating a new payment record.'], 422);
    }
    if ($amount < $requiredAmount) {
        jasti_json([
            'message' => sprintf('%s payment cannot be less than %s.', $paymentType === 'publication' ? 'Publication' : 'Submission', jasti_format_naira_amount($requiredAmount)),
        ], 422);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO manuscript_payments (manuscript_id, author_id, amount, payment_reference, payment_details, proof_file_path, payment_status)
         VALUES (:manuscript_id, :author_id, :amount, :payment_reference, :payment_details, :proof_file_path, "submitted")'
    );
    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'author_id' => $userId,
        'amount' => $amount,
        'payment_reference' => $paymentReference,
        'payment_details' => $paymentDetails !== '' ? $paymentDetails : null,
        'proof_file_path' => $proofFilePath !== '' ? $proofFilePath : null,
    ]);
    $paymentId = (int) $pdo->lastInsertId();
}
$eicStmt = $pdo->query(
    'SELECT u.email
     FROM users u
     INNER JOIN user_roles ur ON ur.user_id = u.user_id
     INNER JOIN roles r ON r.role_id = ur.role_id
     WHERE LOWER(r.role_name) = "editor_in_chief"'
);
foreach ($eicStmt->fetchAll() as $recipient) {
    try {
        jasti_send_action_needed_email(
            (string) ($recipient['email'] ?? ''),
            'JASTI manuscript payment submitted',
            'Payment receipt needs review',
            "Payment details were submitted for manuscript {$manuscript['reference_number']} (#{$manuscriptId}).\n\nPayment Ref: {$paymentReference}\nAmount: {$amount}\nDetails: {$paymentDetails}",
            'Open payment review',
            jasti_dashboard_action_url('editor_in_chief', 'ethics')
        );
    } catch (Throwable $exception) {
        error_log(sprintf('Payment review notification failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
    }
}
jasti_log($pdo, $userId, 'submitted manuscript payment', 'manuscript_payments', $paymentId);
jasti_json(['message' => 'Payment details submitted successfully.']);
