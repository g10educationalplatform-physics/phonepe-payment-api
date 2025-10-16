import express from "express";
import crypto from "crypto";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Environment variables
const MERCHANT_ID = process.env.MERCHANT_ID;
const SALT_KEY = process.env.SALT_KEY;
const SALT_INDEX = process.env.SALT_INDEX;
const BASE_URL = process.env.BASE_URL;

// Utility: Generate checksum
function generateChecksum(data) {
  const sortedKeys = Object.keys(data).sort();
  const payload = sortedKeys.map(k => `${k}=${data[k]}`).join('|') + '|' + SALT_KEY;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Root route
app.get("/", (req, res) => {
  res.send("<h1>PhonePe Payment API is running!</h1><p>Use /pay to create a payment and /verify to verify it.</p>");
});

// Route: /pay -> generate PhonePe payment URL
app.post("/pay", (req, res) => {
  const { orderId, amount, name, email } = req.body;
  if (!orderId || !amount) return res.status(400).json({ error: "Missing orderId or amount" });

  const paymentData = {
    merchantId: MERCHANT_ID,
    merchantOrderId: orderId,
    amount: amount,
    redirectUrl: `${BASE_URL}/verify`,
    redirectMode: "GET",
    customerName: name || "",
    customerEmail: email || ""
  };

  const checksum = generateChecksum(paymentData);
  paymentData.checksum = checksum;

  res.json({
    phonepePaymentUrl: `https://pgi.phonepe.com/pay?merchantId=${MERCHANT_ID}&orderId=${orderId}&amount=${amount}&redirectUrl=${encodeURIComponent(paymentData.redirectUrl)}&checksum=${checksum}`
  });
});

// Route: /verify -> verify payment callback from PhonePe
app.get("/verify", (req, res) => {
  const { orderId, status, txnId, checksum } = req.query;

  if (!orderId || !status || !txnId || !checksum) return res.status(400).send("Invalid request");

  const validChecksum = generateChecksum({ orderId, status, txnId });
  if (validChecksum !== checksum) return res.status(400).send("Checksum mismatch");

  if (status === "SUCCESS") {
    res.send(`<h2>Payment Successful!</h2><p>Order ID: ${orderId}</p><p>Transaction ID: ${txnId}</p>`);
  } else {
    res.send(`<h2>Payment Failed!</h2><p>Order ID: ${orderId}</p>`);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
