const InvoiceRepo = require("../repository/invoice.repo");

const getLatestInvoicesForPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const invoices = await InvoiceRepo.getLatestInvoicesByPhone(phone);

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Get invoices by phone error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getLatestInvoicesForPhone,
};
