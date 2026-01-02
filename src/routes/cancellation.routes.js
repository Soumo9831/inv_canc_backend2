const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  createCancellationFromInvoice,
  getAllCancellationCheques,
  addRefundAmount,
  getCancellationVersionsByInvoiceId,
  getLatestCancellationByInvoiceId,
  getLatestCancellationsForAllInvoices,
  getCancellationById,              // 🔥 NEW
  deleteCancellationById,
  deleteLatestCancellationByInvoiceId,
} = require("../controllers/cancellation.controller");

/**
 * @route   POST /api/cancellation/:invoiceId
 * @desc    Fetch single invoice from JSON & store cancellation entry in DynamoDB
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.post(
  "/:invoiceId",
  authMiddleware,
  createCancellationFromInvoice
);

/**
 * @route   GET /api/cancellation
 * @desc    Fetch all cancellation cheques
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.get(
  "/",
  authMiddleware,
  getAllCancellationCheques
);

/**
 * @route   POST /api/cancellation/add-amount/:invoiceId
 * @desc    Add refund amount & create next version of cancellation voucher
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.post(
  "/add-amount/:invoiceId",
  authMiddleware,
  addRefundAmount
);

/**
 * @route   GET /api/cancellation/by-invoice/:invoiceId
 * @desc    Fetch all versions of cancellation vouchers for a single invoice
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.get(
  "/by-invoice/:invoiceId",
  authMiddleware,
  getCancellationVersionsByInvoiceId
);

/**
 * @route   GET /api/cancellation/by-id/:cancellationId
 * @desc    Fetch a single cancellation voucher by cancellation ID
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.get(
  "/by-id/:cancellationId",
  authMiddleware,
  getCancellationById
);

/**
 * @route   GET /api/cancellation/latest-all
 * @desc    Fetch latest cancellation voucher for EACH invoice
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.get(
  "/latest-all",
  authMiddleware,
  getLatestCancellationsForAllInvoices
);

/**
 * @route   GET /api/cancellation/latest/:invoiceId
 * @desc    Fetch latest (highest version) cancellation voucher of an invoice
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.get(
  "/latest/:invoiceId",
  authMiddleware,
  getLatestCancellationByInvoiceId
);

/**
 * @route   DELETE /api/cancellation/latest/:invoiceId
 * @desc    Delete latest (highest version) cancellation voucher of an invoice
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.delete(
  "/latest/:invoiceId",
  authMiddleware,
  deleteLatestCancellationByInvoiceId
);

/**
 * @route   DELETE /api/cancellation/:cancellationId
 * @desc    Hard delete a cancellation voucher by cancellation ID
 * @access  Private (Any logged-in user: admin or non-admin)
 */
router.delete(
  "/:cancellationId",
  authMiddleware,
  deleteCancellationById
);

module.exports = router;
