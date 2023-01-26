const express = require('express');
const controllers = require('../controllers/index.cjs');

const router = express.Router();

router.route('/').get(controllers.getIndexPage);
router.route('/stamped').get(controllers.stampImage);
router.route('/proxy').get(controllers.getProxy);
router.route('/send').post(controllers.makeScreenShot);
router.route('/adapter_response.json').get(controllers.getAdapterResponseJSON);

module.exports = router;
