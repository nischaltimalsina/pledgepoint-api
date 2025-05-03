import { Router } from 'express';
const router = Router();

// Define your routes
router.get('/', (req, res) => {
  res.send('promises route');
});

export default router;
