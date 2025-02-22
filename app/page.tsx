'use client';

import { useState, useRef, useEffect } from 'react';
import { PlayIcon, StopIcon, MicrophoneIcon, PencilIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import Navbar from './components/Navbar';
import { useUser } from '@auth0/nextjs-auth0/client';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Note {
  id: string;
  transcript: string;
  notes: string;
  timestamp: Date;
  createdAt: Date;
  isEditing?: boolean;
}

export default function Home() {
  const { user, isLoading } = useUser();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const recognitionRef = useRef<any>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const [editingNote, setEditingNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setAudioLevel(0);
  };

  const getAudioBars = (audioLevel: number) => {
    // Amplify lower volumes with a logarithmic curve
    const amplifiedLevel = Math.pow(audioLevel / 256, 0.5) * 256;
    
    // Create 32 bars with dynamic heights based on audio level
    const bars = Array.from({ length: 32 }).map((_, i) => {
      // Create a bell curve effect
      const multiplier = Math.sin((i / 31) * Math.PI);
      // Add a minimum height of 15% and scale the rest
      const height = 15 + Math.min(85, (amplifiedLevel / 256) * 85 * multiplier);
      return height;
    });
    return bars;
  };

  const startRecording = async () => {
    if (!user) {
      // Redirect to Auth0 login if user is not authenticated
      window.location.href = '/api/auth/login';
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    await startAudioAnalysis();
    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (recognitionRef.current && user?.sub) {
      recognitionRef.current.stop();
      stopAudioAnalysis();
      setIsRecording(false);
      setIsProcessing(true);
      
      try {
        const response = await fetch('/api/generate-notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transcript }),
        });
        
        const data = await response.json();
        const newNote = {
          id: Date.now().toString(),
          transcript,
          notes: data.notes,
          timestamp: new Date(),
          createdAt: new Date(),
        };

        // Save to database
        const dbResponse = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...newNote,
            userId: user.sub,
          }),
        });

        const savedNote = await dbResponse.json();
        setSavedNotes(prev => [savedNote, ...prev]);
        setSelectedNote(savedNote);
      } catch (error) {
        console.error('Error generating notes:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleEditNote = (note: Note) => {
    if (note.isEditing) {
      // Only update if changes were made
      const hasChanges = editingNote !== note.notes;
      const updatedTimestamp = hasChanges ? new Date() : note.timestamp;

      // Save the edit
      setSavedNotes(prev => prev.map(n => 
        n.id === note.id 
          ? { 
              ...n, 
              notes: editingNote, 
              isEditing: false,
              timestamp: updatedTimestamp,
              createdAt: updatedTimestamp
            }
          : n
      ));
      setSelectedNote(prev => prev?.id === note.id 
        ? { 
            ...note, 
            notes: editingNote, 
            isEditing: false,
            timestamp: updatedTimestamp,
            createdAt: updatedTimestamp
          }
        : prev
      );
    } else {
      // Start editing
      setEditingNote(note.notes);
      setSavedNotes(prev => prev.map(n => 
        n.id === note.id 
          ? { ...n, isEditing: true }
          : n
      ));
      setSelectedNote(prev => prev?.id === note.id 
        ? { ...note, isEditing: true }
        : prev
      );
    }
  };

  const deleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        const response = await fetch(`/api/notes?noteId=${noteId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setSavedNotes(prev => prev.filter(note => note.id !== noteId));
          if (selectedNote?.id === noteId) {
            setSelectedNote(null);
          }
        }
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      // Reset to all notes when search is cleared
      if (user?.sub) {
        const response = await fetch(`/api/notes?userId=${user.sub}`);
        const allNotes = await response.json();
        setSavedNotes(allNotes);
      }
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      setSavedNotes(results); // This will only show matching notes
    } catch (error) {
      console.error('Error searching notes:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      stopAudioAnalysis();
    };
  }, []);

  // Load notes from database when user logs in
  useEffect(() => {
    if (user?.sub) {
      fetch(`/api/notes?userId=${user.sub}`)
        .then(res => res.json())
        .then(data => {
          setSavedNotes(data);
        });
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {!user ? (
        // Landing Page
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Transform Your Office Hours into Structured Notes
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Record, transcribe, and generate AI-powered notes in real-time. 
              Never miss important details from your meetings again.
            </p>
            <a
              href="/api/auth/login"
              className="inline-flex items-center px-6 py-3 text-lg font-medium rounded-full
                text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Get Started
            </a>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <MicrophoneIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-black text-lg font-semibold mb-2">Real-time Recording</h3>
              <p className="text-gray-600">
                Capture every detail with our advanced audio recording system
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-black text-lg font-semibold mb-2">AI-Powered Notes</h3>
              <p className="text-gray-600">
                Automatically generate structured, markdown-formatted notes
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-black text-lg font-semibold mb-2">Easy Organization</h3>
              <p className="text-gray-600">
                Edit, organize, and access your notes from anywhere
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-blue-50 p-8 rounded-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Enhance Your Office Hours?
            </h2>
            <p className="text-gray-600 mb-6">
              Join now and experience the future of note-taking.
            </p>
            <a
              href="/api/auth/login"
              className="inline-flex items-center px-6 py-3 text-lg font-medium rounded-full
                text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Sign Up Now
            </a>
          </div>
        </div>
      ) : (
        // Existing App Interface
        <div className="min-h-screen bg-gray-50 pb-32">
          {/* Two Column Layout */}
          <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Column - Current Note */}
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                Current Session
              </h2>
              
              <div className="w-full space-y-4">
                {transcript && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Live Transcript</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{transcript}</p>
                  </div>
                )}

                {isProcessing && (
                  <div className="text-center text-gray-600 py-4">
                    <p>Generating notes...</p>
                  </div>
                )}

                {selectedNote && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-20">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium text-gray-700">Generated Notes</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {new Date(selectedNote.timestamp).toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleEditNote(selectedNote)}
                          className="p-1 rounded-full hover:bg-gray-100"
                        >
                          {selectedNote.isEditing ? (
                            <CheckIcon className="w-5 h-5 text-green-500" />
                          ) : (
                            <PencilIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    {selectedNote.isEditing ? (
                      <textarea
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        className="w-full h-64 p-4 border rounded-md font-mono text-base 
                          text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 
                          focus:ring-blue-500 focus:border-transparent"
                        placeholder="Edit your notes here... Markdown is supported"
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{selectedNote.notes}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Saved Notes */}
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                Previous Notes
              </h2>
              
              {/* Add search input */}
              <div className="w-full mb-4 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your notes..."
                    className="w-full px-4 py-2 pl-10 pr-4 rounded-lg border border-gray-200 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      text-gray-900 placeholder-gray-500"
                  />
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>

              <div className="w-full space-y-2 mb-20">
                {savedNotes.map((note) => {
                  // Extract title from markdown content
                  const titleMatch = note.notes.match(/^#\s(.+)$/m);
                  const title = titleMatch ? titleMatch[1] : 'Untitled Note';
                  
                  return (
                    <div
                      key={note.id}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedNote?.id === note.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => setSelectedNote(note)}
                          className="flex-1 text-left"
                        >
                          <span className="text-gray-700">{title}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            {new Date(note.timestamp).toLocaleString()}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                          title="Delete note"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Fixed Recording Module */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-4 bg-gray-50/90 p-4 rounded-full shadow-sm">
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm
                    ${isRecording 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-blue-500 hover:bg-blue-600'
                    } text-white`}
                  title={user ? "Start Recording" : "Sign in to start recording"}
                >
                  {isRecording ? (
                    <StopIcon className="w-7 h-7 text-white" />
                  ) : (
                    <MicrophoneIcon className="w-7 h-7 text-white" />
                  )}
                </button>

                <div className="w-64 h-10 bg-gray-200 rounded-full overflow-hidden flex items-center px-3">
                  {isRecording ? (
                    <div className="flex items-end gap-[2px] h-full w-full">
                      {Array.from({ length: 32 }, (_, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-blue-500 transition-all duration-75"
                          style={{
                            height: `${getAudioBars(audioLevel)[i]}%`,
                            opacity: getAudioBars(audioLevel)[i] > 0 ? 0.3 + (getAudioBars(audioLevel)[i] / 100) * 0.7 : 0.2
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm w-full text-center">
                      Click microphone to start recording
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
