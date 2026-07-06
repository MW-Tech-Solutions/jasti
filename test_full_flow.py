#!/usr/bin/env python3
import json
import os
import urllib.request
import urllib.error
import http.cookiejar

# Create a cookie jar to handle session cookies
cookiejar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookiejar))

# Step 1: Register the user (if not already registered)
base_api = os.environ.get("JASTI_BASE_URL", "http://localhost/api").rstrip("/")
print("=== STEP 1: Register User ===")
reg_url = f"{base_api}/auth/register.php"
reg_data = json.dumps({
    'first_name': 'Jane',
    'last_name': 'Developer',
    'email': 'jane.developer@example.com',
    'password': 'DevPass123!',
    'confirm_password': 'DevPass123!',
    'editor_type': 'managing_editor',
    'institution': 'Tech Institute',
    'country': 'UK',
    'subject_areas': 'Software Development, AI'
}).encode('utf-8')

reg_req = urllib.request.Request(reg_url, data=reg_data, headers={'Content-Type': 'application/json'})
try:
    response = opener.open(reg_req)
    result = json.loads(response.read().decode('utf-8'))
    print(f"Registration: SUCCESS")
    print(f"  User ID: {result['user']['user_id']}")
    print(f"  Editor Type: {result['user']['editor_type']}")
    print(f"  Dashboard URL: {result['user']['dashboard_url']}")
    user_id = result['user']['user_id']
except urllib.error.HTTPError as e:
    result = json.loads(e.read().decode('utf-8'))
    if 'already exists' in result.get('message', ''):
        print(f"Registration: User already exists (skipping)")
        # Try to get the user from another method, or just use a known ID
        user_id = None
    else:
        print(f"Registration: FAILED - {result.get('message')}")
        exit(1)

# Step 2: Login with credentials
print("\n=== STEP 2: Login ===")
login_url = f"{base_api}/auth/login.php"
login_data = json.dumps({
    'email': 'jane.developer@example.com',
    'password': 'DevPass123!'
}).encode('utf-8')

login_req = urllib.request.Request(login_url, data=login_data, headers={'Content-Type': 'application/json'})
try:
    response = opener.open(login_req)
    result = json.loads(response.read().decode('utf-8'))
    print(f"Login: SUCCESS")
    print(f"  User ID: {result['user_id']}")
    print(f"  Roles: {result.get('roles', [])}")
    print(f"  Editor Type: {result.get('editor_type')}")
except urllib.error.HTTPError as e:
    result = json.loads(e.read().decode('utf-8'))
    print(f"Login: FAILED - {result.get('message')}")
    exit(1)

# Step 3: Access editor dashboard with authenticated session
print("\n=== STEP 3: Access Editor Dashboard ===")
dashboard_url = f"{base_api}/editor/dashboard.php"
dashboard_req = urllib.request.Request(dashboard_url, headers={'Content-Type': 'application/json'})

try:
    response = opener.open(dashboard_req)
    result = json.loads(response.read().decode('utf-8'))
    print(f"Dashboard: SUCCESS")
    print(f"  Editor Type Name: {result.get('editor_type')}")
    print(f"  Stats Keys: {list(result.get('stats', {}).keys())}")
    if 'layout' in result:
        print(f"  Layout: {result['layout']}")
    print(f"\n  Full Response:")
    print(json.dumps(result, indent=2)[:500])
except urllib.error.HTTPError as e:
    result = json.loads(e.read().decode('utf-8'))
    print(f"Dashboard: FAILED - {result.get('message')}")
    exit(1)
