const {
  PutCommand,
  ScanCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const uuidv4 = () => randomUUID();
const { dynamoDB } = require("../config/dynamo");

const TABLE_NAME = "cancellation_app_payments";

/* ===============================
   CREATE PAYMENT ENTRY
   =============================== */
const createPaymentEntry = async ({
  amount,
  customer,
  cancellation_id,
  payment,
}) => {
  const paymentId = uuidv4();
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const paymentItem = {
    _id: paymentId, // PK
    cancellation_id: cancellation_id,
    amount,
    customer,
    payment,
    createdAt: istDate.toISOString(),
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
    const payments = response.Items || [];

    // 🔥 Newest first
    payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return payments;
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

const deletePaymentByCancellationId = async (cancellationId) => {
  try {
    /* 1️⃣ Find the payment */
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: "cancellation_id = :cid",
      ExpressionAttributeValues: {
        ":cid": cancellationId,
      },
    };

    const scanResult = await dynamoDB.send(new ScanCommand(scanParams));
    const payments = scanResult.Items || [];

    if (payments.length === 0) {
      throw new Error("Payment not found for this cancellation ID");
    }

    if (payments.length > 1) {
      throw new Error(
        `Data integrity error: Multiple payments found for cancellation ${cancellationId}`
      );
    }

    const payment = payments[0];

    /* 2️⃣ Delete it */
    const deleteParams = {
      TableName: TABLE_NAME,
      Key: {
        _id: payment._id,
      },
      ConditionExpression: "attribute_exists(#id)",
      ExpressionAttributeNames: {
        "#id": "_id",
      },
      ReturnValues: "ALL_OLD",
    };

    const result = await dynamoDB.send(new DeleteCommand(deleteParams));

    return {
      message: "Payment deleted successfully",
      deletedPayment: result.Attributes,
    };
  } catch (err) {
    throw new Error(`Delete Payment By Cancellation Error: ${err.message}`);
  }
};

const getLast30DaysPaymentsSummary = async () => {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const result = await dynamoDB.send(command);
    const payments = result.Items || [];

    /* ================================
       Prepare date helpers
    ================================= */

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 29); // last 30 days incl today

    /* ================================
       Create base map with 0 values
    ================================= */

    const dateMap = {};

    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD

      dateMap[key] = {
        price: 0,
        day: d.getDate(),
        month: d.toLocaleString("en-IN", { month: "short" }),
      };
    }

    /* ================================
       Aggregate payments
    ================================= */

    for (const payment of payments) {
      if (!payment.createdAt || !payment.amount) continue;

      const paymentDate = new Date(payment.createdAt);
      paymentDate.setHours(0, 0, 0, 0);

      if (paymentDate >= startDate && paymentDate <= today) {
        const key = paymentDate.toISOString().split("T")[0];
        dateMap[key].price += Number(payment.amount);
      }
    }

    /* ================================
       Convert to array (sorted)
    ================================= */

    const response = Object.keys(dateMap)
      .sort()
      .map((key) => dateMap[key]);

    return response;
  } catch (err) {
    throw new Error(`DynamoDB 30 Days Payment Summary Error: ${err.message}`);
  }
};

/* ===============================
   EXPORTS
   =============================== */
module.exports = {
  createPaymentEntry,
  deletePaymentByCancellationId,
  // READ APIs
  getLast30DaysPaymentsSummary,
  getAllPayments,
  getPaymentsByInvoiceId,
  getPaymentsByCancellationId,
  getPaymentsByCustomerPhone,
};
