import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MessageSquare, Send, X, Clock, Store, User } from 'lucide-react-native';
import { BASE_URL } from '../services/apiConfig';
import { signalRService } from '../services/signalRService';

export interface ChatMessage {
  id: string;
  orderId: string;
  senderRole: string; // 'Customer' | 'Merchant' | 'Delivery'
  senderName: string;
  messageText: string;
  createdAt: string;
}

interface OrderChatModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  currentRole: 'Customer' | 'Merchant';
  currentUserName: string;
  otherPartyName: string;
  otherPartySubtitle?: string;
}

export default function OrderChatModal({
  visible,
  onClose,
  orderId,
  currentRole,
  currentUserName,
  otherPartyName,
  otherPartySubtitle
}: OrderChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Quick reply presets based on current role
  const quickPresets = currentRole === 'Merchant'
    ? [
        'Your order is being packed now! 📦',
        'Out for delivery soon 🛵',
        'Some items are out of stock ⚠️',
        'Please confirm the quoted bill 👍'
      ]
    : [
        'When will it be delivered? ⏰',
        'Please pack carefully 🙏',
        'Can I add one more item? 🛍️',
        'Please call when you arrive 📞'
      ];

  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!orderId) return;
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}/messages`);
      if (res.ok) {
        const data = await res.json();
        const list: ChatMessage[] = Array.isArray(data) ? data : data.value || [];
        setMessages(list);
      }
    } catch {
      // quiet fallback
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!visible || !orderId) return;

    fetchMessages(true);

    // Listen to real-time SignalR broadcasts
    const unsub = signalRService.onOrderMessage((msg: ChatMessage) => {
      if (msg.orderId === orderId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    // Background polling fallback (every 2.5 seconds)
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 2500);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [visible, orderId, fetchMessages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !orderId) return;

    setIsSending(true);
    setInputText('');

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      orderId,
      senderRole: currentRole,
      senderName: currentUserName || (currentRole === 'Merchant' ? 'Merchant' : 'Customer'),
      messageText: text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: currentRole,
          senderName: currentUserName || (currentRole === 'Merchant' ? 'Merchant' : 'Customer'),
          messageText: text
        })
      });

      if (res.ok) {
        const saved: ChatMessage = await res.json();
        setMessages(prev => prev.map(m => m.id === tempId ? saved : m));
      }
    } catch {
      console.warn('Failed to send message over network');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.chatModalContainer}>
          {/* Header */}
          <View style={styles.chatHeader}>
            <View style={styles.headerInfo}>
              <View style={[styles.avatarBox, { backgroundColor: currentRole === 'Merchant' ? '#E5F1FF' : '#E5F9ED' }]}>
                {currentRole === 'Merchant' ? (
                  <User size={18} color="#007AFF" />
                ) : (
                  <Store size={18} color="#34C759" />
                )}
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerTitle}>{otherPartyName || 'Chat'}</Text>
                <Text style={styles.headerSubtitle}>
                  {otherPartySubtitle || `Order #${orderId} • Live Direct Chat`}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Quick Reply Presets */}
          <View style={styles.presetsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
              {quickPresets.map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.presetChip}
                  onPress={() => handleSendMessage(preset)}
                >
                  <Text style={styles.presetText}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Messages List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {isLoading && messages.length === 0 ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Loading chat history...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyChatBox}>
                <MessageSquare size={36} color="#C7C7CC" />
                <Text style={styles.emptyChatTitle}>No Messages Yet</Text>
                <Text style={styles.emptyChatSub}>
                  Send a message to ask about items, delivery timing, substitutes, or order details!
                </Text>
              </View>
            ) : (
              messages.map(msg => {
                const isMe = msg.senderRole.toLowerCase() === currentRole.toLowerCase();
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageRow,
                      isMe ? styles.messageRowMe : styles.messageRowOther
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.bubbleMe : styles.bubbleOther
                      ]}
                    >
                      {!isMe && (
                        <Text style={styles.senderLabel}>
                          {msg.senderName || (msg.senderRole === 'Merchant' ? 'Store' : 'Customer')}
                        </Text>
                      )}
                      <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                        {msg.messageText}
                      </Text>
                      <View style={styles.timeRow}>
                        <Clock size={10} color={isMe ? 'rgba(255,255,255,0.7)' : '#8E8E93'} />
                        <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                          {formatTime(msg.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.inputField}
              placeholder="Type your message..."
              placeholderTextColor="#8E8E93"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || isSending) && styles.sendBtnDisabled
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Send size={16} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  chatModalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7'
  },
  presetsContainer: {
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8
  },
  presetsScroll: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center'
  },
  presetChip: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },
  presetText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500'
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#F2F2F7'
  },
  messagesContent: {
    padding: 14,
    paddingBottom: 20
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 8
  },
  loadingText: {
    fontSize: 12,
    color: '#8E8E93'
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingHorizontal: 30
  },
  emptyChatTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 10
  },
  emptyChatSub: {
    fontSize: 12,
    color: '#A0A0A5',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10
  },
  messageRowMe: {
    justifyContent: 'flex-end'
  },
  messageRowOther: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16
  },
  bubbleMe: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4
  },
  bubbleOther: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA'
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 2
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19
  },
  messageTextMe: {
    color: '#FFF'
  },
  messageTextOther: {
    color: '#1C1C1E'
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 4
  },
  timeText: {
    fontSize: 10
  },
  timeTextMe: {
    color: 'rgba(255,255,255,0.7)'
  },
  timeTextOther: {
    color: '#8E8E93'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFF',
    gap: 8
  },
  inputField: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1C1C1E',
    maxHeight: 100
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendBtnDisabled: {
    backgroundColor: '#A0A0A5',
    opacity: 0.6
  }
});
