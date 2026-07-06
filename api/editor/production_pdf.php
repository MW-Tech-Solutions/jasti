<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
$roles = (array) ($user['roles'] ?? []);
if (!in_array('technical_editor', $roles, true)) {
    jasti_json(['message' => 'Only technical editors can upload the final publication PDF.'], 403);
}
$userId = (int) $user['user_id'];
$data = jasti_request_data();
$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
if ($manuscriptId <= 0) {
    jasti_json(['message' => 'Manuscript is required.'], 422);
}
if (!isset($_FILES['publication_pdf']) || !is_array($_FILES['publication_pdf']) || (int) ($_FILES['publication_pdf']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    jasti_json(['message' => 'Upload the approved publication PDF before marking it ready.'], 422);
}

$manuscriptStmt = $pdo->prepare(
    'SELECT manuscript_id, title, reference_number, status
     FROM manuscripts
     WHERE manuscript_id = :manuscript_id
     LIMIT 1'
);
$manuscriptStmt->execute(['manuscript_id' => $manuscriptId]);
$manuscript = $manuscriptStmt->fetch();
if (!$manuscript) {
    jasti_json(['message' => 'Manuscript not found.'], 404);
}
$status = strtolower((string) ($manuscript['status'] ?? ''));
if (!in_array($status, ['accepted', 'production'], true)) {
    jasti_json(['message' => 'Final PDF can only be uploaded after the manuscript is accepted and awaiting publication.'], 422);
}

$paymentStmt = $pdo->prepare(
    'SELECT 1
     FROM manuscript_payments
     WHERE manuscript_id = :manuscript_id
       AND payment_status IN ("confirmed", "reviewed")
       AND (
           amount >= :amount
           OR LOWER(COALESCE(payment_details, "")) LIKE "%publication%"
       )
     LIMIT 1'
);
$paymentStmt->execute([
    'manuscript_id' => $manuscriptId,
    'amount' => jasti_manuscript_payment_base_amount(),
]);
if (!$paymentStmt->fetchColumn()) {
    jasti_json(['message' => 'The author must complete the publication payment before the final PDF can be uploaded.'], 422);
}

$pdfPath = jasti_store_uploaded_file(
    $_FILES['publication_pdf'],
    'uploads/publications',
    'publication_pdf',
    ['application/pdf' => 'pdf']
);

$versionStmt = $pdo->prepare('SELECT COALESCE(MAX(version), 0) + 1 FROM manuscript_files WHERE manuscript_id = :manuscript_id');
$versionStmt->execute(['manuscript_id' => $manuscriptId]);
$version = max(1, (int) $versionStmt->fetchColumn());

$fileStmt = $pdo->prepare(
    'INSERT INTO manuscript_files (manuscript_id, file_type, file_path, version, uploaded_by)
     VALUES (:manuscript_id, "publication_pdf", :file_path, :version, :uploaded_by)'
);
$fileStmt->execute([
    'manuscript_id' => $manuscriptId,
    'file_path' => $pdfPath,
    'version' => $version,
    'uploaded_by' => $userId,
]);

$pdo->prepare('UPDATE manuscripts SET status = "production" WHERE manuscript_id = :manuscript_id')
    ->execute(['manuscript_id' => $manuscriptId]);

jasti_notify_role_users(
    $pdo,
    ['editor_in_chief'],
    'JASTI final publication PDF ready',
    'Final PDF ready for publication',
    sprintf(
        "The Technical Editor has uploaded the approved publication PDF for manuscript %s.\n\nTitle: %s\n\nPlease log in as Editor-in-Chief to publish it.",
        (string) ($manuscript['reference_number'] ?? '#' . $manuscriptId),
        (string) ($manuscript['title'] ?? '')
    ),
    'Open publication queue',
    jasti_dashboard_action_url('editor_in_chief', 'scheduling')
);

jasti_log($pdo, $userId, 'uploaded final publication pdf', 'manuscript_files', (int) $pdo->lastInsertId());
jasti_json(['message' => 'Final publication PDF uploaded and marked ready for publication.', 'file_path' => $pdfPath]);
