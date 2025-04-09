import React, { useState, useEffect } from 'react';
import { browserEnv } from '../config/browser-env';

const CognitoDomainStatus: React.FC = () => {
  const [domainStatus, setDomainStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkDomainStatus = async () => {
      try {
        const cognitoDomain = browserEnv.VITE_AWS_COGNITO_DOMAIN;
        const region = browserEnv.VITE_AWS_REGION;
        
        if (!cognitoDomain || !region) {
          setDomainStatus('unavailable');
          setError('Cognito domain or region not configured');
          return;
        }
        
        const domainUrl = `https://${cognitoDomain}.auth.${region}.amazoncognito.com/ping`;
        
        try {
          // Attempt to ping the domain with a timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(domainUrl, { 
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // If we get here, the domain is reachable
          setDomainStatus('available');
        } catch (error) {
          console.error('Domain ping error:', error);
          setDomainStatus('unavailable');
          setError('Cannot reach Cognito domain');
        }
      } catch (error) {
        console.error('Domain check error:', error);
        setDomainStatus('unavailable');
        setError('Error checking domain status');
      }
    };
    
    checkDomainStatus();
  }, []);
  
  if (domainStatus === 'checking') {
    return (
      <div className="text-center py-2 px-4 text-sm text-gray-600">
        Checking Cognito domain status...
      </div>
    );
  }
  
  if (domainStatus === 'available') {
    return (
      <div className="text-center py-2 px-4 text-sm text-green-600">
        Cognito domain is available ✓
      </div>
    );
  }
  
  return (
    <div className="text-center py-2 px-4 text-sm text-red-600">
      Cognito domain unavailable: {error}
      <div className="mt-1 text-xs">
        Using simulated login for demo purposes
      </div>
    </div>
  );
};

export default CognitoDomainStatus; 