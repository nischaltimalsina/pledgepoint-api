import { Router } from 'express';
const router = Router();

// Define your routes
router.get('/', (req, res) => {
  res.send('officials route');
});

export default router;
