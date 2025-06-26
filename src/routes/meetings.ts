import express from 'express';
import { createMeeting, joinMeeting } from '../services/chimeService';

const router = express.Router();

router.post('/create', async (req, res) => {
  try {
    const { userName } = req.body;
    const result = await createMeeting(userName);
    res.json(result);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { meetingId, userName } = req.body;
    const result = await joinMeeting(meetingId, userName);
    res.json(result);
  } catch (error) {
    console.error('Error joining meeting:', error);
    res.status(500).json({ error: 'Failed to join meeting' });
  }
});

export default router; 