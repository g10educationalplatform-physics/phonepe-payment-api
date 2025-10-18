// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// --- PhonePe Sandbox Credentials ---
const CLIENT_ID = "TESTVVUAT_2502041721357207510164";
const CLIENT_SECRET = "ZTcxNDQyZjUtZjQ3Mi00MjJmLTgzOWYtMWZmZWQ2ZjdkMzVi";
const AUTH_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
const PAY_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay";

// --- Generate Payment ---
app.post("/pay", async (req, res) => {
  try {
    const { amount, name, email } = req.body;
    if (!amount) return res.status(400).json({ success: false, message: "Missing amount" });

    // Step 1: Get Auth Token
    const authRes = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_version: "1",
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });
    const authData = await authRes.json();
    const token = authData.access_token;

    // Step 2: Create a unique order ID
    const orderId = "ORD" + Date.now();

    // Step 3: Initiate payment
    const payRes = await fetch(PAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "O-Bearer " + token,
      },
      body: JSON.stringify({
        merchantOrderId: orderId,
        amount: amount * 100, // convert to paise (₹1 = 100 paise)
        expireAfter: 1200,
        metaInfo: { name, email },
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "G10 Admission Fee",
          merchantUrls: { redirectUrl: "https://g10educationalplatformindia.co.in/" },
        },
      }),
    });

    const payData = await payRes.json();

    if (payData.redirectUrl) {
      res.json({
        success: true,
        phonepePaymentUrl: payData.redirectUrl,
      });
    } else {
      console.error("PhonePe Pay API Error:", payData);
      res.status(500).json({ success: false, message: "Payment creation failed", details: payData });
    }
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
