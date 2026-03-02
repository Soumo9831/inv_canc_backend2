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
const getLatestInvoicesBySearch = async (req, res) => {
  try {
    const { q } = req.query; // ?q=98345 or ?q=Rakesh or ?q=ABCDE1234F

    if (!q || String(q).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required (phone, name or PAN)",
      });
    }

    const invoices = await InvoiceRepo.smartSearchLatestActiveInvoices(q);

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Smart invoice search error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to search invoices",
    });
  }
};

module.exports = {
  getLatestInvoicesForPhone,
  getLatestInvoicesBySearch,
};
