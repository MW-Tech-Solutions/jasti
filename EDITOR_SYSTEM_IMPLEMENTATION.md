# Editor Type System Implementation

## Overview

The JASTI Journal Management System now includes a comprehensive editor type system allowing users to register and work in different editorial roles based on the organizational structure defined in the PDF.

## Editor Types

### 1. **Editorial Advisory Board**
- **Access Level:** 2 (Strategic)
- **Responsibilities:** Provides strategic guidance to the journal, supports policy development, international visibility
- **Capabilities:** View-only access to submissions and strategies
- **Dashboard Features:** Strategic overview, advisory reports

### 2. **Editor-in-Chief**
- **Access Level:** 5 (Highest)
- **Responsibilities:** Leads the journal, makes final decisions on papers, oversees peer review, appoints editors
- **Capabilities:** 
  - Can assign reviewers ✓
  - Can make decisions ✓
  - Can appoint editors ✓
- **Dashboard Features:** Complete overview, manuscript management, reviewer management, decision-making

### 3. **Managing Editor**
- **Access Level:** 3 (Operational)
- **Responsibilities:** Manages editorial office, coordinates submissions, communicates with authors/reviewers
- **Capabilities:**
  - Can make decisions ✓
  - Workflow coordination ✓
- **Dashboard Features:** Submission tracking, communication center, workflow management

### 4. **Technical Editor**
- **Access Level:** 2 (Technical)
- **Responsibilities:** Handles manuscript formatting, template compliance, final proofs
- **Capabilities:** Formatting and layout management only
- **Dashboard Features:** Formatting tasks, proof management, template validation

### 5. **Section/Associate Editor**
- **Access Level:** 4 (Operational)
- **Responsibilities:** Manages manuscripts in specific subject areas, assigns reviewers, recommends decisions
- **Capabilities:**
  - Can assign reviewers ✓
  - Subject-specific management ✓
- **Dashboard Features:** Subject area assignments, reviewer management for their section

### 6. **Reviewer**
- **Access Level:** 1 (Limited)
- **Responsibilities:** Evaluates manuscripts, provides peer-review reports, recommends improvements
- **Dashboard Features:** Review invitations, active reviews, completed reviews

## Database Schema

### New Tables Created

#### `editor_types`
Stores all editor type definitions with capabilities and access levels.

```sql
editor_type_id INT PRIMARY KEY
type_name VARCHAR(100) UNIQUE
description LONGTEXT
responsibilities LONGTEXT
access_level INT
can_assign_reviewers BOOLEAN
can_make_decisions BOOLEAN
can_appoint_editors BOOLEAN
```

#### `editor_profiles`
Stores individual editor profiles and their subject specializations.

```sql
editor_profile_id INT PRIMARY KEY
user_id INT FOREIGN KEY
editor_type_id INT FOREIGN KEY
subject_areas LONGTEXT
bio LONGTEXT
expertise_description LONGTEXT
appointment_date DATE
status ENUM('active', 'inactive', 'on_leave')
assigned_manuscripts_limit INT
current_assigned_count INT
```

#### `editor_dashboard_access`
Defines role-based dashboard permissions.

```sql
access_id INT PRIMARY KEY
editor_type_id INT FOREIGN KEY
dashboard_name VARCHAR(100)
can_view BOOLEAN
can_edit BOOLEAN
can_delete BOOLEAN
can_export BOOLEAN
```

### Modified Tables

- **users**: Added `editor_type_id` FOREIGN KEY for editor type association

## API Endpoints

### Registration
- **POST** `/auth/register.php`
- Support for both regular user and editor registration
- Param: `editor_type` - triggers editor registration flow
- Returns: user_id, editor_type, dashboard_url

### Editor Operations
- **GET** `/editor/editor-types.php` - List all available editor types
- **GET** `/editor/dashboard.php` - Get editor dashboard data
- Returns: stats, editor profile, access permissions

### Registration Types

#### Regular Registration (Author/Reviewer)
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "securepass",
  "institution": "University",
  "country": "Nigeria",
  "phone": "+234...",
  "orcid_id": "0000-0000-0000-0000",
  "role": "author"  or  "reviewer"
}
```

#### Editor Registration
```json
{
  "first_name": "Dr.",
  "last_name": "Editor",
  "email": "editor@example.com",
  "password": "securepass",
  "institution": "University",
  "country": "Nigeria", 
  "phone": "+234...",
  "orcid_id": "0000-0000-0000-0000",
  "editor_type": "section_editor",
  "subject_areas": "Applied ICT, Engineering Systems",
  "expertise_description": "15 years in editorial management",
  "bio": "Dr. Editor has extensive experience..."
}
```

## Dashboard URLs by Editor Type

- **Editor-in-Chief**: `/editor/dashboard`
- **Section/Associate Editor**: `/editor/assignments`
- **Managing Editor**: `/editor/submissions`
- **Technical Editor**: `/editor/formatting`
- **Advisory Board**: `/editor/advisory`
- **Reviewer**: `/reviewer/dashboard`

## Frontend Components

### EditorRegistrationForm
Location: `src/admin/components/EditorRegistrationForm.tsx`

Features:
- Editor type selection with role descriptions
- Personal information form (3 steps)
- Professional details (subject areas, expertise, bio)
- Integrated with new `editor-types` API endpoint

### EditorDashboard
Location: `src/admin/components/EditorDashboard.tsx`

Features:
- Role-specific dashboard layouts
- Dynamic statistics based on editor type
- Quick actions relevant to role
- Access control implementation
- Different views for each editor type

## User Flow

### Registration Flow
1. User selects "Register as Editor"
2. Chooses editor type from available options
3. Fills personal and professional information
4. System creates user account with editor_type_id
5. Creates editor_profile record
6. Assigns editor role
7. Sends verification email with editor dashboard link

### Login & Dashboard
1. Editor logs in with credentials
2. System checks editor_type_id
3. Routes to appropriate dashboard based on type
4. Loads role-specific data and permissions
5. Displays available actions and stats

## Role-Based Access Control (RBAC)

### Permission Logic
```php
function jasti_can_access_dashboard($pdo, $userId, $dashboardName)
function jasti_can_edit_dashboard($pdo, $userId, $dashboardName)
function jasti_get_dashboard_url($editorTypeName)
```

### Access Matrix
| Dashboard | Advisory | EIC | Managing | Technical | Section | Reviewer |
|-----------|----------|-----|----------|-----------|---------|----------|
| submissions | View | Edit | Edit | - | View | - |
| reviewers | - | Edit | View | - | Edit | - |
| decisions | - | Edit | Edit | - | View | - |
| formatting | - | View | - | Edit | - | - |
| advisory | View | View | - | - | - | - |

## Implementation Notes

### Key Features
1. ✅ 6 editor types with unique capabilities
2. ✅ Access levels from 1-5 for hierarchy
3. ✅ Subject area specialization support
4. ✅ Dashboard access control
5. ✅ Status management (active/inactive/on_leave)
6. ✅ Manuscript assignment limits per editor

### Bootstrap Functions
Added to `api/support/bootstrap.php`:
- `jasti_ensure_editor_types()` - Create tables if missing
- `jasti_editor_types()` - Get all editor types
- `jasti_editor_type_by_id()` - Get specific type
- `jasti_editor_type_by_name()` - Get type by name
- `jasti_user_editor_profile()` - Get user's editor profile
- `jasti_create_editor_profile()` - Create new profile
- `jasti_can_access_dashboard()` - Check read access
- `jasti_can_edit_dashboard()` - Check edit access
- `jasti_get_dashboard_url()` - Get dashboard path

### Type Safety
- TypeScript types in `journalApi.ts`:
  - `EditorType`
  - `EditorProfile`
  - `EditorDashboardData`
- Full type support for API responses

## Testing

### Test API Endpoints
```bash
# Get editor types
GET http://localhost/api/editor/editor-types.php

# Get editor dashboard
GET http://localhost/api/editor/dashboard.php
Header: Authorization: Bearer <session_token>

# Register as editor
POST http://localhost/api/auth/register.php
{
  "editor_type": "section_editor",
  "first_name": "Test",
  ...
}
```

### Test Editor Selection Flow
1. Navigate to registration
2. Select "Register as Editor" option
3. Choose editor type
4. Fill out form
5. Submit registration
6. Check email verification
7. After verification, verify redirect to appropriate dashboard

## Future Enhancements

1. **Editor Assignment Workflow**: Implement manuscript assignment to editors
2. **Team Management**: Group editors by section
3. **Workload Distribution**: Track assignments and workload balance
4. **Escalation Paths**: Define escalation rules for decisions
5. **Performance Metrics**: Track editor performance metrics
6. **Training Materials**: Add editor-specific training content
7. **Audit Logging**: Track all editor actions for compliance
8. **Bulk Operations**: Support bulk manuscript assignments

## Database Maintenance

### View Current Editor Types
```sql
SELECT * FROM editor_types;
```

### Check Editor Assignments
```sql
SELECT u.first_name, u.last_name, et.type_name 
FROM users u
LEFT JOIN editor_profiles ep ON u.user_id = ep.user_id
LEFT JOIN editor_types et ON ep.editor_type_id = et.editor_type_id;
```

### Count Editors by Type
```sql
SELECT et.type_name, COUNT(*) as count
FROM editor_profiles ep
JOIN editor_types et ON ep.editor_type_id = et.editor_type_id
WHERE ep.status = 'active'
GROUP BY et.type_name;
```
