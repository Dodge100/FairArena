import { Router } from 'express';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../../controllers/v1/newsletterController.js';

const router = Router();

router.post('/subscribe', subscribeToNewsletter);
router.post('/unsubscribe', unsubscribeFromNewsletter);

export default router;
