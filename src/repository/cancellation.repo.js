const {
  PutCommand,
  ScanCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const uuidv4 = () => randomUUID();
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
}) => {
  const cancellationId = generateCancellationId();

  const itemToStore = {
    _id: cancellationId,
    inv_id: invoice._id,

    customer: invoice.customer,
    company: invoice.company,
    items: invoice.items,

    advance: invoice.advance,

    cancellation_charge,
    net_return,
    already_returned,
    yetTB_returned,
    payment,
    version: invoice.version || 1,
    createdAt: new Date().toISOString(),
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
  });
};

const getAllCancellations = async () => {
  try {
    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLE_NAME })
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
      })
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
  payment
) => {
  const newAlreadyReturned = latestVoucher.already_returned + amountToAdd;

  const newYetToBeReturned = latestVoucher.net_return - newAlreadyReturned;

  const newVoucher = {
    ...latestVoucher,
    _id: generateCancellationId(),
    already_returned: newAlreadyReturned,
    yetTB_returned: newYetToBeReturned,
    status: newYetToBeReturned === 0,
    version: latestVoucher.version + 1,
    payment: payment,
    createdAt: new Date().toISOString(),
  };

  try {
    await dynamoDB.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newVoucher,
      })
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
      })
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
      })
    );

    return (response.Items || []).length > 0;
  } catch (err) {
    throw new Error(`Check Cancellation Exists Error: ${err.message}`);
  }
};

/* ================= EXPORTS ================= */

module.exports = {
  fetchInvoiceAndStoreCancellation,
  getAllCancellations,
  hasCancellationForInvoice,

  getCancellationsByInvoiceId,
  getLatestCancellationByInvoiceId,
  createNextVersionCancellation,
  getCancellationsByInvoiceIdExceptLatest,

  deleteCancellationById,
  deleteLatestCancellationByInvoiceId,

  // 🔥 NEW EXPORT
  getLatestCancellationsForAllInvoices,
};
