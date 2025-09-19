// Simple script to test the reservation API endpoint
// Usage: node test-api.js

const fetch = require("node-fetch");

// Configuration
const API_URL = "https://api.restaurante1.gridded.agency/functions/v1/agent-create-reservation";
// You can get this from your Supabase dashboard or environment variables
const ANON_KEY = "YOUR_ANON_KEY"; // Replace with your actual anon key

// Test data
const testReservation = {
  customer_name: "Test User",
  customer_email: "test@example.com",
  customer_phone: "+34 123 456 789",
  date: "2025-10-01",
  time: "20:00",
  guests: 2,
  special_requests: "Testing API endpoint",
};

async function testCreateReservation() {
  console.log("Testing reservation creation API...");
  console.log(`API URL: ${API_URL}`);
  console.log("Request data:", JSON.stringify(testReservation, null, 2));

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(testReservation),
    });

    const data = await response.json();

    console.log("\nResponse status:", response.status);
    console.log("Response headers:", response.headers);
    console.log("Response body:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("\n✅ API request successful!");
    } else {
      console.log("\n❌ API request failed!");
    }
  } catch (error) {
    console.error("\n❌ Error making API request:", error);
  }
}

// Run the test
testCreateReservation();
