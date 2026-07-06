<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'editor');
$userId = (int) $user['user_id'];

ajasti_ensure_editor_workspace_schema($pdo);

$schemaReady = ajasti_table_exists($pdo, 'editors')
    && ajasti_table_exists($pdo, 'editor_qualifications')
    && ajasti_table_exists($pdo, 'editor_expertise')
    && ajasti_table_exists($pdo, 'editor_journal_experience')
    && ajasti_table_exists($pdo, 'journal_sections');

function ajasti_decode_array_field(mixed $value): array
{
    if (is_array($value)) {
        return $value;
    }
    if (is_string($value) && trim($value) !== '') {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }
    return [];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    if (!$schemaReady) {
        ajasti_json([
            'profile' => null,
            'onboarding' => [
                'completed' => false,
                'application' => [],
                'qualifications' => [],
                'expertise' => [],
                'journal_experiences' => [],
                'section_options' => [],
                'schema_ready' => false,
            ],
            'message' => 'Editor application tables are not available yet. Run the editor migration SQL first.',
        ]);
    }
    $profileStmt = $pdo->prepare(
        'SELECT *
         FROM editors
         WHERE user_id = :user_id
         LIMIT 1'
    );
    $profileStmt->execute(['user_id' => $userId]);
    $profile = $profileStmt->fetch() ?: null;
    $editorId = (int) ($profile['editor_id'] ?? 0);

    $qualifications = [];
    $expertise = [];
    $journalExperience = [];
    if ($editorId > 0) {
        $qualificationsStmt = $pdo->prepare(
            'SELECT qualification_id, degree, field_of_study, institution, graduation_year
             FROM editor_qualifications
             WHERE editor_id = :editor_id
             ORDER BY graduation_year DESC, qualification_id ASC'
        );
        $qualificationsStmt->execute(['editor_id' => $editorId]);
        $qualifications = $qualificationsStmt->fetchAll();

        $expertiseStmt = $pdo->prepare(
            'SELECT expertise_id, research_area, keywords
             FROM editor_expertise
             WHERE editor_id = :editor_id
             ORDER BY expertise_id ASC'
        );
        $expertiseStmt->execute(['editor_id' => $editorId]);
        $expertise = $expertiseStmt->fetchAll();

        $journalExperienceStmt = $pdo->prepare(
            'SELECT experience_id, journal_name, publisher, role_title, years_of_service
             FROM editor_journal_experience
             WHERE editor_id = :editor_id
             ORDER BY experience_id ASC'
        );
        $journalExperienceStmt->execute(['editor_id' => $editorId]);
        $journalExperience = $journalExperienceStmt->fetchAll();
    }

    $sectionOptions = $pdo->query(
        'SELECT section_id, section_name, description
         FROM journal_sections
         ORDER BY section_name ASC'
    )->fetchAll();

    ajasti_json([
        'profile' => $profile,
        'onboarding' => [
            'completed' => (bool) ((int) ($profile['application_completed'] ?? 0)),
            'application' => $profile ?: [],
            'qualifications' => $qualifications,
            'expertise' => $expertise,
            'journal_experiences' => $journalExperience,
            'section_options' => $sectionOptions,
        ],
    ]);
}

ajasti_require_method('POST');
if (!$schemaReady) {
    ajasti_json(['message' => 'Editor application tables are not available yet. Run the editor migration SQL first.'], 503);
}
$data = ajasti_request_data();

$title = trim((string) ($data['title'] ?? ''));
$firstName = trim((string) ($data['first_name'] ?? $user['first_name']));
$lastName = trim((string) ($data['last_name'] ?? $user['last_name']));
$gender = trim((string) ($data['gender'] ?? ''));
$nationality = trim((string) ($data['nationality'] ?? ''));
$country = trim((string) ($data['country'] ?? $user['country'] ?? ''));
$institution = trim((string) ($data['institution'] ?? $user['institution'] ?? ''));
$faculty = trim((string) ($data['faculty'] ?? ''));
$department = trim((string) ($data['department'] ?? ''));
$academicRank = trim((string) ($data['academic_rank'] ?? ''));
$position = trim((string) ($data['position'] ?? ''));
$email = trim((string) ($data['email'] ?? $user['email']));
$altEmail = trim((string) ($data['alt_email'] ?? ''));
$phone = trim((string) ($data['phone'] ?? $user['phone'] ?? ''));
$whatsappNumber = trim((string) ($data['whatsapp_number'] ?? ''));
$officeAddress = trim((string) ($data['office_address'] ?? ''));
$orcidId = trim((string) ($data['orcid_id'] ?? $user['orcid_id'] ?? ''));
$scopusId = trim((string) ($data['scopus_id'] ?? ''));
$researcherId = trim((string) ($data['researcher_id'] ?? ''));
$googleScholarLink = trim((string) ($data['google_scholar_link'] ?? ''));
$publicationCount = (int) ($data['publication_count'] ?? 0);
$publicationCountBand = trim((string) ($data['publication_count_band'] ?? ''));
$editorialExperience = in_array((string) ($data['editorial_experience'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$journalsReviewedBand = trim((string) ($data['journals_reviewed_band'] ?? ''));
$papersReviewedBand = trim((string) ($data['papers_reviewed_band'] ?? ''));
$manuscriptsPerYearBand = trim((string) ($data['manuscripts_per_year_band'] ?? ''));
$preferredDecisionTimeline = (int) ($data['preferred_decision_timeline'] ?? 14);
$primaryEditorialArea = trim((string) ($data['primary_editorial_area'] ?? ''));
$researchKeywords = trim((string) ($data['research_keywords'] ?? ''));
$bio = trim((string) ($data['bio'] ?? ''));
$editorRole = trim((string) ($data['editor_role'] ?? 'editorial_board')) ?: 'editorial_board';

$responsibilityFair = in_array((string) ($data['responsibility_fair_decisions'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$responsibilityConfidentiality = in_array((string) ($data['responsibility_confidentiality'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$responsibilityConflicts = in_array((string) ($data['responsibility_conflicts'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$responsibilityIntegrity = in_array((string) ($data['responsibility_integrity'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$responsibilityTimeliness = in_array((string) ($data['responsibility_timeliness'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$conflictDeclared = in_array((string) ($data['conflict_of_interest_declared'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$finalDeclarationAgreed = in_array((string) ($data['final_declaration_agreed'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$finalDeclarationDate = trim((string) ($data['final_declaration_date'] ?? '')) ?: date('Y-m-d');

$qualifications = array_values(array_filter(ajasti_decode_array_field($data['qualifications'] ?? []), static function ($entry): bool {
    return is_array($entry)
        && trim((string) ($entry['degree'] ?? '')) !== ''
        && trim((string) ($entry['field_of_study'] ?? '')) !== ''
        && trim((string) ($entry['institution'] ?? '')) !== ''
        && trim((string) ($entry['graduation_year'] ?? '')) !== '';
}));

$expertiseItems = array_values(array_filter(ajasti_decode_array_field($data['expertise'] ?? []), static function ($entry): bool {
    return is_array($entry)
        && trim((string) ($entry['research_area'] ?? '')) !== '';
}));

$journalExperiences = array_values(array_filter(ajasti_decode_array_field($data['journal_experiences'] ?? []), static function ($entry): bool {
    return is_array($entry)
        && trim((string) ($entry['journal_name'] ?? '')) !== '';
}));

$existingStmt = $pdo->prepare(
    'SELECT editor_id, cv_file, publication_list_file, status
     FROM editors
     WHERE user_id = :user_id
     LIMIT 1'
);
$existingStmt->execute(['user_id' => $userId]);
$existing = $existingStmt->fetch() ?: null;

$cvFile = (string) ($existing['cv_file'] ?? '');
if (isset($_FILES['cv_file']) && is_array($_FILES['cv_file'])) {
    $cvFile = ajasti_store_uploaded_file(
        $_FILES['cv_file'],
        'uploads/editors/cv',
        'editor_cv',
        [
            'application/pdf' => 'pdf',
        ]
    );
}

$publicationListFile = (string) ($existing['publication_list_file'] ?? '');
if (isset($_FILES['publication_list_file']) && is_array($_FILES['publication_list_file'])) {
    $publicationListFile = ajasti_store_uploaded_file(
        $_FILES['publication_list_file'],
        'uploads/editors/publications',
        'editor_publications',
        [
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'text/plain' => 'txt',
        ]
    );
}

$normalizedExpertise = [];
if ($primaryEditorialArea !== '') {
    $normalizedExpertise[] = [
        'research_area' => $primaryEditorialArea,
        'keywords' => $researchKeywords,
    ];
}
foreach ($expertiseItems as $entry) {
    $area = trim((string) ($entry['research_area'] ?? ''));
    if ($area === '') {
        continue;
    }
    $normalizedExpertise[$area] = [
        'research_area' => $area,
        'keywords' => trim((string) ($entry['keywords'] ?? '')),
    ];
}
$normalizedExpertise = array_values($normalizedExpertise);

$completionChecks = [
    $title !== '',
    $firstName !== '',
    $lastName !== '',
    $nationality !== '',
    $country !== '',
    $institution !== '',
    $faculty !== '',
    $department !== '',
    $academicRank !== '',
    $position !== '',
    $email !== '',
    $phone !== '',
    $officeAddress !== '',
    count($qualifications) > 0,
    $primaryEditorialArea !== '',
    $researchKeywords !== '',
    $journalsReviewedBand !== '',
    $papersReviewedBand !== '',
    $manuscriptsPerYearBand !== '',
    $preferredDecisionTimeline > 0,
    $bio !== '',
    $cvFile !== '',
    $responsibilityFair,
    $responsibilityConfidentiality,
    $responsibilityConflicts,
    $responsibilityIntegrity,
    $responsibilityTimeliness,
    $conflictDeclared,
    $finalDeclarationAgreed,
];
if ($editorialExperience) {
    $completionChecks[] = count($journalExperiences) > 0;
}
$applicationCompleted = !in_array(false, $completionChecks, true);

$pdo->beginTransaction();
try {
    $updateUserStmt = $pdo->prepare(
        'UPDATE users
         SET first_name = :first_name,
             last_name = :last_name,
             email = :email,
             orcid_id = :orcid_id,
             institution = :institution,
             country = :country,
             phone = :phone
         WHERE user_id = :user_id'
    );
    $updateUserStmt->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'orcid_id' => $orcidId !== '' ? $orcidId : null,
        'institution' => $institution !== '' ? $institution : null,
        'country' => $country !== '' ? $country : null,
        'phone' => $phone !== '' ? $phone : null,
        'user_id' => $userId,
    ]);

    if ($existing) {
        $editorId = (int) $existing['editor_id'];
        $editorStmt = $pdo->prepare(
            'UPDATE editors
             SET title = :title,
                 first_name = :first_name,
                 last_name = :last_name,
                 gender = :gender,
                 nationality = :nationality,
                 country = :country,
                 institution = :institution,
                 faculty = :faculty,
                 department = :department,
                 academic_rank = :academic_rank,
                 position = :position,
                 email = :email,
                 alt_email = :alt_email,
                 phone = :phone,
                 whatsapp_number = :whatsapp_number,
                 office_address = :office_address,
                 orcid_id = :orcid_id,
                 scopus_id = :scopus_id,
                 researcher_id = :researcher_id,
                 google_scholar_link = :google_scholar_link,
                 publication_count = :publication_count,
                 publication_count_band = :publication_count_band,
                 editorial_experience = :editorial_experience,
                 journals_reviewed_band = :journals_reviewed_band,
                 papers_reviewed_band = :papers_reviewed_band,
                 manuscripts_per_year_band = :manuscripts_per_year_band,
                 preferred_decision_timeline = :preferred_decision_timeline,
                 primary_editorial_area = :primary_editorial_area,
                 research_keywords = :research_keywords,
                 bio = :bio,
                 cv_file = :cv_file,
                 publication_list_file = :publication_list_file,
                 responsibility_fair_decisions = :responsibility_fair_decisions,
                 responsibility_confidentiality = :responsibility_confidentiality,
                 responsibility_conflicts = :responsibility_conflicts,
                 responsibility_integrity = :responsibility_integrity,
                 responsibility_timeliness = :responsibility_timeliness,
                 conflict_of_interest_declared = :conflict_of_interest_declared,
                 final_declaration_agreed = :final_declaration_agreed,
                 final_declaration_date = :final_declaration_date,
                 editor_role = :editor_role,
                 application_completed = :application_completed
             WHERE editor_id = :editor_id'
        );
    } else {
        $editorStmt = $pdo->prepare(
            'INSERT INTO editors (
                user_id, title, first_name, last_name, gender, nationality, country, institution, faculty, department,
                academic_rank, position, email, alt_email, phone, whatsapp_number, office_address, orcid_id, scopus_id,
                researcher_id, google_scholar_link, publication_count, publication_count_band, editorial_experience,
                journals_reviewed_band, papers_reviewed_band, manuscripts_per_year_band, preferred_decision_timeline,
                primary_editorial_area, research_keywords, bio, cv_file, publication_list_file,
                responsibility_fair_decisions, responsibility_confidentiality, responsibility_conflicts,
                responsibility_integrity, responsibility_timeliness, conflict_of_interest_declared,
                final_declaration_agreed, final_declaration_date, editor_role, application_completed
             ) VALUES (
                :user_id, :title, :first_name, :last_name, :gender, :nationality, :country, :institution, :faculty, :department,
                :academic_rank, :position, :email, :alt_email, :phone, :whatsapp_number, :office_address, :orcid_id, :scopus_id,
                :researcher_id, :google_scholar_link, :publication_count, :publication_count_band, :editorial_experience,
                :journals_reviewed_band, :papers_reviewed_band, :manuscripts_per_year_band, :preferred_decision_timeline,
                :primary_editorial_area, :research_keywords, :bio, :cv_file, :publication_list_file,
                :responsibility_fair_decisions, :responsibility_confidentiality, :responsibility_conflicts,
                :responsibility_integrity, :responsibility_timeliness, :conflict_of_interest_declared,
                :final_declaration_agreed, :final_declaration_date, :editor_role, :application_completed
             )'
        );
    }

    $editorParams = [
        'user_id' => $userId,
        'title' => $title !== '' ? $title : null,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'gender' => $gender !== '' ? $gender : null,
        'nationality' => $nationality !== '' ? $nationality : null,
        'country' => $country !== '' ? $country : null,
        'institution' => $institution !== '' ? $institution : null,
        'faculty' => $faculty !== '' ? $faculty : null,
        'department' => $department !== '' ? $department : null,
        'academic_rank' => $academicRank !== '' ? $academicRank : null,
        'position' => $position !== '' ? $position : null,
        'email' => $email,
        'alt_email' => $altEmail !== '' ? $altEmail : null,
        'phone' => $phone !== '' ? $phone : null,
        'whatsapp_number' => $whatsappNumber !== '' ? $whatsappNumber : null,
        'office_address' => $officeAddress !== '' ? $officeAddress : null,
        'orcid_id' => $orcidId !== '' ? $orcidId : null,
        'scopus_id' => $scopusId !== '' ? $scopusId : null,
        'researcher_id' => $researcherId !== '' ? $researcherId : null,
        'google_scholar_link' => $googleScholarLink !== '' ? $googleScholarLink : null,
        'publication_count' => $publicationCount,
        'publication_count_band' => $publicationCountBand !== '' ? $publicationCountBand : null,
        'editorial_experience' => $editorialExperience ? 1 : 0,
        'journals_reviewed_band' => $journalsReviewedBand !== '' ? $journalsReviewedBand : null,
        'papers_reviewed_band' => $papersReviewedBand !== '' ? $papersReviewedBand : null,
        'manuscripts_per_year_band' => $manuscriptsPerYearBand !== '' ? $manuscriptsPerYearBand : null,
        'preferred_decision_timeline' => $preferredDecisionTimeline,
        'primary_editorial_area' => $primaryEditorialArea !== '' ? $primaryEditorialArea : null,
        'research_keywords' => $researchKeywords !== '' ? $researchKeywords : null,
        'bio' => $bio !== '' ? $bio : null,
        'cv_file' => $cvFile !== '' ? $cvFile : null,
        'publication_list_file' => $publicationListFile !== '' ? $publicationListFile : null,
        'responsibility_fair_decisions' => $responsibilityFair ? 1 : 0,
        'responsibility_confidentiality' => $responsibilityConfidentiality ? 1 : 0,
        'responsibility_conflicts' => $responsibilityConflicts ? 1 : 0,
        'responsibility_integrity' => $responsibilityIntegrity ? 1 : 0,
        'responsibility_timeliness' => $responsibilityTimeliness ? 1 : 0,
        'conflict_of_interest_declared' => $conflictDeclared ? 1 : 0,
        'final_declaration_agreed' => $finalDeclarationAgreed ? 1 : 0,
        'final_declaration_date' => $finalDeclarationAgreed ? $finalDeclarationDate : null,
        'editor_role' => $editorRole,
        'application_completed' => $applicationCompleted ? 1 : 0,
    ];
    if ($existing) {
        $editorParams['editor_id'] = (int) $existing['editor_id'];
    }
    $editorStmt->execute($editorParams);

    $editorId = $existing ? (int) $existing['editor_id'] : (int) $pdo->lastInsertId();

    $pdo->prepare('DELETE FROM editor_qualifications WHERE editor_id = :editor_id')->execute(['editor_id' => $editorId]);
    $qualificationStmt = $pdo->prepare(
        'INSERT INTO editor_qualifications (editor_id, degree, field_of_study, institution, graduation_year)
         VALUES (:editor_id, :degree, :field_of_study, :institution, :graduation_year)'
    );
    foreach ($qualifications as $qualification) {
        $qualificationStmt->execute([
            'editor_id' => $editorId,
            'degree' => trim((string) ($qualification['degree'] ?? '')),
            'field_of_study' => trim((string) ($qualification['field_of_study'] ?? '')),
            'institution' => trim((string) ($qualification['institution'] ?? '')),
            'graduation_year' => trim((string) ($qualification['graduation_year'] ?? '')) ?: null,
        ]);
    }

    $pdo->prepare('DELETE FROM editor_expertise WHERE editor_id = :editor_id')->execute(['editor_id' => $editorId]);
    $expertiseStmt = $pdo->prepare(
        'INSERT INTO editor_expertise (editor_id, research_area, keywords)
         VALUES (:editor_id, :research_area, :keywords)'
    );
    foreach ($normalizedExpertise as $entry) {
        $expertiseStmt->execute([
            'editor_id' => $editorId,
            'research_area' => trim((string) ($entry['research_area'] ?? '')),
            'keywords' => trim((string) ($entry['keywords'] ?? '')) ?: null,
        ]);
    }

    $pdo->prepare('DELETE FROM editor_journal_experience WHERE editor_id = :editor_id')->execute(['editor_id' => $editorId]);
    $journalExperienceStmt = $pdo->prepare(
        'INSERT INTO editor_journal_experience (editor_id, journal_name, publisher, role_title, years_of_service)
         VALUES (:editor_id, :journal_name, :publisher, :role_title, :years_of_service)'
    );
    foreach ($journalExperiences as $entry) {
        $journalExperienceStmt->execute([
            'editor_id' => $editorId,
            'journal_name' => trim((string) ($entry['journal_name'] ?? '')),
            'publisher' => trim((string) ($entry['publisher'] ?? '')) ?: null,
            'role_title' => trim((string) ($entry['role_title'] ?? '')) ?: null,
            'years_of_service' => trim((string) ($entry['years_of_service'] ?? '')) !== '' ? (int) $entry['years_of_service'] : null,
        ]);
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ajasti_json(['message' => 'Unable to update editor application.', 'error' => $exception->getMessage()], 500);
}

ajasti_log($pdo, $userId, 'updated editor application', 'editors', $userId);
ajasti_json([
    'message' => $applicationCompleted ? 'Editor application completed successfully.' : 'Editor application progress saved.',
    'completed' => $applicationCompleted,
]);
