import { Router } from 'express';
import { getIndexPage, getScreenShot, adapterResponse } from '../controllers';

const router = Router();

router.route('/').get(getIndexPage);
router.route('/previewData').get(getScreenShot);
router.route('/adapter_response.json').post(adapterResponse);

export default router;
