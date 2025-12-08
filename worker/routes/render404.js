import express from 'express';

const router = express.Router();

router.use((req, res) => {
  res
    .status(200)
    .set({ 'Content-Type': 'text/html', 'Cache-Control': 'max-age=604800' })
    .send('Not Found');
});

export default router;
