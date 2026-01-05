const {
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { dynamoDB } = require("../config/dynamo");
const TABLE_NAME = "Invoice_app_invoices";

const cancellationRepo = require("./cancellation.repo");

const getLatestInvoicesByPhone = async (phone) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: "#c.#p = :phone",
      ExpressionAttributeNames: {
        "#c": "customer",
        "#p": "phone",
      },
      ExpressionAttributeValues: {
        ":phone": String(phone),
      },
    };

    const result = await dynamoDB.send(new ScanCommand(params));
    const invoices = result.Items || [];

    if (!invoices.length) return [];

    /* ===============================
       SAME VERSION LOGIC AS getAllInvoices
    ================================ */

    const referencedIds = new Set();

    for (const inv of invoices) {
      if (inv.previousInvoiceId) {
        referencedIds.add(inv.previousInvoiceId);
      }
    }

    const latestInvoices = invoices.filter(
      (inv) => !referencedIds.has(inv._id)
    );

    /* ===============================
       🔥 FILTER USING LEDGER (NO FLAGS)
       Exclude invoice if ANY cancellation exists
    ================================ */

    const filtered = [];

    for (const inv of latestInvoices) {
      const cancellations = await cancellationRepo.getCancellationsByInvoiceId(
        inv._id
      );

      // If no cancellation vouchers → invoice is active
      if (!cancellations || cancellations.length === 0) {
        filtered.push(inv);
      }
    }

    // newest first for UI
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return filtered;
  } catch (err) {
    throw new Error(
      `Latest Invoice Fetch By Customer Phone Error: ${err.message}`
    );
  }
};

module.exports = {
  getLatestInvoicesByPhone,
};
