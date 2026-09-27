import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Linking,
  ScrollView,
} from 'react-native';
import {
  Bike,
  CheckCircle2,
  KeyRound,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Store,
  User,
  X,
} from 'lucide-react-native';
import { BASE_URL } from '../services/apiConfig';
import { openWhatsAppToCustomerFromDriver } from '../utils/whatsappHelper';
import { signalRService } from '../services/signalRService';

interface DeliveryOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  shopName: string;
  itemsCount: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  itemsText: string;
  deliveryOtp: string;
  deliveryPartnerName?: string;
  createdAt: string;
}

interface OrderMessage {
  id: string;
  orderId: string;
  senderRole: string;
  senderName: string;
  messageText: string;
  createdAt: string;
}

export default function DeliveryPartnerScreen() {
  const [activeDriver, setActiveDriver] = useState('Rohan Das');
  const [drivers] = useState(['Rohan Das', 'Amit Kumar', 'Vikram Singh']);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // OTP Verification Modal State
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Live Chat Drawer State
  const [chatOrder, setChatOrder] = useState<DeliveryOrder | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');

  const loadDeliveryOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/orders`);
      if (res.ok) {
        const data: DeliveryOrder[] = await res.json();
        const active = data.filter(
          o =>
            o.status === 'Out for Delivery' ||
            (o.deliveryPartnerName &&
              o.deliveryPartnerName.toLowerCase() === activeDriver.toLowerCase() &&
              o.status !== 'Delivered' &&
              o.status !== 'Cancelled')
        );
        setOrders(active);
      }
    } catch {
      console.warn('Error loading delivery queue.');
    } finally {
      setLoading(false);
    }
  }, [activeDriver]);

  useEffect(() => {
    loadDeliveryOrders();

    // SignalR real-time subscriptions
    const unsubStatus = signalRService.onOrderStatusUpdated(() => {
      loadDeliveryOrders();
    });
    const unsubChat = signalRService.onOrderMessage((msg: OrderMessage) => {
      if (chatOrder && msg.orderId === chatOrder.id) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      unsubStatus();
      unsubChat();
    };
  }, [activeDriver, chatOrder, loadDeliveryOrders]);

  const handleVerifyOtp = async () => {
    if (!selectedOrder) return;
    if (!otpInput.trim() || otpInput.trim().length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit code provided by the customer.');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`${BASE_URL}/orders/${selectedOrder.id}/verify-otp-deliver`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpInput.trim() }),
      });

      if (res.ok) {
        Alert.alert(
          'Delivery Completed! 🎉',
          `Order #${selectedOrder.id} has been delivered successfully. Customer notified.`
        );
        setSelectedOrder(null);
        setOtpInput('');
        loadDeliveryOrders();
      } else {
        const errorData = await res.json();
        Alert.alert('OTP Mismatch', errorData.message || 'Incorrect OTP code. Please re-check with the customer.');
      }
    } catch {
      Alert.alert('Network Error', 'Failed to verify OTP with the server.');
    } finally {
      setVerifying(false);
    }
  };

  const openChat = async (order: DeliveryOrder) => {
    setChatOrder(order);
    try {
      const res = await fetch(`${BASE_URL}/orders/${order.id}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
      }
    } catch {
      console.warn('Error loading chat.');
    }
  };

  const sendChatMessage = async () => {
    if (!chatOrder || !newMessageText.trim()) return;

    try {
      const res = await fetch(`${BASE_URL}/orders/${chatOrder.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: 'Delivery',
          senderName: activeDriver,
          messageText: newMessageText.trim(),
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setMessages(prev => [...prev, created]);
        setNewMessageText('');
      }
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={styles.container}>
      {/* Driver Identity Card */}
      <View style={styles.driverHeader}>
        <View style={styles.driverIconBox}>
          <Bike size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverLabel}>Active Delivery Partner</Text>
          <Text style={styles.driverName}>{activeDriver}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadDeliveryOrders}>
          <RefreshCw size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Driver Switcher Pills */}
      <View style={styles.driverPills}>
        {drivers.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.driverPill, activeDriver === d && styles.driverPillActive]}
            onPress={() => setActiveDriver(d)}
          >
            <Text style={[styles.driverPillText, activeDriver === d && styles.driverPillTextActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeading}>
        Assigned Deliveries ({orders.length})
      </Text>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle2 size={48} color="#34C759" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>
            No active deliveries pending for {activeDriver}. When shopkeepers dispatch orders, they will appear here live.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDeliveryOrders} />}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderId}>#{item.id}</Text>
                  <Text style={styles.shopName}>
                    <Store size={12} color="#636366" /> Pick up from: {item.shopName}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>

              {/* Customer Drop-off Info */}
              <View style={styles.customerBox}>
                <View style={styles.customerRow}>
                  <User size={14} color="#007AFF" />
                  <Text style={styles.customerName}>{item.customerName}</Text>
                  <Text style={styles.paymentPill}>{item.paymentMethod} • ₹{item.totalAmount}</Text>
                </View>
                <View style={styles.customerRow}>
                  <MapPin size={14} color="#E65100" />
                  <Text style={styles.customerAddress}>
                    Greenfield Apartments, Sector 5 (Deliver to Gate/Door)
                  </Text>
                </View>
                {item.itemsText ? (
                  <Text style={styles.itemsSummary} numberOfLines={2}>
                    📦 {item.itemsText}
                  </Text>
                ) : null}
              </View>

              {/* Action Buttons Row */}
              <View style={styles.actionsRow}>
                {false && (
                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={() =>
                      openWhatsAppToCustomerFromDriver(
                        item.customerPhone,
                        item.customerName,
                        item.id,
                        item.deliveryOtp,
                        'Greenfield Apartments, Sector 5'
                      )
                    }
                  >
                    <MessageCircle size={16} color="#fff" />
                    <Text style={styles.btnTextWhite}>WhatsApp</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => callCustomer(item.customerPhone || '9876543210')}
                >
                  <Phone size={16} color="#007AFF" />
                  <Text style={styles.btnTextBlue}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => openChat(item)}
                >
                  <MessageCircle size={16} color="#5856D6" />
                  <Text style={styles.btnTextPurple}>Chat</Text>
                </TouchableOpacity>
              </View>

              {/* OTP Confirmation Button */}
              <TouchableOpacity
                style={styles.verifyOtpBtn}
                onPress={() => {
                  setSelectedOrder(item);
                  setOtpInput('');
                }}
              >
                <KeyRound size={18} color="#fff" />
                <Text style={styles.verifyOtpBtnText}>Enter Customer OTP & Deliver</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* OTP Modal */}
      <Modal visible={selectedOrder !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Verification Code</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <X size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Ask customer <Text style={{ fontWeight: '700' }}>{selectedOrder?.customerName}</Text> for the 4-digit Delivery OTP shown on their screen.
            </Text>

            <View style={styles.otpInputBox}>
              <TextInput
                style={styles.otpInput}
                placeholder="• • • •"
                keyboardType="number-pad"
                maxLength={4}
                value={otpInput}
                onChangeText={setOtpInput}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.confirmDeliveryBtn, verifying && { opacity: 0.6 }]}
              onPress={handleVerifyOtp}
              disabled={verifying}
            >
              <Text style={styles.confirmDeliveryBtnText}>
                {verifying ? 'Verifying OTP...' : 'Confirm Delivery ✓'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* In-Order Chat Modal */}
      <Modal visible={chatOrder !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Chat #{chatOrder?.id}</Text>
              <TouchableOpacity onPress={() => setChatOrder(null)}>
                <X size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.chatScroll}>
              {messages.length === 0 ? (
                <Text style={styles.emptyChatText}>No messages yet. Send an update to the customer!</Text>
              ) : (
                messages.map((m, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.msgBubble,
                      m.senderRole === 'Delivery' ? styles.msgBubbleMine : styles.msgBubbleTheirs,
                    ]}
                  >
                    <Text style={styles.msgSender}>{m.senderName} ({m.senderRole})</Text>
                    <Text style={styles.msgText}>{m.messageText}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message (e.g. at the gate)..."
                value={newMessageText}
                onChangeText={setNewMessageText}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendChatMessage}>
                <Send size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 14,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  driverIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E65100',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  driverName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  driverPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  driverPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  driverPillActive: {
    backgroundColor: '#E65100',
    borderColor: '#E65100',
  },
  driverPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  driverPillTextActive: {
    color: '#fff',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    paddingBottom: 8,
    marginBottom: 10,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  shopName: {
    fontSize: 12,
    color: '#636366',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E65100',
  },
  customerBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
  },
  paymentPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34C759',
    backgroundColor: '#E8F8EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customerAddress: {
    fontSize: 12,
    color: '#3A3A3C',
    flex: 1,
  },
  itemsSummary: {
    fontSize: 11,
    color: '#636366',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  whatsappBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5F1FF',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FD',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  btnTextWhite: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextBlue: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextPurple: {
    color: '#5856D6',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyOtpBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  verifyOtpBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  modalDesc: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
    marginBottom: 16,
  },
  otpInputBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  otpInput: {
    width: 200,
    height: 56,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 14,
    color: '#1C1C1E',
  },
  confirmDeliveryBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmDeliveryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  chatScroll: {
    flex: 1,
    marginBottom: 12,
  },
  emptyChatText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 40,
    fontSize: 13,
  },
  msgBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '80%',
  },
  msgBubbleMine: {
    backgroundColor: '#E5F1FF',
    alignSelf: 'flex-end',
  },
  msgBubbleTheirs: {
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
  },
  msgSender: {
    fontSize: 10,
    fontWeight: '700',
    color: '#636366',
    marginBottom: 2,
  },
  msgText: {
    fontSize: 13,
    color: '#1C1C1E',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 13,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
