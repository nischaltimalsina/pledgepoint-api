import { Router } from 'express';
const router = Router();

// Define your routes
router.get('/', (req, res) => {
  res.send('ratings route');
});

export default router;
