const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAllPayments,
  getPaymentsByInvoiceId,
  getPaymentsByCancellationId,
  getPaymentsByCustomerPhone,
} = require("../controllers/payments.controller");

/**
 * @route   GET /api/v1/payments
 * @desc    Fetch all payment history
 * @access  Private (Admin only)
 */
router.get(
  "/",
  authMiddleware,
  authorizeRoles("admin"),
  getAllPayments
);

/**
 * @route   GET /api/v1/payments/by-invoice/:invoiceId
 * @desc    Fetch payment history by invoice ID
 * @access  Private (Admin only)
 */
router.get(
  "/by-invoice/:invoiceId",
  authMiddleware,
  authorizeRoles("admin"),
  getPaymentsByInvoiceId
);

/**
 * @route   GET /api/v1/payments/by-cancellation/:cancellationId
 * @desc    Fetch payment history by cancellation ID
 * @access  Private (Admin only)
 */
router.get(
  "/by-cancellation/:cancellationId",
  authMiddleware,
  authorizeRoles("admin"),
  getPaymentsByCancellationId
);

/**
 * @route   GET /api/v1/payments/by-customer/:phone
 * @desc    Fetch payment history by customer phone
 * @access  Private (Admin only)
 */
router.get(
  "/by-customer/:phone",
  authMiddleware,
  authorizeRoles("admin"),
  getPaymentsByCustomerPhone
);

module.exports = router;
