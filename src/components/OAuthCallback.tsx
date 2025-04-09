import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthService from '../utils/auth-service';
import { Loader } from 'lucide-react';
import toast from 'react-hot-toast';

// Interface for the parsed token data
interface TokenData {
  access_token: string;
  expires_in: string;
  token_type: string;
  scope: string;
}

// Interface for user profile
interface UserProfile {
  name: string;
  email: string;
  picture: string;
  sub?: string;
  [key: string]: any;
}

const OAuthCallback = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Parse the URL hash for tokens
  const parseHash = (): TokenData | null => {
    if (!location.hash) return null;
    
    const hash = location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const access_token = params.get('access_token');
    const expires_in = params.get('expires_in');
    const token_type = params.get('token_type');
    const scope = params.get('scope');
    
    if (!access_token) return null;
    
    return {
      access_token,
      expires_in: expires_in || '',
      token_type: token_type || 'Bearer',
      scope: scope || ''
    };
  };

  // Fetch user info from Google with the token
  const fetchUserProfile = async (accessToken: string): Promise<UserProfile> => {
    try {
      console.log('Fetching user profile with token:', accessToken);
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('User profile data:', data);
      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Handle tokens from hash (implicit flow)
        const tokenData = parseHash();
        console.log('Token data from hash:', tokenData);
        
        if (tokenData) {
          // Store the token
          localStorage.setItem('accessToken', tokenData.access_token);
          localStorage.setItem('tokenType', tokenData.token_type);
          
          try {
            // Fetch user profile
            const profileData = await fetchUserProfile(tokenData.access_token);
            setUserProfile(profileData);
            
            // Store user profile data
            localStorage.setItem('userProfile', JSON.stringify(profileData));
            
            setStatus('success');
            setMessage(`Welcome, ${profileData.name || 'User'}! Redirecting...`);
            
            // Clear the hash from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Redirect to dashboard after delay
            setTimeout(() => {
              navigate('/');
            }, 2000);
          } catch (error) {
            console.error('Failed to get user profile:', error);
            setStatus('error');
            setMessage('Failed to fetch user profile');
            setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
            toast.error('Failed to fetch your profile information');
            setTimeout(() => {
              navigate('/');
            }, 3000);
          }
          return;
        }

        // Check for code parameter (authorization code flow)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          console.log('Found authorization code:', code);
          try {
            const success = await AuthService.handleOAuthCallback();
            if (success) {
              setStatus('success');
              setMessage('Authentication successful! Redirecting...');
              setTimeout(() => {
                navigate('/');
              }, 1500);
            } else {
              setStatus('error');
              setMessage('Authentication failed. Please try again.');
              setTimeout(() => {
                navigate('/');
              }, 3000);
            }
          } catch (error) {
            console.error('Error handling OAuth callback:', error);
            setStatus('error');
            setMessage('Error handling OAuth callback');
            setErrorDetails(error instanceof Error ? error.message : 'Unknown error');
            toast.error('Authentication error');
            setTimeout(() => {
              navigate('/');
            }, 3000);
          }
          return;
        }

        // No token or code found
        setStatus('error');
        setMessage('Authentication failed: No authentication data found');
        setErrorDetails('No token or authorization code was found in the URL');
        toast.error('Authentication data missing');
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('Authentication error. Please try again.');
        setErrorDetails(error instanceof Error ? error.message : 'Unknown error occurred');
        toast.error('Authentication process failed');
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate, location]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          {status === 'loading' && (
            <Loader className="h-12 w-12 animate-spin mx-auto text-indigo-600" />
          )}
          {status === 'success' && (
            <>
              <svg className="h-12 w-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {userProfile && userProfile.picture && (
                <div className="mt-4 flex justify-center">
                  <img 
                    src={userProfile.picture} 
                    alt="Profile" 
                    className="h-16 w-16 rounded-full border-2 border-indigo-500"
                  />
                </div>
              )}
            </>
          )}
          {status === 'error' && (
            <svg className="h-12 w-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <h2 className="mt-4 text-xl font-semibold text-gray-800">{message}</h2>
          {userProfile && (
            <div className="mt-2 text-sm text-gray-600">
              {userProfile.email && <p>Email: {userProfile.email}</p>}
            </div>
          )}
          {errorDetails && (
            <p className="mt-2 text-sm text-red-600">{errorDetails}</p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            {status === 'loading' ? 'Please wait while we complete the authentication process...' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback; 