export interface Message {
  id: string;
  conversationId: string;
  senderUid: string;
  receiverUid: string;
  content: string;
  videoURL?: string;
  videoPath?: string;
  sessionId?: string; // Link to a session if this message references a swing video
  createdAt: Date | string;
  readAt?: Date | string;
}

export interface CreateMessageInput {
  receiverUid: string;
  content: string;
  videoURL?: string;
  videoPath?: string;
  sessionId?: string;
}

export interface Conversation {
  id: string;
  participant1Uid: string;
  participant2Uid: string;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: Date | string;
}

