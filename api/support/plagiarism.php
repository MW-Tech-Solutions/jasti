<?php
declare(strict_types=1);

function jasti_ensure_manuscript_text_index_table(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS manuscript_text_index (
            manuscript_id INT NOT NULL PRIMARY KEY,
            normalized_text LONGTEXT NULL,
            word_count INT NOT NULL DEFAULT 0,
            fingerprint_hash CHAR(64) DEFAULT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_manuscript_text_index_manuscript
                FOREIGN KEY (manuscript_id) REFERENCES manuscripts (manuscript_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci'
    );

    $ready = true;
}

function jasti_run_process(array $command, ?string $workingDirectory = null): array
{
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptors, $pipes, $workingDirectory);
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to start document analysis process.');
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);

    return [
        'exit_code' => is_int($exitCode) ? $exitCode : 1,
        'stdout' => $stdout === false ? '' : $stdout,
        'stderr' => $stderr === false ? '' : $stderr,
    ];
}

function jasti_remove_directory(string $directory): void
{
    if (!is_dir($directory)) {
        return;
    }

    $items = scandir($directory);
    if ($items === false) {
        @rmdir($directory);
        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $directory . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            jasti_remove_directory($path);
            continue;
        }
        @unlink($path);
    }

    @rmdir($directory);
}

function jasti_extract_pdf_text(string $path): string
{
    if (!is_file($path)) {
        return '';
    }

    $result = jasti_run_process(['pdftotext', '-enc', 'UTF-8', '-nopgbrk', $path, '-']);
    if (($result['exit_code'] ?? 1) !== 0) {
        return '';
    }

    return trim((string) ($result['stdout'] ?? ''));
}

function jasti_extract_docx_text(string $path): string
{
    if (!is_file($path)) {
        return '';
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return '';
    }

    $parts = [];
    for ($index = 0; $index < $zip->numFiles; $index += 1) {
        $entryName = (string) $zip->getNameIndex($index);
        if (!preg_match('#^word/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$#', $entryName)) {
            continue;
        }
        $xml = $zip->getFromIndex($index);
        if (!is_string($xml) || $xml === '') {
            continue;
        }
        $xml = preg_replace('/<\/w:p>/i', " \n ", $xml);
        $xml = preg_replace('/<\/w:tr>/i', " \n ", $xml);
        $xml = preg_replace('/<[^>]+>/', ' ', (string) $xml);
        $parts[] = html_entity_decode((string) $xml, ENT_QUOTES | ENT_XML1 | ENT_SUBSTITUTE, 'UTF-8');
    }

    $zip->close();

    return trim(implode("\n", $parts));
}

function jasti_extract_legacy_word_text(string $path): string
{
    if (!is_file($path)) {
        return '';
    }

    $tempRoot = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'jasti_doc_' . bin2hex(random_bytes(8));
    $outDir = $tempRoot . DIRECTORY_SEPARATOR . 'out';
    $profileDir = $tempRoot . DIRECTORY_SEPARATOR . 'profile';
    if (!mkdir($outDir, 0700, true) && !is_dir($outDir)) {
        return '';
    }
    if (!mkdir($profileDir, 0700, true) && !is_dir($profileDir)) {
        jasti_remove_directory($tempRoot);
        return '';
    }

    $profileUri = 'file://' . str_replace(DIRECTORY_SEPARATOR, '/', $profileDir);

    try {
        $result = jasti_run_process([
            'libreoffice',
            '--headless',
            '--nologo',
            '--nolockcheck',
            '--nodefault',
            '--nofirststartwizard',
            '--env:UserInstallation=' . $profileUri,
            '--convert-to',
            'txt:Text',
            '--outdir',
            $outDir,
            $path,
        ]);

        if (($result['exit_code'] ?? 1) !== 0) {
            return '';
        }

        $matches = glob($outDir . DIRECTORY_SEPARATOR . '*.txt') ?: [];
        if ($matches === []) {
            return '';
        }

        $text = file_get_contents($matches[0]);
        return $text === false ? '' : trim($text);
    } finally {
        jasti_remove_directory($tempRoot);
    }
}

function jasti_extract_text_from_manuscript_file(string $path, string $mimeType = '', string $originalName = ''): string
{
    $extension = strtolower(pathinfo($originalName !== '' ? $originalName : $path, PATHINFO_EXTENSION));
    $mimeType = trim($mimeType);

    if ($mimeType === '' && is_file($path)) {
        $detected = mime_content_type($path);
        $mimeType = is_string($detected) ? $detected : '';
    }

    return match (true) {
        $mimeType === 'application/pdf', $extension === 'pdf' => jasti_extract_pdf_text($path),
        $mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', $extension === 'docx' => jasti_extract_docx_text($path),
        $mimeType === 'application/msword', $extension === 'doc' => jasti_extract_legacy_word_text($path),
        $mimeType === 'text/x-tex', $mimeType === 'application/x-tex', $extension === 'tex', $mimeType === 'text/plain', $extension === 'txt' => trim((string) file_get_contents($path)),
        default => '',
    };
}

function jasti_normalize_manuscript_text(string $text): string
{
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5 | ENT_SUBSTITUTE, 'UTF-8');
    $text = preg_replace('/\\\\[a-zA-Z@]+(?:\[[^\]]*\])?(?:\{[^{}]*\})?/', ' ', $text);
    $text = preg_replace('/[_^{}\\\\]+/', ' ', (string) $text);
    $text = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', (string) $text);
    $text = mb_strtolower((string) $text, 'UTF-8');
    $text = preg_replace('/\s+/u', ' ', (string) $text);
    return trim((string) $text);
}

function jasti_similarity_stopwords(): array
{
    static $stopwords = null;
    if ($stopwords !== null) {
        return $stopwords;
    }

    $stopwords = array_fill_keys([
        'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost', 'also', 'am', 'among',
        'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'between', 'both',
        'but', 'by', 'can', 'could', 'did', 'do', 'does', 'done', 'during', 'each', 'either', 'enough', 'especially',
        'etc', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'here', 'how', 'however', 'if', 'in',
        'into', 'is', 'it', 'its', 'itself', 'just', 'may', 'might', 'more', 'most', 'much', 'must', 'no', 'nor',
        'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'same', 'should',
        'since', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there', 'these',
        'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'upon', 'use', 'used', 'using',
        'very', 'via', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with',
        'within', 'without', 'would', 'you', 'your',
    ], true);

    return $stopwords;
}

function jasti_manuscript_tokens(string $normalizedText): array
{
    if ($normalizedText === '') {
        return [];
    }

    $stopwords = jasti_similarity_stopwords();
    $parts = preg_split('/\s+/u', $normalizedText) ?: [];

    return array_values(array_filter($parts, static function (string $token) use ($stopwords): bool {
        if ($token === '' || isset($stopwords[$token])) {
            return false;
        }
        if (mb_strlen($token, 'UTF-8') < 3) {
            return false;
        }
        return preg_match('/\p{L}/u', $token) === 1;
    }));
}

function jasti_manuscript_shingles(array $tokens, int $size = 5): array
{
    if (count($tokens) < $size) {
        return [];
    }

    $shingles = [];
    $lastIndex = count($tokens) - $size;
    for ($index = 0; $index <= $lastIndex; $index += 1) {
        $shingles[hash('sha1', implode(' ', array_slice($tokens, $index, $size)))] = true;
    }

    return array_keys($shingles);
}

function jasti_absolute_storage_path(string $publicPath): ?string
{
    $publicPath = trim(str_replace('\\', '/', $publicPath));
    if ($publicPath === '' || preg_match('#^https?://#i', $publicPath)) {
        return null;
    }

    return jasti_root_path(ltrim($publicPath, '/'));
}

function jasti_upsert_manuscript_text_index(PDO $pdo, int $manuscriptId, string $normalizedText): void
{
    jasti_ensure_manuscript_text_index_table($pdo);
    $stmt = $pdo->prepare(
        'INSERT INTO manuscript_text_index (manuscript_id, normalized_text, word_count, fingerprint_hash)
         VALUES (:manuscript_id, :normalized_text, :word_count, :fingerprint_hash)
         ON DUPLICATE KEY UPDATE
             normalized_text = VALUES(normalized_text),
             word_count = VALUES(word_count),
             fingerprint_hash = VALUES(fingerprint_hash)'
    );
    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'normalized_text' => $normalizedText,
        'word_count' => count(preg_split('/\s+/u', trim($normalizedText)) ?: []),
        'fingerprint_hash' => hash('sha256', $normalizedText),
    ]);
}

function jasti_build_archive_similarity_report(PDO $pdo, string $normalizedText, ?int $excludeManuscriptId = null): array
{
    jasti_ensure_manuscript_text_index_table($pdo);

    $candidateTokens = jasti_manuscript_tokens($normalizedText);
    $candidateShingles = jasti_manuscript_shingles($candidateTokens);
    if ($candidateShingles === []) {
        throw new RuntimeException('Unable to extract enough readable text from the uploaded manuscript to calculate a plagiarism score.');
    }

    $candidateSet = array_fill_keys($candidateShingles, true);
    $unionMatches = [];
    $matches = [];

    $sql = 'SELECT m.manuscript_id, m.title, m.abstract, m.keywords, m.status,
                   idx.normalized_text,
                   (
                       SELECT mf.file_path
                       FROM manuscript_files mf
                       WHERE mf.manuscript_id = m.manuscript_id
                         AND mf.file_type = "manuscript"
                       ORDER BY mf.version DESC, mf.file_id DESC
                       LIMIT 1
                   ) AS manuscript_file_path
            FROM manuscripts m
            LEFT JOIN manuscript_text_index idx ON idx.manuscript_id = m.manuscript_id';
    $params = [];
    if ($excludeManuscriptId !== null) {
        $sql .= ' WHERE m.manuscript_id <> :exclude_manuscript_id';
        $params['exclude_manuscript_id'] = $excludeManuscriptId;
    }
    $sql .= ' ORDER BY m.submission_date DESC, m.manuscript_id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $indexedArchiveCount = 0;

    foreach ($rows as $row) {
        $sourceText = trim((string) ($row['normalized_text'] ?? ''));

        if ($sourceText === '') {
            $absolutePath = jasti_absolute_storage_path((string) ($row['manuscript_file_path'] ?? ''));
            if ($absolutePath !== null && is_file($absolutePath)) {
                $sourceRawText = jasti_extract_text_from_manuscript_file($absolutePath, '', basename($absolutePath));
                $sourceText = jasti_normalize_manuscript_text($sourceRawText);
            }

            if ($sourceText === '') {
                $sourceText = jasti_normalize_manuscript_text(
                    trim(
                        (string) ($row['title'] ?? '') . ' ' .
                        (string) ($row['abstract'] ?? '') . ' ' .
                        (string) ($row['keywords'] ?? '')
                    )
                );
            }

            if ($sourceText !== '') {
                jasti_upsert_manuscript_text_index($pdo, (int) $row['manuscript_id'], $sourceText);
            }
        }

        if ($sourceText === '') {
            continue;
        }

        $indexedArchiveCount += 1;
        $sourceTokens = jasti_manuscript_tokens($sourceText);
        $sourceShingles = jasti_manuscript_shingles($sourceTokens);
        if ($sourceShingles === []) {
            continue;
        }

        $shared = 0;
        foreach ($sourceShingles as $shingle) {
            if (!isset($candidateSet[$shingle])) {
                continue;
            }
            $shared += 1;
            $unionMatches[$shingle] = true;
        }

        if ($shared === 0) {
            continue;
        }

        $score = round(($shared / count($candidateShingles)) * 100, 2);
        if ($score < 0.5) {
            continue;
        }

        $matches[] = [
            'manuscript_id' => (int) $row['manuscript_id'],
            'title' => (string) ($row['title'] ?? 'Untitled manuscript'),
            'status' => (string) ($row['status'] ?? 'submitted'),
            'score' => $score,
        ];
    }

    usort($matches, static function (array $left, array $right): int {
        return ($right['score'] <=> $left['score']) ?: ($right['manuscript_id'] <=> $left['manuscript_id']);
    });

    $archiveScore = round((count($unionMatches) / count($candidateShingles)) * 100, 2);
    $message = $indexedArchiveCount === 0
        ? 'No archived manuscripts were available for comparison yet. The score is 0.00% until the archive grows.'
        : ($archiveScore > 0
            ? 'Similarity analysis completed against the JASTI manuscript archive.'
            : 'No significant overlap was detected against the JASTI manuscript archive.');

    return [
        'score' => $archiveScore,
        'message' => $message,
        'top_matches' => array_slice($matches, 0, 3),
        'match_count' => count($matches),
        'word_count' => count(preg_split('/\s+/u', trim($normalizedText)) ?: []),
        'token_count' => count($candidateTokens),
    ];
}

function jasti_calculate_uploaded_manuscript_similarity(PDO $pdo, array $file): array
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException(jasti_upload_error_message($error));
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_file($tmpPath)) {
        throw new RuntimeException('Uploaded manuscript file is unavailable for plagiarism analysis.');
    }

    $maxBytes = (int) jasti_env('MAX_UPLOAD_SIZE_BYTES', (string) (10 * 1024 * 1024));
    if ((int) ($file['size'] ?? 0) > $maxBytes) {
        $maxMb = number_format($maxBytes / 1048576, 0);
        throw new RuntimeException("Uploaded file exceeds the {$maxMb}MB size limit.");
    }

    $mimeType = (string) (mime_content_type($tmpPath) ?: '');
    $extension = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    $supportedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/x-tex',
        'application/x-tex',
        'text/plain',
    ];
    $supportedExtensions = ['pdf', 'doc', 'docx', 'tex', 'txt'];
    if ($mimeType !== '' && !in_array($mimeType, $supportedMimeTypes, true) && !in_array($extension, $supportedExtensions, true)) {
        throw new RuntimeException('Unsupported manuscript format. Upload a PDF, DOC, DOCX, or TEX file.');
    }

    $rawText = jasti_extract_text_from_manuscript_file($tmpPath, $mimeType, (string) ($file['name'] ?? ''));
    $normalizedText = jasti_normalize_manuscript_text($rawText);
    $tokenCount = count(jasti_manuscript_tokens($normalizedText));
    if ($tokenCount < 40) {
        throw new RuntimeException('Unable to extract enough readable text from the uploaded manuscript. Upload a searchable PDF, DOC, DOCX, or TEX file.');
    }

    $report = jasti_build_archive_similarity_report($pdo, $normalizedText);
    $report['normalized_text'] = $normalizedText;
    return $report;
}
