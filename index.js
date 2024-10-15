// Import required modules
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
require("dotenv").config(); // Ensure to load .env if you use it

// Initialize Express app
const app = express();
const port = parseInt(process.env.PORT, 10) || 9000; // Port setting with fallback

// Middleware to parse JSON request body
app.use(bodyParser.json());

// Validate port number
if (isNaN(port) || port < 0 || port > 65535) {
  throw new RangeError(`Invalid port number: ${port}. Port should be >= 0 and < 65536.`);
}

// Define Paystack Webhook router
const router = express.Router();

router.post("/paystack-webhook", async (req, res) => {
  const event = req.body;
  const signature = req.headers["x-paystack-signature"];

  if (!verifyPaystackSignature(event, signature)) {
    return res.status(400).send("Invalid signature");
  }

  try {
    switch (event.event) {
      case "charge.success":
        await handleSuccessfulPayment(req, event);
        break;
      case "refund.success":
        await handleSuccessfulRefund(req, event);
        break;
      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Error processing Paystack webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Verify Paystack signature
function verifyPaystackSignature(payload, signature) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  return hash === signature;
}

// Handle successful payment
async function handleSuccessfulPayment(req, event) {
  const data = event.data;
  const orderService = req.scope.resolve("orderService");

  await orderService.update(data.metadata.order_id, {
    status: "paid",
  });

  console.log(`Payment successful for order: ${data.metadata.order_id}`);
}

// Handle successful refund
async function handleSuccessfulRefund(req, event) {
  const data = event.data;
  const orderService = req.scope.resolve("orderService");

  await orderService.update(data.metadata.order_id, {
    status: "refunded",
  });

  console.log(`Refund successful for order: ${data.metadata.order_id}`);
}

// Register the router with the app
app.use(router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
