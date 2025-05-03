import { Router } from 'express';
const router = Router();

// Define your routes
router.get('/', (req, res) => {
  res.send('campaigns route');
});

export default router;
