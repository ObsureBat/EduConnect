//import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import Assignments from './pages/Assignments';
import Chat from './pages/Chat';
import TranslationDemo from './pages/TranslationDemo';
import { UserCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import AISupport from './components/AISupport';
import Auth from './components/Auth';
import AuthService from './utils/auth-service';
import OAuthCallback from './components/OAuthCallback';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Check for stored profile from Google login
      const userProfileStr = localStorage.getItem('userProfile');
      if (userProfileStr) {
        try {
          const userProfile = JSON.parse(userProfileStr);
          console.log("Using stored user profile:", userProfile);
          setUser(userProfile);
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error('Error parsing user profile:', e);
          // Clear invalid profile
          localStorage.removeItem('userProfile');
        }
      }

      // Check for access token without profile (unusual case)
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken && !accessToken.startsWith('SIMULATED_')) {
        try {
          // We have a token but no profile, try to fetch it
          const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          
          if (response.ok) {
            const userProfile = await response.json();
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            setUser(userProfile);
            setIsAuthenticated(true);
          } else {
            // Token might be expired or invalid
            console.error('Failed to fetch profile with token, clearing auth data');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userProfile');
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setIsAuthenticated(false);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Handle legacy simulated login case
      if (accessToken && accessToken.startsWith('SIMULATED_')) {
        console.log('Using simulated authentication');
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Normal auth check via Cognito
      const user = await AuthService.getCurrentUser();
      setIsAuthenticated(!!user);
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  const handleSignOut = () => {
    // Clear all auth data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenType');
    localStorage.removeItem('userProfile');
    
    // Call auth service signout
    AuthService.signOut();
    
    // Update state
    setIsAuthenticated(false);
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" />

      {!isAuthenticated ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">EduConnect</h1>
            <Auth />
          </div>
        </div>
      ) : (
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white shadow-sm">
              <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-gray-900">EduConnect</h1>
                <div className="flex items-center space-x-4">
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
                    Create New
                  </button>
                  <div className="flex items-center space-x-2">
                    {user && user.picture ? (
                      <div className="flex items-center space-x-2">
                        <img 
                          src={user.picture} 
                          alt={user.name || "Profile"} 
                          className="h-8 w-8 rounded-full border border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">{user.name}</span>
                      </div>
                    ) : (
                      <UserCircle className="h-8 w-8 text-gray-500" />
                    )}
                    <button 
                      onClick={handleSignOut}
                      className="text-sm text-gray-600 hover:text-indigo-600 font-medium"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/assignments" element={<Assignments />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/translate" element={<TranslationDemo />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
      <AISupport />
    </BrowserRouter>
  );
}

export default App;