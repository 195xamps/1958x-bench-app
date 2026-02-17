export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[] | null;
  createdAt: string;
}

export interface Chat {
  id: string;
  title: string;
  userId: string | null;
  benchJobId: string | null;
  isStandalone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatWithMessages {
  chat: Chat;
  messages: ChatMessage[];
}

export interface SendMessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface TroubleshootingMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TroubleshootingSession {
  id: string;
  benchJobId: string;
  mode: 'guided' | 'expert';
}

export interface TroubleshootingChatPayload {
  sessionId: string;
  message: string;
  benchJobContext?: {
    make?: string;
    model?: string;
    year?: string;
    ownerSymptoms?: string;
    knownMods?: string;
    priorWork?: string;
  } | null;
}

export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
}
