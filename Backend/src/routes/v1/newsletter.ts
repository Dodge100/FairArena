import { Router } from 'express';
import { subscribeToNewsletter } from '../../controllers/v1/newsletterController.js';

const router = Router();

router.post('/subscribe', subscribeToNewsletter);

export default router;
