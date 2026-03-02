// const dotenv = require("dotenv");
// const express = require("express");
// const serverless = require("serverless-http");

// dotenv.config();

// const app = require("./src/app");

// const handler = serverless(app);

// console.log("✅ AWS DynamoDB configuration loaded.");

// // Export the Lambda handler
// module.exports.handler = handler;

const dotenv = require("dotenv");
// const connectDB = require("./src/config/db"); // DELETE THIS LINE
const app = require("./src/app");
const express = require("express");

app.use(express.json());

async function startServer() {
  dotenv.config();

  // DELETE THESE LINES:
  // console.log("Pinging database...");
  // await connectDB();

  // DynamoDB connects automatically using the credentials in your .env file
  // whenever you make a request in your repo files.
  console.log("✅ AWS DynamoDB configuration loaded.");

  //const PORT = process.env.PORT || 5000;

  const PORT = 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
