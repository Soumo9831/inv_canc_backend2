const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const { dynamoDB } = require("../config/dynamo");

const TABLE_NAME = "cancellation_app_payments";

/**
 * ===============================
 * CREATE PAYMENT ENTRY
 * ===============================
 * Called internally from cancellation.controller
 *
 * @param {Object} params
 * @param {number} params.amount
 * @param {Object} params.customer
 * @param {string} params.cancellationId
 */
const createPaymentEntry = async ({
  amount,
  customer,
  cancellationId,
}) => {
  const paymentId = uuidv4();
  const now = new Date();

  const paymentItem = {
    _id: paymentId,              // PK
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
    const command = new PutCommand(params);
    await dynamoDB.send(command);
    return paymentItem;
  } catch (err) {
    throw new Error(`Create Payment Error: ${err.message}`);
  }
};

/**
 * ===============================
 * GET PAYMENTS BY CANCELLATION ID
 * ===============================
 * (Useful for history screen later)
 */
const getPaymentsByCancellationId = async (cancellationId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "cancellation_id = :cid",
    ExpressionAttributeValues: {
      ":cid": cancellationId,
    },
  };

  try {
    const command = new ScanCommand(params);
    const response = await dynamoDB.send(command);
    return response.Items || [];
  } catch (err) {
    throw new Error(`Fetch Payments Error: ${err.message}`);
  }
};

module.exports = {
  createPaymentEntry,
  getPaymentsByCancellationId, // future-proof, read-only usage
};
