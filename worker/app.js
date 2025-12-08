import express from 'express';
import cors from 'cors'
import render404 from './routes/render404.js'
import getSignedUrlRouter from './routes/getSignedUrl.js'

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors())

app.use('/api', getSignedUrlRouter)

// at last render 404 page
app.use(render404);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});