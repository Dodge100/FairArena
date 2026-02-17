import { Router } from 'express';
import { getHackathons } from '../../controllers/v1/hackathonController.js';

const router = Router();

router.get('/', getHackathons);

export default router;
