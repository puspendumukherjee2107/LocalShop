import { CheckCircle2, Clock, Key, Landmark, MessageSquare, RefreshCw, Send, Star, Tag, X, XCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BASE_URL } from '../services/apiConfig';
import { signalRService } from '../services/signalRService';
import { openWhatsAppToMerchant } from '../utils/whatsappHelper';

interface OrderMessage {
  id: number;
  orderId: string;
  senderRole: string;
  senderName: string;
  messageText: string;
  createdAt: string;
}

interface Order {
  id: string;
  shopName: string;
  customerName?: string;
  customerPhone?: string;
  itemsCount: number;
  totalAmount: number;
  quotedAmount?: number;
  itemsText?: string;
  orderType?: string;
  status: 'QuoteRequested' | 'PriceQuoted' | 'Placed' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  refundStatus?: 'None' | 'Pending' | 'Processed';
  paymentMethod?: string;
  createdAt?: string;
  deliveryOtp?: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  discountAmount?: number;
  couponCode?: string;
  rating?: number;
  reviewComment?: string;
}

export default function OrderTrackingScreen() {
  const [orders, setOrders] = useState<Order[]>([
    { 
      id: 'ORD-9021', 
      shopName: 'Kirana Junction', 
      itemsCount: 3, 
      totalAmount: 215, 
      status: 'Processing',
      itemsText: '• 2x Amul Taaza Milk\n• 1x Brown Bread\n• 1x Butter',
      deliveryOtp: '4829'
    },
    { 
      id: 'ORD-8841', 
      shopName: 'Kirana Junction', 
      itemsCount: 1, 
      totalAmount: 60, 
      status: 'Delivered',
      itemsText: '• 1x Britannia Bread',
      rating: 5,
      reviewComment: 'Super fast delivery!'
    },
  ]);
  const [loading, setLoading] = useState(false);

  // Chat State
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<OrderMessage[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Rating Modal State
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    fetchLiveOrders();

    // 1. Listen for real-time price quotes
    const unsubQuote = signalRService.onPriceQuote((data) => {
      setOrders(prev => prev.map(o => 
        o.id === data.orderId 
          ? { ...o, status: 'PriceQuoted', quotedAmount: data.quoteAmount, totalAmount: data.quoteAmount } 
          : o
      ));
      Alert.alert(
        'Price Quote Received! 🏷️',
        `Kirana Junction has quoted ₹${data.quoteAmount} for order ${data.orderId}!\n\nReview and tap "Accept Quote & Pay" to confirm.`
      );
    });

    // 2. Listen for order updates
    const unsubStatus = signalRService.onOrderStatusUpdated((data) => {
      setOrders(prev => prev.map(o => 
        o.id === data.orderId ? { ...o, status: data.status as any } : o
      ));
    });

    // 3. Listen for in-order real-time chat messages
    const unsubChat = signalRService.onOrderMessage((msg) => {
      if (activeChatOrderId === msg.orderId) {
        setChatMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      unsubQuote();
      unsubStatus();
      unsubChat();
    };
  }, [activeChatOrderId]);

  const fetchLiveOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/orders`);
      if (response.ok) {
        const data: Order[] = await response.json();
        if (data.length > 0) {
          setOrders(data);
        }
      }
    } catch {
      console.log('Using local order queue cache.');
    } finally {
      setLoading(false);
    }
  };

  // Open Chat Drawer & Load History
  const handleOpenChat = async (orderId: string) => {
    setActiveChatOrderId(orderId);
    setChatMessages([]);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch {
      console.log('Error loading messages.');
    }
  };

  const handleSendMessage = async () => {
    if (!newChatText.trim() || !activeChatOrderId) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`${BASE_URL}/orders/${activeChatOrderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: 'Customer',
          senderName: 'Turja Mukherjee',
          messageText: newChatText.trim()
        })
      });
      if (res.ok) {
        const saved = await res.json();
        setChatMessages(prev => [...prev, saved]);
        setNewChatText('');
      }
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Handle Post-Delivery Rating Submission
  const handleSubmitRating = async () => {
    if (!ratingOrderId) return;
    try {
      const res = await fetch(`${BASE_URL}/orders/${ratingOrderId}/rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: selectedStars,
          reviewComment: reviewComment.trim()
        })
      });
      if (res.ok) {
        Alert.alert('Thank You! ⭐', 'Your rating and feedback have been shared with the merchant.');
        setOrders(prev => prev.map(o => o.id === ratingOrderId ? { ...o, rating: selectedStars, reviewComment: reviewComment.trim() } : o));
        setRatingOrderId(null);
        setReviewComment('');
      } else {
        Alert.alert('Error', 'Could not save review.');
      }
    } catch {
      Alert.alert('Error', 'Network request failed.');
    }
  };

  const handleAcceptQuote = (orderId: string, amount: number) => {
    Alert.alert(
      'Accept Shopkeeper Quote',
      `Kirana Junction has quoted ₹${amount} for your grocery list.\n\nChoose payment method to confirm:`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: '💵 Cash on Delivery', 
          onPress: () => submitQuotePayment(orderId, 'Cash') 
        },
        { 
          text: '📱 Pay with UPI (Instant)', 
          onPress: () => submitQuotePayment(orderId, 'UPI') 
        }
      ]
    );
  };

  const submitQuotePayment = async (orderId: string, method: string) => {
    try {
      const response = await fetch(`${BASE_URL}/orders/${orderId}/accept-quote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });

      if (response.ok) {
        Alert.alert('Order Confirmed! 🚀', `Your order is confirmed via ${method}. The shopkeeper is now packing your items.`);
        fetchLiveOrders();
      } else {
        Alert.alert('Error', 'Failed to accept quote.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? If paid online, your refund will be initiated instantly.',
      [
        { text: 'Keep Order', style: 'cancel' },
        { 
          text: 'Cancel Order', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/orders/${orderId}/cancel`, {
                method: 'PUT',
              });

              if (response.ok) {
                Alert.alert('Order Cancelled', 'The shopkeeper has been notified. Refund is being processed back to your bank.');
                fetchLiveOrders();
              } else {
                setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'Cancelled', refundStatus: 'Pending' } : o));
              }
            } catch {
              setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'Cancelled', refundStatus: 'Pending' } : o));
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QuoteRequested': return '#FF9500';
      case 'PriceQuoted': return '#007AFF';
      case 'Placed': return '#007AFF';
      case 'Processing': return '#34C759';
      case 'Out for Delivery': return '#5856D6';
      case 'Delivered': return '#34C759';
      case 'Cancelled': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'QuoteRequested': return '⏳ Awaiting Quote';
      case 'PriceQuoted': return '🏷️ Price Quoted';
      case 'Placed': return '📦 Order Placed';
      case 'Processing': return '🟢 Confirmed & Packing';
      case 'Out for Delivery': return '🚚 Out for Delivery';
      case 'Delivered': return '✅ Delivered';
      case 'Cancelled': return '❌ Cancelled';
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topHeaderRow}>
        <Text style={styles.title}>Your Orders & Tracking</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchLiveOrders}>
          <RefreshCw size={16} color="#007AFF" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        onRefresh={fetchLiveOrders}
        refreshing={loading}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            
            {/* Order Identity Header */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.shopName}>{item.shopName}</Text>
                <Text style={styles.orderId}>{item.id} • {item.orderType === 'CustomList' ? 'Grocery List' : 'Direct Order'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            </View>

            {/* Requested Items Box */}
            {item.itemsText ? (
              <View style={styles.itemsBox}>
                <Text style={styles.itemsTitle}>Items in this Order:</Text>
                <Text style={styles.itemsText}>{item.itemsText}</Text>
              </View>
            ) : null}

            {/* Order Details Metrics */}
            <View style={styles.detailsRow}>
              <Text style={styles.detailsText}>
                {item.status === 'QuoteRequested' 
                  ? 'Price: Calculating shelf total...' 
                  : `Total Bill: ₹${item.totalAmount} • ${item.paymentMethod || 'UPI'}`}
              </Text>
              {item.discountAmount && item.discountAmount > 0 ? (
                <Text style={styles.discountText}>🎉 Saved ₹{item.discountAmount} with {item.couponCode || 'Coupon'}</Text>
              ) : null}
            </View>

            {/* PHASE 4: Delivery Confirmation OTP Card */}
            {item.deliveryOtp && !['Delivered', 'Cancelled'].includes(item.status) && (
              <View style={styles.otpCard}>
                <View style={styles.otpHeader}>
                  <Key size={16} color="#B45309" />
                  <Text style={styles.otpTitle}>Delivery Confirmation Code (OTP)</Text>
                </View>
                <Text style={styles.otpCode}>{item.deliveryOtp}</Text>
                <Text style={styles.otpSub}>
                  Share this 4-digit code with the delivery partner upon arrival to verify delivery.
                </Text>
              </View>
            )}

            {/* Assigned Delivery Driver Banner */}
            {item.deliveryPartnerName ? (
              <View style={styles.driverBanner}>
                <Text style={styles.driverLabel}>🛵 Delivery Partner Assigned:</Text>
                <Text style={styles.driverName}>{item.deliveryPartnerName} {item.deliveryPartnerPhone ? `(${item.deliveryPartnerPhone})` : ''}</Text>
              </View>
            ) : null}

            {/* State 1: Awaiting Shopkeeper Quote */}
            {item.status === 'QuoteRequested' && (
              <View style={styles.infoBanner}>
                <Clock size={16} color="#B36B00" />
                <Text style={styles.infoBannerText}>
                  The shopkeeper is checking shelves. You will receive an instant price quote right here.
                </Text>
              </View>
            )}

            {/* State 2: Price Quoted - Action to Accept and Pay */}
            {item.status === 'PriceQuoted' && (
              <View style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <Tag size={18} color="#007AFF" />
                  <Text style={styles.quoteTitle}>Shopkeeper Quoted: ₹{item.totalAmount}</Text>
                </View>
                <Text style={styles.quoteSub}>
                  All items are available! Review the amount and accept to start fulfillment.
                </Text>
                <TouchableOpacity 
                  style={styles.acceptQuoteBtn} 
                  onPress={() => handleAcceptQuote(item.id, item.totalAmount)}
                >
                  <CheckCircle2 size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.acceptQuoteBtnText}>Accept Quote & Pay (₹{item.totalAmount})</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Post-Delivery Rating Display or Action */}
            {item.status === 'Delivered' && (
              item.rating ? (
                <View style={styles.ratedCard}>
                  <Text style={styles.ratedTitle}>Your Rating: {'⭐'.repeat(item.rating)} ({item.rating}/5)</Text>
                  {item.reviewComment ? <Text style={styles.ratedComment}>“{item.reviewComment}”</Text> : null}
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.rateOrderBtn}
                  onPress={() => {
                    setRatingOrderId(item.id);
                    setSelectedStars(5);
                    setReviewComment('');
                  }}
                >
                  <Star size={16} color="#B45309" fill="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.rateOrderBtnText}>Rate Experience & Delivery</Text>
                </TouchableOpacity>
              )
            )}

            {/* Customer Communication Actions: Live Chat only */}
            <View style={styles.actionRow}>
              {false && (
                <TouchableOpacity 
                  style={styles.waBtn} 
                  onPress={() => openWhatsAppToMerchant('9876543210', item.shopName, item.id, item.itemsText || '')}
                >
                  <Text style={styles.waBtnText}>💬 WhatsApp Store</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.chatBtn} 
                onPress={() => handleOpenChat(item.id)}
              >
                <MessageSquare size={14} color="#007AFF" style={{ marginRight: 4 }} />
                <Text style={styles.chatBtnText}>Order Chat</Text>
              </TouchableOpacity>
            </View>

            {/* Refund Status Monitoring Block */}
            {item.status === 'Cancelled' && item.refundStatus && (
              <View style={[styles.refundCard, { backgroundColor: item.refundStatus === 'Pending' ? '#FFF9E6' : '#E5F9ED' }]}>
                <Landmark size={16} color={item.refundStatus === 'Pending' ? '#FF9500' : '#34C759'} />
                <Text style={[styles.refundText, { color: item.refundStatus === 'Pending' ? '#B36B00' : '#248A3D' }]}>
                  Refund Tracker: {item.refundStatus === 'Pending' ? 'Processing back to bank' : 'Credited to Original Method ✓'}
                </Text>
              </View>
            )}

            {/* Cancellation Option */}
            {['QuoteRequested', 'PriceQuoted', 'Placed', 'Processing'].includes(item.status) && (
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => handleCancelOrder(item.id)}
              >
                <XCircle size={16} color="#FF3B30" style={{ marginRight: 4 }} />
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            )}

          </View>
        )}
      />

      {/* MODAL 1: In-Order Real-Time Chat Modal */}
      <Modal visible={activeChatOrderId !== null} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.chatModalContainer}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>Order Chat • {activeChatOrderId}</Text>
                <Text style={styles.chatSubtitle}>Live thread with Merchant & Delivery Partner</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveChatOrderId(null)} style={styles.closeBtn}>
                <X size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.messagesList} contentContainerStyle={{ padding: 12 }}>
              {chatMessages.length === 0 ? (
                <Text style={styles.emptyChatText}>No messages yet. Ask the storekeeper about item substitutes or delivery updates!</Text>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderRole.toLowerCase() === 'customer';
                  return (
                    <View key={msg.id} style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                      <Text style={styles.senderName}>{msg.senderName} ({msg.senderRole})</Text>
                      <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>{msg.messageText}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type your message..."
                value={newChatText}
                onChangeText={setNewChatText}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, (!newChatText.trim() || sendingMsg) && { opacity: 0.5 }]} 
                onPress={handleSendMessage}
                disabled={!newChatText.trim() || sendingMsg}
              >
                <Send size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: 5-Star Rating & Store Review Modal */}
      <Modal visible={ratingOrderId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalCard}>
            <Text style={styles.ratingModalTitle}>Rate Your Experience</Text>
            <Text style={styles.ratingModalSub}>How was your delivery from Kirana Junction?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setSelectedStars(star)}>
                  <Star 
                    size={36} 
                    color="#F59E0B" 
                    fill={star <= selectedStars ? '#F59E0B' : 'transparent'} 
                    style={{ marginHorizontal: 4 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder="Leave a short review for the merchant and driver (optional)..."
              multiline
              numberOfLines={3}
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.cancelRatingBtn} onPress={() => setRatingOrderId(null)}>
                <Text style={styles.cancelRatingText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitRatingBtn} onPress={handleSubmitRating}>
                <Text style={styles.submitRatingText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  topHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, elevation: 1 },
  refreshText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  listContainer: { padding: 16 },
  orderCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 14, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  shopName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  orderId: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  itemsBox: { backgroundColor: '#F8F9FA', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5EA' },
  itemsTitle: { fontSize: 11, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 4 },
  itemsText: { fontSize: 13, color: '#1C1C1E', lineHeight: 18 },
  detailsRow: { borderTopWidth: 1, borderTopColor: '#F2F2F7', paddingTop: 10, marginBottom: 4 },
  detailsText: { fontSize: 14, color: '#3A3A3C', fontWeight: '600' },
  discountText: { fontSize: 12, color: '#059669', fontWeight: '700', marginTop: 2 },
  otpCard: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#FDE68A' },
  otpHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  otpTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  otpCode: { fontSize: 26, fontWeight: '900', color: '#B45309', letterSpacing: 6, marginVertical: 4 },
  otpSub: { fontSize: 11, color: '#92400E', lineHeight: 15 },
  driverBanner: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  driverLabel: { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  driverName: { fontSize: 13, fontWeight: '600', color: '#1E3A8A', marginTop: 2 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF9E6', padding: 10, borderRadius: 8, marginTop: 10 },
  infoBannerText: { fontSize: 12, color: '#B36B00', fontWeight: '500', flex: 1, lineHeight: 16 },
  quoteCard: { backgroundColor: '#E5F1FF', borderRadius: 10, padding: 12, marginTop: 10 },
  quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  quoteTitle: { fontSize: 15, fontWeight: '800', color: '#007AFF' },
  quoteSub: { fontSize: 12, color: '#3A3A3C', marginBottom: 10, lineHeight: 16 },
  acceptQuoteBtn: { backgroundColor: '#007AFF', height: 42, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  acceptQuoteBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  ratedCard: { backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  ratedTitle: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  ratedComment: { fontSize: 12, color: '#166534', marginTop: 3, fontStyle: 'italic' },
  rateOrderBtn: { backgroundColor: '#FEF3C7', height: 38, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: '#F59E0B' },
  rateOrderBtnText: { color: '#B45309', fontSize: 13, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  waBtn: { flex: 1, backgroundColor: '#25D366', height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  waBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  chatBtn: { flex: 1, backgroundColor: '#E5F1FF', height: 36, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#007AFF' },
  chatBtnText: { color: '#007AFF', fontSize: 12, fontWeight: '700' },
  refundCard: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, marginTop: 12 },
  refundText: { fontSize: 12, fontWeight: '600' },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF3B30', borderRadius: 8, height: 36, marginTop: 10 },
  cancelButtonText: { color: '#FF3B30', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  chatModalContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', paddingBottom: 20 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  chatTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  chatSubtitle: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  closeBtn: { padding: 4 },
  messagesList: { flex: 1 },
  emptyChatText: { textAlign: 'center', color: '#8E8E93', marginTop: 40, fontSize: 13, lineHeight: 18, paddingHorizontal: 20 },
  messageBubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#F2F2F7' },
  senderName: { fontSize: 10, fontWeight: '700', color: '#8E8E93', marginBottom: 2 },
  messageText: { fontSize: 14 },
  myText: { color: '#FFF' },
  otherText: { color: '#1C1C1E' },
  chatInputRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, gap: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  chatInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 14, height: 40, fontSize: 14 },
  sendBtn: { backgroundColor: '#007AFF', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ratingModalCard: { backgroundColor: '#FFF', margin: 20, borderRadius: 16, padding: 20, alignItems: 'center', alignSelf: 'center', width: '90%', elevation: 5 },
  ratingModalTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  ratingModalSub: { fontSize: 13, color: '#8E8E93', marginTop: 4, marginBottom: 16, textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  commentInput: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, width: '100%', padding: 12, fontSize: 14, marginBottom: 16 },
  modalActionsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelRatingBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#F2F2F7' },
  cancelRatingText: { color: '#8E8E93', fontWeight: '700' },
  submitRatingBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#F59E0B' },
  submitRatingText: { color: '#FFF', fontWeight: '700' }
});
