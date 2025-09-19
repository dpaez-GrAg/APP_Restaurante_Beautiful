#!/bin/bash

# Simple script to test the reservation API endpoint using curl
# Usage: bash test-api.sh

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://api.restaurante1.gridded.agency/functions/v1/agent-create-reservation"
# Replace with your actual anon key from Supabase dashboard
ANON_KEY="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1NzI1MDAwMCwiZXhwIjo0OTEyOTIzNjAwLCJyb2xlIjoiYW5vbiJ9.XvH85shTYQwGvwuAgHyN9YNAuxkYz3fpKwTMTpky2jo"

echo -e "${BLUE}Testing reservation creation API...${NC}"
echo -e "${BLUE}API URL: ${API_URL}${NC}"

# Test data
echo -e "${BLUE}Sending test reservation data...${NC}"
echo '{
  "customer_name": "Test User",
  "customer_email": "test@example.com",
  "customer_phone": "+34 123 456 789",
  "date": "2025-10-01",
  "time": "20:00",
  "guests": 2,
  "special_requests": "Testing API endpoint"
}'

# Make the API request
response=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "apikey: ${ANON_KEY}" \
  -d '{
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "+34 123 456 789",
    "date": "2025-10-01",
    "time": "20:00",
    "guests": 2,
    "special_requests": "Testing API endpoint"
  }')

# Extract status code and response body
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo -e "\n${BLUE}Response status code: ${http_code}${NC}"
echo -e "${BLUE}Response body:${NC}"
echo "$body" | json_pp 2>/dev/null || echo "$body"

# Check if request was successful
if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
  echo -e "\n${GREEN}✅ API request successful!${NC}"
else
  echo -e "\n${RED}❌ API request failed!${NC}"
fi
