import { Router } from 'express';
import auth from './auth.routes'
import users from './users.routes'
import officials from './officials.routes'
import promises from './promises.routes'
import campaigns from './campaigns.routes'
import learning from './learning.routes'
import ratings from './ratings.routes'
import badges from './badges.routes'
import districts from './districts.routes'
import admin from './admin.routes'

const router = Router();

router.use('/auth', auth);
router.use('/users', users);
router.use('/officials', officials);
router.use('/promises', promises);
router.use('/campaigns', campaigns);
router.use('/learning', learning);
router.use('/ratings', ratings);
router.use('/badges', badges);
router.use('/districts', districts);
router.use('/admin', admin);

export default router;
