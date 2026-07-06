<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

const MANUSCRIPT_ABSTRACT_WORD_LIMIT = 400;
const MANUSCRIPT_KEYWORD_WORD_LIMIT = 20;
const MANUSCRIPT_SCOPE_AREAS = [
    'Applied Information and Communication Technology (ICT)',
    'Engineering Systems, Design, and Optimization',
    'Applied Physical and Chemical Sciences',
    'Biological and Life Sciences Applications',
    'Agricultural Science, Agri-Technology, and Food Systems',
    'Environmental Science, Sustainability, and Climate Solutions',
    'Technology-Driven Innovation and Product Development',
    'Science, Technology, Engineering, and Mathematics (STEM) Education',
    'Educational Technology and Digital Learning Systems',
    'Management Science, Operations, and Organizational Innovation',
    'Entrepreneurship, Business Innovation, and Technology Transfer',
];

function manuscript_word_count(string $value): int
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return 0;
    }

    return count(preg_split('/\s+/u', $trimmed, -1, PREG_SPLIT_NO_EMPTY) ?: []);
}

function manuscript_author_display_name(array $author): string
{
    $name = trim((string) ($author['author_name'] ?? ''));
    if ($name !== '') {
        return $name;
    }

    $firstName = trim((string) ($author['first_name'] ?? ''));
    $lastName = trim((string) ($author['last_name'] ?? ''));
    $fullName = trim($firstName . ' ' . $lastName);
    if ($fullName !== '') {
        return $fullName;
    }

    return trim((string) ($author['email'] ?? ''));
}

$pdo = jasti_db();
jasti_ensure_manuscript_reference_number($pdo);
jasti_ensure_manuscript_scope_schema($pdo);
jasti_ensure_technical_screening_schema($pdo);
jasti_ensure_manuscript_author_schema($pdo);
$user = jasti_require_role($pdo, 'author');
$userId = (int) $user['user_id'];
$data = jasti_request_data();

$title = trim((string) ($data['title'] ?? ''));
$scopeArea = trim((string) ($data['scope_area'] ?? ''));
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
                'application/msword' => 'doc',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            ],
        ];
}
if (isset($_FILES['supplementary_file']) && is_array($_FILES['supplementary_file']) && (int) ($_FILES['supplementary_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    jasti_json(['message' => 'Only the main manuscript file is allowed at initial submission. Upload DOC or DOCX only.'], 422);
}

$existingFiles = array_values(array_filter(
    (array) ($data['files'] ?? []),
    static fn ($file): bool => is_array($file) && trim((string) ($file['file_path'] ?? '')) !== ''
));
$hasManuscriptFile = false;
foreach ($pendingUploadFiles as $pendingUpload) {
    if (($pendingUpload['file_type'] ?? '') === 'manuscript') {
        $hasManuscriptFile = true;
    }
}
foreach ($existingFiles as $file) {
    $fileType = trim((string) ($file['file_type'] ?? ''));
    if ($fileType === 'manuscript') {
        $hasManuscriptFile = true;
    }
    $path = strtolower(trim((string) ($file['file_path'] ?? '')));
    if ($fileType !== 'manuscript' || !preg_match('/\.(doc|docx)$/', $path)) {
        jasti_json(['message' => 'Only one DOC or DOCX manuscript file is allowed at initial submission.'], 422);
    }
}

if ($title === '') {
    jasti_json(['message' => 'Title is required.'], 422);
}
if ($scopeArea === '') {
    jasti_json(['message' => 'Scope area is required.'], 422);
}
if (!in_array($scopeArea, MANUSCRIPT_SCOPE_AREAS, true)) {
    jasti_json(['message' => 'Select a valid scope area before submitting.'], 422);
}
if ($articleType === '') {
    jasti_json(['message' => 'Article type is required.'], 422);
}
if ($abstract === '') {
    jasti_json(['message' => 'Abstract is required.'], 422);
}
if (manuscript_word_count($abstract) > MANUSCRIPT_ABSTRACT_WORD_LIMIT) {
    jasti_json(['message' => 'Abstract cannot exceed 400 words.'], 422);
}
if ($keywords === '') {
    jasti_json(['message' => 'Keywords are required.'], 422);
}
if (manuscript_word_count($keywords) > MANUSCRIPT_KEYWORD_WORD_LIMIT) {
    jasti_json(['message' => 'Keywords cannot exceed 20 words.'], 422);
}
if (!$hasManuscriptFile) {
    jasti_json(['message' => 'A manuscript file is required for submission.'], 422);
}

$resolvedAuthors = [[
    'author_id' => $userId,
    'author_name' => manuscript_author_display_name($user),
    'author_email' => trim((string) ($user['email'] ?? '')),
    'affiliation' => trim((string) ($user['institution'] ?? '')),
    'is_corresponding' => true,
]];
$knownAuthors = [
    strtolower(trim((string) ($user['email'] ?? ''))) => true,
    'user:' . $userId => true,
];

$linkedAuthorStmt = $pdo->prepare(
    'SELECT user_id, first_name, last_name, email, institution
     FROM users
     WHERE user_id = :user_id
     LIMIT 1'
);

foreach ($authors as $author) {
    if (!is_array($author)) {
        continue;
    }

    $authorId = (int) ($author['author_id'] ?? 0);
    $linkedAuthor = null;
    if ($authorId > 0 && $authorId !== $userId) {
        $linkedAuthorStmt->execute(['user_id' => $authorId]);
        $linkedAuthor = $linkedAuthorStmt->fetch() ?: null;
        if (!$linkedAuthor) {
            $authorId = 0;
        }
    } else {
        $authorId = 0;
    }

    $authorName = trim((string) ($author['author_name'] ?? ''));
    if ($authorName === '' && is_array($linkedAuthor)) {
        $authorName = manuscript_author_display_name($linkedAuthor);
    }

    $authorEmail = strtolower(trim((string) ($author['author_email'] ?? '')));
    if ($authorEmail === '' && is_array($linkedAuthor)) {
        $authorEmail = strtolower(trim((string) ($linkedAuthor['email'] ?? '')));
    }

    $affiliation = trim((string) ($author['affiliation'] ?? ''));
    if ($affiliation === '' && is_array($linkedAuthor)) {
        $affiliation = trim((string) ($linkedAuthor['institution'] ?? ''));
    }

    if ($authorName === '' && $authorEmail === '' && $affiliation === '') {
        continue;
    }

    if ($authorName === '') {
        jasti_json(['message' => 'Each additional contributor must include a full name before submission.'], 422);
    }

    if ($authorEmail !== '' && filter_var($authorEmail, FILTER_VALIDATE_EMAIL) === false) {
        jasti_json(['message' => sprintf('Enter a valid email address for %s or leave the email field blank.', $authorName)], 422);
    }

    $duplicateKey = $authorId > 0 ? 'user:' . $authorId : 'email:' . $authorEmail;
    if ($duplicateKey !== 'email:' && isset($knownAuthors[$duplicateKey])) {
        continue;
    }
    if ($authorEmail !== '' && isset($knownAuthors[$authorEmail])) {
        continue;
    }

    $resolvedAuthors[] = [
        'author_id' => $authorId > 0 ? $authorId : null,
        'author_name' => $authorName,
        'author_email' => $authorEmail,
        'affiliation' => $affiliation,
        'is_corresponding' => false,
    ];

    if ($authorId > 0) {
        $knownAuthors['user:' . $authorId] = true;
    }
    if ($authorEmail !== '') {
        $knownAuthors[$authorEmail] = true;
        $knownAuthors['email:' . $authorEmail] = true;
    }
}

$journalId = jasti_first_journal_id($pdo);
$pdo->beginTransaction();
try {
    $referenceNumber = jasti_generate_reference_number($pdo);
    $stmt = $pdo->prepare(
        'INSERT INTO manuscripts (title, scope_area, abstract, keywords, reference_number, journal_id, corresponding_author_id, status, article_type, plagiarism_score, version_number)
         VALUES (:title, :scope_area, :abstract, :keywords, :reference_number, :journal_id, :corresponding_author_id, :status, :article_type, :plagiarism_score, 1)'
    );
    $stmt->execute([
        'title' => $title,
        'scope_area' => $scopeArea,
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

    $authorStmt = $pdo->prepare(
        'INSERT INTO manuscript_authors (manuscript_id, author_id, author_order, is_corresponding, affiliation, author_name, author_email)
         VALUES (:manuscript_id, :author_id, :author_order, :is_corresponding, :affiliation, :author_name, :author_email)'
    );
    foreach ($resolvedAuthors as $index => $author) {
        $authorStmt->execute([
            'manuscript_id' => $manuscriptId,
            'author_id' => isset($author['author_id']) ? (int) $author['author_id'] : null,
            'author_order' => $index + 1,
            'is_corresponding' => !empty($author['is_corresponding']) ? 1 : 0,
            'affiliation' => trim((string) ($author['affiliation'] ?? '')),
            'author_name' => trim((string) ($author['author_name'] ?? '')),
            'author_email' => trim((string) ($author['author_email'] ?? '')),
        ]);
    }

    $fileStmt = $pdo->prepare(
        'INSERT INTO manuscript_files (manuscript_id, file_type, file_path, version, uploaded_by)
         VALUES (:manuscript_id, :file_type, :file_path, :version, :uploaded_by)'
    );
    foreach ($pendingUploadFiles as $pendingUpload) {
        $uploadedFiles[] = [
            'file_type' => $pendingUpload['file_type'],
            'file_path' => jasti_store_uploaded_file(
                $pendingUpload['upload'],
                'uploads/manuscripts',
                (string) $pendingUpload['prefix'],
                (array) $pendingUpload['allowed_mime_map']
            ),
        ];
    }
    foreach (array_merge($existingFiles, $uploadedFiles) as $file) {
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

    $screeningStmt = $pdo->prepare(
        'INSERT INTO technical_screenings (manuscript_id, status)
         VALUES (:manuscript_id, "pending")
         ON DUPLICATE KEY UPDATE status = IF(status = "rejected", "pending", status)'
    );
    $screeningStmt->execute(['manuscript_id' => $manuscriptId]);

    $pdo->commit();
    jasti_log($pdo, $userId, 'created manuscript', 'manuscripts', $manuscriptId);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jasti_json(['message' => 'Unable to create manuscript.', 'error' => $exception->getMessage()], 500);
}

$authorList = implode(', ', array_values(array_filter(array_map(
    static fn (array $author): string => trim((string) ($author['author_name'] ?? '')),
    $resolvedAuthors
))));
$submissionDate = date('F j, Y \a\t g:i A T');
$emailSent = false;
$emailMessage = 'A confirmation email was sent to the corresponding author.';
try {
    jasti_send_manuscript_submission_email(
        trim((string) ($user['email'] ?? '')),
        manuscript_author_display_name($user),
        [
            'reference_number' => $referenceNumber,
            'title' => $title,
            'article_type' => $articleType,
            'submission_date' => $submissionDate,
            'author_list' => $authorList,
            'submission_fee' => ' of ' . jasti_format_naira_amount(jasti_submission_screening_payment_amount()),
            'submission_payment_link' => jasti_dashboard_action_url('author', 'metrics'),
        ]
    );
    $emailSent = true;
} catch (Throwable $exception) {
    $emailMessage = 'The manuscript was submitted, but the confirmation email could not be sent right now.';
    error_log(sprintf('Manuscript confirmation email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
}

jasti_json([
    'message' => 'Manuscript submitted successfully.',
    'manuscript_id' => $manuscriptId,
    'reference_number' => $referenceNumber,
    'plagiarism_score' => null,
    'email_sent' => $emailSent,
    'email_message' => $emailMessage,
    'submitted_at' => $submissionDate,
]);
