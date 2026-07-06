export const aboutSections = [
  {
    id: "general-introduction",
    title: "1.1 General Introduction",
    body: [
      "The global academic ecosystem depends on credible journals to validate research, advance knowledge, and inform policy and practice. In recent years, the growth of low-quality and predatory publishing outlets has weakened trust in scholarly communication, particularly in developing regions.",
      "This proposal presents a structured plan for establishing a credible, ethical, and sustainable academic journal publishing firm that prioritizes rigorous peer review, editorial independence, and international best practices.",
      "The proposed firm will operate as a professional scholarly publisher, managing the full lifecycle of academic manuscripts from submission and peer review to publication, archiving, and dissemination.",
    ],
  },
  {
    id: "about-jasti",
    title: "1.2 Introduction to JASTI",
    body: [
      "The Journal of Applied Science, Technology, and Innovation (JASTI) is a multidisciplinary, peer-reviewed academic journal established to advance the dissemination of high-quality applied research that converts scientific knowledge into practical, implementable solutions.",
      "JASTI places strong emphasis on innovation, problem-solving, and measurable impact. It provides a scholarly platform for researchers, practitioners, educators, engineers, technologists, and policy-oriented scholars whose work demonstrates clear applicability to industry, society, governance, education, and sustainable development.",
      "Through a rigorous peer-review process, transparent editorial governance, and adherence to internationally recognized publication ethics, JASTI is committed to maintaining high academic standards while remaining accessible to emerging scholars and practitioners.",
    ],
  },
  {
    id: "rationale",
    title: "2. Rationale and Justification",
    body: [
      "Many researchers face limited access to reputable journals that understand local research contexts, alongside excessive publication delays or opaque editorial decisions.",
      "JASTI responds with transparent editorial and peer-review processes, clear acceptance and rejection criteria, ethical publishing practices aligned with global standards, and a deliberate pathway to international visibility and indexing.",
    ],
  },
  {
    id: "vision-mission",
    title: "3. Vision and Mission",
    body: [
      "Vision: To become a trusted scholarly publishing platform recognized for integrity, rigor, and meaningful academic impact.",
      "Mission: To publish high-quality, peer-reviewed research that advances knowledge, supports evidence-based decision-making, and upholds the highest standards of publication ethics.",
    ],
  },
  {
    id: "aims-scope",
    title: "4. Aims and Scope",
    body: [
      "JASTI provides a rigorous scholarly platform for disseminating applied, solution-oriented research that addresses real-world challenges across science, technology, engineering, agriculture, management, and education.",
      "The journal prioritizes practical relevance, methodological soundness, and innovation with measurable societal, industrial, or policy impact, while encouraging interdisciplinary integration across multiple thematic areas.",
    ],
  },
]

export const aims = [
  "Bridge the gap between theory and practice",
  "Promote interdisciplinary and cross-sector research",
  "Support innovation-driven development",
  "Encourage context-aware solutions relevant to both developed and developing economies",
]

export const scopeAreas = [
  "Applied Information and Communication Technology (ICT)",
  "Engineering Systems, Design, and Optimization",
  "Applied Physical and Chemical Sciences",
  "Biological and Life Sciences Applications",
  "Agricultural Science, Agri-Technology, and Food Systems",
  "Environmental Science, Sustainability, and Climate Solutions",
  "Technology-Driven Innovation and Product Development",
  "Science, Technology, Engineering, and Mathematics (STEM) Education",
  "Educational Technology and Digital Learning Systems",
  "Management Science, Operations, and Organizational Innovation",
  "Entrepreneurship, Business Innovation, and Technology Transfer",
]

export const governanceRoles = [
  {
    title: "Editor-in-Chief",
    summary: "Sets the academic vision and policy of the journal and holds final publication authority.",
    responsibilities: [
      "Makes final publication decisions and resolves editorial disputes",
      "Handles plagiarism, conflicts of interest, and retractions",
      "Appoints or supervises editors and represents JASTI publicly",
    ],
  },
  {
    title: "Editor",
    summary: "Manages manuscripts within a defined subject area and runs the review pipeline.",
    responsibilities: [
      "Screens submissions for scope, formatting, and technical quality",
      "Assigns reviewers and evaluates reviewer reports",
      "Recommends accept, revise, or reject decisions to the Editor-in-Chief",
    ],
  },
  {
    title: "Reviewer",
    summary: "Acts as the independent quality-control mechanism for science.",
    responsibilities: [
      "Evaluates originality, methodology, clarity, and validity",
      "Detects flaws such as weak experiments, poor statistics, or plagiarism",
      "Provides objective confidential feedback and recommends an outcome",
    ],
  },
  {
    title: "Author",
    summary: "Submits manuscripts, responds to reviews, and tracks production to publication.",
    responsibilities: [
      "Maintains profile, ORCID, and institutional affiliation",
      "Uploads manuscripts, revisions, datasets, code, and response letters",
      "Tracks status, metrics, DOI assignment, and editorial messages",
    ],
  },
]

export const workflowStages = [
  "Author submits manuscript",
  "Automated checks: plagiarism, formatting, reference style, AI disclosure",
  "Editor initial screening",
  "Reviewer assignment",
  "Peer review process",
  "Reviewer recommendations submitted",
  "Editor decision",
  "Author revision",
  "Final evaluation",
  "Editor-in-Chief approval",
  "Copyediting and typesetting",
  "DOI assignment, online publication, indexing, and citation tracking",
]

export const advancedFeatures = [
  "AI-assisted reviewer selection",
  "Automated plagiarism detection",
  "ORCID integration",
  "CrossRef DOI automation",
  "Analytics dashboards and performance metrics",
  "Automated email notifications",
  "API integration with indexing services",
  "Blockchain-based publication records (emerging)",
]

export const roleTabs = [
  { id: "overview", label: "Journal Overview" },
  { id: "author", label: "Author Portal" },
  { id: "reviewer", label: "Reviewer Portal" },
  { id: "editor", label: "Editor Dashboard" },
  { id: "eic", label: "Editor-in-Chief" },
  { id: "admin", label: "Admin Control" },
  { id: "schema", label: "Database Schema" },
] as const

export type RoleTabId = (typeof roleTabs)[number]["id"]

export const authorDashboard = {
  metrics: [
    { label: "Active submissions", value: "18", detail: "Across 5 thematic areas" },
    { label: "Revision requests", value: "6", detail: "Awaiting author action" },
    { label: "Published articles", value: "24", detail: "With DOI and metrics" },
    { label: "Average first decision", value: "5.8 weeks", detail: "Target within 6 weeks" },
  ],
  modules: [
    "Profile management with ORCID integration, institutional affiliation, and author metrics",
    "New manuscript submission for title, abstract, keywords, author list, files, datasets, and code",
    "Automated compliance checks for plagiarism, formatting, references, and AI-content disclosure",
    "Submission tracker covering submitted, screening, review, revision, accepted, rejected, and published states",
    "Revision module with version history and response-to-reviewers upload",
    "Communication center for decision letters, comments, and editor messages",
    "Publication and metrics tracking including DOI, downloads, citations, and altmetrics",
  ],
}

export const reviewerDashboard = {
  metrics: [
    { label: "Pending invitations", value: "12", detail: "4 need response this week" },
    { label: "Assigned reviews", value: "9", detail: "3 due within 72 hours" },
    { label: "Average turnaround", value: "19 days", detail: "Below target threshold" },
    { label: "Reviewer rating", value: "4.8/5", detail: "Based on editor feedback" },
  ],
  evaluationCriteria: [
    "Originality or novelty of research",
    "Methodological soundness",
    "Data quality and statistical validity",
    "Clarity of presentation",
    "Relevance to the journal scope",
    "Adequacy of references",
  ],
  modules: [
    "Reviewer profile with expertise areas, history, ORCID, and performance metrics",
    "Invitation management with accept, decline, and conflict-of-interest declaration",
    "Assigned manuscript workspace with anonymized files and supplementary materials",
    "Structured evaluation forms covering novelty, methodology, statistics, literature, and ethics",
    "Recommendation panel for accept, minor revision, major revision, or reject",
    "Separate comments to authors and confidential comments to editors",
    "Deadline tracking with automated reminders and attachment uploads",
  ],
}

export const editorDashboard = {
  metrics: [
    { label: "New submissions", value: "34", detail: "Waiting for handling editor" },
    { label: "Under review", value: "51", detail: "Across 11 scope areas" },
    { label: "Overdue reviews", value: "7", detail: "Reminder automation active" },
    { label: "Acceptance rate", value: "31%", detail: "Strict quality control" },
  ],
  modules: [
    "Assignment panel for new submissions, in-review manuscripts, and revised papers",
    "Initial screening for scope, formatting, ethics, and plagiarism report review",
    "Reviewer selection with database search, AI assistance, and conflict detection",
    "Review monitoring for reviewer status, overdue reviews, and reminder automation",
    "Decision module for accept, minor revision, major revision, or reject",
    "Revision comparison tools for version checks and author responses",
    "Performance analytics for review time, acceptance rate, and reviewer performance",
  ],
}

export const eicDashboard = {
  metrics: [
    { label: "Total submissions", value: "286", detail: "Past 12 months" },
    { label: "Average review time", value: "41 days", detail: "Improving quarter over quarter" },
    { label: "Active ethics cases", value: "3", detail: "Tracked with documented actions" },
    { label: "Indexing milestones", value: "4", detail: "ISSN, DOI, directories, readiness" },
  ],
  modules: [
    "Journal overview panel for submissions, acceptance, and throughput metrics",
    "Final decision authority to approve, override, and resolve disputes",
    "Editorial board management for editors and reviewers with performance tracking",
    "Ethics and compliance monitoring for plagiarism, retractions, and investigations",
    "Journal impact metrics for citations, impact factor tracking, and indexing status",
    "Publication scheduling for issues, priorities, and special issues",
    "System monitoring for submission trends, author geography, and subject growth",
  ],
}

export const adminControl = {
  modules: [
    "User and role management across authors, reviewers, editors, and Editor-in-Chief",
    "Journal, issue, and article metadata administration",
    "System logs, auditability, and communication records",
    "Message routing, notification templates, and workflow automation settings",
    "Infrastructure integrations for plagiarism tools, DOI, ORCID, and indexing services",
  ],
  dataEntities: [
    "users, roles, and user_roles",
    "journals and issues",
    "manuscripts, manuscript_authors, and manuscript_files",
    "reviewer_profiles, review_invitations, and reviews",
    "editor_assignments, editor_decisions, and final_decisions",
    "articles, article_metrics, messages, revisions, and system_logs",
  ],
}

export const publicationTimeline = [
  "Months 1-3: Legal registration, policy development, board constitution",
  "Months 4-6: Platform deployment, reviewer onboarding, pilot submissions",
  "Months 7-12: First issue publication, visibility building, quality audit",
]

export const schemaSql = String.raw`CREATE DATABASE jasti_jms;
USE jasti_jms;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    orcid_id VARCHAR(50),
    institution VARCHAR(200),
    country VARCHAR(100),
    phone VARCHAR(30),
    status ENUM('active','inactive') DEFAULT 'active',
    date_registered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    description TEXT
) ENGINE=InnoDB;

CREATE TABLE user_roles (
    user_role_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE journals (
    journal_id INT AUTO_INCREMENT PRIMARY KEY,
    journal_name VARCHAR(255) NOT NULL,
    issn VARCHAR(50),
    publisher VARCHAR(255),
    website VARCHAR(255),
    description TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE issues (
    issue_id INT AUTO_INCREMENT PRIMARY KEY,
    journal_id INT NOT NULL,
    volume INT,
    issue_number INT,
    publication_year INT,
    publication_date DATE,
    status ENUM('upcoming','published'),
    FOREIGN KEY (journal_id) REFERENCES journals(journal_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE manuscripts (
    manuscript_id INT AUTO_INCREMENT PRIMARY KEY,
    title TEXT,
    abstract TEXT,
    keywords TEXT,
    journal_id INT,
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    corresponding_author_id INT,
    status ENUM('submitted','editor_screening','under_review','revision_required','accepted','rejected','production','published'),
    article_type VARCHAR(100),
    plagiarism_score DECIMAL(5,2),
    current_editor_id INT,
    version_number INT DEFAULT 1,
    FOREIGN KEY (journal_id) REFERENCES journals(journal_id),
    FOREIGN KEY (corresponding_author_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE manuscript_authors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    author_id INT,
    author_order INT,
    is_corresponding BOOLEAN DEFAULT FALSE,
    affiliation VARCHAR(255),
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE manuscript_files (
    file_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    file_type VARCHAR(100),
    file_path VARCHAR(255),
    version INT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE editor_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    editor_id INT,
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending','active','completed'),
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id),
    FOREIGN KEY (editor_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE reviewer_profiles (
    reviewer_id INT PRIMARY KEY,
    expertise_area TEXT,
    reviewer_rating DECIMAL(3,2),
    total_reviews INT DEFAULT 0,
    availability_status ENUM('available','busy'),
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE review_invitations (
    invitation_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    reviewer_id INT,
    invited_by_editor INT,
    invitation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response ENUM('pending','accepted','declined'),
    response_date TIMESTAMP,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id),
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    reviewer_id INT,
    review_date TIMESTAMP,
    recommendation ENUM('accept','minor_revision','major_revision','reject'),
    confidential_comments TEXT,
    comments_to_author TEXT,
    score_novelty INT,
    score_methodology INT,
    score_clarity INT,
    score_significance INT,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id),
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE editor_decisions (
    decision_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    editor_id INT,
    decision_type ENUM('accept','minor_revision','major_revision','reject'),
    decision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decision_letter TEXT,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id),
    FOREIGN KEY (editor_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE revisions (
    revision_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    revision_number INT,
    submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_by INT,
    response_document TEXT,
    status ENUM('submitted','under_review','approved'),
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id)
) ENGINE=InnoDB;

CREATE TABLE final_decisions (
    final_decision_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    editor_in_chief_id INT,
    final_decision ENUM('accepted','rejected'),
    approval_date TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id),
    FOREIGN KEY (editor_in_chief_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE articles (
    article_id INT AUTO_INCREMENT PRIMARY KEY,
    manuscript_id INT,
    doi VARCHAR(100),
    issue_id INT,
    publication_date DATE,
    page_numbers VARCHAR(50),
    article_url VARCHAR(255),
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(manuscript_id),
    FOREIGN KEY (issue_id) REFERENCES issues(issue_id)
) ENGINE=InnoDB;

CREATE TABLE messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT,
    receiver_id INT,
    manuscript_id INT,
    subject VARCHAR(255),
    message_body TEXT,
    sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (sender_id) REFERENCES users(user_id),
    FOREIGN KEY (receiver_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE article_metrics (
    metric_id INT AUTO_INCREMENT PRIMARY KEY,
    article_id INT,
    downloads INT DEFAULT 0,
    views INT DEFAULT 0,
    citations INT DEFAULT 0,
    altmetric_score INT,
    last_updated TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(article_id)
) ENGINE=InnoDB;

CREATE TABLE system_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255),
    entity_type VARCHAR(100),
    entity_id INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50)
) ENGINE=InnoDB;`
