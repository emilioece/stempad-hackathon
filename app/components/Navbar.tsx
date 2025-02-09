'use client';

import { useState } from 'react';
import { QuestionMarkCircleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { MicrophoneIcon } from '@heroicons/react/24/solid';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function Navbar() {
  const { user, isLoading } = useUser();
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleModalClick = (e: React.MouseEvent) => {
    // Close modal if clicking the backdrop (outside the modal content)
    if (e.target === e.currentTarget) {
      setShowHelpModal(false);
    }
  };

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Name */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <MicrophoneIcon className="h-8 w-8 text-blue-500" />
                <span className="ml-2 text-xl font-semibold text-gray-800">DeepSearch</span>
              </div>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowHelpModal(true)}
                className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Help"
              >
                <QuestionMarkCircleIcon className="h-6 w-6" />
              </button>

              {isLoading ? (
                <div className="h-10 w-20 bg-gray-100 animate-pulse rounded-md" />
              ) : user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">{user.email}</span>
                  <a
                    href="/api/auth/logout"
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Log out
                  </a>
                </div>
              ) : (
                <a
                  href="/api/auth/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent 
                    text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign In
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Updated Help Modal */}
      {showHelpModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={handleModalClick}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHelpModal(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            >
              <span className="text-2xl">×</span>
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Use DeepSearch</h2>
            
            <div className="space-y-4 text-gray-600">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">1. Recording</h3>
                <p>Click the microphone button at the bottom of the screen to start recording your office hours session.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">2. Live Transcription</h3>
                <p>Your speech will be transcribed in real-time and displayed in the Current Session panel.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">3. AI Note Generation</h3>
                <p>When you stop recording, our AI will automatically generate structured notes from your session.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">4. Edit and Review</h3>
                <p>You can edit the generated notes using the pencil icon. The notes support markdown formatting for better organization.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">5. Previous Notes</h3>
                <p>Access your previous notes from the right panel. Click on any note to view and edit its contents.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 