<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

const TECHNICAL_SCORE_FIELDS = ['grammar_quality', 'ai_score', 'similarity_score'];

function technical_score_value(array $data, string $field): float
{
    $value = $data[$field] ?? null;
    if (!is_numeric($value)) {
        jasti_json(['message' => 'All technical screening scores must be numeric percentages.'], 422);
    }

    $score = (float) $value;
    if ($score < 0 || $score > 100) {
        jasti_json(['message' => 'Technical screening scores must be between 0 and 100 percent.'], 422);
    }

    return $score;
}

function technical_similarity_classification(float $score): array
{
    if ($score < 15) {
        return ['Safe Zone', 'Highly acceptable; typically passes directly to peer review.'];
    }
    if ($score <= 25) {
        return ['Review Zone', 'Triggers manual editorial inspection to check for standard phrasing or missing citations.'];
    }

    return ['High Risk', 'Often results in an immediate desk rejection or mandatory major rewrite.'];
}

function technical_scores_email_html(array $manuscript, float $grammarQuality, float $aiScore, float $similarityScore): string
{
    [$classification, $action] = technical_similarity_classification($similarityScore);
    $reference = htmlspecialchars((string) ($manuscript['reference_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $title = htmlspecialchars((string) ($manuscript['title'] ?? ''), ENT_QUOTES, 'UTF-8');

    return '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">'
        . '<p>Dear Author,</p>'
        . '<p>Your manuscript technical screening has been completed.</p>'
        . '<p><strong>Reference:</strong> ' . $reference . '<br><strong>Title:</strong> ' . $title . '</p>'
        . '<table style="border-collapse:collapse;width:100%;max-width:720px;margin:18px 0">'
        . '<thead><tr>'
        . '<th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Metric</th>'
        . '<th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Score</th>'
        . '<th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Position</th>'
        . '</tr></thead><tbody>'
        . '<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0">Grammar Quality (GQ)</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">' . number_format($grammarQuality, 2) . '%</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Recorded</td></tr>'
        . '<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0">AI Score</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">' . number_format($aiScore, 2) . '%</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Recorded</td></tr>'
        . '<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0">Similarity</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">' . number_format($similarityScore, 2) . '%</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">' . htmlspecialchars($classification, ENT_QUOTES, 'UTF-8') . '</td></tr>'
        . '</tbody></table>'
        . '<table style="border-collapse:collapse;width:100%;max-width:820px;margin:18px 0">'
        . '<thead><tr><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Similarity Score</th><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Classification</th><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:10px">Typical Journal Action</th></tr></thead>'
        . '<tbody>'
        . '<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0">Below 15%</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Safe Zone</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Highly acceptable; typically passes directly to peer review.</td></tr>'
        . '<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0">15% - 25%</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Review Zone</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Triggers manual editorial inspection to check for standard phrasing or missing citations.</td></tr>'
        . '<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0">Above 25%</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">High Risk</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">Often results in an immediate desk rejection or mandatory major rewrite.</td></tr>'
        . '</tbody></table>'
        . '<p><strong>Your similarity position:</strong> ' . htmlspecialchars($classification, ENT_QUOTES, 'UTF-8') . '. ' . htmlspecialchars($action, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p>The anonymized manuscript has been forwarded to the editorial desk for review.</p>'
        . '</div>';
}

$pdo = jasti_db();
jasti_ensure_technical_screening_schema($pdo);
jasti_ensure_peer_review_schema($pdo);
$user = jasti_require_auth($pdo);
$roles = (array) ($user['roles'] ?? []);
$userId = (int) $user['user_id'];
$data = jasti_request_data();
$action = trim((string) ($data['action'] ?? 'submit_screening'));

if ($action === 'submit_screening') {
    if (!in_array('technical_editor', $roles, true)) {
        jasti_json(['message' => 'Only technical editors can submit technical screening.'], 403);
    }

    $manuscriptId = (int) ($data['manuscript_id'] ?? 0);
    if ($manuscriptId <= 0) {
        jasti_json(['message' => 'Manuscript is required.'], 422);
    }
    if (!isset($_FILES['anonymized_file']) || !is_array($_FILES['anonymized_file']) || (int) ($_FILES['anonymized_file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        jasti_json(['message' => 'Upload the anonymized DOC or DOCX file before submitting.'], 422);
    }

    $manuscriptStmt = $pdo->prepare(
        'SELECT m.manuscript_id, m.title, m.reference_number, u.email, CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name
         FROM manuscripts m
         LEFT JOIN users u ON u.user_id = m.corresponding_author_id
         WHERE m.manuscript_id = :manuscript_id
         LIMIT 1'
    );
    $manuscriptStmt->execute(['manuscript_id' => $manuscriptId]);
    $manuscript = $manuscriptStmt->fetch();
    if (!$manuscript) {
        jasti_json(['message' => 'Manuscript not found.'], 404);
    }

    $paidStmt = $pdo->prepare(
        'SELECT 1 FROM manuscript_payments
         WHERE manuscript_id = :manuscript_id
           AND payment_status IN ("confirmed", "reviewed")
           AND amount >= :amount
         LIMIT 1'
    );
    $paidStmt->execute([
        'manuscript_id' => $manuscriptId,
        'amount' => jasti_submission_screening_payment_amount(),
    ]);
    if (!$paidStmt->fetchColumn()) {
        jasti_json(['message' => 'The author must complete the NGN 10,000 submission payment before technical screening can be attended.'], 422);
    }

    $grammarQuality = technical_score_value($data, 'grammar_quality');
    $aiScore = technical_score_value($data, 'ai_score');
    $similarityScore = technical_score_value($data, 'similarity_score');
    $anonymizedPath = jasti_store_uploaded_file(
        $_FILES['anonymized_file'],
        'uploads/manuscripts',
        'technical_anonymized',
        [
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        ]
    );

    $stmt = $pdo->prepare(
        'INSERT INTO technical_screenings
            (manuscript_id, technical_editor_id, status, anonymized_file_path, grammar_quality, ai_score, similarity_score, attended_at)
         VALUES
            (:manuscript_id, :technical_editor_id, "attended", :anonymized_file_path, :grammar_quality, :ai_score, :similarity_score, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
            technical_editor_id = VALUES(technical_editor_id),
            status = "attended",
            anonymized_file_path = VALUES(anonymized_file_path),
            grammar_quality = VALUES(grammar_quality),
            ai_score = VALUES(ai_score),
            similarity_score = VALUES(similarity_score),
            editor_decision = NULL,
            editor_rejection_reason = NULL,
            attended_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([
        'manuscript_id' => $manuscriptId,
        'technical_editor_id' => $userId,
        'anonymized_file_path' => $anonymizedPath,
        'grammar_quality' => $grammarQuality,
        'ai_score' => $aiScore,
        'similarity_score' => $similarityScore,
    ]);

    $pdo->prepare('UPDATE manuscripts SET plagiarism_score = :score, status = "editor_screening" WHERE manuscript_id = :manuscript_id')->execute([
        'score' => $similarityScore,
        'manuscript_id' => $manuscriptId,
    ]);

    $authorEmail = trim((string) ($manuscript['email'] ?? ''));
    if ($authorEmail !== '' && filter_var($authorEmail, FILTER_VALIDATE_EMAIL) !== false) {
        $html = technical_scores_email_html($manuscript, $grammarQuality, $aiScore, $similarityScore);
        $plain = "Your JASTI technical screening scores are: Grammar Quality {$grammarQuality}%, AI Score {$aiScore}%, Similarity {$similarityScore}%.";
        try {
            jasti_send_html_email($authorEmail, 'JASTI technical screening scores', $html, $plain);
        } catch (Throwable $exception) {
            error_log(sprintf('Technical screening score email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
        }
    }

    jasti_notify_role_users(
        $pdo,
        ['editor', 'managing_editor', 'section_editor', 'advisory_board'],
        'JASTI technical screening ready for approval',
        'Technical screening needs editor approval',
        sprintf(
            "The Technical Editor has uploaded the anonymized file and screening scores for manuscript %s.\n\nTitle: %s\n\nPlease review and approve it before reviewer assignment.",
            (string) ($manuscript['reference_number'] ?? '#' . $manuscriptId),
            (string) ($manuscript['title'] ?? '')
        ),
        'Review technical screening',
        jasti_dashboard_action_url('editor', 'selection')
    );

    jasti_log($pdo, $userId, 'submitted technical screening', 'technical_screenings', $manuscriptId);
    jasti_json(['message' => 'Technical screening submitted and sent to the editor.']);
}

if ($action === 'editor_decision') {
    if (!jasti_has_editor_workspace_role($roles) || in_array('technical_editor', $roles, true)) {
        jasti_json(['message' => 'Only editors can approve or reject technical screening output.'], 403);
    }

    $manuscriptId = (int) ($data['manuscript_id'] ?? 0);
    $decision = trim((string) ($data['decision'] ?? ''));
    $reason = trim((string) ($data['reason'] ?? ''));
    if ($manuscriptId <= 0 || !in_array($decision, ['approved', 'rejected'], true)) {
        jasti_json(['message' => 'Manuscript and a valid decision are required.'], 422);
    }
    if ($decision === 'rejected' && $reason === '') {
        jasti_json(['message' => 'Rejection reason is required.'], 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE technical_screenings
         SET status = :status,
             editor_decision = :decision,
             editor_rejection_reason = :reason,
             editor_decided_at = CURRENT_TIMESTAMP
         WHERE manuscript_id = :manuscript_id
           AND status = "attended"'
    );
    $stmt->execute([
        'status' => $decision,
        'decision' => $decision,
        'reason' => $reason !== '' ? $reason : null,
        'manuscript_id' => $manuscriptId,
    ]);
    if ($stmt->rowCount() === 0) {
        jasti_json(['message' => 'Technical screening record is not ready for editor decision.'], 422);
    }

    if ($decision === 'approved') {
        $existingAssignmentStmt = $pdo->prepare(
            'SELECT assignment_id, editor_id
             FROM editor_assignments
             WHERE manuscript_id = :manuscript_id
               AND status IN ("pending", "active")
             ORDER BY assignment_id ASC
             LIMIT 1'
        );
        $existingAssignmentStmt->execute(['manuscript_id' => $manuscriptId]);
        $existingAssignment = $existingAssignmentStmt->fetch() ?: null;

        if ($existingAssignment) {
            $pdo->prepare(
                'UPDATE editor_assignments
                 SET editor_id = :editor_id,
                     status = "active"
                 WHERE assignment_id = :assignment_id'
            )->execute([
                'editor_id' => $userId,
                'assignment_id' => (int) $existingAssignment['assignment_id'],
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO editor_assignments (manuscript_id, editor_id, status)
                 VALUES (:manuscript_id, :editor_id, "active")'
            )->execute([
                'manuscript_id' => $manuscriptId,
                'editor_id' => $userId,
            ]);
        }

        $pdo->prepare(
            'UPDATE manuscripts
             SET current_editor_id = :editor_id,
                 status = "editor_screening"
             WHERE manuscript_id = :manuscript_id'
        )->execute([
            'editor_id' => $userId,
            'manuscript_id' => $manuscriptId,
        ]);
    }

    if ($decision === 'rejected') {
        $notifyStmt = $pdo->prepare(
            'SELECT m.title, m.reference_number, u.email
             FROM technical_screenings ts
             INNER JOIN manuscripts m ON m.manuscript_id = ts.manuscript_id
             LEFT JOIN users u ON u.user_id = ts.technical_editor_id
             WHERE ts.manuscript_id = :manuscript_id
             LIMIT 1'
        );
        $notifyStmt->execute(['manuscript_id' => $manuscriptId]);
        $notifyRow = $notifyStmt->fetch() ?: [];
        try {
            jasti_send_action_needed_email(
                (string) ($notifyRow['email'] ?? ''),
                'JASTI technical screening returned',
                'Technical screening requires correction',
                sprintf(
                    "The editor returned the technical screening for manuscript %s.\n\nTitle: %s\n\nReason: %s\n\nPlease log in as Technical Editor, review the reason, and upload the corrected anonymized file.",
                    (string) ($notifyRow['reference_number'] ?? '#' . $manuscriptId),
                    (string) ($notifyRow['title'] ?? ''),
                    $reason
                ),
                'Open technical screening',
                jasti_dashboard_action_url('technical_editor', 'technical-screening')
            );
        } catch (Throwable $exception) {
            error_log(sprintf('Technical screening rejection email failed for manuscript %d: %s', $manuscriptId, $exception->getMessage()));
        }
    }

    jasti_log($pdo, $userId, 'recorded technical screening decision', 'technical_screenings', $manuscriptId);
    jasti_json(['message' => $decision === 'approved' ? 'Technical screening approved for reviewer assignment.' : 'Technical screening returned to the technical editor.']);
}

jasti_json(['message' => 'Unsupported technical screening action.'], 422);
