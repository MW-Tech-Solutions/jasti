<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
ajasti_ensure_manuscript_reference_number($pdo);
$user = ajasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

$title = trim((string) ($data['title'] ?? ''));
$abstract = trim((string) ($data['abstract'] ?? ''));
$keywords = trim((string) ($data['keywords'] ?? ''));
$articleType = trim((string) ($data['article_type'] ?? 'Original Research Article'));
$authors = is_array($data['authors'] ?? null) ? $data['authors'] : [];
if ($authors === [] && isset($data['authors']) && is_string($data['authors']) && trim($data['authors']) !== '') {
    $decodedAuthors = json_decode((string) $data['authors'], true);
    $authors = is_array($decodedAuthors) ? $decodedAuthors : [];
}

$uploadedFiles = [];
$pendingUploadFiles = [];
if (isset($_FILES['manuscript_file']) && is_array($_FILES['manuscript_file']) && (int) ($_FILES['manuscript_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $pendingUploadFiles[] = [
        'file_type' => 'manuscript',
        'prefix' => 'manuscript_file',
        'upload' => $_FILES['manuscript_file'],
        'allowed_mime_map' => [
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'text/x-tex' => 'tex',
            'application/x-tex' => 'tex',
            'text/plain' => 'tex',
        ],
    ];
}
if (isset($_FILES['supplementary_file']) && is_array($_FILES['supplementary_file']) && (int) ($_FILES['supplementary_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $pendingUploadFiles[] = [
        'file_type' => 'supplementary',
        'prefix' => 'supplementary_file',
        'upload' => $_FILES['supplementary_file'],
        'allowed_mime_map' => [
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/zip' => 'zip',
            'application/x-zip-compressed' => 'zip',
            'text/csv' => 'csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
        ],
    ];
}

if ($title === '' || $abstract === '' || $keywords === '') {
    ajasti_json(['message' => 'Title, abstract, and keywords are required.'], 422);
}
if ($pendingUploadFiles === [] && (array) ($data['files'] ?? []) === []) {
    ajasti_json(['message' => 'A manuscript file is required for submission.'], 422);
}

$manuscriptUpload = $_FILES['manuscript_file'] ?? null;
if (!is_array($manuscriptUpload) || (int) ($manuscriptUpload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    ajasti_json(['message' => 'A manuscript file is required for submission.'], 422);
}

$journalId = ajasti_first_journal_id($pdo);
$pdo->beginTransaction();
try {
    $referenceNumber = ajasti_generate_reference_number($pdo);
    $stmt = $pdo->prepare(
        'INSERT INTO manuscripts (title, abstract, keywords, reference_number, journal_id, corresponding_author_id, status, article_type, plagiarism_score, version_number)
         VALUES (:title, :abstract, :keywords, :reference_number, :journal_id, :corresponding_author_id, :status, :article_type, :plagiarism_score, 1)'
    );
    $stmt->execute([
        'title' => $title,
        'abstract' => $abstract,
        'keywords' => $keywords,
        'reference_number' => $referenceNumber,
        'journal_id' => $journalId,
        'corresponding_author_id' => $userId,
        'status' => 'submitted',
        'article_type' => $articleType,
        'plagiarism_score' => null,
    ]);
    $manuscriptId = (int) $pdo->lastInsertId();

    $authorRows = $authors !== [] ? $authors : [[
        'author_id' => $userId,
        'affiliation' => $user['institution'] ?? '',
        'is_corresponding' => true,
    ]];

    $authorStmt = $pdo->prepare(
        'INSERT INTO manuscript_authors (manuscript_id, author_id, author_order, is_corresponding, affiliation)
         VALUES (:manuscript_id, :author_id, :author_order, :is_corresponding, :affiliation)'
    );
    foreach ($authorRows as $index => $author) {
        $authorStmt->execute([
            'manuscript_id' => $manuscriptId,
            'author_id' => (int) ($author['author_id'] ?? $userId),
            'author_order' => $index + 1,
            'is_corresponding' => !empty($author['is_corresponding']) ? 1 : 0,
            'affiliation' => trim((string) ($author['affiliation'] ?? '')),
        ]);
    }

    $fileStmt = $pdo->prepare(
        'INSERT INTO manuscript_files (manuscript_id, file_type, file_path, version, uploaded_by)
         VALUES (:manuscript_id, :file_type, :file_path, :version, :uploaded_by)'
    );
    foreach ($pendingUploadFiles as $pendingUpload) {
        $uploadedFiles[] = [
            'file_type' => $pendingUpload['file_type'],
            'file_path' => ajasti_store_uploaded_file(
                $pendingUpload['upload'],
                'uploads/manuscripts',
                (string) $pendingUpload['prefix'],
                (array) $pendingUpload['allowed_mime_map']
            ),
        ];
    }
    foreach (array_merge((array) ($data['files'] ?? []), $uploadedFiles) as $file) {
        $path = trim((string) ($file['file_path'] ?? ''));
        if ($path === '') {
            continue;
        }
        $fileStmt->execute([
            'manuscript_id' => $manuscriptId,
            'file_type' => trim((string) ($file['file_type'] ?? 'manuscript')),
            'file_path' => $path,
            'version' => 1,
            'uploaded_by' => $userId,
        ]);
    }

    $pdo->commit();
    ajasti_log($pdo, $userId, 'created manuscript', 'manuscripts', $manuscriptId);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ajasti_json(['message' => 'Unable to create manuscript.', 'error' => $exception->getMessage()], 500);
}

ajasti_json([
    'message' => 'Manuscript submitted successfully.',
    'manuscript_id' => $manuscriptId,
    'reference_number' => $referenceNumber,
    'plagiarism_score' => null,
]);
