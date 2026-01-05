const {
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const uuidv4 = () => randomUUID();
const { dynamoDB } = require("../config/dynamo"); // Ensure this matches your config export

const TABLE_NAME = "cancellation_app_users"; // Ensure this matches your AWS Table Name

// 1. FIND BY ID (Fast - For Login)
// Uses Primary Key Lookup
const findUserById = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { _id: id },
  };
  try {
    const command = new GetCommand(params);
    const response = await dynamoDB.send(command);
    return response.Item;
  } catch (err) {
    throw new Error(`DynamoDB FindById Error: ${err.message}`);
  }
};

// 2. FIND BY EMAIL (For Registration Checks)
// Uses Scan (Slower) - Recommended: Add GSI on 'email' for production
const findUserByEmail = async (email) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: { ":email": email },
  };
  try {
    const command = new ScanCommand(params);
    const response = await dynamoDB.send(command);
    return response.Items[0];
  } catch (err) {
    throw new Error(`DynamoDB FindByEmail Error: ${err.message}`);
  }
};

// 3. CREATE USER
// Handles strict uniqueness check on _id using alias
const createUser = async (userData) => {
  const newId = uuidv4();
  const newUser = {
    _id: newId,
    createdAt: new Date().toISOString(),
    ...userData,
  };

  const params = {
    TableName: TABLE_NAME,
    Item: newUser,
    // "attribute_not_exists" ensures we don't overwrite an ID.
    // We use #id alias because _id contains special char in some contexts
    ConditionExpression: "attribute_not_exists(#id)",
    ExpressionAttributeNames: {
      "#id": "_id",
    },
  };

  try {
    const command = new PutCommand(params);
    await dynamoDB.send(command);
    return newUser;
  } catch (err) {
    throw new Error(`DynamoDB Create Error: ${err.message}`);
  }
};

// 4. GET ALL NON-ADMIN USERS
// Filters out anyone with role 'admin'
const getAllNonAdminUsers = async () => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "#r <> :adminRole",
    ExpressionAttributeNames: {
      "#r": "role", // "role" is a reserved word, must alias
    },
    ExpressionAttributeValues: {
      ":adminRole": "admin",
    },
  };

  try {
    const command = new ScanCommand(params);
    const response = await dynamoDB.send(command);

    // Remove passwords from the result
    const users = response.Items.map((user) => {
      const { password, ...cleanUser } = user;
      return cleanUser;
    });

    return users;
  } catch (err) {
    throw new Error(`DynamoDB Scan Error: ${err.message}`);
  }
};

// 5. DELETE USER (With Email Verification)
// Only deletes if _id matches AND email matches
const deleteUserByIdAndEmail = async (id, email) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { _id: id },
    ConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": email,
    },
  };

  try {
    const command = new DeleteCommand(params);
    await dynamoDB.send(command);
    return true;
  } catch (err) {
    // If condition fails (email wrong or user doesn't exist)
    if (err.name === "ConditionalCheckFailedException") {
      return false;
    }
    throw new Error(`DynamoDB Delete Error: ${err.message}`);
  }
};

module.exports = {
  findUserById,
  findUserByEmail,
  createUser,
  getAllNonAdminUsers,
  deleteUserByIdAndEmail,
};
