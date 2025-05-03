import { Router } from 'express';
import auth from './auth';
import users from './users';
import officials from './officials';
import promises from './promises';
import campaigns from './campaigns';
import learning from './learning';
import ratings from './ratings';
import badges from './badges';
import districts from './districts';
import admin from './admin';

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
