#!/usr/bin/env python3
"""End-to-end JASTI smoke test from registration to publication."""
from __future__ import annotations

import http.cookiejar
import json
import os
import random
import shutil
import string
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple

BASE_API = os.environ.get("JASTI_BASE_URL", "http://localhost/ajasti/api").rstrip("/")
BASE_SITE = BASE_API[:-4] if BASE_API.endswith("/api") else BASE_API
DB_NAME = os.environ.get("JASTI_DB_NAME", "ajasti_jms")
DB_USER = os.environ.get("JASTI_DB_USER", "root")
DB_PASS = os.environ.get("JASTI_DB_PASS", "")
MYSQL_BIN = os.environ.get("MYSQL_BIN") or shutil.which("mysql") or "/opt/lampp/bin/mysql"
RESULT_PATH = Path("tmp/e2e_publish_flow_result.json")
USER_AGENT = "ajasti-e2e/1.0"
PASSWORD = os.environ.get("JASTI_TEST_PASSWORD", "TestPass123!")


@dataclass
class UserAccount:
    label: str
    email: str
    password: str
    user_id: int
    roles: list[str]
    opener: urllib.request.OpenerDirector


def rand_suffix(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def sql_quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def mysql_command(*extra: str) -> list[str]:
    command = [MYSQL_BIN, "-u", DB_USER]
    if DB_PASS:
        command.append(f"-p{DB_PASS}")
    command.extend([DB_NAME, *extra])
    return command


def mysql_exec(query: str) -> str:
    proc = subprocess.run(
        mysql_command("-N", "-B", "-e", query),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return proc.stdout.strip()


def new_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def http_post_json(opener: urllib.request.OpenerDirector, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    request = urllib.request.Request(
        f"{BASE_API}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    with opener.open(request) as response:
        return json.loads(response.read().decode("utf-8"))


def http_get_json(opener: urllib.request.OpenerDirector, path: str) -> Dict[str, Any]:
    request = urllib.request.Request(
        f"{BASE_API}{path}",
        headers={"User-Agent": USER_AGENT},
    )
    with opener.open(request) as response:
        return json.loads(response.read().decode("utf-8"))


def post_multipart(
    opener: urllib.request.OpenerDirector,
    path: str,
    fields: Dict[str, str],
    files: Dict[str, Tuple[str, bytes, str]],
) -> Dict[str, Any]:
    boundary = "----JASTIBoundary" + rand_suffix(12)
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        chunks.append(b"")
        chunks.append(str(value).encode())
    for name, (filename, content, mimetype) in files.items():
        chunks.append(f"--{boundary}".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode())
        chunks.append(f"Content-Type: {mimetype}".encode())
        chunks.append(b"")
        chunks.append(content)
    chunks.append(f"--{boundary}--".encode())
    chunks.append(b"")
    body = b"\r\n".join(chunks)
    request = urllib.request.Request(
        f"{BASE_API}{path}",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": USER_AGENT},
    )
    with opener.open(request) as response:
        return json.loads(response.read().decode("utf-8"))


def ensure_test_pdf() -> Path:
    pdf_path = Path("tmp/manuscripts/e2e_publish_flow.pdf")
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    if pdf_path.exists():
        return pdf_path

    pdf_path.write_bytes(
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 180]/Contents 4 0 R>>endobj\n"
        b"4 0 obj<</Length 86>>stream\n"
        b"BT /F1 12 Tf 36 140 Td (JASTI automated publish-flow manuscript) Tj ET\n"
        b"BT /F1 10 Tf 36 110 Td (Submission to publication smoke test.) Tj ET\n"
        b"endstream\nendobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF"
    )
    return pdf_path


def verify_email(email: str) -> None:
    mysql_exec(
        "UPDATE users "
        "SET email_verified_at = NOW(), "
        "    email_verification_token = NULL, "
        "    email_verification_sent_at = NULL, "
        "    email_verification_expires_at = NULL "
        f"WHERE email = {sql_quote(email)}"
    )
    print(f"[verify] {email}")


def approve_editor_account(user_id: int, *, needs_editor_role: bool) -> None:
    app_row = mysql_exec(
        "SELECT application_id, editor_type_id, "
        "       COALESCE(subject_areas, ''), COALESCE(bio, ''), COALESCE(expertise_description, '') "
        "FROM editor_applications "
        f"WHERE user_id = {user_id} "
        "ORDER BY applied_at DESC "
        "LIMIT 1"
    )
    if not app_row:
        raise RuntimeError(f"No editor application found for user {user_id}")

    application_id, editor_type_id, subject_areas, bio, expertise_description = app_row.split("\t")
    mysql_exec(
        "UPDATE editor_applications "
        'SET status = "accepted", reviewed_at = NOW(), acceptance_notes = "Automation approved" '
        f"WHERE application_id = {int(application_id)}"
    )

    existing_profile = mysql_exec(
        "SELECT editor_profile_id FROM editor_profiles "
        f"WHERE user_id = {user_id} "
        "LIMIT 1"
    )
    if not existing_profile:
        mysql_exec(
            "INSERT INTO editor_profiles "
            "(user_id, editor_type_id, subject_areas, bio, expertise_description, appointment_date, status, application_id) "
            "VALUES "
            f"({user_id}, {int(editor_type_id)}, {sql_quote(subject_areas)}, {sql_quote(bio)}, "
            f"{sql_quote(expertise_description)}, CURDATE(), 'active', {int(application_id)})"
        )

    if needs_editor_role:
        mysql_exec(
            "INSERT IGNORE INTO user_roles (user_id, role_id) "
            "SELECT "
            f"{user_id}, role_id FROM roles WHERE role_name = 'editor' LIMIT 1"
        )

    print(f"[approve] editor account user_id={user_id} application_id={application_id}")


def register_account(label: str, *, role: str | None = None, editor_type: str | None = None) -> UserAccount:
    opener = new_opener()
    email = f"{label}.{rand_suffix()}@example.com"
    payload: Dict[str, Any] = {
        "first_name": label.capitalize(),
        "last_name": "Tester",
        "email": email,
        "password": PASSWORD,
        "confirm_password": PASSWORD,
        "institution": "Automation Lab",
        "country": "Nigeria",
        "phone": "+2348000000000",
        "orcid_id": "0000-0000-0000-0000",
    }
    if editor_type:
        payload.update(
            {
                "role": "reviewer",
                "editor_type": editor_type,
                "subject_areas": "Automation, QA, Publishing Systems",
                "bio": f"{label.capitalize()} automation test editor account.",
                "expertise_description": "Workflow validation and publishing operations.",
            }
        )
    else:
        payload["role"] = role or "author"
        if role == "reviewer":
            payload["expertise_area"] = "Automation and editorial workflow testing"

    response = http_post_json(opener, "/auth/register.php", payload)
    user_id = int(response["user"]["user_id"])
    verify_email(email)

    if editor_type:
        approve_editor_account(user_id, needs_editor_role=editor_type != "editor_in_chief")

    account = UserAccount(
        label=label,
        email=email,
        password=PASSWORD,
        user_id=user_id,
        roles=[str(item) for item in response["user"]["roles"]],
        opener=opener,
    )
    print(f"[register] {label} user_id={user_id} email={email}")
    return account


def login(account: UserAccount) -> None:
    response = http_post_json(account.opener, "/auth/login.php", {"email": account.email, "password": account.password})
    roles = response.get("user", {}).get("roles", [])
    account.roles = [str(item) for item in roles]
    print(f"[login] {account.label} roles={roles}")


def submit_manuscript(author: UserAccount, pdf: Path) -> tuple[int, str]:
    suffix = rand_suffix()
    response = post_multipart(
        author.opener,
        "/author/manuscripts.php",
        {
            "title": f"E2E Publish Flow Manuscript {suffix}",
            "abstract": "Automated JASTI smoke test from registration to publication.",
            "keywords": "automation, qa, journal workflow",
            "article_type": "Original Research Article",
            "authors": json.dumps(
                [
                    {
                        "author_id": author.user_id,
                        "affiliation": "Automation Lab",
                        "is_corresponding": True,
                    }
                ]
            ),
        },
        {"manuscript_file": (pdf.name, pdf.read_bytes(), "application/pdf")},
    )
    manuscript_id = int(response["manuscript_id"])
    reference_number = str(response["reference_number"])
    print(f"[submit] manuscript_id={manuscript_id} ref={reference_number}")
    return manuscript_id, reference_number


def editor_claim(editor: UserAccount, manuscript_id: int) -> None:
    http_post_json(editor.opener, "/editor/assignments.php", {"manuscript_id": manuscript_id})
    print(f"[editor] claimed manuscript {manuscript_id}")


def invite_reviewer(editor: UserAccount, manuscript_id: int, reviewer_id: int) -> int:
    response = http_post_json(
        editor.opener,
        "/editor/reviewer_invitations.php",
        {"manuscript_id": manuscript_id, "reviewer_id": reviewer_id},
    )
    invitation_id = int(response["invitation_ids"][0])
    print(f"[editor] invited reviewer_id={reviewer_id} invitation_id={invitation_id}")
    return invitation_id


def reviewer_accept_invitation(reviewer: UserAccount, invitation_id: int) -> None:
    http_post_json(reviewer.opener, "/reviewer/invitations.php", {"invitation_id": invitation_id, "response": "accepted"})
    print(f"[reviewer] accepted invitation {invitation_id}")


def reviewer_submit_review(reviewer: UserAccount, manuscript_id: int) -> None:
    http_post_json(
        reviewer.opener,
        "/reviewer/reviews.php",
        {
            "manuscript_id": manuscript_id,
            "recommendation": "accept",
            "confidential_comments": "Automation smoke test review completed successfully.",
            "comments_to_author": "The manuscript is suitable for publication.",
            "score_novelty": 5,
            "score_methodology": 5,
            "score_clarity": 5,
            "score_significance": 5,
        },
    )
    print(f"[reviewer] submitted review for manuscript {manuscript_id}")


def record_editor_decision(editor: UserAccount, manuscript_id: int) -> None:
    http_post_json(
        editor.opener,
        "/editor/decisions.php",
        {
            "manuscript_id": manuscript_id,
            "decision_type": "accept",
            "decision_letter": "Accepted after successful reviewer validation.",
        },
    )
    print(f"[editor] accepted manuscript {manuscript_id}")


def record_final_decision(eic: UserAccount, manuscript_id: int) -> None:
    http_post_json(
        eic.opener,
        "/eic/final_decisions.php",
        {
            "manuscript_id": manuscript_id,
            "final_decision": "accepted",
            "remarks": "Editor-in-Chief approval for smoke test.",
        },
    )
    print(f"[eic] final decision accepted manuscript {manuscript_id}")


def publish_manuscript(eic: UserAccount, manuscript_id: int) -> int:
    response = http_post_json(eic.opener, "/eic/publish.php", {"manuscript_id": manuscript_id})
    article_id = int(response["article_id"])
    print(f"[publish] manuscript_id={manuscript_id} article_id={article_id}")
    return article_id


def author_workspace_status(author: UserAccount, manuscript_id: int) -> Dict[str, Any]:
    workspace = http_get_json(author.opener, "/workspace.php")
    manuscripts = workspace.get("author", {}).get("manuscripts", [])
    for entry in manuscripts:
        if int(entry.get("manuscript_id", 0)) == manuscript_id:
            return entry
    raise RuntimeError(f"Could not locate manuscript {manuscript_id} in author workspace")


def public_article(article_id: int) -> Dict[str, Any]:
    opener = new_opener()
    query = urllib.parse.urlencode({"article_id": article_id})
    response = http_get_json(opener, f"/public/article.php?{query}")
    return response["article"]


def public_article_list() -> list[Dict[str, Any]]:
    opener = new_opener()
    response = http_get_json(opener, "/public/articles.php")
    return [dict(item) for item in response.get("articles", [])]


def save_result(data: Dict[str, Any]) -> None:
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULT_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def run() -> None:
    print(f"[config] BASE_API={BASE_API}")
    print(f"[config] MYSQL_BIN={MYSQL_BIN}")
    pdf = ensure_test_pdf()

    author = register_account("author", role="author")
    reviewer = register_account("reviewer", role="reviewer")
    editor = register_account("editor", editor_type="section_editor")
    eic = register_account("chief", editor_type="editor_in_chief")

    for account in (author, reviewer, editor, eic):
        login(account)

    manuscript_id, reference_number = submit_manuscript(author, pdf)
    editor_claim(editor, manuscript_id)
    invitation_id = invite_reviewer(editor, manuscript_id, reviewer.user_id)
    reviewer_accept_invitation(reviewer, invitation_id)
    reviewer_submit_review(reviewer, manuscript_id)
    record_editor_decision(editor, manuscript_id)
    record_final_decision(eic, manuscript_id)
    article_id = publish_manuscript(eic, manuscript_id)

    workspace_entry = author_workspace_status(author, manuscript_id)
    article_detail = public_article(article_id)
    article_list = public_article_list()

    result = {
        "accounts": {
            account.label: {
                "user_id": account.user_id,
                "email": account.email,
                "password": account.password,
                "roles": account.roles,
            }
            for account in (author, reviewer, editor, eic)
        },
        "manuscript": {
            "manuscript_id": manuscript_id,
            "reference_number": reference_number,
            "status": workspace_entry.get("status"),
            "title": workspace_entry.get("title"),
        },
        "article": {
            "article_id": article_id,
            "title": article_detail.get("title"),
            "doi": article_detail.get("doi"),
            "publication_date": article_detail.get("publication_date"),
            "public_detail_url": f"{BASE_SITE}/articles/{article_id}",
            "public_api_url": f"{BASE_API}/public/article.php?article_id={article_id}",
            "listed_publicly": any(int(item.get("article_id", 0)) == article_id for item in article_list),
        },
    }
    save_result(result)

    print(json.dumps(result, indent=2))
    print(f"[saved] {RESULT_PATH}")


if __name__ == "__main__":
    try:
        run()
    except urllib.error.HTTPError as error:
        body = error.read().decode(errors="ignore")
        sys.stderr.write(f"HTTPError {error.code}: {body}\n")
        sys.exit(1)
    except subprocess.CalledProcessError as error:
        sys.stderr.write(error.stderr if isinstance(error.stderr, str) else str(error))
        sys.exit(1)
    except Exception as error:
        sys.stderr.write(f"Error: {error}\n")
        sys.exit(1)
