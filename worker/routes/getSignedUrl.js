import express from 'express';
import { supabase } from '../lib/supabase.js'

const router = express.Router();

async function handler(req, res) {
  const { uploadId, chunkIndex, fileName } = req.body;
  const chunkPath = `temp/${uploadId}/${chunkIndex}-${fileName}`;


  const { data, error } = await supabase.storage
    .from('audio-temp')
    .createSignedUploadUrl(chunkPath, { expiresIn: 60 * 10 }); // 10 min

  if (error) return res.status(500).json({ error });
  return res.json({ signedUrl: data.signedUrl });
}

router.post('/getSignedUrl', handler)

export default router