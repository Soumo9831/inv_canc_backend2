const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const { dynamoDB } = require("../config/dynamo");

const TABLE_NAME = "cancellation_app_payments";

/* ===============================
   CREATE PAYMENT ENTRY
   =============================== */
const createPaymentEntry = async ({
  amount,
  customer,
  cancellationId,
}) => {
  const paymentId = uuidv4();
  const now = new Date();

  const paymentItem = {
    _id: paymentId, // PK
    cancellation_id: cancellationId,
    amount,
    customer,
    date: now.toISOString().split("T")[0], // YYYY-MM-DD
    time: now.toISOString().split("T")[1].split(".")[0], // HH:mm:ss
    createdAt: now.toISOString(),
  };

  const params = {
    TableName: TABLE_NAME,
    Item: paymentItem,
    ConditionExpression: "attribute_not_exists(#id)",
    ExpressionAttributeNames: {
      "#id": "_id",
    },
  };

  try {
    await dynamoDB.send(new PutCommand(params));
    return paymentItem;
  } catch (err) {
    throw new Error(`Create Payment Error: ${err.message}`);
  }
};

/* ===============================
   GET ALL PAYMENTS
   =============================== */
const getAllPayments = async () => {
  const params = {
    TableName: TABLE_NAME,
  };

  try {
    const response = await dynamoDB.send(new ScanCommand(params));
    return response.Items || [];
  } catch (err) {
    throw new Error(`Fetch All Payments Error: ${err.message}`);
  }
};

/* ===============================
   GET PAYMENTS BY CANCELLATION ID
   =============================== */
const getPaymentsByCancellationId = async (cancellationId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "cancellation_id = :cid",
    ExpressionAttributeValues: {
      ":cid": cancellationId,
    },
  };

  try {
    const response = await dynamoDB.send(new ScanCommand(params));
    return response.Items || [];
  } catch (err) {
    throw new Error(`Fetch Payments By Cancellation Error: ${err.message}`);
  }
};

/* ===============================
   GET PAYMENTS BY INVOICE ID
   ===============================
   NOTE:
   payments table doesn’t store invoiceId directly.
   We infer via cancellation_id → invoice relationship later if needed.
   For now, we assume invoiceId is embedded in customer / metadata if present.
*/
const getPaymentsByInvoiceId = async (invoiceId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "contains(#cust, :inv)",
    ExpressionAttributeNames: {
      "#cust": "customer",
    },
    ExpressionAttributeValues: {
      ":inv": invoiceId,
    },
  };

  try {
    const response = await dynamoDB.send(new ScanCommand(params));
    return response.Items || [];
  } catch (err) {
    throw new Error(`Fetch Payments By Invoice Error: ${err.message}`);
  }
};

/* ===============================
   GET PAYMENTS BY CUSTOMER PHONE
   =============================== */
const getPaymentsByCustomerPhone = async (phone) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "customer.phone = :phone",
    ExpressionAttributeValues: {
      ":phone": phone,
    },
  };

  try {
    const response = await dynamoDB.send(new ScanCommand(params));
    return response.Items || [];
  } catch (err) {
    throw new Error(`Fetch Payments By Customer Error: ${err.message}`);
  }
};

/* ===============================
   EXPORTS
   =============================== */
module.exports = {
  createPaymentEntry,

  // READ APIs
  getAllPayments,
  getPaymentsByInvoiceId,
  getPaymentsByCancellationId,
  getPaymentsByCustomerPhone,
};
