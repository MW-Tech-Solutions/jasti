<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'reviewer');
$userId = (int) $user['user_id'];

$schemaReady = jasti_table_exists($pdo, 'reviewers')
    && jasti_table_exists($pdo, 'reviewer_qualifications')
    && jasti_table_exists($pdo, 'reviewer_expertise')
    && jasti_table_exists($pdo, 'reviewer_journal_experience')
    && jasti_table_exists($pdo, 'reviewer_availability')
    && jasti_table_exists($pdo, 'reviewer_conflicts')
    && jasti_table_exists($pdo, 'reviewer_agreements');

function jasti_decode_reviewer_array(mixed $value): array
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
        jasti_json([
            'profile' => null,
            'onboarding' => [
                'completed' => false,
                'application' => [],
                'qualifications' => [],
                'expertise' => [],
                'journal_experiences' => [],
                'availability' => [],
                'conflicts' => [],
                'agreements' => [],
                'specialization_options' => [],
                'schema_ready' => false,
            ],
            'message' => 'Reviewer application tables are not available yet. Run the reviewer migration SQL first.',
        ]);
    }
    $settings = jasti_settings($pdo);

    $reviewerStmt = $pdo->prepare(
        'SELECT *
         FROM reviewers
         WHERE user_id = :user_id
         LIMIT 1'
    );
    $reviewerStmt->execute(['user_id' => $userId]);
    $reviewer = $reviewerStmt->fetch() ?: null;
    $reviewerId = (int) ($reviewer['reviewer_id'] ?? 0);

    $profileStmt = $pdo->prepare(
        'SELECT expertise_area, reviewer_rating, total_reviews, availability_status
         FROM reviewer_profiles
         WHERE reviewer_id = :reviewer_id
         LIMIT 1'
    );
    $profileStmt->execute(['reviewer_id' => $userId]);

    $qualifications = [];
    $expertise = [];
    $journalExperience = [];
    $availability = [];
    $conflicts = [];
    $agreements = [];
    if ($reviewerId > 0) {
        $qualificationStmt = $pdo->prepare(
            'SELECT qualification_id, degree, field_of_study, institution, graduation_year
             FROM reviewer_qualifications
             WHERE reviewer_id = :reviewer_id
             ORDER BY graduation_year DESC, qualification_id ASC'
        );
        $qualificationStmt->execute(['reviewer_id' => $reviewerId]);
        $qualifications = $qualificationStmt->fetchAll();

        $expertiseStmt = $pdo->prepare(
            'SELECT expertise_id, research_area, keywords
             FROM reviewer_expertise
             WHERE reviewer_id = :reviewer_id
             ORDER BY expertise_id ASC'
        );
        $expertiseStmt->execute(['reviewer_id' => $reviewerId]);
        $expertise = $expertiseStmt->fetchAll();

        $journalExperienceStmt = $pdo->prepare(
            'SELECT experience_id, journal_name, publisher, years_of_service
             FROM reviewer_journal_experience
             WHERE reviewer_id = :reviewer_id
             ORDER BY experience_id ASC'
        );
        $journalExperienceStmt->execute(['reviewer_id' => $reviewerId]);
        $journalExperience = $journalExperienceStmt->fetchAll();

        $availabilityStmt = $pdo->prepare(
            'SELECT availability_id, available, max_reviews_per_year, last_review_date
             FROM reviewer_availability
             WHERE reviewer_id = :reviewer_id
             LIMIT 1'
        );
        $availabilityStmt->execute(['reviewer_id' => $reviewerId]);
        $availability = $availabilityStmt->fetch() ?: [];

        $conflictStmt = $pdo->prepare(
            'SELECT conflict_id, institution_conflict, author_conflict, notes
             FROM reviewer_conflicts
             WHERE reviewer_id = :reviewer_id
             ORDER BY conflict_id ASC'
        );
        $conflictStmt->execute(['reviewer_id' => $reviewerId]);
        $conflicts = $conflictStmt->fetchAll();

        $agreementsStmt = $pdo->prepare(
            'SELECT agreement_id, confidentiality_agreed, conflict_policy_agreed, ethical_review_agreed, agreement_date
             FROM reviewer_agreements
             WHERE reviewer_id = :reviewer_id
             LIMIT 1'
        );
        $agreementsStmt->execute(['reviewer_id' => $reviewerId]);
        $agreements = $agreementsStmt->fetch() ?: [];
    }

    jasti_json([
        'profile' => $profileStmt->fetch() ?: null,
        'onboarding' => [
            'completed' => (bool) ((int) ($reviewer['application_completed'] ?? 0)),
            'application' => $reviewer ?: [],
            'qualifications' => $qualifications,
            'expertise' => $expertise,
            'journal_experiences' => $journalExperience,
            'availability' => $availability,
            'conflicts' => $conflicts,
            'agreements' => $agreements,
            'specialization_options' => json_decode((string) ($settings['review_specializations_json'] ?? '[]'), true) ?: [],
        ],
    ]);
}

jasti_require_method('POST');
if (!$schemaReady) {
    jasti_json(['message' => 'Reviewer application tables are not available yet. Run the reviewer migration SQL first.'], 503);
}
$data = jasti_request_data();

$title = trim((string) ($data['title'] ?? ''));
$firstName = trim((string) ($data['first_name'] ?? $user['first_name']));
$lastName = trim((string) ($data['last_name'] ?? $user['last_name']));
$gender = trim((string) ($data['gender'] ?? ''));
$nationality = trim((string) ($data['nationality'] ?? ''));
$country = trim((string) ($data['country'] ?? $user['country'] ?? ''));
$institution = trim((string) ($data['institution'] ?? $user['institution'] ?? ''));
$department = trim((string) ($data['department'] ?? ''));
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
$reviewerExperience = in_array((string) ($data['reviewer_experience'] ?? '0'), ['1', 'true', 'yes', 'on'], true);
$papersReviewedBand = trim((string) ($data['papers_reviewed_band'] ?? ''));
$manuscriptsPerYear = (int) ($data['manuscripts_per_year'] ?? 3);
$manuscriptsPerYearBand = trim((string) ($data['manuscripts_per_year_band'] ?? ''));
$preferredReviewTime = (int) ($data['preferred_review_time'] ?? 14);
$bio = trim((string) ($data['bio'] ?? ''));
$specializations = array_values(array_filter(array_map('trim', (array) jasti_decode_reviewer_array($data['specializations'] ?? []))));

$qualifications = array_values(array_filter(jasti_decode_reviewer_array($data['qualifications'] ?? []), static function ($entry): bool {
    return is_array($entry)
        && trim((string) ($entry['degree'] ?? '')) !== ''
        && trim((string) ($entry['field_of_study'] ?? '')) !== ''
        && trim((string) ($entry['institution'] ?? '')) !== ''
        && trim((string) ($entry['graduation_year'] ?? '')) !== '';
}));

$expertise = array_values(array_filter(jasti_decode_reviewer_array($data['expertise'] ?? []), static function ($entry): bool {
    return is_array($entry) && trim((string) ($entry['research_area'] ?? '')) !== '';
}));
if ($specializations !== []) {
    foreach ($specializations as $area) {
        $expertise[] = [
            'research_area' => $area,
            'keywords' => '',
        ];
    }
}
$expertise = array_values(array_reduce($expertise, static function (array $carry, array $entry): array {
    $area = trim((string) ($entry['research_area'] ?? ''));
    if ($area === '') {
        return $carry;
    }
    $carry[$area] = [
        'research_area' => $area,
        'keywords' => trim((string) ($entry['keywords'] ?? '')),
    ];
    return $carry;
}, []));

$journalExperiences = array_values(array_filter(jasti_decode_reviewer_array($data['journal_experiences'] ?? []), static function ($entry): bool {
    return is_array($entry) && trim((string) ($entry['journal_name'] ?? '')) !== '';
}));

$conflicts = array_values(array_filter(jasti_decode_reviewer_array($data['conflicts'] ?? []), static function ($entry): bool {
    return is_array($entry)
        && (trim((string) ($entry['institution_conflict'] ?? '')) !== '' || trim((string) ($entry['author_conflict'] ?? '')) !== '' || trim((string) ($entry['notes'] ?? '')) !== '');
}));

$availability = [
    'available' => in_array((string) ($data['available'] ?? '1'), ['1', 'true', 'yes', 'on'], true),
    'max_reviews_per_year' => trim((string) ($data['max_reviews_per_year'] ?? '')) !== '' ? (int) $data['max_reviews_per_year'] : null,
    'last_review_date' => trim((string) ($data['last_review_date'] ?? '')) ?: null,
];

$agreements = [
    'confidentiality_agreed' => in_array((string) ($data['confidentiality_agreed'] ?? '0'), ['1', 'true', 'yes', 'on'], true),
    'conflict_policy_agreed' => in_array((string) ($data['conflict_policy_agreed'] ?? '0'), ['1', 'true', 'yes', 'on'], true),
    'ethical_review_agreed' => in_array((string) ($data['ethical_review_agreed'] ?? '0'), ['1', 'true', 'yes', 'on'], true),
];

$existingStmt = $pdo->prepare(
    'SELECT reviewer_id, cv_file, publication_list_file, orcid_screenshot_file, reviews_completed, reviewer_score, status
     FROM reviewers
     WHERE user_id = :user_id
     LIMIT 1'
);
$existingStmt->execute(['user_id' => $userId]);
$existing = $existingStmt->fetch() ?: null;

$cvFile = (string) ($existing['cv_file'] ?? '');
if (isset($_FILES['cv_file']) && is_array($_FILES['cv_file'])) {
    $cvFile = jasti_store_uploaded_file(
        $_FILES['cv_file'],
        'uploads/reviewers/cv',
        'reviewer_cv',
        [
            'application/pdf' => 'pdf',
        ]
    );
}

$publicationListFile = (string) ($existing['publication_list_file'] ?? '');
if (isset($_FILES['publication_list_file']) && is_array($_FILES['publication_list_file'])) {
    $publicationListFile = jasti_store_uploaded_file(
        $_FILES['publication_list_file'],
        'uploads/reviewers/publications',
        'reviewer_publications',
        [
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'text/plain' => 'txt',
        ]
    );
}

$orcidScreenshotFile = (string) ($existing['orcid_screenshot_file'] ?? '');
if (isset($_FILES['orcid_screenshot_file']) && is_array($_FILES['orcid_screenshot_file'])) {
    $orcidScreenshotFile = jasti_store_uploaded_file(
        $_FILES['orcid_screenshot_file'],
        'uploads/reviewers/orcid',
        'reviewer_orcid',
        [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
        ]
    );
}

$completionChecks = [
    $title !== '',
    $firstName !== '',
    $lastName !== '',
    $nationality !== '',
    $country !== '',
    $institution !== '',
    $department !== '',
    $position !== '',
    $email !== '',
    $phone !== '',
    count($qualifications) > 0,
    count($expertise) > 0,
    $papersReviewedBand !== '',
    $manuscriptsPerYearBand !== '',
    $preferredReviewTime > 0,
    $bio !== '',
    $cvFile !== '',
    $agreements['confidentiality_agreed'],
    $agreements['conflict_policy_agreed'],
    $agreements['ethical_review_agreed'],
];
if ($reviewerExperience) {
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
        $reviewerId = (int) $existing['reviewer_id'];
        $reviewerStmt = $pdo->prepare(
            'UPDATE reviewers
             SET title = :title,
                 first_name = :first_name,
                 last_name = :last_name,
                 gender = :gender,
                 nationality = :nationality,
                 country = :country,
                 institution = :institution,
                 department = :department,
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
                 reviewer_experience = :reviewer_experience,
                 papers_reviewed_band = :papers_reviewed_band,
                 manuscripts_per_year = :manuscripts_per_year,
                 manuscripts_per_year_band = :manuscripts_per_year_band,
                 preferred_review_time = :preferred_review_time,
                 bio = :bio,
                 cv_file = :cv_file,
                 publication_list_file = :publication_list_file,
                 orcid_screenshot_file = :orcid_screenshot_file,
                 application_completed = :application_completed
             WHERE reviewer_id = :reviewer_id'
        );
    } else {
        $reviewerStmt = $pdo->prepare(
            'INSERT INTO reviewers (
                user_id, title, first_name, last_name, gender, nationality, country, institution, department, position,
                email, alt_email, phone, whatsapp_number, office_address, orcid_id, scopus_id, researcher_id,
                google_scholar_link, publication_count, publication_count_band, reviewer_experience, papers_reviewed_band,
                manuscripts_per_year, manuscripts_per_year_band, preferred_review_time, bio, cv_file, publication_list_file,
                orcid_screenshot_file, application_completed, reviews_completed, reviewer_score
             ) VALUES (
                :user_id, :title, :first_name, :last_name, :gender, :nationality, :country, :institution, :department, :position,
                :email, :alt_email, :phone, :whatsapp_number, :office_address, :orcid_id, :scopus_id, :researcher_id,
                :google_scholar_link, :publication_count, :publication_count_band, :reviewer_experience, :papers_reviewed_band,
                :manuscripts_per_year, :manuscripts_per_year_band, :preferred_review_time, :bio, :cv_file, :publication_list_file,
                :orcid_screenshot_file, :application_completed, :reviews_completed, :reviewer_score
             )'
        );
    }

    $reviewerParams = [
        'user_id' => $userId,
        'title' => $title !== '' ? $title : null,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'gender' => $gender !== '' ? $gender : null,
        'nationality' => $nationality !== '' ? $nationality : null,
        'country' => $country !== '' ? $country : null,
        'institution' => $institution !== '' ? $institution : null,
        'department' => $department !== '' ? $department : null,
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
        'reviewer_experience' => $reviewerExperience ? 1 : 0,
        'papers_reviewed_band' => $papersReviewedBand !== '' ? $papersReviewedBand : null,
        'manuscripts_per_year' => $manuscriptsPerYear,
        'manuscripts_per_year_band' => $manuscriptsPerYearBand !== '' ? $manuscriptsPerYearBand : null,
        'preferred_review_time' => $preferredReviewTime,
        'bio' => $bio !== '' ? $bio : null,
        'cv_file' => $cvFile !== '' ? $cvFile : null,
        'publication_list_file' => $publicationListFile !== '' ? $publicationListFile : null,
        'orcid_screenshot_file' => $orcidScreenshotFile !== '' ? $orcidScreenshotFile : null,
        'application_completed' => $applicationCompleted ? 1 : 0,
        'reviews_completed' => (int) ($existing['reviews_completed'] ?? 0),
        'reviewer_score' => (float) ($existing['reviewer_score'] ?? 0),
    ];
    if ($existing) {
        $reviewerParams['reviewer_id'] = (int) $existing['reviewer_id'];
    }
    $reviewerStmt->execute($reviewerParams);

    $reviewerId = $existing ? (int) $existing['reviewer_id'] : (int) $pdo->lastInsertId();

    $pdo->prepare('DELETE FROM reviewer_qualifications WHERE reviewer_id = :reviewer_id')->execute(['reviewer_id' => $reviewerId]);
    $qualificationStmt = $pdo->prepare(
        'INSERT INTO reviewer_qualifications (reviewer_id, degree, field_of_study, institution, graduation_year)
         VALUES (:reviewer_id, :degree, :field_of_study, :institution, :graduation_year)'
    );
    foreach ($qualifications as $qualification) {
        $qualificationStmt->execute([
            'reviewer_id' => $reviewerId,
            'degree' => trim((string) ($qualification['degree'] ?? '')),
            'field_of_study' => trim((string) ($qualification['field_of_study'] ?? '')),
            'institution' => trim((string) ($qualification['institution'] ?? '')),
            'graduation_year' => trim((string) ($qualification['graduation_year'] ?? '')) ?: null,
        ]);
    }

    $pdo->prepare('DELETE FROM reviewer_expertise WHERE reviewer_id = :reviewer_id')->execute(['reviewer_id' => $reviewerId]);
    $expertiseStmt = $pdo->prepare(
        'INSERT INTO reviewer_expertise (reviewer_id, research_area, keywords)
         VALUES (:reviewer_id, :research_area, :keywords)'
    );
    foreach ($expertise as $entry) {
        $expertiseStmt->execute([
            'reviewer_id' => $reviewerId,
            'research_area' => trim((string) ($entry['research_area'] ?? '')),
            'keywords' => trim((string) ($entry['keywords'] ?? '')) ?: null,
        ]);
    }

    $pdo->prepare('DELETE FROM reviewer_journal_experience WHERE reviewer_id = :reviewer_id')->execute(['reviewer_id' => $reviewerId]);
    $journalExperienceStmt = $pdo->prepare(
        'INSERT INTO reviewer_journal_experience (reviewer_id, journal_name, publisher, years_of_service)
         VALUES (:reviewer_id, :journal_name, :publisher, :years_of_service)'
    );
    foreach ($journalExperiences as $entry) {
        $journalExperienceStmt->execute([
            'reviewer_id' => $reviewerId,
            'journal_name' => trim((string) ($entry['journal_name'] ?? '')),
            'publisher' => trim((string) ($entry['publisher'] ?? '')) ?: null,
            'years_of_service' => trim((string) ($entry['years_of_service'] ?? '')) !== '' ? (int) $entry['years_of_service'] : null,
        ]);
    }

    $pdo->prepare('DELETE FROM reviewer_conflicts WHERE reviewer_id = :reviewer_id')->execute(['reviewer_id' => $reviewerId]);
    $conflictStmt = $pdo->prepare(
        'INSERT INTO reviewer_conflicts (reviewer_id, institution_conflict, author_conflict, notes)
         VALUES (:reviewer_id, :institution_conflict, :author_conflict, :notes)'
    );
    foreach ($conflicts as $entry) {
        $conflictStmt->execute([
            'reviewer_id' => $reviewerId,
            'institution_conflict' => trim((string) ($entry['institution_conflict'] ?? '')) ?: null,
            'author_conflict' => trim((string) ($entry['author_conflict'] ?? '')) ?: null,
            'notes' => trim((string) ($entry['notes'] ?? '')) ?: null,
        ]);
    }

    $availabilityStmt = $pdo->prepare(
        'INSERT INTO reviewer_availability (reviewer_id, available, max_reviews_per_year, last_review_date)
         VALUES (:reviewer_id, :available, :max_reviews_per_year, :last_review_date)
         ON DUPLICATE KEY UPDATE
            available = VALUES(available),
            max_reviews_per_year = VALUES(max_reviews_per_year),
            last_review_date = VALUES(last_review_date)'
    );
    $availabilityStmt->execute([
        'reviewer_id' => $reviewerId,
        'available' => $availability['available'] ? 1 : 0,
        'max_reviews_per_year' => $availability['max_reviews_per_year'],
        'last_review_date' => $availability['last_review_date'],
    ]);

    $agreementsStmt = $pdo->prepare(
        'INSERT INTO reviewer_agreements (reviewer_id, confidentiality_agreed, conflict_policy_agreed, ethical_review_agreed)
         VALUES (:reviewer_id, :confidentiality_agreed, :conflict_policy_agreed, :ethical_review_agreed)
         ON DUPLICATE KEY UPDATE
            confidentiality_agreed = VALUES(confidentiality_agreed),
            conflict_policy_agreed = VALUES(conflict_policy_agreed),
            ethical_review_agreed = VALUES(ethical_review_agreed),
            agreement_date = CURRENT_TIMESTAMP'
    );
    $agreementsStmt->execute([
        'reviewer_id' => $reviewerId,
        'confidentiality_agreed' => $agreements['confidentiality_agreed'] ? 1 : 0,
        'conflict_policy_agreed' => $agreements['conflict_policy_agreed'] ? 1 : 0,
        'ethical_review_agreed' => $agreements['ethical_review_agreed'] ? 1 : 0,
    ]);

    $profileStmt = $pdo->prepare(
        'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
         VALUES (:reviewer_id, :expertise_area, :reviewer_rating, :total_reviews, :availability_status)
         ON DUPLICATE KEY UPDATE
            expertise_area = VALUES(expertise_area),
            reviewer_rating = VALUES(reviewer_rating),
            total_reviews = VALUES(total_reviews),
            availability_status = VALUES(availability_status)'
    );
    $profileStmt->execute([
        'reviewer_id' => $userId,
        'expertise_area' => count($specializations) > 0 ? implode(', ', $specializations) : implode(', ', array_map(static fn (array $entry): string => (string) $entry['research_area'], $expertise)),
        'reviewer_rating' => (float) ($existing['reviewer_score'] ?? 0),
        'total_reviews' => (int) ($existing['reviews_completed'] ?? 0),
        'availability_status' => $availability['available'] ? 'available' : 'busy',
    ]);

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jasti_json(['message' => 'Unable to update reviewer application.', 'error' => $exception->getMessage()], 500);
}

jasti_log($pdo, $userId, 'updated reviewer application', 'reviewers', $userId);
jasti_json([
    'message' => $applicationCompleted ? 'Reviewer application completed successfully.' : 'Reviewer application progress saved.',
    'completed' => $applicationCompleted,
]);
