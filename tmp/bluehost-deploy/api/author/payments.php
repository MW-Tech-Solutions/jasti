<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();
$uploadedProofFile = null;
if (isset($_FILES['payment_proof']) && is_array($_FILES['payment_proof']) && (int) ($_FILES['payment_proof']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $uploadedProofFile = ajasti_store_uploaded_file(
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
    ajasti_json(['message' => 'Manuscript and payment reference are required.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT manuscript_id, status, reference_number
     FROM manuscripts
     WHERE manuscript_id = :manuscript_id AND corresponding_author_id = :author_id
     LIMIT 1'
);
$ownership->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
]);
$manuscript = $ownership->fetch();
if (!$manuscript) {
    ajasti_json(['message' => 'Manuscript not found for this author.'], 404);
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
        ajasti_json(['message' => 'Amount is required when creating a new payment record.'], 422);
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
    ajasti_send_mail(
        (string) ($recipient['email'] ?? ''),
        'JASTI manuscript payment submitted',
        "Payment details were submitted for manuscript {$manuscript['reference_number']} (#{$manuscriptId}).\nPayment Ref: {$paymentReference}\nAmount: {$amount}\nDetails: {$paymentDetails}"
    );
}
ajasti_log($pdo, $userId, 'submitted manuscript payment', 'manuscript_payments', $paymentId);
ajasti_json(['message' => 'Payment details submitted successfully.']);
