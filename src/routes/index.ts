import { Router } from 'express';
import controllers, { getIndexPage } from '../controllers';

const router = Router();

router.route('/').get(getIndexPage);
router.route('/stamped').get(controllers.getStampedImage);
router.route('/tweetData').get(controllers.getTweetData);
router.route('/metaData').get(controllers.getMetaData);
router.route("/send").post(controllers.getScreenShot);
router.route("/adapter_response.json").post(controllers.adapterResponseJSON);

export default router;
