#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

url = 'http://localhost/ajasti/api/auth/register.php'
data = json.dumps({
    'first_name': 'John',
    'last_name': 'Smith',
    'email': 'john.smith.editor@example.com',
    'password': 'TPass123!',
    'confirm_password': 'TPass123!',
    'editor_type': 'editor_in_chief',
    'institution': 'Test University',
    'country': 'Canada',
    'subject_areas': 'Computer Science, Engineering'
}).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        result = response.read().decode('utf-8')
        print(f'Status: {response.status}')
        print(result)
except urllib.error.HTTPError as e:
    result = e.read().decode('utf-8')
    print(f'Status: {e.code}')
    print(result)
except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')
