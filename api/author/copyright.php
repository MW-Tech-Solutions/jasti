<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = jasti_request_data();
$uploadedSignedFile = null;
if (isset($_FILES['signed_form']) && is_array($_FILES['signed_form']) && (int) ($_FILES['signed_form']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $uploadedSignedFile = jasti_store_uploaded_file(
        $_FILES['signed_form'],
        'uploads/copyright',
        'copyright_form',
        [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
        ]
    );
}

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$signedFilePath = $uploadedSignedFile ?? trim((string) ($data['signed_file_path'] ?? ''));
$notes = trim((string) ($data['notes'] ?? ''));

if ($manuscriptId <= 0 || $signedFilePath === '') {
    jasti_json(['message' => 'Manuscript and signed copyright form are required.'], 422);
}

$ownership = $pdo->prepare(
    'SELECT m.manuscript_id
     FROM manuscripts m
     WHERE m.manuscript_id = :manuscript_id
       AND m.corresponding_author_id = :author_id
       AND EXISTS (
           SELECT 1 FROM manuscript_payments mp
           WHERE mp.manuscript_id = m.manuscript_id
             AND mp.author_id = :author_id_check
       )
     LIMIT 1'
);
$ownership->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'author_id_check' => $userId,
]);
if (!$ownership->fetch()) {
    jasti_json(['message' => 'A payment record is required before uploading the copyright form.'], 422);
}

$stmt = $pdo->prepare(
    'INSERT INTO copyright_forms (manuscript_id, author_id, signed_file_path, notes, status)
     VALUES (:manuscript_id, :author_id, :signed_file_path, :notes, "submitted")'
);
$stmt->execute([
    'manuscript_id' => $manuscriptId,
    'author_id' => $userId,
    'signed_file_path' => $signedFilePath,
    'notes' => $notes !== '' ? $notes : null,
]);

$formId = (int) $pdo->lastInsertId();
jasti_log($pdo, $userId, 'submitted copyright form', 'copyright_forms', $formId);
jasti_json(['message' => 'Copyright form uploaded successfully.']);
