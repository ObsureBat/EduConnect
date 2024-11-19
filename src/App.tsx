//import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import Assignments from './pages/Assignments';
import Chat from './pages/Chat';
import { UserCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />

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
                <UserCircle className="h-8 w-8 text-gray-500" />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/chat" element={<Chat />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;