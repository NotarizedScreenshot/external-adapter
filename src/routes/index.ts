import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.route("/").get(controllers.getIndexPage);
router.route("/stamped").get(controllers.getStampedImage);
router.route("/meta").get(controllers.getMeta);
router.route("/proxy").get(controllers.getProxy);
router.route("/send").post(controllers.getScreenShot);
router.route("/adapter_response.json").get(controllers.getAdapterResponseJSON);

export default router;
