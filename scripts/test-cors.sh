#!/bin/bash
# ============================================
# CORS Testing Script for Absenta 13
# Version 2.0 - Enhanced Error Detection
# ============================================
# Usage: ./scripts/test-cors.sh [environment]
# Environments: local, production
# ============================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
ENV="${1:-local}"

if [ "$ENV" = "production" ]; then
    API_URL="https://api.absenta13.my.id"
    ORIGIN="https://absenta13.my.id"
elif [ "$ENV" = "local" ]; then
    API_URL="http://localhost:3001"
    ORIGIN="http://localhost:5173"
else
    echo -e "${RED}Unknown environment: $ENV${NC}"
    echo "Usage: $0 [local|production]"
    exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}           ${BOLD}CORS Testing Script - Absenta 13 v2.0${NC}             ${BLUE}║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} Environment: ${YELLOW}$ENV${NC}"
echo -e "${BLUE}║${NC} API URL: ${CYAN}$API_URL${NC}"
echo -e "${BLUE}║${NC} Test Origin: ${CYAN}$ORIGIN${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Track results
declare -a TEST_RESULTS
TOTAL_TESTS=0
PASSED_TESTS=0

# Function to log test result
log_test() {
    local test_name="$1"
    local passed="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$passed" = "true" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "  ${GREEN}✓ PASS${NC} - $details"
        TEST_RESULTS+=("PASS: $test_name")
    else
        echo -e "  ${RED}✗ FAIL${NC} - $details"
        TEST_RESULTS+=("FAIL: $test_name - $details")
    fi
}

# ============================================
# Test 1: Server Accessibility
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 1] Server Accessibility${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health" --connect-timeout 10 2>/dev/null)

if [ "$HEALTH_RESPONSE" = "200" ]; then
    log_test "Server Health" "true" "Server responding (HTTP $HEALTH_RESPONSE)"
else
    log_test "Server Health" "false" "Server not responding (HTTP $HEALTH_RESPONSE)"
    echo -e "\n${RED}Server is not accessible. Cannot continue tests.${NC}"
    echo -e "Possible causes:"
    echo -e "  • Server is down (check: pm2 status)"
    echo -e "  • DNS not resolving (check: nslookup $API_URL)"
    echo -e "  • Firewall blocking (check: telnet $(echo $API_URL | sed 's|https://||;s|http://||') 443)"
    exit 1
fi
echo ""

# ============================================
# Test 2: CORS Headers with Origin
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 2] CORS Headers with Origin${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

CORS_HEADERS=$(curl -s -D - -o /dev/null "$API_URL/api/health" \
    -H "Origin: $ORIGIN" 2>/dev/null)

# Extract headers
CORS_ORIGIN=$(echo "$CORS_HEADERS" | grep -i "^access-control-allow-origin:" | tr -d '\r' | cut -d' ' -f2-)
CORS_CREDS=$(echo "$CORS_HEADERS" | grep -i "^access-control-allow-credentials:" | tr -d '\r' | cut -d' ' -f2-)
CORS_STATUS=$(echo "$CORS_HEADERS" | grep -i "^x-cors-status:" | tr -d '\r' | cut -d' ' -f2-)
CORS_ERROR=$(echo "$CORS_HEADERS" | grep -i "^x-cors-error-code:" | tr -d '\r' | cut -d' ' -f2-)

echo -e "  Headers received:"
echo -e "    Access-Control-Allow-Origin: ${CYAN}${CORS_ORIGIN:-'(not set)'}${NC}"
echo -e "    Access-Control-Allow-Credentials: ${CYAN}${CORS_CREDS:-'(not set)'}${NC}"
echo -e "    X-CORS-Status: ${CYAN}${CORS_STATUS:-'(not set)'}${NC}"

if [ -n "$CORS_ERROR" ]; then
    echo -e "    X-CORS-Error-Code: ${RED}${CORS_ERROR}${NC}"
fi

# Check if origin matches
if [ "$CORS_ORIGIN" = "$ORIGIN" ]; then
    log_test "Origin Match" "true" "Origin header correctly set to $ORIGIN"
elif [ -z "$CORS_ORIGIN" ]; then
    log_test "Origin Match" "false" "Access-Control-Allow-Origin header MISSING"
    echo -e "    ${YELLOW}→ This is the main CORS error cause!${NC}"
else
    log_test "Origin Match" "false" "Origin mismatch: got '$CORS_ORIGIN' expected '$ORIGIN'"
fi

# Check credentials
if [ "$CORS_CREDS" = "true" ]; then
    log_test "Credentials" "true" "Credentials allowed"
else
    log_test "Credentials" "false" "Credentials header missing or not 'true'"
fi
echo ""

# ============================================
# Test 3: Preflight OPTIONS Request
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 3] Preflight OPTIONS Request${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PREFLIGHT=$(curl -s -D - -o /tmp/cors_preflight_body.txt -X OPTIONS "$API_URL/api/login" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type, Authorization" 2>/dev/null)

PREFLIGHT_STATUS=$(echo "$PREFLIGHT" | head -1 | grep -oE "[0-9]{3}")
PREFLIGHT_ORIGIN=$(echo "$PREFLIGHT" | grep -i "^access-control-allow-origin:" | tr -d '\r' | cut -d' ' -f2-)
PREFLIGHT_METHODS=$(echo "$PREFLIGHT" | grep -i "^access-control-allow-methods:" | tr -d '\r' | cut -d' ' -f2-)
PREFLIGHT_HEADERS_ALLOWED=$(echo "$PREFLIGHT" | grep -i "^access-control-allow-headers:" | tr -d '\r' | cut -d' ' -f2-)

echo -e "  Preflight Response:"
echo -e "    HTTP Status: ${CYAN}$PREFLIGHT_STATUS${NC}"
echo -e "    Allow-Origin: ${CYAN}${PREFLIGHT_ORIGIN:-'(not set)'}${NC}"
echo -e "    Allow-Methods: ${CYAN}${PREFLIGHT_METHODS:-'(not set)'}${NC}"
echo -e "    Allow-Headers: ${CYAN}${PREFLIGHT_HEADERS_ALLOWED:-'(not set)'}${NC}"

# Check status
if [ "$PREFLIGHT_STATUS" = "204" ] || [ "$PREFLIGHT_STATUS" = "200" ]; then
    log_test "Preflight Status" "true" "Status $PREFLIGHT_STATUS (OK)"
else
    log_test "Preflight Status" "false" "Status $PREFLIGHT_STATUS (expected 204 or 200)"
    
    # Check for error body
    if [ -f /tmp/cors_preflight_body.txt ] && [ -s /tmp/cors_preflight_body.txt ]; then
        ERROR_BODY=$(cat /tmp/cors_preflight_body.txt)
        ERROR_CODE=$(echo "$ERROR_BODY" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
        ERROR_TITLE=$(echo "$ERROR_BODY" | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
        
        if [ -n "$ERROR_CODE" ]; then
            echo -e "    ${RED}Error Code: $ERROR_CODE${NC}"
            echo -e "    ${RED}Error: $ERROR_TITLE${NC}"
        fi
    fi
fi

# Check methods include POST
if echo "$PREFLIGHT_METHODS" | grep -qi "POST"; then
    log_test "POST Allowed" "true" "POST method is allowed"
else
    log_test "POST Allowed" "false" "POST method not in allowed methods"
fi

# Check headers include Authorization
if echo "$PREFLIGHT_HEADERS_ALLOWED" | grep -qi "Authorization"; then
    log_test "Auth Header Allowed" "true" "Authorization header is allowed"
else
    log_test "Auth Header Allowed" "false" "Authorization header not allowed"
fi
echo ""

# ============================================
# Test 4: CORS Debug Endpoint
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 4] CORS Debug Endpoint${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

DEBUG_RESPONSE=$(curl -s "$API_URL/api/debug/cors" \
    -H "Origin: $ORIGIN" 2>/dev/null)

DEBUG_STATUS=$(echo "$DEBUG_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
DEBUG_ALLOWED=$(echo "$DEBUG_RESPONSE" | grep -o '"allowed":[^,}]*' | cut -d':' -f2)
DEBUG_ERROR_CODE=$(echo "$DEBUG_RESPONSE" | grep -o '"errorCode":"[^"]*"' | head -1 | cut -d'"' -f4)

echo -e "  Debug Response:"
echo -e "    Status: ${CYAN}$DEBUG_STATUS${NC}"
echo -e "    Allowed: ${CYAN}$DEBUG_ALLOWED${NC}"

if [ -n "$DEBUG_ERROR_CODE" ] && [ "$DEBUG_ERROR_CODE" != "null" ]; then
    echo -e "    Error Code: ${RED}$DEBUG_ERROR_CODE${NC}"
fi

if [ "$DEBUG_ALLOWED" = "true" ]; then
    log_test "Debug Endpoint" "true" "Origin is allowed according to debug endpoint"
else
    log_test "Debug Endpoint" "false" "Origin is BLOCKED - Error: $DEBUG_ERROR_CODE"
    
    # Show suggestions if available
    SUGGESTIONS=$(echo "$DEBUG_RESPONSE" | grep -o '"suggestions":\[[^]]*\]' | sed 's/"suggestions":\[//;s/\]$//')
    if [ -n "$SUGGESTIONS" ]; then
        echo -e "    ${YELLOW}Suggestions:${NC}"
        echo "$SUGGESTIONS" | tr ',' '\n' | sed 's/"//g' | while read -r suggestion; do
            echo -e "      → $suggestion"
        done
    fi
fi
echo ""

# ============================================
# Test 5: Duplicate Headers Check
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 5] Duplicate Headers Check${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

FULL_HEADERS=$(curl -s -D - -o /dev/null "$API_URL/api/health" \
    -H "Origin: $ORIGIN" 2>/dev/null)

ORIGIN_COUNT=$(echo "$FULL_HEADERS" | grep -ci "^access-control-allow-origin:")

echo -e "  Access-Control-Allow-Origin header count: ${CYAN}$ORIGIN_COUNT${NC}"

if [ "$ORIGIN_COUNT" -eq 1 ]; then
    log_test "No Duplicates" "true" "Exactly 1 CORS origin header (correct)"
elif [ "$ORIGIN_COUNT" -eq 0 ]; then
    log_test "No Duplicates" "false" "NO CORS origin headers found!"
else
    log_test "No Duplicates" "false" "DUPLICATE HEADERS DETECTED ($ORIGIN_COUNT headers)"
    echo -e "    ${YELLOW}→ This causes CORS failures in some browsers!${NC}"
    echo -e "    ${YELLOW}→ Fix: Remove CORS headers from nginx if backend handles CORS${NC}"
fi
echo ""

# ============================================
# Test 6: Unauthorized Origin (Security)
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 6] Security - Unauthorized Origin${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

MALICIOUS_ORIGIN="https://malicious-attacker.com"
SECURITY_HEADERS=$(curl -s -D - -o /dev/null "$API_URL/api/health" \
    -H "Origin: $MALICIOUS_ORIGIN" 2>/dev/null)

SECURITY_CORS=$(echo "$SECURITY_HEADERS" | grep -i "^access-control-allow-origin:" | tr -d '\r' | cut -d' ' -f2-)
SECURITY_STATUS=$(echo "$SECURITY_HEADERS" | grep -i "^x-cors-status:" | tr -d '\r' | cut -d' ' -f2-)

echo -e "  Testing with malicious origin: ${CYAN}$MALICIOUS_ORIGIN${NC}"
echo -e "    X-CORS-Status: ${CYAN}${SECURITY_STATUS:-'(not set)'}${NC}"
echo -e "    Allow-Origin: ${CYAN}${SECURITY_CORS:-'(not set/null)'}${NC}"

if [ "$SECURITY_CORS" = "$MALICIOUS_ORIGIN" ]; then
    log_test "Security Check" "false" "SECURITY ISSUE: Malicious origin was ALLOWED!"
    echo -e "    ${RED}⚠️  WARNING: Server allows any origin!${NC}"
else
    log_test "Security Check" "true" "Malicious origin correctly rejected"
fi
echo ""

# ============================================
# Test 7: Test Specific Origin Endpoint
# ============================================
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}[Test 7] Origin Test Endpoint${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TEST_ORIGIN_RESPONSE=$(curl -s "$API_URL/api/debug/cors/test?origin=$ORIGIN" 2>/dev/null)
TEST_RESULT=$(echo "$TEST_ORIGIN_RESPONSE" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

echo -e "  Testing origin via API: ${CYAN}$ORIGIN${NC}"
echo -e "    Result: ${CYAN}$TEST_RESULT${NC}"

if [ "$TEST_RESULT" = "ALLOWED" ]; then
    log_test "Origin Test API" "true" "Origin test endpoint confirms allowed"
else
    log_test "Origin Test API" "false" "Origin test endpoint reports: $TEST_RESULT"
fi
echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                        ${BOLD}SUMMARY${NC}                              ${BLUE}║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════════════╣${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${BLUE}║${NC}  ${GREEN}✓ All $TOTAL_TESTS tests passed! CORS is working correctly.${NC}"
else
    echo -e "${BLUE}║${NC}  ${YELLOW}$PASSED_TESTS/$TOTAL_TESTS tests passed${NC}"
    echo -e "${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${RED}Failed Tests:${NC}"
    for result in "${TEST_RESULTS[@]}"; do
        if [[ "$result" == FAIL* ]]; then
            echo -e "${BLUE}║${NC}    • ${result#FAIL: }"
        fi
    done
fi

echo -e "${BLUE}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  ${BOLD}Quick Fixes:${NC}"
echo -e "${BLUE}║${NC}    1. Check .env: grep ALLOWED_ORIGINS .env"
echo -e "${BLUE}║${NC}    2. Restart: pm2 restart absenta"
echo -e "${BLUE}║${NC}    3. Debug: curl $API_URL/api/debug/cors -H 'Origin: $ORIGIN'"
echo -e "${BLUE}║${NC}    4. Docs: docs/CORS-TROUBLESHOOTING.md"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Cleanup
rm -f /tmp/cors_preflight_body.txt

# Exit with appropriate code
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    exit 0
else
    exit 1
fi
