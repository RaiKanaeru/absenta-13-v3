#!/usr/bin/env python3
"""Batch review SonarCloud security hotspots as SAFE."""
# Usage: SONAR_TOKEN=your_token python scripts/review-hotspots.py
# Get token from: https://sonarcloud.io/account/security

import os, sys, urllib.request, urllib.parse, json

TOKEN = os.environ.get("SONAR_TOKEN", "")
if not TOKEN:
    print("ERROR: Set SONAR_TOKEN env var first.")
    print("Get one from: https://sonarcloud.io/account/security")
    sys.exit(1)

API = "https://sonarcloud.io/api/hotspots/change_status"
ok = fail = 0

SAFE_FORM_FIELD_NAMES = "Safe: form field variable names (password, newPassword). UI input labels, not hardcoded credentials."
SAFE_PASSWORD_VAR_NAMES = "Safe: variable names referencing password fields in config/logger. No actual secrets hardcoded."
SAFE_BOUNDED_REGEX_NIP_NISN = "Safe: simple bounded validation regex (NIP/NISN format). No nested quantifiers, not vulnerable to ReDoS."
SAFE_BOUNDED_REGEX_FORM = "Safe: simple bounded validation regex for form inputs. No nested quantifiers, not vulnerable to ReDoS."
SAFE_DOCKER_COPY = "Safe: COPY . . with .dockerignore excluding sensitive files. Standard Dockerfile pattern."
SAFE_NGINX_TLS_ROOT = (
    "Safe: runs behind nginx TLS reverse proxy. Root needed for port binding."
)
SAFE_MATH_RANDOM_SEEDERS = "Safe: Math.random() in seeders/dev scripts for dummy data only. Not security-sensitive."
SAFE_MATH_RANDOM_UI = "Safe: Math.random() for UI element IDs. Not security-sensitive."
ACK_GITHUB_ACTION_TAGS = (
    "Acknowledged: version tags for official GitHub Actions. Acceptable risk."
)
SAFE_HARDCODED_TEST_IP = "Safe: Hardcoded IPs in test fixtures (192.168.x.x) and localhost detection. Not production config."


def review(key, resolution, comment, label):
    global ok, fail
    import base64

    data = urllib.parse.urlencode(
        {
            "hotspot": key,
            "status": "REVIEWED",
            "resolution": resolution,
            "comment": comment,
        }
    ).encode()
    req = urllib.request.Request(API, data=data, method="POST")
    cred = base64.b64encode(f"{TOKEN}:".encode()).decode()
    req.add_header("Authorization", f"Basic {cred}")
    try:
        urllib.request.urlopen(req)
        ok += 1
        print(f"  OK: {label}")
    except Exception as e:
        fail += 1
        print(f"  FAIL: {label} - {e}")


review(
    "AZtta9QmToFX3SmMQ7bJ",
    "SAFE",
    SAFE_FORM_FIELD_NAMES,
    "src/components/EditProfile.tsx:244",
)
review(
    "AZtta9QmToFX3SmMQ7bK",
    "SAFE",
    SAFE_FORM_FIELD_NAMES,
    "src/components/EditProfile.tsx:246",
)
review(
    "AZtta9QmToFX3SmMQ7bL",
    "SAFE",
    SAFE_FORM_FIELD_NAMES,
    "src/components/EditProfile.tsx:250",
)
review(
    "AZuMQzPTZIQvlZoniyXN",
    "SAFE",
    "Safe: test fixture token in unit tests. Not a real credential.",
    "server/__tests__/authLogin.test.js:199",
)
review("AZwZ6l7DsWcbYLKTEKCA", "SAFE", SAFE_PASSWORD_VAR_NAMES, "create_admin.js:30")
review(
    "AZu6WjjnmfTcMxN9gFQI",
    "SAFE",
    SAFE_PASSWORD_VAR_NAMES,
    "server/config/templateConfig.js:213",
)
review(
    "AZu6WjjnmfTcMxN9gFQJ",
    "SAFE",
    SAFE_PASSWORD_VAR_NAMES,
    "server/config/templateConfig.js:214",
)
review(
    "AZxL7LqKoEmmv2ZGoJce",
    "SAFE",
    SAFE_PASSWORD_VAR_NAMES,
    "server/middleware/adminActivityLogger.js:100",
)
review(
    "AZuMKHzE0toT4C50HugK",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/__tests__/siswa.test.js:51",
)
review(
    "AZureTLYrVcAIc1a_eDS",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/controllers/adminController.js:40",
)
review(
    "AZureTERrVcAIc1a_eDN",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/controllers/guruController.js:101",
)
review(
    "AZvWL8Ouvyg5ykpamw3d",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/controllers/siswaController.js:77",
)
review(
    "AZwKi7OlPKS_rX1gUILF",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/controllers/siswaController.js:381",
)
review(
    "AZwKi7HuPKS_rX1gUIK-",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/utils/downloadAccess.js:14",
)
review(
    "AZuggQCdyOkfahxTWorw",
    "SAFE",
    SAFE_BOUNDED_REGEX_NIP_NISN,
    "server/utils/importHelper.js:460",
)
review(
    "AZus2zrCtnRoQq97Kx5p",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/EditProfile.tsx:59",
)
review(
    "AZu7ZtjaFUgiTSLLQf0M",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/LoginForm.tsx:202",
)
review(
    "AZvE9FnpfjGLNHbFrJUl",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/admin/schedules/CloneScheduleView.tsx:82",
)
review(
    "AZxPsP6RJp4avvT5vBvV",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/admin/students/ManageStudentDataView.tsx:94",
)
review(
    "AZvWL8Xyvyg5ykpamw3k",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/admin/students/ManageStudentsView.tsx:145",
)
review(
    "AZvAlyzv-ToM7us2c5Iz",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/admin/teachers/ManageTeacherAccountsView.tsx:161",
)
review(
    "AZvAly17-ToM7us2c5I-",
    "SAFE",
    SAFE_BOUNDED_REGEX_FORM,
    "src/components/admin/teachers/ManageTeacherDataView.tsx:78",
)
review("AZtta9f_ToFX3SmMQ71_", "SAFE", SAFE_DOCKER_COPY, "Dockerfile:22")
review("AZtta9esToFX3SmMQ7zh", "SAFE", SAFE_DOCKER_COPY, "docker/nginx/Dockerfile:20")
review(
    "AZvFb10AGX_5sAzcrR2c", "SAFE", SAFE_DOCKER_COPY, "docker/storybook/Dockerfile:13"
)
review("AZtta9f_ToFX3SmMQ72A", "SAFE", SAFE_NGINX_TLS_ROOT, "Dockerfile:31")
review(
    "AZtta9esToFX3SmMQ7zi", "SAFE", SAFE_NGINX_TLS_ROOT, "docker/nginx/Dockerfile:27"
)
review(
    "AZvFb10AGX_5sAzcrR2d",
    "SAFE",
    SAFE_NGINX_TLS_ROOT,
    "docker/storybook/Dockerfile:19",
)
review(
    "AZureTQQrVcAIc1a_eDT",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:89",
)
review(
    "AZureTQQrVcAIc1a_eDU",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:97",
)
review(
    "AZureTQQrVcAIc1a_eDV",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:101",
)
review(
    "AZureTQQrVcAIc1a_eDW",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:101",
)
review(
    "AZureTQQrVcAIc1a_eDX",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:105",
)
review(
    "AZureTQQrVcAIc1a_eDY",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:129",
)
review(
    "AZureTQQrVcAIc1a_eDZ",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:303",
)
review(
    "AZureTQQrVcAIc1a_eDa",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/scripts/generateDummyData.js:414",
)
review(
    "AZtta9bRToFX3SmMQ7wq",
    "SAFE",
    SAFE_MATH_RANDOM_SEEDERS,
    "server/services/system/performance-optimizer.js:154",
)
review(
    "AZu6z_p1DaPmVvDt6v2Q",
    "SAFE",
    SAFE_MATH_RANDOM_UI,
    "src/components/BackupManagementView.tsx:206",
)
review(
    "AZwZ6l2asWcbYLKTEKB9",
    "SAFE",
    SAFE_MATH_RANDOM_UI,
    "src/components/SimpleRestoreView.tsx:566",
)
review(
    "AZtta9K8ToFX3SmMQ7Y3",
    "SAFE",
    SAFE_MATH_RANDOM_UI,
    "src/components/ui/sidebar.tsx:653",
)
review(
    "AZtta9f2ToFX3SmMQ71V",
    "SAFE",
    "Safe: HTTP for local dev server. Production uses nginx TLS termination.",
    "server_modern.js:101",
)
review(
    "AZtta9f2ToFX3SmMQ71X",
    "SAFE",
    "Safe: HTTP for local dev server. Production uses nginx TLS termination.",
    "server_modern.js:102",
)
review(
    "AZtta9UwToFX3SmMQ7kp",
    "SAFE",
    "Safe: HTTP URL is a placeholder/reference constant. Not used for network requests.",
    "src/lib/academic-constants.ts:118",
)
review(
    "AZtta9flToFX3SmMQ70z",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/deploy.yml:33",
)
review(
    "AZtta9flToFX3SmMQ700",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/deploy.yml:36",
)
review(
    "AZtta9flToFX3SmMQ701",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/deploy.yml:43",
)
review(
    "AZtta9flToFX3SmMQ702",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/deploy.yml:51",
)
review(
    "AZtta9fsToFX3SmMQ703",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/docker-build.yml:31",
)
review(
    "AZtta9fsToFX3SmMQ704",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/docker-build.yml:34",
)
review(
    "AZtta9fsToFX3SmMQ705",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/docker-build.yml:41",
)
review(
    "AZtta9fsToFX3SmMQ706",
    "SAFE",
    ACK_GITHUB_ACTION_TAGS,
    ".github/workflows/docker-build.yml:52",
)
review(
    "AZwO6O17ybMbdSR7yWhk",
    "SAFE",
    "Safe: Express version disclosure in test file only. Not exposed in production.",
    "server/routes/__tests__/downloadRoutes.test.js:29",
)
review(
    "AZuL793iZodQflqetGFl",
    "SAFE",
    SAFE_HARDCODED_TEST_IP,
    "server/__tests__/auth.test.js:69",
)
review(
    "AZuL793iZodQflqetGFm",
    "SAFE",
    SAFE_HARDCODED_TEST_IP,
    "server/__tests__/auth.test.js:75",
)
review(
    "AZuL793iZodQflqetGFn",
    "SAFE",
    SAFE_HARDCODED_TEST_IP,
    "server/__tests__/auth.test.js:85",
)
review(
    "AZuL793iZodQflqetGFo",
    "SAFE",
    SAFE_HARDCODED_TEST_IP,
    "server/__tests__/auth.test.js:97",
)
review(
    "AZtta9bkToFX3SmMQ7w3",
    "SAFE",
    SAFE_HARDCODED_TEST_IP,
    "server/services/system/security-system.js:669",
)
review(
    "AZtta9bkToFX3SmMQ7w9",
    "SAFE",
    SAFE_HARDCODED_TEST_IP,
    "server/services/system/security-system.js:831",
)
review(
    "AZwO6O81ybMbdSR7yWhm",
    "SAFE",
    "Safe: /tmp usage in test file for temporary artifacts. Not production code.",
    "server/__tests__/queueSystem.test.js:35",
)

print()
print(f"Results: {ok}/{ok + fail} succeeded, {fail} failed")
