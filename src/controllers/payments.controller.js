const paymentsRepo = require("../repository/payments.repo");

/* ================= GET ALL PAYMENTS ================= */

/**
 * @desc   Get all payment history
 * @route  GET /api/v1/payments
 * @access Private (JWT required | admin & non-admin)
 */
const getAllPayments = async (req, res) => {
  try {
    const payments = await paymentsRepo.getAllPayments();

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (err) {
    console.error("Get All Payments Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET PAYMENTS BY INVOICE ================= */

/**
 * @desc   Get payment history by invoice ID
 * @route  GET /api/v1/payments/by-invoice/:invoiceId
 * @access Private (JWT required | admin & non-admin)
 */
const getPaymentsByInvoiceId = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const payments =
      await paymentsRepo.getPaymentsByInvoiceId(invoiceId);

    return res.status(200).json({
      success: true,
      count: payments.length,
      inv_id: invoiceId,
      data: payments,
    });
  } catch (err) {
    console.error("Get Payments By Invoice Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET PAYMENTS BY CANCELLATION ================= */

/**
 * @desc   Get payment history by cancellation ID
 * @route  GET /api/v1/payments/by-cancellation/:cancellationId
 * @access Private (JWT required | admin & non-admin)
 */
const getPaymentsByCancellationId = async (req, res) => {
  try {
    const { cancellationId } = req.params;

    if (!cancellationId) {
      return res.status(400).json({
        success: false,
        message: "Cancellation ID is required",
      });
    }

    const payments =
      await paymentsRepo.getPaymentsByCancellationId(cancellationId);

    return res.status(200).json({
      success: true,
      count: payments.length,
      cancellation_id: cancellationId,
      data: payments,
    });
  } catch (err) {
    console.error("Get Payments By Cancellation Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET PAYMENTS BY CUSTOMER ================= */

/**
 * @desc   Get payment history by customer phone
 * @route  GET /api/v1/payments/by-customer/:phone
 * @access Private (JWT required | admin & non-admin)
 */
const getPaymentsByCustomerPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required",
      });
    }

    const payments =
      await paymentsRepo.getPaymentsByCustomerPhone(phone);

    return res.status(200).json({
      success: true,
      count: payments.length,
      phone,
      data: payments,
    });
  } catch (err) {
    console.error("Get Payments By Customer Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= EXPORTS ================= */

module.exports = {
  getAllPayments,
  getPaymentsByInvoiceId,
  getPaymentsByCancellationId,
  getPaymentsByCustomerPhone,
};
