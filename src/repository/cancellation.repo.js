const {
  PutCommand,
  ScanCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const uuidv4 = () => randomUUID();
require("dotenv").config();
const { dynamoDB } = require("../config/dynamo");
const generateCancellationId = require("../utils/generateCancellationId");

const TABLE_NAME = "cancellation_app_voucher";

const INVOICE_TABLE = "Invoice_app_invoices";

/* ================= EXISTING CODE (UNCHANGED) ================= */

const findInvoiceByInvoiceId = async (invoiceId) => {
  const params = {
    TableName: INVOICE_TABLE,
    Key: {
      _id: invoiceId,
    },
  };

  try {
    const res = await dynamoDB.send(new GetCommand(params));
    return res.Item || null;
  } catch (err) {
    throw new Error(`DynamoDB Invoice Fetch Error: ${err.message}`);
  }
};

const createCancellationEntry = async ({
  invoice,
  cancellation_charge,
  net_return,
  already_returned,
  yetTB_returned,
  payment,
  executiveName,
}) => {
  const cancellationId = generateCancellationId();
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const itemToStore = {
    _id: cancellationId,
    inv_id: invoice._id,

    customer: invoice.customer,
    company: invoice.company,
    items: invoice.items,
    charges: invoice.charges,
    paid: already_returned,

    advance: invoice.advance,
    executiveName: executiveName,

    cancellation_charge,
    net_return,
    already_returned,
    yetTB_returned,
    payment,
    version: 1,
    createdAt: istDate.toISOString(),
  };

  const params = {
    TableName: TABLE_NAME, // your cancellation table
    Item: itemToStore,
    ConditionExpression: "attribute_not_exists(#id)",
    ExpressionAttributeNames: {
      "#id": "_id",
    },
  };

  try {
    await dynamoDB.send(new PutCommand(params));
    return itemToStore;
  } catch (err) {
    throw new Error(`DynamoDB Cancellation Create Error: ${err.message}`);
  }
};

const fetchInvoiceAndStoreCancellation = async ({
  invoiceId,
  cancellation_charge,
  net_return,
  already_returned,
  yetTB_returned,
  payment,
  executiveName,
}) => {
  // 1️⃣ Fetch invoice from invoice_app_invoices
  const invoice = await findInvoiceByInvoiceId(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // 2️⃣ Store cancellation entry
  return await createCancellationEntry({
    invoice,
    cancellation_charge: Number(cancellation_charge),
    net_return: Number(net_return),
    already_returned: Number(already_returned),
    yetTB_returned: Number(yetTB_returned),
    payment,
    executiveName,
  });
};

const getAllCancellations = async () => {
  try {
    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLE_NAME }),
    );
    return response.Items || [];
  } catch (err) {
    throw new Error(`DynamoDB Fetch All Cancellations Error: ${err.message}`);
  }
};

/* ================= AMOUNT ADDITION SUPPORT ================= */

const getCancellationsByInvoiceId = async (invId) => {
  try {
    const response = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "inv_id = :invId",
        ExpressionAttributeValues: {
          ":invId": invId,
        },
      }),
    );

    return response.Items || [];
  } catch (err) {
    throw new Error(`Fetch Cancellation By Invoice Error: ${err.message}`);
  }
};
const getCancellationsByInvoiceIdExceptLatest = async (invId) => {
  const vouchers = await getCancellationsByInvoiceId(invId);
  if (vouchers.length === 0) return [];

  const latestVersion = Math.max(...vouchers.map((v) => v.version));
  return vouchers.filter((v) => v.version !== latestVersion);
};

const getLatestCancellationByInvoiceId = async (invId) => {
  const vouchers = await getCancellationsByInvoiceId(invId);

  // No cancellations exist
  if (!vouchers || vouchers.length === 0) return null;

  // Return the voucher with the highest version
  return vouchers.reduce((latest, current) => {
    return current.version > latest.version ? current : latest;
  });
};

const createNextVersionCancellation = async (
  latestVoucher,
  amountToAdd,
  payment,
) => {
  const newAlreadyReturned = latestVoucher.already_returned + amountToAdd;

  const newYetToBeReturned = latestVoucher.net_return - newAlreadyReturned;

  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const newVoucher = {
    ...latestVoucher,
    _id: generateCancellationId(),
    paid: amountToAdd,
    already_returned: newAlreadyReturned,
    yetTB_returned: newYetToBeReturned,
    status: newYetToBeReturned === 0,
    version: latestVoucher.version + 1,
    payment: payment,
    createdAt: istDate.toISOString(),
  };

  try {
    await dynamoDB.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newVoucher,
      }),
    );
    return newVoucher;
  } catch (err) {
    throw new Error(`Create Next Cancellation Version Error: ${err.message}`);
  }
};

/* ================= HARD DELETE SUPPORT ================= */

const deleteCancellationById = async (cancellationId) => {
  try {
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { _id: cancellationId },
        ConditionExpression: "attribute_exists(#id)",
        ExpressionAttributeNames: {
          "#id": "_id",
        },
      }),
    );
    return true;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return false;
    throw new Error(`Delete Cancellation Error: ${err.message}`);
  }
};

/* ================= DELETE LATEST BY INVOICE ================= */

const deleteLatestCancellationByInvoiceId = async (invId) => {
  const latestVoucher = await getLatestCancellationByInvoiceId(invId);
  if (!latestVoucher) return null;

  await deleteCancellationById(latestVoucher._id);
  return latestVoucher;
};

/* ================= 🔥 NEW FEATURE ================= */

/**
 * 🔟 Get latest cancellation voucher for ALL invoices
 */
const getLatestCancellationsForAllInvoices = async () => {
  const all = await getAllCancellations();
  const latestMap = {};

  for (const voucher of all) {
    const invId = voucher.inv_id;
    if (!latestMap[invId] || voucher.version > latestMap[invId].version) {
      latestMap[invId] = voucher;
    }
  }

  return Object.values(latestMap);
};

/**
 * 🔍 Check if ANY cancellation voucher exists for an invoice
 */
const hasCancellationForInvoice = async (invId) => {
  try {
    const response = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "inv_id = :invId",
        ExpressionAttributeValues: {
          ":invId": invId,
        },
        ProjectionExpression: "_id", // fetch only minimal data
      }),
    );

    return (response.Items || []).length > 0;
  } catch (err) {
    throw new Error(`Check Cancellation Exists Error: ${err.message}`);
  }
};
const getCancellationDashboardStats = async () => {
  try {
    const all = await getAllCancellations();

    const latestMap = {};

    // 1️⃣ Keep only the latest voucher per invoice
    for (const v of all) {
      const invId = v.inv_id;

      if (!latestMap[invId] || v.version > latestMap[invId].version) {
        latestMap[invId] = v;
      }
    }

    const latestVouchers = Object.values(latestMap);

    // 2️⃣ Aggregate
    let totalInvoices = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const v of latestVouchers) {
      totalInvoices++;
      totalPaid += Number(v.already_returned || 0);
      totalDue += Number(v.yetTB_returned || 0);
    }

    return {
      totalVoucher: totalInvoices,
      totalPaid,
      totalDue,
    };
  } catch (err) {
    throw new Error(`Cancellation Dashboard Stats Error: ${err.message}`);
  }
};

const getCancellationsByExecutiveName = async (executiveName) => {
  try {
    const response = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "executiveName = :exec",
        ExpressionAttributeValues: {
          ":exec": executiveName,
        },
      }),
    );

    const all = response.Items || [];

    // 🧠 Keep only latest voucher per invoice
    const latestMap = {};

    for (const voucher of all) {
      const invId = voucher.inv_id;

      if (!latestMap[invId] || voucher.version > latestMap[invId].version) {
        latestMap[invId] = voucher;
      }
    }

    return Object.values(latestMap);
  } catch (err) {
    throw new Error(`Fetch Cancellation By Executive Error: ${err.message}`);
  }
};
const restoreCancellation = async (voucher) => {
  await dynamoDB.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: voucher,
      ConditionExpression: "attribute_not_exists(#id)",
      ExpressionAttributeNames: {
        "#id": "_id",
      },
    }),
  );
};

/* ================= EXPORTS ================= */

module.exports = {
  fetchInvoiceAndStoreCancellation,
  getAllCancellations,
  hasCancellationForInvoice,
  getCancellationDashboardStats,
  getCancellationsByExecutiveName,
  getCancellationsByInvoiceId,
  getLatestCancellationByInvoiceId,
  createNextVersionCancellation,
  getCancellationsByInvoiceIdExceptLatest,

  deleteCancellationById,
  deleteLatestCancellationByInvoiceId,
  restoreCancellation,

  // 🔥 NEW EXPORT
  getLatestCancellationsForAllInvoices,
};
