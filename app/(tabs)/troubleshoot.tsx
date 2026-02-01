import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface BenchJob {
  id: string;
  ownerSymptoms: string;
  knownMods: string;
  priorWork: string;
}

interface AmpProfile {
  make: string;
  model: string;
  year: string;
}

const COMMON_SYMPTOMS = [
  'Hum after recap',
  'No sound at all',
  'Red plating on tubes',
  'Motorboating',
  'Volume drop',
  'Reverb not working',
  'Tremolo weak',
  'Fuse blows',
  'Scratchy pots',
  'Pops on standby toggle',
];

export default function TroubleshootScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'guided' | 'expert'>('guided');
  const [activeJob, setActiveJob] = useState<BenchJob | null>(null);
  const [ampProfile, setAmpProfile] = useState<AmpProfile | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const startSession = async (symptom?: string) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/troubleshooting/start`, {
        mode,
      });
      setSessionId(response.data.id);
      
      if (symptom) {
        await sendMessage(symptom, response.data.id);
      } else {
        setMessages([{
          role: 'assistant',
          content: `I'm your troubleshooting assistant for the 195X Bench App. I'll guide you through diagnosing and repairing guitar amplifiers safely and methodically.\n\n**SAFETY FIRST**: Before we begin any high-voltage work, please confirm:\n- Isolation transformer is connected\n- Capacitors are discharged\n- PPE is available\n\nDescribe the symptom you're experiencing, or select one from the common issues above to get started.`
        }]);
      }
    } catch (error) {
      console.error('Error starting session:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string, sid?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const currentSessionId = sid || sessionId;
    if (!currentSessionId) {
      await startSession(messageText);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: messageText }]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/troubleshooting/chat`, {
        sessionId: currentSessionId,
        message: messageText,
        benchJobContext: activeJob ? {
          make: ampProfile?.make,
          model: ampProfile?.model,
          year: ampProfile?.year,
          ownerSymptoms: activeJob.ownerSymptoms,
          knownMods: activeJob.knownMods,
          priorWork: activeJob.priorWork,
        } : null,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.data.message }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an error. Please try again or rephrase your question.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    return (
      <View
        key={index}
        style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {!isUser && (
          <View style={styles.assistantHeader}>
            <Ionicons name="hardware-chip" size={18} color="#f59e0b" />
            <Text style={styles.assistantLabel}>Bench Assistant</Text>
          </View>
        )}
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {message.content}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'guided' && styles.modeButtonActive]}
          onPress={() => setMode('guided')}
        >
          <Ionicons name="list" size={18} color={mode === 'guided' ? '#1f2937' : '#9ca3af'} />
          <Text style={[styles.modeButtonText, mode === 'guided' && styles.modeButtonTextActive]}>
            Guided
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'expert' && styles.modeButtonActive]}
          onPress={() => setMode('expert')}
        >
          <Ionicons name="flash" size={18} color={mode === 'expert' ? '#1f2937' : '#9ca3af'} />
          <Text style={[styles.modeButtonText, mode === 'expert' && styles.modeButtonTextActive]}>
            Expert
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && !sessionId && (
          <View style={styles.welcomeContainer}>
            <Ionicons name="build" size={48} color="#f59e0b" />
            <Text style={styles.welcomeTitle}>Troubleshooting Assistant</Text>
            <Text style={styles.welcomeText}>
              Select a common symptom or describe the issue you're experiencing
            </Text>
            
            <View style={styles.symptomsGrid}>
              {COMMON_SYMPTOMS.map((symptom, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.symptomChip}
                  onPress={() => startSession(symptom)}
                >
                  <Text style={styles.symptomChipText}>{symptom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map(renderMessage)}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#f59e0b" />
            <Text style={styles.loadingText}>Analyzing...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Describe the issue or ask a question..."
          placeholderTextColor="#6b7280"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={22} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {sessionId && (
        <TouchableOpacity
          style={styles.newSessionButton}
          onPress={() => {
            setSessionId(null);
            setMessages([]);
          }}
        >
          <Ionicons name="refresh" size={16} color="#9ca3af" />
          <Text style={styles.newSessionText}>New Session</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  modeButtonActive: {
    backgroundColor: '#f59e0b',
  },
  modeButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#1f2937',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  symptomChip: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  symptomChipText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#f59e0b',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  assistantLabel: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#1f2937',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#1f2937',
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  newSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#1f2937',
  },
  newSessionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
