import {
  TranslateClient,
  TranslateTextCommand
} from '@aws-sdk/client-translate';

import { browserEnv } from '../config/browser-env';

// Initialize the Translate client
const translateClient = new TranslateClient({
  region: browserEnv.VITE_AWS_REGION,
  credentials: {
    accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Language codes and names mapping
export const languages = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ar: 'Arabic',
  cs: 'Czech',
  nl: 'Dutch',
  hi: 'Hindi',
  ru: 'Russian'
};

/**
 * Translate text from one language to another
 * @param text The text to translate
 * @param targetLanguage The target language code
 * @param sourceLanguage The source language code (optional, auto-detect if not specified)
 * @returns Translated text
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> {
  try {
    const command = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLanguage || 'auto',
      TargetLanguageCode: targetLanguage
    });

    const response = await translateClient.send(command);
    return response.TranslatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
}

/**
 * Detect the language of a text using Amazon Translate
 * @param text The text to detect the language of
 * @returns Promise with the detected language code
 */
export async function detectLanguage(text: string): Promise<string> {
  try {
    // Amazon Translate doesn't have a dedicated language detection API
    // We can use a workaround by translating to a language and checking the source
    const command = new TranslateTextCommand({
      Text: text.substring(0, 100), // Limit text length
      SourceLanguageCode: 'auto',
      TargetLanguageCode: 'en' // Target doesn't matter for detection
    });

    const response = await translateClient.send(command);
    return response.SourceLanguageCode || 'en';
  } catch (error) {
    console.error('Language detection error:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Helper function to get the language name from a language code
 * @param languageCode ISO language code
 * @returns The human-readable language name or the code if not found
 */
export function getLanguageName(languageCode: string): string {
  return languages[languageCode as keyof typeof languages] || languageCode;
}

export const LanguageService = {
  translateText,
  detectLanguage,
  getLanguageName,
  languages
};

export default LanguageService; 