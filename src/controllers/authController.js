const userRepo = require("../repository/user.repo");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // 1. CHECK EMAIL UNIQUENESS
    // We must search by email here to ensure it doesn't already exist.
    const existingUser = await userRepo.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // 2. CREATE USER (Generates unique ID)
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userRepo.createUser({
      name,
      email,
      password: hashedPassword,
      role: "user",
    });

    const userResponse = { ...newUser };
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully",
      token: generateToken(newUser._id, newUser.role),
      user: userResponse,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.registerAdmin = async (req, res) => {
  try {
    const { email, password, adminToken } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Fields required" });
    if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Invalid admin token" });
    }

    // 1. CHECK EMAIL UNIQUENESS
    const existingUser = await userRepo.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Admin with this email already exists" });
    }

    // 2. CREATE ADMIN
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userRepo.createUser({
      email,
      password: hashedPassword,
      role: "admin",
    });

    const userResponse = { ...newUser };
    delete userResponse.password;

    res.status(201).json({
      message: "Admin registered successfully",
      token: generateToken(newUser._id, newUser.role),
      user: userResponse,
    });
  } catch (err) {
    console.error("Admin Register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    // LOGIN REMAINS BY ID
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await userRepo.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      message: "Logged in",
      token: generateToken(user._id, user.role),
      user: userResponse,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.validateToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
      });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
        });
      }

      return res.status(200).json({
        success: true,
      });
    });
  } catch (err) {
    console.error("Token validation error:", err);

    res.status(500).json({
      success: false,
    });
  }
};
