import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  CircularProgress,
  IconButton,
  Fab,
  Zoom,
  Tooltip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import { LexRuntimeV2Client, RecognizeTextCommand } from '@aws-sdk/client-lex-runtime-v2';
import { browserEnv } from '../config/browser-env';

// Define interface for chat messages
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  suggestedQuestions?: string[];
}

// Demo questions and answers for use when Lex bot is not configured
const DEMO_QA: Record<string, string> = {
  "how do i submit an assignment": "To submit an assignment, go to the Assignments page, select the assignment you want to submit, attach your file, and click the Submit button.",
  "when is the next live session": "The next live session is scheduled for Friday at 3:00 PM. You can join through the Live Sessions tab in your dashboard.",
  "how can i contact my instructor": "You can contact your instructor through the Messages section or by sending an email directly to their address available on the Course Information page.",
  "where can i find my grades": "Your grades are available in the Grades section of your dashboard. You can see individual assignment scores and your overall course grade there.",
  "how do i reset my password": "To reset your password, click on the 'Forgot Password' link on the login page, enter your email, and follow the instructions sent to your email.",
  "what courses are available": "We offer various courses including Programming, Data Science, Web Development, Mobile App Development, and Design. Check the Courses page for a complete listing.",
  "how do i enroll in a course": "To enroll in a course, go to the Courses page, select the course you're interested in, and click the Enroll button. Follow the payment instructions if it's a paid course.",
  "is there a mobile app": "Yes, we have a mobile app available for both iOS and Android. You can download it from the App Store or Google Play Store by searching for 'EduConnect'.",
  "default": "I'm sorry, I don't have information about that yet. Please try asking something else or contact support for more assistance."
};

// Suggested questions that can be shown to the user
const SUGGESTED_QUESTIONS = [
  "How do I submit an assignment?",
  "When is the next live session?",
  "How can I contact my instructor?",
  "Where can I find my grades?",
  "How do I reset my password?",
  "What courses are available?",
  "How do I enroll in a course?",
  "Is there a mobile app?"
];

export const AISupport: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBotConfigured, setIsBotConfigured] = useState(true);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize Lex client
  const lexClient = new LexRuntimeV2Client({
    region: browserEnv.VITE_AWS_REGION || '',
    credentials: {
      accessKeyId: browserEnv.VITE_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: browserEnv.VITE_AWS_SECRET_ACCESS_KEY || ''
    }
  });
  
  // Check if the Lex bot is properly configured
  useEffect(() => {
    const botId = browserEnv.VITE_AWS_LEX_BOT_ID;
    const botAliasId = browserEnv.VITE_AWS_LEX_BOT_ALIAS_ID;
    
    if (!botId || !botAliasId) {
      console.warn('Lex bot is not configured properly. Using demo mode.');
      setIsBotConfigured(false);
      setUseDemoMode(true);
    }
  }, []);
  
  // Add welcome message when component mounts
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      text: "Hello! I'm your AI learning assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
      suggestedQuestions: SUGGESTED_QUESTIONS
    };
    
    setMessages([welcomeMessage]);
  }, []);
  
  // Scroll to bottom of messages when messages change
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);
  
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Find the best matching demo response
  const findDemoResponse = (query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Direct match
    if (DEMO_QA[normalizedQuery]) {
      return DEMO_QA[normalizedQuery];
    }
    
    // Search for a partial match
    for (const [key, value] of Object.entries(DEMO_QA)) {
      if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
        return value;
      }
    }
    
    // Check for specific keywords
    const keywordMap: Record<string, string[]> = {
      'assignment': ['submit', 'assignment', 'upload', 'homework'],
      'live session': ['live', 'session', 'meeting', 'webinar', 'zoom', 'when'],
      'instructor': ['instructor', 'teacher', 'professor', 'contact', 'email'],
      'grades': ['grade', 'score', 'mark', 'result'],
      'password': ['password', 'reset', 'forgot', 'login', 'sign in'],
      'courses': ['course', 'class', 'subject', 'available', 'offering'],
      'enroll': ['enroll', 'register', 'sign up', 'join'],
      'app': ['app', 'mobile', 'phone', 'android', 'ios']
    };
    
    for (const [topic, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(keyword => normalizedQuery.includes(keyword))) {
        const key = Object.keys(DEMO_QA).find(k => k.includes(topic));
        if (key) {
          return DEMO_QA[key];
        }
      }
    }
    
    return DEMO_QA['default'];
  };
  
  // Send message to Lex and handle response
  const sendMessageToLex = async (text: string) => {
    setIsLoading(true);
    
    try {
      if (useDemoMode) {
        // Demo mode - simulate delay for realism
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const botResponse = findDemoResponse(text);
        
        const botMessage: ChatMessage = {
          id: Date.now().toString(),
          text: botResponse,
          sender: 'bot',
          timestamp: new Date(),
          suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3) // Show fewer suggestions after first response
        };
        
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Real Lex bot interaction
        const botId = browserEnv.VITE_AWS_LEX_BOT_ID;
        const botAliasId = browserEnv.VITE_AWS_LEX_BOT_ALIAS_ID;
        const localeId = 'en_US';
        
        const command = new RecognizeTextCommand({
          botId,
          botAliasId,
          localeId,
          sessionId: 'user-session-' + Date.now().toString(),
          text
        });
        
        const response = await lexClient.send(command);
        
        let botResponse = "I'm not sure how to respond to that. Can you try rephrasing your question?";
        let suggestedFollowUps: string[] = [];
        
        if (response.messages && response.messages.length > 0) {
          botResponse = response.messages.map(msg => msg.content).join(' ');
          
          // If we want to include suggested follow-up questions from the Lex bot
          if (response.sessionState?.dialogAction?.slotToElicit) {
            suggestedFollowUps = [
              "Tell me more about " + response.sessionState.dialogAction.slotToElicit,
              "What else can you help with?"
            ];
          }
        }
        
        const botMessage: ChatMessage = {
          id: Date.now().toString(),
          text: botResponse,
          sender: 'bot',
          timestamp: new Date(),
          suggestedQuestions: suggestedFollowUps.length > 0 ? suggestedFollowUps : undefined
        };
        
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error communicating with Lex:', error);
      
      // Fallback to demo mode if there's an error
      setUseDemoMode(true);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: "I'm having trouble connecting to my knowledge base. I'll switch to basic assistance mode.",
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Try again with demo mode
      setTimeout(() => sendMessageToLex(text), 1000);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle form submission (text input)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    sendMessageToLex(messageToSend);
  };
  
  // Handle button click (suggested questions)
  const handleButtonClick = (question: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: question,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    sendMessageToLex(question);
  };
  
  const toggleChatWindow = () => {
    setIsOpen(prev => !prev);
  };
  
  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1050 }}>
      {/* Floating button when chat is closed */}
      {!isOpen && (
        <Zoom in={!isOpen}>
          <Tooltip title="AI Support">
            <Fab 
              color="primary" 
              onClick={toggleChatWindow}
              sx={{
                boxShadow: 3,
                '&:hover': {
                  transform: 'scale(1.05)'
                },
                transition: 'transform 0.2s'
              }}
            >
              <SmartToyIcon />
            </Fab>
          </Tooltip>
        </Zoom>
      )}
      
      {/* Chat window when opened */}
      <Zoom in={isOpen} mountOnEnter unmountOnExit>
        <Paper 
          elevation={6} 
          sx={{ 
            width: 360, 
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 3
          }}
        >
          {/* Header */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'primary.main', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToyIcon />
              <Typography variant="h6">
                AI Support {useDemoMode && <Typography component="span" variant="caption" sx={{ opacity: 0.8 }}>(Demo Mode)</Typography>}
              </Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={toggleChatWindow} 
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          {/* Messages area */}
          <Box sx={{ 
            flexGrow: 1, 
            p: 2, 
            overflowY: 'auto',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            {messages.map((message) => (
              <Box 
                key={message.id} 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: message.sender === 'user' ? 'primary.light' : 'background.paper',
                    color: message.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2">{message.text}</Typography>
                </Paper>
                
                {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {message.suggestedQuestions.map((question, index) => (
                      <Button 
                        key={index}
                        size="small"
                        variant="outlined"
                        onClick={() => handleButtonClick(question)}
                        sx={{ 
                          typography: 'caption', 
                          textTransform: 'none',
                          py: 0.5
                        }}
                      >
                        {question}
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
            
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            
            <div ref={messagesEndRef} />
          </Box>
          
          {/* Input area */}
          <Box 
            component="form" 
            onSubmit={handleFormSubmit}
            sx={{ 
              p: 2, 
              borderTop: 1, 
              borderColor: 'divider',
              display: 'flex', 
              gap: 1,
              bgcolor: 'background.paper'
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Type your question here..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading}
              sx={{ flexGrow: 1 }}
            />
            <IconButton 
              color="primary" 
              type="submit" 
              disabled={isLoading || !inputMessage.trim()}
              sx={{ p: 1 }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Zoom>
    </Box>
  );
};

export default AISupport; 