**Roles (user types)**
- `Author`: submits manuscripts, uploads revisions, approves proofs, pays fees (if applicable).
- `Reviewer`: accepts/declines invitations, submits reviews, recommends decision.
- `Section/Handling Editor`: runs peer review, communicates with author, recommends decision.
- `Editor-in-Chief` (or `Chief Editor`): final decision (accept/reject), assigns editors.
- `Managing Editor/Admin`: configures journal, verifies accounts, monitors timelines, publishes.
- `Copyeditor`: language/style editing after acceptance.
- `Production/Layout`: typesetting, XML/PDF/HTML, DOI metadata packaging.
- `Publisher`: final publish/unpublish, issue assignment.

---

## A) Registration workflow (Author + all other users)

### 1) Account creation (common)
1. User opens “Register”.
2. Enters: full name, email (unique), password, affiliation/organization, country, phone (optional).
3. Email verification (OTP/link) → account becomes `active`.
4. System assigns base role depending on registration path:
   - `/register/author` → `Author`
   - `/register/reviewer` → `Reviewer` (often requires expertise)
   - `/register/editor` / staff roles → usually **invite-only** (recommended)

**Recommended controls**
- Authors: self-register allowed.
- Reviewers: self-register allowed but requires admin approval OR must be invited.
- Editors/Staff: invite-only (admin sends invite link; user sets password).

### 2) Additional data by role
- Author profile: ORCID, research interests, preferred correspondence address.
- Reviewer profile: areas of expertise (keywords), CV link, availability, conflicts, reviewer consent.
- Editor/staff profile: department/section, permission scope.

### 3) Activation + permissions
- Statuses: `pending_verification` → `active` (or `pending_approval` → `active`).
- Admin can suspend/disable: `suspended`.
- Audit log every change (role changes, approvals).

---

## B) Manuscript workflow (submission → publication)

### Stage 1: Author submission
1. Author clicks “New Submission”.
2. Completes submission wizard:
   - Manuscript title, abstract, keywords, article type/section
   - Authors & affiliations (corresponding author)
   - Funding, conflicts of interest, ethics statement, data availability
3. Uploads files:
   - Main manuscript (DOCX) + figures + tables + supplementary + cover letter
4. Confirms checklist (formatting, plagiarism policy, originality).
5. Submits → manuscript status becomes **`submitted`**.

**System actions**
- Generate Manuscript ID (e.g., `OSO-2026-0012`)
- Notify Managing Editor/Admin + Editor-in-Chief.

---

### Stage 2: Editorial office checks (desk screening)
1. Managing Editor performs technical checks:
   - Completeness, scope fit, formatting, missing statements
   - Plagiarism/similarity check (optional integration)
2. Outcomes:
   - If incomplete → **`returned_to_author`** with required fixes.
   - If out of scope/low quality → **`desk_rejected`** (with reason).
   - If OK → **`ready_for_editor_assignment`**.

---

### Stage 3: Editor assignment
1. Editor-in-Chief assigns Handling Editor (and section).
2. Status → **`with_editor`**.

Handling Editor does an initial read:
- Option A: Desk reject → **`desk_rejected`**.
- Option B: Send to review → **`reviewers_invited`**.

---

### Stage 4: Peer review (single/double blind as configured)
1. Editor invites reviewers (typically 2–3).
2. Each reviewer: `invited` → accepts/declines.
3. Once minimum reviewers accept → **`under_review`**.
4. Reviewers submit:
   - confidential notes to editor
   - comments to author
   - recommendation (Accept / Minor / Major / Reject)
5. When sufficient reviews received → **`reviews_completed`**.

---

### Stage 5: Editorial decision
Handling Editor recommends decision; Editor-in-Chief finalizes:
- **`minor_revision`** or **`major_revision`**
- **`rejected`**
- **`accepted`** (rare without revisions)

Author notified with consolidated decision letter.

---

### Stage 6: Revision rounds (repeatable)
1. Author uploads revised manuscript + response-to-reviewers.
2. Status → **`revision_submitted`**.
3. Editor checks:
   - May send back to same reviewers → **`revision_under_review`**
   - Or decide without re-review → **`decision_pending`**
4. Repeat until final decision.

---

### Stage 7: Acceptance → production
Upon acceptance:
1. Status → **`accepted`**.
2. Production tasks start:
   - Copyediting → **`copyediting`**
   - Author queries resolved → **`copyedit_complete`**
   - Typesetting/layout (PDF/HTML/XML) → **`typesetting`**
   - Proof to author → **`proof_sent`**
   - Author approves/corrections → **`proof_approved`**
3. Metadata completion:
   - DOI assignment (if used)
   - Pagination/issue scheduling
   - Final files locked

---

### Stage 8: Publication
1. Managing Editor/Publisher schedules:
   - **`scheduled`** (issue/volume + publish date)
2. Publish action:
   - Status → **`published`**
3. Post-publication:
   - Indexing exports (Crossref, DOAJ, Google Scholar metadata)
   - Corrections/errata workflow (optional)

---

## C) Suggested status map (single-source-of-truth)
- Submission: `draft` → `submitted` → `returned_to_author`
- Screening: `technical_check` → `desk_rejected` / `ready_for_editor_assignment`
- Editorial: `with_editor` → `reviewers_invited` → `under_review` → `reviews_completed`
- Decision: `minor_revision` / `major_revision` → `revision_submitted` → (loop) → `accepted` / `rejected`
- Production: `copyediting` → `typesetting` → `proof_sent` → `proof_approved`
- Publish: `scheduled` → `published`

---

## D) What I need to tailor this to your app
1) Is review **single-blind** or **double-blind**?  
2) Are Editors/Reviewers **invite-only** or self-register + admin approval?  
3) Do you need **issues/volumes** or “publish as you go”?