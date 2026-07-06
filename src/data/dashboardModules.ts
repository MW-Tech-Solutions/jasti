export type WorkspaceSection = {
  id: string
  label: string
  description: string
  stats?: Array<{ label: string; value: string; detail?: string }>
  checklist?: string[]
  fields?: string[]
}

export type WorkspaceRoleConfig = {
  role: string
  title: string
  intro: string
  sections: WorkspaceSection[]
}

export const workspaceConfigs: WorkspaceRoleConfig[] = [
  {
    role: 'author',
    title: 'Author Dashboard',
    intro: 'The author workspace covers submission, tracking, revisions, communications, and publication metrics.',
    sections: [
      {
        id: 'profile',
        label: 'Profile Management',
        description: 'Manage ORCID integration, institutional affiliation, author metrics, and previous submission identity.',
        fields: ['First and last name', 'Email address', 'ORCID integration', 'Institutional affiliation', 'Country and phone'],
        checklist: ['Maintain an accurate ORCID record', 'Keep affiliation current', 'Review previous submissions and author metrics'],
      },
      {
        id: 'submission',
        label: 'New Manuscript Submission',
        description: 'Create a new manuscript with metadata, author list, and upload package.',
        fields: ['Title', 'Scope area', 'Abstract', 'Keywords', 'Author list and affiliations', 'Manuscript upload (DOC/DOCX only)'],
      },
      // {
      //   id: 'compliance',
      //   label: 'Compliance Checks',
      //   description: 'Track automated validation before editorial screening.',
      //   checklist: ['Plagiarism detection', 'Formatting validation', 'Reference style check', 'AI-content disclosure'],
      // },
      {
        id: 'tracker',
        label: 'Submission Status Tracker',
        description: 'Follow the manuscript through the publishing pipeline.',
        checklist: ['Submitted', 'Under editorial screening', 'Under review', 'Revision required', 'Accepted / Rejected', 'Published'],
      },
      {
        id: 'revision',
        label: 'Revision Module',
        description: 'Manage revised versions and response documents.',
        checklist: ['Upload revised manuscript', 'Attach response-to-reviewers document', 'Preserve version history'],
      },
      {
        id: 'communication',
        label: 'Communication Center',
        description: 'Track message history, read editorial messages, and reply inside the workspace.',
        checklist: ['Message inbox', 'Thread history', 'Workspace replies'],
      },
      {
        id: 'metrics',
        label: 'Payments',
        description: 'Track article performance after acceptance and publication.',
        checklist: ['DOI assignment', 'Article downloads', 'Citation tracking', 'Altmetrics'],
      },
    ],
  },
  {
    role: 'reviewer',
    title: 'Reviewer Dashboard',
    intro: 'The reviewer workspace is built for confidential evaluation, invitation handling, and review performance.',
    sections: [
      {
        id: 'profile',
        label: 'Reviewer Profile',
        description: 'Maintain expertise, ORCID, review history, and performance signals.',
        checklist: ['Areas of expertise', 'Reviewer history', 'ORCID link', 'Review performance metrics'],
      },
      {
        id: 'invitations',
        label: 'Invitation Management',
        description: 'Respond to review invitations and declare potential conflicts.',
        checklist: ['Accept review', 'Decline review', 'Conflict of interest declaration'],
      },
      {
        id: 'assigned',
        label: 'Assigned Manuscripts',
        description: 'Access files, supplementary materials, and anonymized manuscript records.',
        checklist: ['Manuscript files', 'Supplementary materials', 'Anonymized author information in double-blind review'],
      },
      {
        id: 'evaluation',
        label: 'Review Evaluation Form',
        description: 'Score each manuscript using structured quality criteria.',
        checklist: ['Novelty assessment', 'Methodology evaluation', 'Statistical validity', 'Literature adequacy', 'Ethical compliance'],
      },
      // {
      //   id: 'recommendation',
      //   label: 'Recommendation Section',
      //   description: 'Recommend the editorial outcome after completing review.',
      //   checklist: ['Accept', 'Minor revision', 'Major revision', 'Reject'],
      // },
      // {
      //   id: 'comments',
      //   label: 'Confidential Comments',
      //   description: 'Separate author-facing and editor-only notes.',
      //   checklist: ['Comments to authors', 'Confidential comments to editor'],
      // },
      {
        id: 'deadlines',
        label: 'Deadline Tracker',
        description: 'Monitor due dates and reminder schedules.',
        checklist: ['Review due dates', 'Automated reminders'],
      },
      {
        id: 'communication',
        label: 'Communication Center',
        description: 'Track editor messages, author communications, and reply history inside the workspace.',
        checklist: ['Message inbox', 'Thread history', 'Workspace replies'],
      },
    ],
  },
  {
    role: 'editor',
    title: 'Editor Dashboard',
    intro: 'Editors manage the peer-review pipeline from intake to recommendation.',
    sections: [
      {
        id: 'profile',
        label: 'Editor Profile',
        description: 'Maintain editorial affiliation, contact details, expertise, and onboarding records.',
        checklist: ['Editorial affiliation', 'Country and phone', 'Expertise details', 'Onboarding record'],
      },
      {
        id: 'selection',
        label: 'Reviewer Selection',
        description: 'Select qualified reviewers with conflict management and AI assistance.',
        checklist: ['Reviewer database search', 'AI reviewer recommendation', 'Conflict-of-interest detection'],
      },
      {
        id: 'monitoring',
        label: 'Review Monitoring',
        description: 'Supervise reviewer turnaround and overdue reminders.',
        checklist: ['Reviewer status', 'Overdue reviews', 'Reminder automation'],
      },
      {
        id: 'communication',
        label: 'Communication Center',
        description: 'Message authors or reviewers and send email notifications from the editor workspace.',
        checklist: ['Author messages', 'Reviewer messages', 'Email notifications'],
      },
      {
        id: 'decisions',
        label: 'Editorial Decision Module',
        description: 'Issue editorial recommendations based on review evidence.',
        checklist: ['Accept', 'Minor revision', 'Major revision', 'Reject'],
      },
      {
        id: 'revision',
        label: 'Revision Management',
        description: 'Compare versions, verify author responses, and resend if required.',
        checklist: ['Compare versions', 'Check author responses', 'Resend to reviewers if needed'],
      },
      {
        id: 'analytics',
        label: 'Performance Analytics',
        description: 'Monitor editorial throughput and reviewer quality.',
        checklist: ['Average review time', 'Acceptance rate', 'Reviewer performance'],
      },
    ],
  },
  {
    role: 'technical_editor',
    title: 'Technical Editor Dashboard',
    intro: 'Technical editors handle paid manuscript intake, anonymization, grammar/AI/similarity scoring, and editor handoff.',
    sections: [
      {
        id: 'technical-screening',
        label: 'Technical Screening',
        description: 'View paid submissions, download DOC/DOCX manuscripts, upload anonymized papers, and record screening scores.',
        checklist: ['Payment gate', 'DOC/DOCX download', 'Anonymized upload', 'Grammar/AI/similarity scores'],
      },
      {
        id: 'communication',
        label: 'Communication Center',
        description: 'Track technical screening messages and editorial communication.',
        checklist: ['Message inbox', 'Thread history', 'Workspace replies'],
      },
    ],
  },
  {
    role: 'editor_in_chief',
    title: 'Editor-in-Chief Dashboard',
    intro: 'The Editor-in-Chief workspace is the strategic control center for final publishing decisions and oversight.',
    sections: [
      {
        id: 'overview',
        label: 'Journal Overview Panel',
        description: 'Review total submissions, acceptance performance, review speed, and active manuscript load.',
        checklist: ['Total submissions', 'Acceptance rate', 'Average review time', 'Active manuscripts'],
      },
      {
        id: 'applications',
        label: 'Applications Review',
        description: 'Approve or reject reviewer/editor onboarding applications after checking CV PDFs.',
        checklist: ['Review submitted profiles', 'Open CV PDFs', 'Approve or reject onboarding'],
      },
      {
        id: 'final-decisions',
        label: 'Final Decision Authority',
        description: 'Approve, override, and resolve disputes in editorial recommendations.',
        checklist: ['Approve editor decisions', 'Override editorial recommendations', 'Resolve disputes'],
      },
      {
        id: 'published-articles',
        label: 'Published Articles',
        description: 'View published manuscript records and archive public articles when needed.',
        checklist: ['Published article list', 'Archive publication', 'Preserve internal publication record'],
      },
      {
        id: 'manage-all-articles',
        label: 'Manage All Articles',
        description: 'View and manage all manuscripts, including published and unpublished articles.',
        checklist: ['Search articles', 'Edit publication metadata', 'Delete article records'],
      },
      {
        id: 'board',
        label: 'Editorial Board Management',
        description: 'Manage editor and reviewer appointments and track performance.',
        checklist: ['Appoint editors and reviewers', 'Track editor performance'],
      },
      {
        id: 'ethics',
        label: 'Ethics & Compliance',
        description: 'Manage plagiarism cases, retractions, and ethical investigations.',
        checklist: ['Plagiarism cases', 'Retractions', 'Ethical investigations'],
      },
      {
        id: 'impact',
        label: 'Journal Impact Metrics',
        description: 'Track citations, impact factor readiness, and indexing progression.',
        checklist: ['Citation statistics', 'Impact factor tracking', 'Indexing status (Scopus, Web of Science)'],
      },
      {
        id: 'scheduling',
        label: 'Publication Scheduling',
        description: 'Plan issues and prioritize articles and special calls.',
        checklist: ['Issue planning', 'Article prioritization', 'Special issues'],
      },
      {
        id: 'manage-issues',
        label: 'Manage Issues',
        description: 'Create and maintain the issue records used during publication.',
        checklist: ['Create issue metadata', 'Review current issues', 'Remove unused issues'],
      },
      {
        id: 'monitoring',
        label: 'System Monitoring',
        description: 'Watch submission patterns and subject growth trends.',
        checklist: ['Submission trends', 'Geographic distribution of authors', 'Subject area growth'],
      },
      {
        id: 'reports',
        label: 'Reports',
        description: 'Generate and download journal reports in PDF, CSV, XLSX, or DOCX format.',
        checklist: ['Submission reports', 'Review reports', 'Payment reports', 'Publication reports'],
      },
    ],
  },
  {
    role: 'admin',
    title: 'Admin Control Panel',
    intro: 'Admin manages the full platform, including settings, journal identity, operational controls, and system-wide configuration.',
    sections: [
      {
        id: 'overview',
        label: 'Platform Overview',
        description: 'Central overview of users, manuscripts, messages, and logs.',
        checklist: ['User overview', 'Submission overview', 'Message oversight', 'Audit log visibility'],
      },
      {
        id: 'manage-all-articles',
        label: 'Manage All Articles',
        description: 'View and manage all manuscripts across the platform, including published and unpublished articles.',
        checklist: ['Search manuscripts', 'Edit publication metadata', 'Delete manuscript records'],
      },
      {
        id: 'applications',
        label: 'Applications Review',
        description: 'Review onboarding applications and approve/reject after checking CV PDFs.',
        checklist: ['Review pending reviewers', 'Review pending editors', 'Approve or reject'],
      },
      {
        id: 'users',
        label: 'User & Role Management',
        description: 'Manage authors, reviewers, editors, EIC, and administrators.',
        checklist: ['Assign roles', 'Review user access', 'Manage activation status', 'Support account governance'],
      },
      {
        id: 'settings',
        label: 'System Settings',
        description: 'Change the journal name, acronym, logo, aims, scope, and objectives across the system.',
        checklist: ['Update journal identity', 'Upload and replace logo', 'Edit aims, scope, and objectives', 'Control public-facing metadata'],
      },
      {
        id: 'integrations',
        label: 'Infrastructure & Integrations',
        description: 'Configure the services that power a serious modern digital journal system.',
        checklist: ['AI-assisted reviewer selection', 'Automated plagiarism detection', 'ORCID integration', 'CrossRef DOI automation', 'Analytics dashboards', 'Automated email notifications', 'API integration with indexing services'],
      },
      {
        id: 'monitoring',
        label: 'System Monitoring',
        description: 'Supervise system health, logs, and administrative workflow rules.',
        checklist: ['System logs', 'Workflow automation state', 'Operational audit trail', 'Security posture review'],
      },
      {
        id: 'reports',
        label: 'Reports',
        description: 'Generate administrative reports in PDF, CSV, XLSX, or DOCX format.',
        checklist: ['Submission reports', 'User reports', 'Payment reports', 'Publication reports'],
      },
    ],
  },
]
