const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const router = express.Router();

router.use(bodyParser.json());

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

function verifyPaystackSignature(payload, signature) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  return hash === signature;
}

async function handleSuccessfulPayment(req, event) {
  const data = event.data;

  const orderService = req.scope.resolve("orderService");

  await orderService.update(data.metadata.order_id, {
    status: "paid",
  });

  console.log(`Payment successful for order: ${data.metadata.order_id}`);
}

async function handleSuccessfulRefund(req, event) {
  const data = event.data;

  const orderService = req.scope.resolve("orderService");

  await orderService.update(data.metadata.order_id, {
    status: "refunded",
  });

  console.log(`Refund successful for order: ${data.metadata.order_id}`);
}

module.exports = router;
