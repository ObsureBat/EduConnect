import { useState, ChangeEvent, FormEvent } from 'react';
import { LanguageService, languages } from '../utils/language-services';
import { Loader, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const TranslationDemo = () => {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const handleSourceTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setSourceText(e.target.value);
    setDetectedLanguage(null);
  };

  const handleSourceLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSourceLanguage(e.target.value);
  };

  const handleTargetLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setTargetLanguage(e.target.value);
  };

  const handleDetectLanguage = async () => {
    if (!sourceText.trim()) {
      toast.error('Please enter text to detect language');
      return;
    }

    try {
      setIsDetecting(true);
      const language = await LanguageService.detectLanguage(sourceText);
      setDetectedLanguage(language);
      setSourceLanguage(language);
      toast.success(`Detected language: ${LanguageService.getLanguageName(language)}`);
    } catch (error) {
      console.error('Error detecting language:', error);
      toast.error('Failed to detect language');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleTranslate = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!sourceText.trim()) {
      toast.error('Please enter text to translate');
      return;
    }

    try {
      setIsTranslating(true);
      
      const sourceLang = sourceLanguage === 'auto' 
        ? (detectedLanguage || await LanguageService.detectLanguage(sourceText)) 
        : sourceLanguage;
      
      const translated = await LanguageService.translateText(
        sourceText,
        targetLanguage,
        sourceLang === 'auto' ? undefined : sourceLang
      );
      
      setTranslatedText(translated);
      toast.success('Translation completed');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Failed to translate text');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = () => {
    if (!translatedText) return;
    
    navigator.clipboard.writeText(translatedText)
      .then(() => toast.success('Copied to clipboard'))
      .catch(err => {
        console.error('Failed to copy:', err);
        toast.error('Failed to copy to clipboard');
      });
  };

  const swapLanguages = () => {
    if (sourceLanguage === 'auto') {
      toast.error("Can't swap when source language is set to 'Auto Detect'");
      return;
    }
    
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">EduConnect Translation Service</h1>
      <p className="mb-6 text-gray-600">
        This demo uses Amazon Translate to translate text between different languages.
        Enter your text, select source and target languages, then click Translate.
      </p>

      <form onSubmit={handleTranslate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Text Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Source Text</label>
              <button
                type="button"
                onClick={handleDetectLanguage}
                disabled={isDetecting || !sourceText.trim()}
                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400 flex items-center"
              >
                {isDetecting ? (
                  <>
                    <Loader className="animate-spin w-4 h-4 mr-1" />
                    Detecting...
                  </>
                ) : (
                  'Detect Language'
                )}
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={handleSourceTextChange}
              rows={6}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter text to translate"
            ></textarea>
            <div className="flex justify-between items-center">
              <select
                value={sourceLanguage}
                onChange={handleSourceLanguageChange}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="auto">Auto Detect</option>
                {Object.entries(languages).map(([code, name]) => (
                  <option key={`source-${code}`} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              
              <button
                type="button"
                onClick={swapLanguages}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                title="Swap languages"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
              
              <select
                value={targetLanguage}
                onChange={handleTargetLanguageChange}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={`target-${code}`} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Translated Text Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Translated Text</label>
              <button
                type="button"
                onClick={copyToClipboard}
                disabled={!translatedText}
                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400"
              >
                Copy to clipboard
              </button>
            </div>
            <div className="relative">
              <textarea
                value={translatedText}
                readOnly
                rows={6}
                className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-50"
                placeholder="Translation will appear here"
              ></textarea>
              {isTranslating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
                  <Loader className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              {detectedLanguage && sourceLanguage === 'auto' && (
                <span className="text-sm text-gray-500 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  Detected: {LanguageService.getLanguageName(detectedLanguage)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isTranslating || !sourceText.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 flex items-center"
          >
            {isTranslating ? (
              <>
                <Loader className="animate-spin h-5 w-5 mr-2" />
                Translating...
              </>
            ) : (
              'Translate'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TranslationDemo; 