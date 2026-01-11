const router = require("express").Router();
const {
  register,
  registerAdmin,
  login,
  validateToken,
} = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.post("/admin/register", registerAdmin);
router.post("/register", auth, authorizeRoles("admin"), register);
router.post("/login", login);
router.post("/validate", validateToken);

module.exports = router;
