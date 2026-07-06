<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);

// Get editor profile
$profile = ajasti_user_editor_profile($pdo, $user['user_id']);
if (!$profile) {
    ajasti_json(['message' => 'You do not have an editor profile.'], 403);
}

$editorType = $profile['type_name'];

// Get stats based on editor type
$stats = [
    'total_manuscripts' => 0,
    'pending_review' => 0,
    'assigned_to_me' => 0,
    'decisions_made' => 0,
    'active_reviewers' => 0,
];

if ($editorType === 'editor_in_chief') {
    // Get total manuscripts
    $stmt = $pdo->query('SELECT COUNT(*) as count FROM manuscripts');
    $result = $stmt->fetch();
    $stats['total_manuscripts'] = (int) ($result['count'] ?? 0);

    // Get pending manuscripts
    $stmt = $pdo->query('SELECT COUNT(*) as count FROM manuscripts WHERE status = "under_review"');
    $result = $stmt->fetch();
    $stats['pending_review'] = (int) ($result['count'] ?? 0);

    // Get decisions made
    $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM editor_decisions WHERE editor_id = :user_id');
    $stmt->execute(['user_id' => $user['user_id']]);
    $result = $stmt->fetch();
    $stats['decisions_made'] = (int) ($result['count'] ?? 0);

    // Get active reviewers
    $stmt = $pdo->query('SELECT COUNT(DISTINCT reviewer_id) as count FROM reviews');
    $result = $stmt->fetch();
    $stats['active_reviewers'] = (int) ($result['count'] ?? 0);
    
} elseif ($editorType === 'section_editor') {
    // Get assigned manuscripts
    $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM manuscripts WHERE current_editor_id = :user_id');
    $stmt->execute(['user_id' => $user['user_id']]);
    $result = $stmt->fetch();
    $stats['assigned_to_me'] = (int) ($result['count'] ?? 0);

    // Get pending/under review
    $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM manuscripts WHERE current_editor_id = :user_id AND status IN ("submitted", "under_review")');
    $stmt->execute(['user_id' => $user['user_id']]);
    $result = $stmt->fetch();
    $stats['pending_review'] = (int) ($result['count'] ?? 0);
     
} elseif ($editorType === 'managing_editor') {
    // Get all manuscripts
    $stmt = $pdo->query('SELECT COUNT(*) as count FROM manuscripts');
    $result = $stmt->fetch();
    $stats['total_manuscripts'] = (int) ($result['count'] ?? 0);

    // Get communications needed
    $stmt = $pdo->query('SELECT COUNT(DISTINCT manuscript_id) as count FROM messages WHERE read_status <> "read"');
    $result = $stmt->fetch();
    $stats['pending_review'] = (int) ($result['count'] ?? 0);
    
} elseif ($editorType === 'technical_editor') {
    // Use accepted manuscripts as the formatting queue when no dedicated formatting column exists.
    $stmt = $pdo->query('SELECT COUNT(*) as count FROM manuscripts WHERE status = "accepted"');
    $result = $stmt->fetch();
    $stats['pending_review'] = (int) ($result['count'] ?? 0);
    
} elseif ($editorType === 'reviewer') {
    // Get assigned reviews
    $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM review_invitations WHERE reviewer_id = :user_id AND response = "pending"');
    $stmt->execute(['user_id' => $user['user_id']]);
    $result = $stmt->fetch();
    $stats['assigned_to_me'] = (int) ($result['count'] ?? 0);

    // Get completed reviews
    $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM reviews WHERE reviewer_id = :user_id');
    $stmt->execute(['user_id' => $user['user_id']]);
    $result = $stmt->fetch();
    $stats['decisions_made'] = (int) ($result['count'] ?? 0);
}

ajasti_json([
    'user' => [
        'user_id' => $user['user_id'],
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'email' => $user['email'],
    ],
    'editor_profile' => [
        'editor_type' => $editorType,
        'title' => $profile['description'],
        'status' => $profile['status'],
        'appointment_date' => $profile['appointment_date'],
        'subject_areas' => $profile['subject_areas'],
        'bio' => $profile['bio'],
    ],
    'stats' => $stats,
    'access' => [
        'can_view_submissions' => ajasti_can_access_dashboard($pdo, $user['user_id'], 'submissions'),
        'can_edit_submissions' => ajasti_can_edit_dashboard($pdo, $user['user_id'], 'submissions'),
        'can_view_reviewers' => ajasti_can_access_dashboard($pdo, $user['user_id'], 'reviewers'),
        'can_edit_reviewers' => ajasti_can_edit_dashboard($pdo, $user['user_id'], 'reviewers'),
        'can_view_decisions' => ajasti_can_access_dashboard($pdo, $user['user_id'], 'decisions'),
        'can_edit_decisions' => ajasti_can_edit_dashboard($pdo, $user['user_id'], 'decisions'),
        'can_view_formatting' => ajasti_can_access_dashboard($pdo, $user['user_id'], 'formatting'),
    ],
]);
