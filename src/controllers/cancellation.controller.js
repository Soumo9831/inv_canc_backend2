const cancellationRepo = require("../repository/cancellation.repo");

/* ================= EXISTING CODE (UNCHANGED) ================= */

const createCancellationFromInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const result =
      await cancellationRepo.fetchInvoiceAndStoreCancellation(invoiceId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Cancellation entry created successfully",
      data: result,
    });
  } catch (err) {
    console.error("Cancellation Controller Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllCancellationCheques = async (req, res) => {
  try {
    const cancellations = await cancellationRepo.getAllCancellations();

    return res.status(200).json({
      success: true,
      count: cancellations.length,
      data: cancellations,
    });
  } catch (err) {
    console.error("Get All Cancellations Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= AMOUNT ADDITION ================= */

const addRefundAmount = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amountToAdd } = req.body;

    if (!invoiceId || !amountToAdd) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID and amountToAdd are required",
      });
    }

    if (amountToAdd <= 0) {
      return res.status(400).json({
        success: false,
        message: "Refund amount must be greater than zero",
      });
    }

    const latestVoucher =
      await cancellationRepo.getLatestCancellationByInvoiceId(invoiceId);

    if (!latestVoucher) {
      return res.status(404).json({
        success: false,
        message: "No cancellation voucher exists for this invoice",
      });
    }

    if (latestVoucher.status === true) {
      return res.status(400).json({
        success: false,
        message: "Refund has already been fully settled",
      });
    }

    if (amountToAdd > latestVoucher.yetTB_returned) {
      return res.status(400).json({
        success: false,
        message: "Refund amount exceeds pending refundable balance",
      });
    }

    const newVoucher =
      await cancellationRepo.createNextVersionCancellation(
        latestVoucher,
        amountToAdd
      );

    return res.status(201).json({
      success: true,
      message: "Refund amount added successfully",
      data: newVoucher,
    });
  } catch (err) {
    console.error("Add Refund Amount Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET BY INVOICE ================= */

const getCancellationVersionsByInvoiceId = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const vouchers =
      await cancellationRepo.getCancellationsByInvoiceId(invoiceId);

    if (!vouchers || vouchers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No cancellation vouchers found for this invoice",
      });
    }

    return res.status(200).json({
      success: true,
      inv_id: invoiceId,
      count: vouchers.length,
      data: vouchers,
    });
  } catch (err) {
    console.error("Get Cancellation Versions Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET LATEST VERSION ================= */

const getLatestCancellationByInvoiceId = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const latestVoucher =
      await cancellationRepo.getLatestCancellationByInvoiceId(invoiceId);

    if (!latestVoucher) {
      return res.status(404).json({
        success: false,
        message: "No cancellation vouchers found for this invoice",
      });
    }

    return res.status(200).json({
      success: true,
      inv_id: invoiceId,
      data: latestVoucher,
    });
  } catch (err) {
    console.error("Get Latest Cancellation Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= DELETE BY CANCELLATION ID ================= */

const deleteCancellationById = async (req, res) => {
  try {
    const { cancellationId } = req.params;

    if (!cancellationId) {
      return res.status(400).json({
        success: false,
        message: "Cancellation ID is required",
      });
    }

    const deleted =
      await cancellationRepo.deleteCancellationById(cancellationId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Cancellation voucher not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cancellation voucher deleted successfully",
    });
  } catch (err) {
    console.error("Delete Cancellation Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= DELETE LATEST BY INVOICE ================= */

const deleteLatestCancellationByInvoiceId = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const latestVoucher =
      await cancellationRepo.getLatestCancellationByInvoiceId(invoiceId);

    if (!latestVoucher) {
      return res.status(404).json({
        success: false,
        message: "No cancellation voucher exists for this invoice",
      });
    }

    await cancellationRepo.deleteCancellationById(latestVoucher._id);

    return res.status(200).json({
      success: true,
      message: "Latest cancellation voucher deleted successfully",
      deletedVersion: latestVoucher.version,
      cancellationId: latestVoucher._id,
    });
  } catch (err) {
    console.error("Delete Latest Cancellation Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= 🔥 NEW FEATURE: GET LATEST FOR ALL INVOICES ================= */

/**
 * @desc   Get latest (highest version) cancellation voucher for each invoice
 * @route  GET /api/cancellation/latest-all
 * @access Private (JWT required | admin & non-admin)
 */
const getLatestCancellationsForAllInvoices = async (req, res) => {
  try {
    const cancellations = await cancellationRepo.getAllCancellations();

    if (!cancellations || cancellations.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const latestMap = {};

    for (const voucher of cancellations) {
      const invId = voucher.inv_id;

      if (
        !latestMap[invId] ||
        voucher.version > latestMap[invId].version
      ) {
        latestMap[invId] = voucher;
      }
    }

    const latestVouchers = Object.values(latestMap);

    return res.status(200).json({
      success: true,
      count: latestVouchers.length,
      data: latestVouchers,
    });
  } catch (err) {
    console.error("Get Latest Cancellations For All Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= EXPORTS ================= */

module.exports = {
  createCancellationFromInvoice,
  getAllCancellationCheques,
  addRefundAmount,
  getCancellationVersionsByInvoiceId,
  getLatestCancellationByInvoiceId,

  deleteCancellationById,
  deleteLatestCancellationByInvoiceId,

  // 🔥 NEW EXPORT
  getLatestCancellationsForAllInvoices,
};
