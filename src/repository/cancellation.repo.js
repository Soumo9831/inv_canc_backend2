const fs = require("fs");
const path = require("path");
const {
  PutCommand,
  ScanCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const { dynamoDB } = require("../config/dynamo");

const TABLE_NAME = "cancellation_app_voucher";

// Path to dummy invoices JSON
const invoicesFilePath = path.join(__dirname, "../../invoices.json");

/* ================= EXISTING CODE (UNCHANGED) ================= */

const readInvoicesFromFile = () => {
  const rawData = fs.readFileSync(invoicesFilePath, "utf-8");
  const parsed = JSON.parse(rawData);
  return parsed.invoices || [];
};

const findInvoiceByInvoiceId = (invoiceId) => {
  const invoices = readInvoicesFromFile();
  return invoices.find((inv) => inv._id === invoiceId);
};

const createCancellationEntry = async (invoice) => {
  const cancellationId = uuidv4();

  const itemToStore = {
    _id: cancellationId,
    inv_id: invoice._id,
    customer: invoice.customer,
    company: invoice.company,
    items: invoice.items,

    advance: invoice.advance,
    cancellation_charge: invoice.cancellation_charge,
    net_return: invoice.net_return,
    already_returned: invoice.already_returned,
    yetTB_returned: invoice.yetTB_returned,
    status: invoice.status,

    version: invoice.version || 1,
    createdAt: new Date().toISOString(),
  };

  const params = {
    TableName: TABLE_NAME,
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

const fetchInvoiceAndStoreCancellation = async (invoiceId) => {
  const invoice = findInvoiceByInvoiceId(invoiceId);
  if (!invoice) return null;
  return await createCancellationEntry(invoice);
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

const getLatestCancellationByInvoiceId = async (invId) => {
  const vouchers = await getCancellationsByInvoiceId(invId);
  if (vouchers.length === 0) return null;

  return vouchers.reduce((latest, current) =>
    current.version > latest.version ? current : latest
  );
};

const createNextVersionCancellation = async (latestVoucher, amountToAdd) => {
  const newAlreadyReturned =
    latestVoucher.already_returned + amountToAdd;

  const newYetToBeReturned =
    latestVoucher.net_return - newAlreadyReturned;

  const newVoucher = {
    ...latestVoucher,
    _id: uuidv4(),
    already_returned: newAlreadyReturned,
    yetTB_returned: newYetToBeReturned,
    status: newYetToBeReturned === 0,
    version: latestVoucher.version + 1,
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
    if (
      !latestMap[invId] ||
      voucher.version > latestMap[invId].version
    ) {
      latestMap[invId] = voucher;
    }
  }

  return Object.values(latestMap);
};

/* ================= EXPORTS ================= */

module.exports = {
  fetchInvoiceAndStoreCancellation,
  getAllCancellations,

  getCancellationsByInvoiceId,
  getLatestCancellationByInvoiceId,
  createNextVersionCancellation,

  deleteCancellationById,
  deleteLatestCancellationByInvoiceId,

  // 🔥 NEW EXPORT
  getLatestCancellationsForAllInvoices,
};
