'use client';

import { useState, useRef, useEffect } from 'react';
import { PlayIcon, StopIcon, MicrophoneIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import Navbar from './components/Navbar';
import { useUser } from '@auth0/nextjs-auth0/client';

// Add these type declarations at the top of the file
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
  isEditing?: boolean;
}

export default function Home() {
  const { user, isLoading } = useUser();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const recognitionRef = useRef<any>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const [editingNote, setEditingNote] = useState<string>('');

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
              timestamp: updatedTimestamp
            }
          : n
      ));
      setSelectedNote(prev => prev?.id === note.id 
        ? { 
            ...note, 
            notes: editingNote, 
            isEditing: false,
            timestamp: updatedTimestamp
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
      <Navbar isSignedIn={false} />
      
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
            
            <div className="w-full space-y-2 mb-20">
              {savedNotes.map((note) => {
                // Extract title from markdown content
                const titleMatch = note.notes.match(/^#\s(.+)$/m);
                const title = titleMatch ? titleMatch[1] : 'Untitled Note';
                
                return (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedNote?.id === note.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">{title}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(note.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </button>
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
                    {getAudioBars(audioLevel).map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-blue-500 transition-all duration-75"
                        style={{
                          height: `${height}%`,
                          opacity: height > 0 ? 0.3 + (height / 100) * 0.7 : 0.2
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
    </div>
  );
}
