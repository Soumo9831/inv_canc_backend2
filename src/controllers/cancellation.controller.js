const cancellationRepo = require("../repository/cancellation.repo");
const paymentsRepo = require("../repository/payments.repo");
const userRepo = require("../repository/user.repo");

/* ================= EXISTING CODE (UNCHANGED) ================= */

const createCancellationFromInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const {
      cancellation_charge,
      net_return,
      already_returned,
      yetTB_returned,
      payment,
    } = req.body;
    const { userId, role } = req.user;

    let executiveName = "System";

    if (role === "user") {
      const user = await userRepo.findUserById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      executiveName = user.name;
    }

    // 🔒 Basic validation
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    if (
      cancellation_charge === undefined ||
      net_return === undefined ||
      already_returned === undefined ||
      yetTB_returned === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "cancellation_charge, net_return, already_returned and yetTB_returned are required",
      });
    }

    // 1️⃣ Create cancellation entry from invoice
    const result = await cancellationRepo.fetchInvoiceAndStoreCancellation({
      invoiceId,
      cancellation_charge,
      net_return,
      already_returned,
      yetTB_returned,
      payment,
      executiveName,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // 2️⃣ Auto-record returned money
    if (Number(already_returned) > 0) {
      await paymentsRepo.createPaymentEntry({
        cancellation_id: result._id,
        amount: Number(already_returned),
        customer: result.customer,
        payment,
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
      message: err.message || "Internal server error",
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
    const { amountToAdd, payment } = req.body;

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

    // if (latestVoucher.status === true) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Refund has already been fully settled",
    //   });
    // }

    if (amountToAdd > latestVoucher.yetTB_returned) {
      return res.status(400).json({
        success: false,
        message: "Refund amount exceeds pending refundable balance",
      });
    }

    const newVoucher = await cancellationRepo.createNextVersionCancellation(
      latestVoucher,
      amountToAdd,
      payment
    );

    /* 🔥 PAYMENT ENTRY ON NEW VERSION CREATION */
    await paymentsRepo.createPaymentEntry({
      cancellation_id: newVoucher._id,
      amount: amountToAdd,
      customer: newVoucher.customer,
      payment,
    });

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
      await cancellationRepo.getCancellationsByInvoiceIdExceptLatest(invoiceId);

    // if (!vouchers || vouchers.length === 0) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "No cancellation vouchers found for this invoice",
    //   });
    // }

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

    const deleted = await cancellationRepo.deleteCancellationById(
      cancellationId
    );

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
    await paymentsRepo.deletePaymentByCancellationId(latestVoucher._id);

    return res.status(200).json({
      success: true,
      message: "Latest cancellation voucher deleted successfully",
    });
  } catch (err) {
    console.error("Delete Latest Cancellation Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET LATEST FOR ALL INVOICES ================= */

const getLatestCancellationsForAllInvoices = async (req, res) => {
  try {
    const cancellations = await cancellationRepo.getAllCancellations();

    const latestMap = {};

    for (const voucher of cancellations) {
      const invId = voucher.inv_id;
      if (!latestMap[invId] || voucher.version > latestMap[invId].version) {
        latestMap[invId] = voucher;
      }
    }

    return res.status(200).json({
      success: true,
      count: Object.keys(latestMap).length,
      data: Object.values(latestMap),
    });
  } catch (err) {
    console.error("Get Latest Cancellations For All Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= GET BY CANCELLATION ID ================= */

/**
 * @desc   Get a single cancellation voucher by cancellation ID
 * @route  GET /api/cancellation/by-id/:cancellationId
 * @access Private (JWT required | admin & non-admin)
 */
const getCancellationById = async (req, res) => {
  try {
    const { cancellationId } = req.params;

    if (!cancellationId) {
      return res.status(400).json({
        success: false,
        message: "Cancellation ID is required",
      });
    }

    const cancellations = await cancellationRepo.getAllCancellations();

    const voucher = cancellations.find((item) => item._id === cancellationId);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Cancellation voucher not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: voucher,
    });
  } catch (err) {
    console.error("Get Cancellation By ID Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getMyVoucher = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    if (role !== "user") {
      return res.status(403).json({ message: "Only executives allowed" });
    }

    const user = await userRepo.findUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const cancellations =
      await cancellationRepo.getCancellationsByExecutiveName(user.name);

    res.status(200).json({
      success: true,
      count: cancellations.length,
      data: cancellations,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
  getLatestCancellationsForAllInvoices,
  getCancellationById,
  getMyVoucher,
};
