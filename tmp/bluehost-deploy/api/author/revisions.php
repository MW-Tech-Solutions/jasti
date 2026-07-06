<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();
$uploadedRevisionFile = null;
if (isset($_FILES['revised_file']) && is_array($_FILES['revised_file']) && (int) ($_FILES['revised_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $uploadedRevisionFile = ajasti_store_uploaded_file(
        $_FILES['revised_file'],
        'uploads/revisions',
        'revision_file',
        [
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        ]
    );
}

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$responseDocument = trim((string) ($data['response_document'] ?? ''));
$revisedFilePath = $uploadedRevisionFile ?? trim((string) ($data['revised_file_path'] ?? ''));
if ($manuscriptId <= 0 || $responseDocument === '') {
    ajasti_json(['message' => 'Manuscript and response document are required.'], 422);
}

$ownership = $pdo->prepare('SELECT version_number FROM manuscripts WHERE manuscript_id = :manuscript_id AND corresponding_author_id = :user_id LIMIT 1');
$ownership->execute(['manuscript_id' => $manuscriptId, 'user_id' => $userId]);
$currentVersion = $ownership->fetchColumn();
if ($currentVersion === false) {
    ajasti_json(['message' => 'Manuscript not found for this author.'], 404);
}

$pdo->beginTransaction();
try {
    $revisionNumber = ((int) $currentVersion) + 1;
    $stmt = $pdo->prepare(
        'INSERT INTO revisions (manuscript_id, revision_number, submitted_by, response_document, status)
         VALUES (:manuscript_id, :revision_number, :submitted_by, :response_document, :status)'
    );
    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'revision_number' => $revisionNumber,
        'submitted_by' => $userId,
        'response_document' => $responseDocument,
        'status' => 'submitted',
    ]);

    $pdo->prepare('UPDATE manuscripts SET version_number = :version_number, status = :status WHERE manuscript_id = :manuscript_id')
        ->execute([
            'version_number' => $revisionNumber,
            'status' => 'under_review',
            'manuscript_id' => $manuscriptId,
        ]);

    if ($revisedFilePath !== '') {
        $fileStmt = $pdo->prepare(
            'INSERT INTO manuscript_files (manuscript_id, file_type, file_path, version, uploaded_by)
             VALUES (:manuscript_id, :file_type, :file_path, :version, :uploaded_by)'
        );
        $fileStmt->execute([
            'manuscript_id' => $manuscriptId,
            'file_type' => 'revised_manuscript',
            'file_path' => $revisedFilePath,
            'version' => $revisionNumber,
            'uploaded_by' => $userId,
        ]);
    }

    $pdo->commit();
    ajasti_log($pdo, $userId, 'submitted revision', 'revisions', (int) $pdo->lastInsertId());
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ajasti_json(['message' => 'Unable to submit revision.', 'error' => $exception->getMessage()], 500);
}

ajasti_json(['message' => 'Revision submitted successfully.']);
