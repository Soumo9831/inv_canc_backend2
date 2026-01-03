const {
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { dynamoDB } = require("../config/dynamo");
const TABLE_NAME = "Invoice_app_invoices";

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
        ":phone": String(phone), // important: force string
      },
    };

    const result = await dynamoDB.send(new ScanCommand(params));
    const invoices = result.Items || [];

    if (!invoices.length) return [];

    /* ===============================
       SAME VERSION LOGIC AS getAllInvoices
    ================================ */

    const referencedIds = new Set();

    // collect previousInvoiceIds only inside this customer scope
    for (const inv of invoices) {
      if (inv.previousInvoiceId) {
        referencedIds.add(inv.previousInvoiceId);
      }
    }

    // latest = not referenced by any other
    const latestInvoices = invoices.filter(
      (inv) => !referencedIds.has(inv._id)
    );

    // newest first for UI
    latestInvoices.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return latestInvoices;
  } catch (err) {
    throw new Error(
      `Latest Invoice Fetch By Customer Phone Error: ${err.message}`
    );
  }
};

module.exports = {
  getLatestInvoicesByPhone,
};
