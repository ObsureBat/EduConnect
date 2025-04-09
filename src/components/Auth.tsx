import { useState, FormEvent, useEffect } from 'react';
import AuthService from '../utils/auth-service';
import { Loader } from 'lucide-react';
import { browserEnv } from '../config/browser-env';
import CognitoDomainStatus from './CognitoDomainStatus';

type AuthMode = 'signin' | 'signup' | 'confirm' | 'forgotPassword' | 'resetPassword';

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [socialLoginEnabled, setSocialLoginEnabled] = useState(false);
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Check if social login is configured
  useEffect(() => {
    const cognitoDomain = browserEnv.VITE_AWS_COGNITO_DOMAIN;
    setSocialLoginEnabled(cognitoDomain !== undefined && cognitoDomain.trim() !== '');
  }, []);

  // Check for OAuth callback
  useEffect(() => {
    const checkOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        setLoading(true);
        try {
          await AuthService.handleOAuthCallback();
          window.location.reload();
        } catch (error) {
          console.error('Error handling OAuth callback:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    checkOAuthCallback();
  }, []);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await AuthService.signIn(username, password);
      if (result) {
        setSuccess('Sign in successful! Redirecting...');
        // Redirect to dashboard or reload the page after successful login
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError('Sign in failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await AuthService.signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setLoading(true);
    try {
      await AuthService.signInWithFacebook();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Facebook');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await AuthService.signUp(username, password, email, name);
      if (result) {
        setSuccess('Sign up successful! Please check your email for verification code.');
        setMode('confirm');
      } else {
        setError('Sign up failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await AuthService.confirmSignUp(username, confirmationCode);
      if (result) {
        setSuccess('Email verified successfully! You can now sign in.');
        setMode('signin');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await AuthService.forgotPassword(username);
      if (result) {
        setSuccess('Password reset code sent to your email!');
        setMode('resetPassword');
      } else {
        setError('Failed to send reset code. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await AuthService.confirmForgotPassword(username, confirmationCode, newPassword);
      if (result) {
        setSuccess('Password reset successful! You can now sign in with your new password.');
        setMode('signin');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during password reset');
    } finally {
      setLoading(false);
    }
  };

  // Render different forms based on the current mode
  const renderForm = () => {
    switch (mode) {
      case 'signin':
        return (
          <div className="space-y-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('forgotPassword')}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Need an account? Sign up
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin h-5 w-5 mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
            
            {socialLoginEnabled && (
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleGoogleSignIn}
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Sign in with Google</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032 s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2 C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                    </svg>
                  </button>
                  <button
                    onClick={handleFacebookSignIn}
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Sign in with Facebook</span>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {!socialLoginEnabled && (
              <div className="mt-6 text-center text-xs text-gray-500">
                <p>Social login is not configured. Add VITE_AWS_COGNITO_DOMAIN to your .env file to enable it.</p>
              </div>
            )}
            
            <div className="mt-4">
              <CognitoDomainStatus />
            </div>
          </div>
        );

      case 'signup':
        return (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 8 characters and include uppercase, lowercase, and numbers.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Already have an account? Sign in
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Signing up...
                </>
              ) : (
                'Sign up'
              )}
            </button>
          </form>
        );

      case 'confirm':
        return (
          <form onSubmit={handleConfirmSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmation Code</label>
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the verification code sent to your email.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Back to sign in
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>
        );

      case 'forgotPassword':
        return (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Back to sign in
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Sending reset code...
                </>
              ) : (
                'Send Password Reset Code'
              )}
            </button>
          </form>
        );

      case 'resetPassword':
        return (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmation Code</label>
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 8 characters and include uppercase, lowercase, and numbers.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Back to sign in
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Resetting password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === 'signin' && 'Sign in to your account'}
            {mode === 'signup' && 'Create a new account'}
            {mode === 'confirm' && 'Verify your email'}
            {mode === 'forgotPassword' && 'Reset your password'}
            {mode === 'resetPassword' && 'Create a new password'}
          </h2>
        </div>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div>
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}
        {renderForm()}
      </div>
    </div>
  );
};

export default Auth; 