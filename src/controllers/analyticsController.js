const cancellationRepo = require("../repository/cancellation.repo");
const paymentsRepo = require("../repository/payments.repo");

// GET /api/v1/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const analyticsData =
      await cancellationRepo.getCancellationDashboardStats();

    res.status(200).json({
      success: true,
      analytics: analyticsData,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/v1/analytics/summary
exports.getAnalyticsSummary = async (req, res) => {
  try {
    const last30DaysPayments =
      await paymentsRepo.getLast30DaysPaymentsSummary();

    res.status(200).json({
      success: true,
      analytics: {
        last30DaysPayments,
      },
    });
  } catch (err) {
    console.error("Analytics Controller Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: err.message,
    });
  }
};
