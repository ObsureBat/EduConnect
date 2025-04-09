import { LexRuntimeV2Client, RecognizeTextCommand } from '@aws-sdk/client-lex-runtime-v2';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Get environment variables
const AWS_REGION = process.env.VITE_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.VITE_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.VITE_AWS_SECRET_ACCESS_KEY || '';
const AWS_LEX_BOT_ID = process.env.VITE_AWS_LEX_BOT_ID || '';
const AWS_LEX_BOT_ALIAS_ID = process.env.VITE_AWS_LEX_BOT_ALIAS_ID || '';

async function verifyLexBot() {
  if (!AWS_LEX_BOT_ID || !AWS_LEX_BOT_ALIAS_ID) {
    console.error('Lex bot IDs are not configured properly in .env file');
    console.log('VITE_AWS_LEX_BOT_ID:', AWS_LEX_BOT_ID);
    console.log('VITE_AWS_LEX_BOT_ALIAS_ID:', AWS_LEX_BOT_ALIAS_ID);
    return;
  }

  console.log('Verifying Lex bot configuration...');
  console.log('Bot ID:', AWS_LEX_BOT_ID);
  console.log('Bot Alias ID:', AWS_LEX_BOT_ALIAS_ID);
  console.log('AWS Region:', AWS_REGION);
  
  const lexClient = new LexRuntimeV2Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    // Instead of checking the bot configuration directly, we'll send a simple test message
    // to verify the bot is working
    const command = new RecognizeTextCommand({
      botId: AWS_LEX_BOT_ID,
      botAliasId: AWS_LEX_BOT_ALIAS_ID,
      localeId: 'en_US',
      sessionId: `test-${Date.now()}`,
      text: 'Hello'
    });

    console.log('Sending test message to Lex bot...');
    const response = await lexClient.send(command);
    console.log('Bot response:', JSON.stringify(response, null, 2));
    console.log('Lex bot is working properly!');
  } catch (error) {
    console.error('Error verifying Lex bot:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
  }
}

// Run the function
verifyLexBot().catch(console.error); 