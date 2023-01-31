import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.route("/").get(controllers.getIndexPage);
router.route("/stamped").get(controllers.getStampedImage);
router.route("/storedData").get(controllers.getStoredData);
router.route("/send").post(controllers.getScreenShot);

export default router;
