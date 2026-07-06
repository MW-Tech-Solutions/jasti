<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
require_once __DIR__ . '/support/copyleaks.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
ajasti_ensure_manuscript_reference_number($pdo);
ajasti_ensure_plagiarism_scan_table($pdo);
$user = ajasti_require_auth($pdo);
$userId = (int) $user['user_id'];
$roles = $user['roles'];
$data = [
    'user' => $user,
    'settings' => ajasti_settings($pdo),
    'roles' => $roles,
];

$messagesStmt = $pdo->prepare(
    'SELECT m.message_id, m.subject, m.message_body, m.sent_date, m.read_status, m.manuscript_id,
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
        'SELECT m.manuscript_id, m.title, m.abstract, m.keywords, m.reference_number, m.status, m.article_type, m.submission_date,
                m.plagiarism_score, m.version_number, a.doi, a.publication_date,
                COALESCE(am.downloads, 0) AS downloads,
                COALESCE(am.citations, 0) AS citations,
                COALESCE(am.altmetric_score, 0) AS altmetric_score,
                ps.status AS plagiarism_scan_status, ps.provider AS plagiarism_provider, ps.last_error AS plagiarism_scan_error,
                (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id) AS file_bundle
         FROM manuscripts m
         LEFT JOIN articles a ON a.manuscript_id = m.manuscript_id
         LEFT JOIN (
             SELECT article_id,
                    SUM(COALESCE(downloads, 0)) AS downloads,
                    SUM(COALESCE(citations, 0)) AS citations,
                    MAX(COALESCE(altmetric_score, 0)) AS altmetric_score
             FROM article_metrics
             GROUP BY article_id
         ) am ON am.article_id = a.article_id
         LEFT JOIN manuscript_plagiarism_scans ps ON ps.manuscript_id = m.manuscript_id
         WHERE m.corresponding_author_id = :user_id
         ORDER BY m.submission_date DESC'
    );
    $authorStmt->execute(['user_id' => $userId]);
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
    $reviewerTablesReady = ajasti_table_exists($pdo, 'reviewers')
        && ajasti_table_exists($pdo, 'reviewer_qualifications')
        && ajasti_table_exists($pdo, 'reviewer_expertise')
        && ajasti_table_exists($pdo, 'reviewer_journal_experience')
        && ajasti_table_exists($pdo, 'reviewer_availability')
        && ajasti_table_exists($pdo, 'reviewer_conflicts')
        && ajasti_table_exists($pdo, 'reviewer_agreements');

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
                    m.title, m.abstract, m.status, m.article_type,
                    (SELECT GROUP_CONCAT(CONCAT(mf.file_type, ": ", mf.file_path) SEPARATOR " || ") FROM manuscript_files mf WHERE mf.manuscript_id = m.manuscript_id) AS file_bundle
             FROM review_invitations ri
             INNER JOIN manuscripts m ON m.manuscript_id = ri.manuscript_id
             WHERE ri.reviewer_id = :user_id
             ORDER BY ri.invitation_date DESC'
        );
        $invitationsStmt->execute(['user_id' => $userId]);
        $invitations = $invitationsStmt->fetchAll();

        $reviewsStmt = $pdo->prepare(
            'SELECT rv.review_id, rv.manuscript_id, rv.review_date, rv.recommendation, rv.comments_to_author,
                    rv.confidential_comments, rv.score_novelty, rv.score_methodology, rv.score_clarity, rv.score_significance,
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

if (ajasti_has_editor_workspace_role($roles)) {
    ajasti_ensure_editor_workspace_schema($pdo);
    $acceptedEditorProfile = ajasti_user_editor_profile($pdo, $userId);
    $latestEditorApplication = ajasti_get_latest_editor_application($pdo, $userId);
    $editorProfile = null;
    $editorQualifications = [];
    $editorExpertise = [];
    $editorJournalExperience = [];
    $sectionOptions = [];
    $editorApproved = $acceptedEditorProfile !== null && strtolower((string) ($acceptedEditorProfile['status'] ?? '')) === 'active';
    $editorTablesReady = ajasti_table_exists($pdo, 'editors')
        && ajasti_table_exists($pdo, 'editor_qualifications')
        && ajasti_table_exists($pdo, 'editor_expertise')
        && ajasti_table_exists($pdo, 'editor_journal_experience')
        && ajasti_table_exists($pdo, 'journal_sections');

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
    if (($editorApproved ?? false) === true) {
        $assignmentsStmt = $pdo->prepare(
            'SELECT ea.assignment_id, ea.manuscript_id, ea.status AS assignment_status, ea.assigned_date,
                    m.title, m.reference_number, m.status, m.article_type, m.plagiarism_score, m.submission_date,
                    ps.status AS plagiarism_scan_status,
                    (SELECT COUNT(*) FROM review_invitations ri WHERE ri.manuscript_id = ea.manuscript_id) AS reviewer_invitation_count,
                    (SELECT COUNT(*) FROM review_invitations ri WHERE ri.manuscript_id = ea.manuscript_id AND ri.response = "accepted") AS accepted_invitation_count,
                    (SELECT COUNT(*) FROM reviews rv WHERE rv.manuscript_id = ea.manuscript_id) AS completed_review_count,
                    EXISTS(SELECT 1 FROM editor_decisions ed2 WHERE ed2.manuscript_id = ea.manuscript_id AND ed2.editor_id = ea.editor_id) AS has_editor_decision,
                    CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name
             FROM editor_assignments ea
             INNER JOIN manuscripts m ON m.manuscript_id = ea.manuscript_id
             LEFT JOIN manuscript_plagiarism_scans ps ON ps.manuscript_id = m.manuscript_id
             LEFT JOIN users u ON u.user_id = m.corresponding_author_id
             WHERE ea.editor_id = :user_id
             ORDER BY ea.assigned_date DESC'
        );
        $assignmentsStmt->execute(['user_id' => $userId]);
        $assignments = $assignmentsStmt->fetchAll();

        $unassignedStmt = $pdo->query(
            'SELECT m.manuscript_id, m.title, m.reference_number, m.status, m.article_type, m.plagiarism_score, m.submission_date,
                    ps.status AS plagiarism_scan_status
             FROM manuscripts m
             LEFT JOIN editor_assignments ea ON ea.manuscript_id = m.manuscript_id AND ea.status IN ("pending", "active")
             LEFT JOIN manuscript_plagiarism_scans ps ON ps.manuscript_id = m.manuscript_id
             WHERE ea.assignment_id IS NULL
             ORDER BY m.submission_date DESC'
        );
        $unassigned = $unassignedStmt->fetchAll();

        $reviewersStmt = $pdo->query(
            'SELECT u.user_id, u.first_name, u.last_name, u.email, rp.expertise_area, rp.availability_status, rp.total_reviews,
                    ro.specializations_json
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
        'SELECT ed.decision_id, ed.manuscript_id, ed.decision_type, ed.decision_date, ed.decision_letter, m.title, m.reference_number,
                CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS editor_name
         FROM editor_decisions ed
         INNER JOIN manuscripts m ON m.manuscript_id = ed.manuscript_id
         INNER JOIN users u ON u.user_id = ed.editor_id
         ORDER BY ed.decision_date DESC'
    )->fetchAll();

    $finalDecisions = $pdo->prepare(
        'SELECT fd.final_decision_id, fd.manuscript_id, fd.final_decision, fd.approval_date, fd.remarks,
                m.title, m.reference_number, m.status,
                a.article_id, a.issue_id, a.page_numbers
         FROM final_decisions fd
         INNER JOIN manuscripts m ON m.manuscript_id = fd.manuscript_id
         LEFT JOIN articles a ON a.manuscript_id = fd.manuscript_id
         WHERE fd.editor_in_chief_id = :user_id
         ORDER BY fd.approval_date DESC'
    );
    $finalDecisions->execute(['user_id' => $userId]);
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC')->fetchAll();
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
        'issues' => $issues,
        'users' => ajasti_users_with_roles($pdo),
        'payments' => $paymentQueue,
        'copyright_forms' => $copyrightQueue,
    ];
}

if (in_array('admin', $roles, true)) {
    $journals = $pdo->query('SELECT * FROM journals ORDER BY journal_id ASC')->fetchAll();
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC')->fetchAll();
    $manuscripts = $pdo->query(
        'SELECT m.manuscript_id, m.title, m.reference_number, m.status, m.article_type, m.plagiarism_score, m.submission_date,
                CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS author_name
         FROM manuscripts m
         LEFT JOIN users u ON u.user_id = m.corresponding_author_id
         ORDER BY m.submission_date DESC'
    )->fetchAll();
    $data['admin'] = [
        'users' => ajasti_users_with_roles($pdo),
        'journals' => $journals,
        'issues' => $issues,
        'manuscripts' => $manuscripts,
        'settings' => ajasti_settings($pdo),
    ];
}

ajasti_json($data);
