const router = require("express").Router();
const {
  getAnalytics,
  getAnalyticsSummary,
} = require("../controllers/analyticsController");

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/stats", auth, authorizeRoles("admin"), getAnalytics);
router.get("/summary", auth, authorizeRoles("admin"), getAnalyticsSummary);

module.exports = router;
