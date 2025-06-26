import express from 'express';
import cors from 'cors';
import meetingsRouter from './routes/meetings';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/meetings', meetingsRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 