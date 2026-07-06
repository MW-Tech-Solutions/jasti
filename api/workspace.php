<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
require_once __DIR__ . '/support/copyleaks.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
jasti_ensure_manuscript_reference_number($pdo);
jasti_ensure_manuscript_scope_schema($pdo);
jasti_ensure_technical_screening_schema($pdo);
jasti_ensure_manuscript_author_schema($pdo);
jasti_ensure_plagiarism_scan_table($pdo);
jasti_ensure_peer_review_schema($pdo);
jasti_ensure_article_archive_schema($pdo);
jasti_ensure_message_thread_schema($pdo);
jasti_process_review_deadline_reminders($pdo);
jasti_retry_failed_message_emails($pdo);
$user = jasti_require_auth($pdo);
$userId = (int) $user['user_id'];
$roles = $user['roles'];
$data = [
    'user' => $user,
    'settings' => jasti_settings($pdo),
    'roles' => $roles,
];

$messagesStmt = $pdo->prepare(
    'SELECT m.message_id, m.parent_message_id, m.subject, m.message_body, m.sent_date, m.read_status, m.email_sent, m.email_status, m.manuscript_id,
            m.sender_id, m.receiver_id,
            CONCAT(COALESCE(s.first_name, ""), " ", COALESCE(s.last_name, "")) AS sender_name,
            CONCAT(COALESCE(r.first_name, ""), " ", COALESCE(r.last_name, "")) AS receiver_name
     FROM messages m
     LEFT JOIN users s ON s.user_id = m.sender_id
     LEFT JOIN users r ON r.user_id = m.receiver_id
     WHERE m.sender_id = :sender_id OR m.receiver_id = :receiver_id
     ORDER BY m.sent_date DESC
     LIMIT 25'
);
$messagesStmt->execute([
    'sender_id' => $userId,
    'receiver_id' => $userId,
]);
$data['messages'] = $messagesStmt->fetchAll();

if (in_array('author', $roles, true)) {
    $authorStmt = $pdo->prepare(
        'SELECT m.manuscript_id, m.title, m.scope_area, m.abstract, m.keywords, m.reference_number, m.status, m.article_type, m.submission_date,
                m.journal_id, j.journal_name,
                m.plagiarism_score, m.version_number, a.doi, a.publication_date, a.page_numbers,
                COALESCE(am.downloads, 0) AS downloads,
                COALESCE(am.citations, 0) AS citations,
                COALESCE(am.altmetric_score, 0) AS altmetric_score,
                ps.status AS plagiarism_scan_status, ps.provider AS plagiarism_provider, ps.last_error AS plagiarism_scan_error,
                ts.status AS technical_status, ts.grammar_quality, ts.ai_score, ts.similarity_score, ts.editor_rejection_reason,
                (SELECT mp.payment_status FROM manuscript_payments mp WHERE mp.manuscript_id = m.manuscript_id ORDER BY mp.payment_id DESC LIMIT 1) AS submission_payment_status,
                EXISTS (
                    SELECT 1
                    FROM manuscript_payments mp
                    WHERE mp.manuscript_id = m.manuscript_id
                      AND mp.author_id = m.corresponding_author_id
                      AND mp.payment_status IN ("confirmed", "reviewed")
                      AND mp.amount >= :submission_fee
                ) AS submission_payment_completed,
                EXISTS (
                    SELECT 1
                    FROM manuscript_payments mp
                    WHERE mp.manuscript_id = m.manuscript_id
                      AND mp.author_id = m.corresponding_author_id
                      AND mp.payment_status IN ("confirmed", "reviewed")
                      AND (
                          mp.amount >= :publication_fee
                          OR LOWER(COALESCE(mp.payment_details, "")) LIKE "%publication%"
                      )
                ) AS publication_payment_completed,
                COALESCE(
                    (
                        SELECT GROUP_CONCAT(
                            COALESCE(
                                NULLIF(TRIM(ma.author_name), ""),
                                NULLIF(TRIM(CONCAT(COALESCE(ua.first_name, ""), " ", COALESCE(ua.last_name, ""))), ""),
                                NULLIF(TRIM(ua.email), "")
                            )
                            ORDER BY ma.author_order SEPARATOR ", "
                        )
                        FROM manuscript_authors ma
                        LEFT JOIN users ua ON ua.user_id = ma.author_id
                        WHERE ma.manuscript_id = m.manuscript_id
                    ),
                    NULLIF(TRIM(CONCAT(COALESCE(ca.first_name, ""), " ", COALESCE(ca.last_name, ""))), ""),
                    NULLIF(TRIM(ca.email), "")
                ) AS author_list,
                (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id) AS file_bundle
         FROM manuscripts m
         LEFT JOIN articles a ON a.manuscript_id = m.manuscript_id
         LEFT JOIN journals j ON j.journal_id = m.journal_id
         LEFT JOIN users ca ON ca.user_id = m.corresponding_author_id
         LEFT JOIN (
             SELECT article_id,
                    SUM(COALESCE(downloads, 0)) AS downloads,
                    SUM(COALESCE(citations, 0)) AS citations,
                    MAX(COALESCE(altmetric_score, 0)) AS altmetric_score
             FROM article_metrics
             GROUP BY article_id
         ) am ON am.article_id = a.article_id
         LEFT JOIN manuscript_plagiarism_scans ps ON ps.manuscript_id = m.manuscript_id
         LEFT JOIN technical_screenings ts ON ts.manuscript_id = m.manuscript_id
         WHERE m.corresponding_author_id = :user_id
         ORDER BY m.submission_date DESC'
    );
    $authorStmt->execute([
        'user_id' => $userId,
        'submission_fee' => jasti_submission_screening_payment_amount(),
        'publication_fee' => jasti_manuscript_payment_base_amount(),
    ]);
    $data['author'] = [
        'manuscripts' => $authorStmt->fetchAll(),
        'revisions' => [],
    ];

    $revisionStmt = $pdo->prepare(
        'SELECT r.revision_id, r.manuscript_id, r.revision_number, r.submitted_date, r.status, r.response_document
         FROM revisions r
         WHERE r.submitted_by = :user_id
         ORDER BY r.submitted_date DESC'
    );
    $revisionStmt->execute(['user_id' => $userId]);
    $paymentsStmt = $pdo->prepare(
        'SELECT payment_id, manuscript_id, amount, payment_reference, payment_details, proof_file_path, payment_status, submitted_at
         FROM manuscript_payments
         WHERE author_id = :user_id
         ORDER BY submitted_at DESC'
    );
    $paymentsStmt->execute(['user_id' => $userId]);
    $copyrightStmt = $pdo->prepare(
        'SELECT form_id, manuscript_id, signed_file_path, notes, submitted_at, status
         FROM copyright_forms
         WHERE author_id = :user_id
         ORDER BY submitted_at DESC'
    );
    $copyrightStmt->execute(['user_id' => $userId]);
    $data['author']['revisions'] = $revisionStmt->fetchAll();
    $data['author']['payments'] = $paymentsStmt->fetchAll();
    $data['author']['copyright_forms'] = $copyrightStmt->fetchAll();
}

if (in_array('reviewer', $roles, true)) {
    $reviewerApplication = null;
    $qualificationRows = [];
    $expertiseRows = [];
    $journalExperienceRows = [];
    $availability = [];
    $conflictRows = [];
    $agreements = [];
    $reviewerApproved = false;
    $reviewerTablesReady = jasti_table_exists($pdo, 'reviewers')
        && jasti_table_exists($pdo, 'reviewer_qualifications')
        && jasti_table_exists($pdo, 'reviewer_expertise')
        && jasti_table_exists($pdo, 'reviewer_journal_experience')
        && jasti_table_exists($pdo, 'reviewer_availability')
        && jasti_table_exists($pdo, 'reviewer_conflicts')
        && jasti_table_exists($pdo, 'reviewer_agreements');

    $profileStmt = $pdo->prepare(
        'SELECT expertise_area, reviewer_rating, total_reviews, availability_status
         FROM reviewer_profiles
         WHERE reviewer_id = :reviewer_id
         LIMIT 1'
    );
    $profileStmt->execute(['reviewer_id' => $userId]);

    if ($reviewerTablesReady) {
        $reviewerAppStmt = $pdo->prepare(
            'SELECT *
             FROM reviewers
             WHERE user_id = :user_id
             LIMIT 1'
        );
        $reviewerAppStmt->execute(['user_id' => $userId]);
        $reviewerApplication = $reviewerAppStmt->fetch() ?: null;
        $reviewerId = (int) ($reviewerApplication['reviewer_id'] ?? 0);
        $reviewerApproved = $reviewerApplication && (string) ($reviewerApplication['status'] ?? '') === 'approved';

        if ($reviewerId > 0) {
            $qualificationStmt = $pdo->prepare(
                'SELECT qualification_id, degree, field_of_study, institution, graduation_year
                 FROM reviewer_qualifications
                 WHERE reviewer_id = :reviewer_id
                 ORDER BY graduation_year DESC, qualification_id ASC'
            );
            $qualificationStmt->execute(['reviewer_id' => $reviewerId]);
            $qualificationRows = $qualificationStmt->fetchAll();

            $expertiseStmt = $pdo->prepare(
                'SELECT expertise_id, research_area, keywords
                 FROM reviewer_expertise
                 WHERE reviewer_id = :reviewer_id
                 ORDER BY expertise_id ASC'
            );
            $expertiseStmt->execute(['reviewer_id' => $reviewerId]);
            $expertiseRows = $expertiseStmt->fetchAll();

            $journalExperienceStmt = $pdo->prepare(
                'SELECT experience_id, journal_name, publisher, years_of_service
                 FROM reviewer_journal_experience
                 WHERE reviewer_id = :reviewer_id
                 ORDER BY experience_id ASC'
            );
            $journalExperienceStmt->execute(['reviewer_id' => $reviewerId]);
            $journalExperienceRows = $journalExperienceStmt->fetchAll();

            $availabilityStmt = $pdo->prepare(
                'SELECT availability_id, available, max_reviews_per_year, last_review_date
                 FROM reviewer_availability
                 WHERE reviewer_id = :reviewer_id
                 LIMIT 1'
            );
            $availabilityStmt->execute(['reviewer_id' => $reviewerId]);
            $availability = $availabilityStmt->fetch() ?: [];

            $conflictsStmt = $pdo->prepare(
                'SELECT conflict_id, institution_conflict, author_conflict, notes
                 FROM reviewer_conflicts
                 WHERE reviewer_id = :reviewer_id
                 ORDER BY conflict_id ASC'
            );
            $conflictsStmt->execute(['reviewer_id' => $reviewerId]);
            $conflictRows = $conflictsStmt->fetchAll();

            $agreementsStmt = $pdo->prepare(
                'SELECT agreement_id, confidentiality_agreed, conflict_policy_agreed, ethical_review_agreed, agreement_date
                 FROM reviewer_agreements
                 WHERE reviewer_id = :reviewer_id
                 LIMIT 1'
            );
            $agreementsStmt->execute(['reviewer_id' => $reviewerId]);
            $agreements = $agreementsStmt->fetch() ?: [];
        }
    }

    $invitations = [];
    $reviews = [];
    if ($reviewerApproved) {
        $invitationsStmt = $pdo->prepare(
            'SELECT ri.invitation_id, ri.manuscript_id, ri.response, ri.invitation_date, ri.response_date,
                    ri.review_deadline, ri.review_model, ri.extension_requested, ri.extension_reason, ri.extension_requested_at,
                    m.title, m.abstract, m.status, m.article_type, m.submission_date,
                    CASE
                        WHEN ts.status = "approved" AND NULLIF(TRIM(ts.anonymized_file_path), "") IS NOT NULL
                            THEN CONCAT("anonymized_manuscript: ", ts.anonymized_file_path)
                        ELSE (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id)
                    END AS file_bundle,
                    (SELECT GROUP_CONCAT(CONCAT("Revision ", r.revision_number, ": ", r.response_document) SEPARATOR " || ") FROM revisions r WHERE r.manuscript_id = m.manuscript_id ORDER BY r.revision_number DESC) AS previous_revision_files
             FROM review_invitations ri
             INNER JOIN manuscripts m ON m.manuscript_id = ri.manuscript_id
             LEFT JOIN technical_screenings ts ON ts.manuscript_id = m.manuscript_id
             WHERE ri.reviewer_id = :user_id
               AND m.status <> "published"
               AND NOT EXISTS (
                   SELECT 1
                   FROM reviews rv_done
                   WHERE rv_done.manuscript_id = ri.manuscript_id
                     AND rv_done.reviewer_id = ri.reviewer_id
               )
             ORDER BY ri.invitation_date DESC'
        );
        $invitationsStmt->execute(['user_id' => $userId]);
        $invitations = $invitationsStmt->fetchAll();

        $reviewsStmt = $pdo->prepare(
            'SELECT rv.review_id, rv.manuscript_id, rv.review_date, rv.recommendation, rv.comments_to_author,
                    rv.confidential_comments, rv.score_novelty, rv.score_relevance, rv.score_technical_quality,
                    rv.score_methodology, rv.score_literature_review, rv.score_data_analysis, rv.score_clarity,
                    rv.score_grammar_language, rv.score_references_quality, rv.score_ethical_compliance,
                    rv.score_contribution, rv.total_score, rv.score_percent, rv.screenshot_attachment,
                    m.title
             FROM reviews rv
             INNER JOIN manuscripts m ON m.manuscript_id = rv.manuscript_id
             WHERE rv.reviewer_id = :user_id
             ORDER BY rv.review_date DESC'
        );
        $reviewsStmt->execute(['user_id' => $userId]);
        $reviews = $reviewsStmt->fetchAll();
    }

    $data['reviewer'] = [
        'profile' => $profileStmt->fetch() ?: null,
        'onboarding' => [
            'completed' => (bool) ((int) ($reviewerApplication['application_completed'] ?? 0)),
            'application' => $reviewerApplication ?: [],
            'qualifications' => $qualificationRows,
            'expertise' => $expertiseRows,
            'journal_experiences' => $journalExperienceRows,
            'availability' => $availability,
            'conflicts' => $conflictRows,
            'agreements' => $agreements,
            'specialization_options' => json_decode((string) ($data['settings']['review_specializations_json'] ?? '[]'), true) ?: [],
            'schema_ready' => $reviewerTablesReady,
        ],
        'invitations' => $invitations,
        'reviews' => $reviews,
    ];
}

if (jasti_has_editor_workspace_role($roles)) {
    jasti_ensure_editor_workspace_schema($pdo);
    $acceptedEditorProfile = jasti_user_editor_profile($pdo, $userId);
    $latestEditorApplication = jasti_get_latest_editor_application($pdo, $userId);
    $editorProfile = null;
    $editorQualifications = [];
    $editorExpertise = [];
    $editorJournalExperience = [];
    $sectionOptions = [];
    $editorApproved = $acceptedEditorProfile !== null && strtolower((string) ($acceptedEditorProfile['status'] ?? '')) === 'active';
    $editorTablesReady = jasti_table_exists($pdo, 'editors')
        && jasti_table_exists($pdo, 'editor_qualifications')
        && jasti_table_exists($pdo, 'editor_expertise')
        && jasti_table_exists($pdo, 'editor_journal_experience')
        && jasti_table_exists($pdo, 'journal_sections');

    if ($editorTablesReady) {
        $editorProfileStmt = $pdo->prepare(
            'SELECT editor_id, user_id, title, first_name, last_name, gender, nationality, country, institution, faculty, department,
                    academic_rank, position, email, alt_email, phone, whatsapp_number, office_address, orcid_id, scopus_id,
                    researcher_id, google_scholar_link, publication_count, publication_count_band, editorial_experience,
                    journals_reviewed_band, papers_reviewed_band, manuscripts_per_year_band, preferred_decision_timeline,
                    primary_editorial_area, research_keywords, bio, cv_file, publication_list_file,
                    responsibility_fair_decisions, responsibility_confidentiality, responsibility_conflicts,
                    responsibility_integrity, responsibility_timeliness, conflict_of_interest_declared,
                    final_declaration_agreed, final_declaration_date, editor_role, application_completed, status, date_registered
             FROM editors
             WHERE user_id = :user_id
             LIMIT 1'
        );
        $editorProfileStmt->execute(['user_id' => $userId]);
        $editorProfile = $editorProfileStmt->fetch() ?: null;
        $editorId = (int) ($editorProfile['editor_id'] ?? 0);
        $editorApproved = $editorApproved || ($editorProfile && (string) ($editorProfile['status'] ?? '') === 'approved');

        if ($editorId > 0) {
            $editorQualificationsStmt = $pdo->prepare(
                'SELECT qualification_id, degree, field_of_study, institution, graduation_year
                 FROM editor_qualifications
                 WHERE editor_id = :editor_id
                 ORDER BY graduation_year DESC, qualification_id ASC'
            );
            $editorQualificationsStmt->execute(['editor_id' => $editorId]);
            $editorQualifications = $editorQualificationsStmt->fetchAll();

            $editorExpertiseStmt = $pdo->prepare(
                'SELECT expertise_id, research_area, keywords
                 FROM editor_expertise
                 WHERE editor_id = :editor_id
                 ORDER BY expertise_id ASC'
            );
            $editorExpertiseStmt->execute(['editor_id' => $editorId]);
            $editorExpertise = $editorExpertiseStmt->fetchAll();

            $editorJournalExperienceStmt = $pdo->prepare(
                'SELECT experience_id, journal_name, publisher, role_title, years_of_service
                 FROM editor_journal_experience
                 WHERE editor_id = :editor_id
                 ORDER BY experience_id ASC'
            );
            $editorJournalExperienceStmt->execute(['editor_id' => $editorId]);
            $editorJournalExperience = $editorJournalExperienceStmt->fetchAll();
        }

        $sectionOptions = $pdo->query(
            'SELECT section_id, section_name, description
             FROM journal_sections
             ORDER BY section_name ASC'
        )->fetchAll();
    }

    $assignments = [];
    $unassigned = [];
    $reviewers = [];
    $decisions = [];
    $editorOverview = [];
    if (($editorApproved ?? false) === true) {
        $legacyAssignmentStmt = $pdo->prepare(
            'INSERT INTO editor_assignments (manuscript_id, editor_id, status)
             SELECT ts.manuscript_id, :editor_id, "active"
             FROM technical_screenings ts
             INNER JOIN manuscripts m ON m.manuscript_id = ts.manuscript_id
             WHERE ts.status = "approved"
               AND m.status <> "published"
               AND NOT EXISTS (
                   SELECT 1
                   FROM editor_assignments ea
                   WHERE ea.manuscript_id = ts.manuscript_id
                     AND ea.status IN ("pending", "active")
               )
               AND EXISTS (
                   SELECT 1
                   FROM system_logs sl
                   WHERE sl.entity_type = "technical_screenings"
                     AND sl.entity_id = ts.manuscript_id
                     AND sl.action = "recorded technical screening decision"
                     AND sl.user_id = :log_editor_id
               )'
        );
        $legacyAssignmentStmt->execute([
            'editor_id' => $userId,
            'log_editor_id' => $userId,
        ]);

        $pdo->prepare(
            'UPDATE manuscripts m
             INNER JOIN editor_assignments ea ON ea.manuscript_id = m.manuscript_id
             SET m.current_editor_id = ea.editor_id,
                 m.status = IF(m.status = "published", m.status, "editor_screening")
             WHERE ea.editor_id = :editor_id
               AND ea.status IN ("pending", "active")
               AND EXISTS (
                   SELECT 1
                   FROM technical_screenings ts
                   WHERE ts.manuscript_id = m.manuscript_id
                     AND ts.status = "approved"
               )
               AND (m.current_editor_id IS NULL OR m.current_editor_id = 0)'
        )->execute(['editor_id' => $userId]);

        $assignmentsStmt = $pdo->prepare(
            'SELECT ea.assignment_id, ea.manuscript_id, ea.status AS assignment_status, ea.assigned_date,
                    m.title, m.scope_area, m.abstract, m.keywords, m.reference_number, m.status, m.article_type, m.plagiarism_score, m.submission_date,
                    m.corresponding_author_id,
                    ps.status AS plagiarism_scan_status,
                    ts.status AS technical_status, ts.anonymized_file_path, ts.grammar_quality, ts.ai_score, ts.similarity_score, ts.editor_rejection_reason,
                    (SELECT mp.payment_status FROM manuscript_payments mp WHERE mp.manuscript_id = ea.manuscript_id ORDER BY mp.payment_id DESC LIMIT 1) AS apc_payment_status,
                    (SELECT COUNT(*) FROM review_invitations ri WHERE ri.manuscript_id = ea.manuscript_id) AS reviewer_invitation_count,
                    (SELECT GROUP_CONCAT(ri.reviewer_id SEPARATOR ",") FROM review_invitations ri WHERE ri.manuscript_id = ea.manuscript_id) AS assigned_reviewer_ids,
                    (SELECT GROUP_CONCAT(CONCAT(COALESCE(ru.first_name, ""), " ", COALESCE(ru.last_name, ""), " (", ri.response, ")") SEPARATOR " || ") FROM review_invitations ri INNER JOIN users ru ON ru.user_id = ri.reviewer_id WHERE ri.manuscript_id = ea.manuscript_id) AS assigned_reviewers,
                    (SELECT COUNT(*) FROM review_invitations ri WHERE ri.manuscript_id = ea.manuscript_id AND ri.response = "accepted") AS accepted_invitation_count,
                    (SELECT COUNT(*) FROM reviews rv WHERE rv.manuscript_id = ea.manuscript_id) AS completed_review_count,
                    EXISTS(SELECT 1 FROM editor_decisions ed2 WHERE ed2.manuscript_id = ea.manuscript_id AND ed2.editor_id = ea.editor_id) AS has_editor_decision,
                    CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name,
                    (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = ea.manuscript_id) AS file_bundle,
                    (SELECT GROUP_CONCAT(
                        CONCAT(
                            "Reviewer ", rv.reviewer_id,
                            " | ", rv.recommendation,
                            " | ", COALESCE(rv.score_percent, 0), "%",
                            " | Author: ", COALESCE(rv.comments_to_author, ""),
                            " | Editor: ", COALESCE(rv.confidential_comments, "")
                        )
                        SEPARATOR " || "
                    ) FROM reviews rv WHERE rv.manuscript_id = ea.manuscript_id ORDER BY rv.review_date ASC) AS reviewer_reports
             FROM editor_assignments ea
             INNER JOIN manuscripts m ON m.manuscript_id = ea.manuscript_id
             LEFT JOIN manuscript_plagiarism_scans ps ON ps.manuscript_id = m.manuscript_id
             LEFT JOIN technical_screenings ts ON ts.manuscript_id = m.manuscript_id
             LEFT JOIN users u ON u.user_id = m.corresponding_author_id
             WHERE ea.editor_id = :user_id
               AND m.status <> "published"
             ORDER BY ea.assigned_date DESC'
        );
        $assignmentsStmt->execute(['user_id' => $userId]);
        $assignments = $assignmentsStmt->fetchAll();

        $unassignedStmt = $pdo->query(
            'SELECT m.manuscript_id, m.title, m.scope_area, m.reference_number, m.status, m.article_type, m.plagiarism_score, m.submission_date,
                    ps.status AS plagiarism_scan_status,
                    ts.status AS technical_status, ts.anonymized_file_path, ts.grammar_quality, ts.ai_score, ts.similarity_score, ts.editor_rejection_reason,
                    (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id) AS file_bundle
             FROM manuscripts m
             LEFT JOIN editor_assignments ea ON ea.manuscript_id = m.manuscript_id AND ea.status IN ("pending", "active")
             LEFT JOIN manuscript_plagiarism_scans ps ON ps.manuscript_id = m.manuscript_id
             INNER JOIN technical_screenings ts ON ts.manuscript_id = m.manuscript_id AND ts.status = "approved"
             WHERE ea.assignment_id IS NULL
             ORDER BY m.submission_date DESC'
        );
        $unassigned = $unassignedStmt->fetchAll();

        $technicalScreeningsStmt = $pdo->query(
            'SELECT ts.screening_id, ts.manuscript_id, ts.status AS technical_status, ts.anonymized_file_path,
                    ts.grammar_quality, ts.ai_score, ts.similarity_score, ts.editor_rejection_reason,
                    ts.attended_at, ts.editor_decided_at,
                    m.title, m.scope_area, m.reference_number, m.status, m.article_type, m.submission_date,
                    CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name,
                    EXISTS(
                        SELECT 1 FROM manuscript_payments mp
                        WHERE mp.manuscript_id = m.manuscript_id
                          AND mp.payment_status IN ("confirmed", "reviewed")
                          AND mp.amount >= ' . (int) jasti_submission_screening_payment_amount() . '
                    ) AS submission_payment_confirmed,
                    EXISTS(
                        SELECT 1 FROM manuscript_payments mp
                        WHERE mp.manuscript_id = m.manuscript_id
                          AND mp.payment_status IN ("confirmed", "reviewed")
                          AND (
                              mp.amount >= ' . (int) jasti_manuscript_payment_base_amount() . '
                              OR LOWER(COALESCE(mp.payment_details, "")) LIKE "%publication%"
                          )
                    ) AS publication_payment_confirmed,
                    (SELECT mf.file_path FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id AND mf.file_type = "publication_pdf" ORDER BY mf.version DESC, mf.file_id DESC LIMIT 1) AS publication_pdf_path,
                    (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id) AS file_bundle
             FROM technical_screenings ts
             INNER JOIN manuscripts m ON m.manuscript_id = ts.manuscript_id
             LEFT JOIN users u ON u.user_id = m.corresponding_author_id
             ORDER BY ts.updated_at DESC, ts.created_at DESC'
        );
        $technicalScreenings = $technicalScreeningsStmt->fetchAll();

        $reviewersStmt = $pdo->query(
            'SELECT u.user_id, u.first_name, u.last_name, u.email, u.orcid_id, rp.expertise_area, rp.availability_status, rp.total_reviews,
                    ro.specializations_json,
                    (SELECT COUNT(*) FROM reviews rv WHERE rv.reviewer_id = u.user_id) AS completed_reviews,
                    (SELECT COUNT(*) FROM review_invitations ri WHERE ri.reviewer_id = u.user_id AND ri.response = "pending") AS pending_reviews,
                    (SELECT COUNT(*) FROM review_invitations ri WHERE ri.reviewer_id = u.user_id AND ri.response = "accepted" AND NOT EXISTS (SELECT 1 FROM reviews rv2 WHERE rv2.manuscript_id = ri.manuscript_id AND rv2.reviewer_id = ri.reviewer_id)) AS active_reviews,
                    (SELECT AVG(TIMESTAMPDIFF(HOUR, ri.response_date, rv.review_date)) FROM reviews rv INNER JOIN review_invitations ri ON ri.manuscript_id = rv.manuscript_id AND ri.reviewer_id = rv.reviewer_id WHERE rv.reviewer_id = u.user_id AND ri.response_date IS NOT NULL) AS average_completion_hours,
                    (SELECT AVG(rv.editor_quality_rating) FROM reviews rv WHERE rv.reviewer_id = u.user_id AND rv.editor_quality_rating IS NOT NULL) AS average_quality_rating,
                    (SELECT ROUND(100 * SUM(CASE WHEN rv.recommendation = "accept" THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) FROM reviews rv WHERE rv.reviewer_id = u.user_id) AS acceptance_percentage,
                    CASE
                        WHEN ((SELECT COUNT(*) FROM review_invitations ri WHERE ri.reviewer_id = u.user_id AND ri.response IN ("pending", "accepted"))) >= 5 THEN "high"
                        WHEN ((SELECT COUNT(*) FROM review_invitations ri WHERE ri.reviewer_id = u.user_id AND ri.response IN ("pending", "accepted"))) >= 3 THEN "moderate"
                        ELSE "low"
                    END AS fatigue_risk
             FROM reviewer_profiles rp
             INNER JOIN users u ON u.user_id = rp.reviewer_id
             LEFT JOIN reviewer_onboarding ro ON ro.reviewer_id = rp.reviewer_id
             ORDER BY rp.total_reviews ASC, u.last_name ASC'
        );
        $reviewers = $reviewersStmt->fetchAll();

        $decisionsStmt = $pdo->prepare(
            'SELECT ed.decision_id, ed.manuscript_id, ed.decision_type, ed.decision_date, ed.decision_letter, m.title
             FROM editor_decisions ed
             INNER JOIN manuscripts m ON m.manuscript_id = ed.manuscript_id
             WHERE ed.editor_id = :user_id
             ORDER BY ed.decision_date DESC'
        );
        $decisionsStmt->execute(['user_id' => $userId]);
        $decisions = $decisionsStmt->fetchAll();

        $overviewStmt = $pdo->prepare(
            'SELECT
                ROUND(AVG(TIMESTAMPDIFF(HOUR, ri.response_date, rv.review_date)) / 24, 1) AS average_review_time_days,
                ROUND(100 * SUM(CASE WHEN ed.decision_type = "accept" THEN 1 ELSE 0 END) / NULLIF(COUNT(ed.decision_id), 0), 2) AS acceptance_rate,
                ROUND(100 * SUM(CASE WHEN ri.response = "accepted" THEN 1 ELSE 0 END) / NULLIF(COUNT(ri.invitation_id), 0), 2) AS reviewer_responsiveness,
                (SELECT COUNT(*) FROM editor_assignments ea2 INNER JOIN manuscripts m2 ON m2.manuscript_id = ea2.manuscript_id WHERE ea2.editor_id = :editor_id_backlog AND m2.status NOT IN ("published", "rejected")) AS manuscript_backlog,
                (SELECT COUNT(*) FROM editor_assignments ea3 INNER JOIN manuscripts m3 ON m3.manuscript_id = ea3.manuscript_id WHERE ea3.editor_id = :editor_id_pipeline AND m3.status IN ("accepted", "production")) AS publication_pipeline
             FROM editor_assignments ea
             LEFT JOIN review_invitations ri ON ri.manuscript_id = ea.manuscript_id
             LEFT JOIN reviews rv ON rv.manuscript_id = ri.manuscript_id AND rv.reviewer_id = ri.reviewer_id
             LEFT JOIN editor_decisions ed ON ed.manuscript_id = ea.manuscript_id AND ed.editor_id = ea.editor_id
             WHERE ea.editor_id = :editor_id'
        );
        $overviewStmt->execute([
            'editor_id' => $userId,
            'editor_id_backlog' => $userId,
            'editor_id_pipeline' => $userId,
        ]);
        $editorOverview = $overviewStmt->fetch() ?: [];
    }

    $editorWorkspaceCompleted = (bool) ((int) ($editorProfile['application_completed'] ?? 0));
    if (!$editorWorkspaceCompleted && $acceptedEditorProfile !== null) {
        $editorWorkspaceCompleted = true;
    }

    $editorProfilePayload = $editorProfile;
    if ($editorProfilePayload === null && $acceptedEditorProfile !== null) {
        $editorProfilePayload = [
            'user_id' => $acceptedEditorProfile['user_id'],
            'title' => $acceptedEditorProfile['description'],
            'subject_areas' => $acceptedEditorProfile['subject_areas'],
            'bio' => $acceptedEditorProfile['bio'],
            'expertise_description' => $acceptedEditorProfile['expertise_description'],
            'status' => $acceptedEditorProfile['status'],
            'appointment_date' => $acceptedEditorProfile['appointment_date'],
            'editor_role' => $acceptedEditorProfile['type_name'],
        ];
    }

    $editorApplicationPayload = $editorProfile ?: ($latestEditorApplication ?: []);

    $data['editor'] = [
        'overview' => $editorOverview,
        'profile' => $editorProfilePayload,
        'onboarding' => [
            'completed' => $editorWorkspaceCompleted,
            'application' => $editorApplicationPayload,
            'qualifications' => $editorQualifications,
            'expertise' => $editorExpertise,
            'journal_experiences' => $editorJournalExperience,
            'section_options' => $sectionOptions,
            'schema_ready' => $editorTablesReady,
        ],
        'assignments' => $assignments,
        'unassigned_manuscripts' => $unassigned,
        'technical_screenings' => $technicalScreenings ?? [],
        'reviewers' => $reviewers,
        'decisions' => $decisions,
    ];
}

if (in_array('editor_in_chief', $roles, true)) {
    $overview = $pdo->query(
        'SELECT
            (SELECT COUNT(*) FROM manuscripts) AS total_submissions,
            (SELECT COUNT(*) FROM manuscripts WHERE status = "accepted") AS accepted,
            (SELECT COUNT(*) FROM manuscripts WHERE status = "under_review") AS under_review,
            (SELECT COUNT(*) FROM manuscripts WHERE status = "published") AS published'
    )->fetch();

    $editorDecisions = $pdo->query(
        'SELECT ed.decision_id, ed.manuscript_id, ed.decision_type, ed.decision_date, ed.decision_letter, m.title, m.reference_number, m.status,
                CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS editor_name
         FROM editor_decisions ed
         INNER JOIN manuscripts m ON m.manuscript_id = ed.manuscript_id
         INNER JOIN users u ON u.user_id = ed.editor_id
         WHERE m.status NOT IN ("accepted", "rejected", "published")
           AND NOT EXISTS (
               SELECT 1
               FROM final_decisions fd_done
               WHERE fd_done.manuscript_id = ed.manuscript_id
           )
         ORDER BY ed.decision_date DESC'
    )->fetchAll();

    $finalDecisions = $pdo->prepare(
        'SELECT fd.final_decision_id, fd.manuscript_id, fd.final_decision, fd.approval_date, fd.remarks,
                m.title, m.reference_number, m.status,
                CONCAT(COALESCE(eic.first_name, ""), " ", COALESCE(eic.last_name, "")) AS editor_in_chief_name,
                a.article_id, a.issue_id, a.page_numbers, COALESCE(a.archived, 0) AS archived, a.archived_at,
                (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = fd.manuscript_id) AS file_bundle,
                (
                    SELECT mp.payment_status
                    FROM manuscript_payments mp
                    WHERE mp.manuscript_id = fd.manuscript_id
                    ORDER BY mp.payment_id DESC
                    LIMIT 1
                ) AS payment_status,
                    EXISTS(
                        SELECT 1
                        FROM manuscript_payments mp
                        WHERE mp.manuscript_id = fd.manuscript_id
                          AND mp.payment_status IN ("confirmed", "reviewed")
                          AND (
                              mp.amount >= :publication_fee
                              OR LOWER(COALESCE(mp.payment_details, "")) LIKE "%publication%"
                          )
                    ) AS payment_completed
         FROM final_decisions fd
         INNER JOIN manuscripts m ON m.manuscript_id = fd.manuscript_id
         LEFT JOIN users eic ON eic.user_id = fd.editor_in_chief_id
         LEFT JOIN articles a ON a.manuscript_id = fd.manuscript_id
         WHERE m.status <> "published"
         ORDER BY fd.approval_date DESC'
    );
    $finalDecisions->execute([
        'publication_fee' => jasti_manuscript_payment_base_amount(),
    ]);
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC')->fetchAll();
    $publishedArticles = $pdo->query(
        'SELECT a.article_id, a.manuscript_id, a.doi, a.issue_id, a.publication_date, a.page_numbers, a.article_url,
                COALESCE(a.archived, 0) AS archived, a.archived_at,
                m.title, m.reference_number, m.status,
                CONCAT("Vol. ", COALESCE(i.volume, ""), ", Issue ", COALESCE(i.issue_number, ""), " (", COALESCE(i.publication_year, ""), ")") AS issue_label,
                CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name,
                (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id) AS file_bundle
         FROM articles a
         INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
         LEFT JOIN issues i ON i.issue_id = a.issue_id
         LEFT JOIN users u ON u.user_id = m.corresponding_author_id
         WHERE m.status = "published"
         ORDER BY a.publication_date DESC, a.article_id DESC'
    )->fetchAll();
    $paymentQueue = $pdo->query(
        'SELECT mp.payment_id, mp.manuscript_id, mp.amount, mp.payment_reference, mp.payment_details, mp.proof_file_path, mp.payment_status, mp.submitted_at,
                m.title, m.reference_number, CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name
         FROM manuscript_payments mp
         INNER JOIN manuscripts m ON m.manuscript_id = mp.manuscript_id
         INNER JOIN users u ON u.user_id = mp.author_id
         ORDER BY mp.submitted_at DESC'
    )->fetchAll();
    $copyrightQueue = $pdo->query(
        'SELECT cf.form_id, cf.manuscript_id, cf.signed_file_path, cf.status, cf.submitted_at, m.title, m.reference_number
         FROM copyright_forms cf
         INNER JOIN manuscripts m ON m.manuscript_id = cf.manuscript_id
         ORDER BY cf.submitted_at DESC'
    )->fetchAll();

    $data['editor_in_chief'] = [
        'overview' => $overview ?: [],
        'editor_decisions' => $editorDecisions,
        'final_decisions' => $finalDecisions->fetchAll(),
        'published_articles' => $publishedArticles,
        'issues' => $issues,
        'users' => jasti_users_with_roles($pdo),
        'payments' => $paymentQueue,
        'copyright_forms' => $copyrightQueue,
    ];
}

if (in_array('admin', $roles, true)) {
    $journals = $pdo->query('SELECT * FROM journals ORDER BY journal_id ASC')->fetchAll();
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC')->fetchAll();
    $manuscripts = $pdo->query(
        'SELECT m.manuscript_id, m.title, m.scope_area, m.reference_number, m.status, m.article_type, m.plagiarism_score, m.submission_date,
                a.article_id, a.publication_date, COALESCE(a.archived, 0) AS archived, a.archived_at,
                CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name,
                u.email AS author_email
         FROM manuscripts m
         LEFT JOIN articles a ON a.manuscript_id = m.manuscript_id
         LEFT JOIN users u ON u.user_id = m.corresponding_author_id
         ORDER BY m.submission_date DESC'
    )->fetchAll();
    $data['admin'] = [
        'users' => jasti_users_with_roles($pdo),
        'journals' => $journals,
        'issues' => $issues,
        'manuscripts' => $manuscripts,
        'settings' => jasti_settings($pdo),
    ];
}

jasti_json($data);
