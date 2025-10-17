import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// --- PhonePe Config ---
const MERCHANT_ID = process.env.MERCHANT_ID;
const MERCHANT_KEY = process.env.SALT_KEY; // rename for clarity
const BASE_URL = process.env.BASE_URL;

// --- Helper: Generate X-VERIFY signature ---
function generateXVerify(payloadBase64) {
  const stringToHash = payloadBase64 + "/checkout/v2/pay" + MERCHANT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
  return sha256;
}

// --- PAY Endpoint ---
app.post("/pay", async (req, res) => {
  try {
    const { amount, name, email } = req.body;
    if (!amount || !name || !email) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const merchantTransactionId = "TXN" + Date.now();

    // --- Step 1: Build request body ---
    const body = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: "USER" + Date.now(),
      amount: amount * 100, // in paise
      redirectUrl: `${BASE_URL}/payment-success`,
      callbackUrl: `${BASE_URL}/payment-callback`,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    // --- Step 2: Base64 encode ---
    const payload = Buffer.from(JSON.stringify(body)).toString("base64");

    // --- Step 3: Generate X-VERIFY signature ---
    const xVerify = generateXVerify(payload);

    console.log("Payment request payload:", body);
    console.log("X-VERIFY signature:", xVerify);

    // --- Step 4: POST to PhonePe Sandbox ---
    const response = await axios.post(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
      { request: payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
          "X-MERCHANT-ID": MERCHANT_ID,
          Accept: "application/json",
        },
      }
    );

    // --- Step 5: Return redirect URL to frontend ---
    const redirectUrl = response.data?.data?.instrumentResponse?.redirectInfo?.url;
    if (redirectUrl) {
      res.json({ success: true, phonepePaymentUrl: redirectUrl });
    } else {
      console.error("Unexpected PhonePe response:", response.data);
      res.status(400).json({ error: "Payment creation failed", data: response.data });
    }
  } catch (err) {
    console.error("❌ Payment error:", err.response?.data || err.message);
    res.status(500).json({ error: "Server error during payment" });
  }
});

// --- Success / Callback handlers ---
app.get("/payment-success", (req, res) => {
  res.send("<h2>✅ Payment Successful</h2><p>You can now return to the form page.</p>");
});

app.post("/payment-callback", (req, res) => {
  console.log("📞 Callback data:", req.body);
  res.status(200).send("Callback received");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
