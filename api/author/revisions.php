<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = jasti_request_data();
$uploadedRevisionFile = null;
if (isset($_FILES['revised_file']) && is_array($_FILES['revised_file']) && (int) ($_FILES['revised_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $uploadedRevisionFile = jasti_store_uploaded_file(
        $_FILES['revised_file'],
        'uploads/revisions',
        'revision_file',
        [
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        ]
    );
}

$manuscriptId = (int) ($data['manuscript_id'] ?? 0);
$responseDocument = trim((string) ($data['response_document'] ?? ''));
$revisedFilePath = $uploadedRevisionFile ?? '';
if ($manuscriptId <= 0 || $responseDocument === '' || $revisedFilePath === '') {
    jasti_json(['message' => 'Manuscript, response document, and a DOC/DOCX revised manuscript file are required.'], 422);
}

$ownership = $pdo->prepare('SELECT version_number, status, title, reference_number FROM manuscripts WHERE manuscript_id = :manuscript_id AND corresponding_author_id = :user_id LIMIT 1');
$ownership->execute(['manuscript_id' => $manuscriptId, 'user_id' => $userId]);
$manuscript = $ownership->fetch();
if (!$manuscript) {
    jasti_json(['message' => 'Manuscript not found for this author.'], 404);
}
if ((string) ($manuscript['status'] ?? '') !== 'revision_required') {
    jasti_json(['message' => 'This manuscript is not currently open for revision.'], 422);
}

$pdo->beginTransaction();
try {
    $revisionNumber = ((int) ($manuscript['version_number'] ?? 0)) + 1;
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
    $revisionId = (int) $pdo->lastInsertId();

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
    jasti_log($pdo, $userId, 'submitted revision', 'revisions', $revisionId);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jasti_json(['message' => 'Unable to submit revision.', 'error' => $exception->getMessage()], 500);
}

$editorStmt = $pdo->prepare(
    'SELECT DISTINCT u.email
     FROM editor_assignments ea
     INNER JOIN users u ON u.user_id = ea.editor_id
     WHERE ea.manuscript_id = :manuscript_id'
);
$editorStmt->execute(['manuscript_id' => $manuscriptId]);
foreach ($editorStmt->fetchAll() as $recipient) {
    try {
        jasti_send_action_needed_email(
            (string) ($recipient['email'] ?? ''),
            'JASTI revised manuscript submitted',
            'Author revision needs review',
            sprintf(
                "The author has submitted a revised DOC/DOCX manuscript for %s.\n\nTitle: %s\n\nPlease log in to continue the editorial workflow.",
                (string) ($manuscript['reference_number'] ?? '#' . $manuscriptId),
                (string) ($manuscript['title'] ?? '')
            ),
            'Open editor dashboard',
            jasti_dashboard_action_url('editor', 'decisions')
        );
    } catch (Throwable $exception) {
        error_log(sprintf('Revision submission notification failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
    }
}

jasti_json(['message' => 'Revision submitted successfully.']);
