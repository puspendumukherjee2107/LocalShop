import {
  CheckCircle2,
  IndianRupee,
  Layers,
  MessageSquare,
  Package,
  PlusCircle,
  Receipt,
  Send,
  ShoppingBag,
  Truck,
  X
} from 'lucide-react-native';
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
import { openWhatsAppToCustomer } from '../utils/whatsappHelper';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  isAvailable: boolean;
}

interface StaffMember {
  id: number;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
}

interface OrderMessage {
  id: number;
  orderId: string;
  senderRole: string;
  senderName: string;
  messageText: string;
  createdAt: string;
}

interface OrderRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  shopName: string;
  itemsText: string;
  itemsCount: number;
  totalAmount: number;
  status: string;
  orderType: string;
  createdAt: string;
  deliveryOtp?: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  discountAmount?: number;
  couponCode?: string;
  rating?: number;
  reviewComment?: string;
}

export default function InventoryScreen() {
  const [tab, setTab] = useState<'quotes' | 'quickbill' | 'catalog'>('quotes');

  // Quotes & Requests State
  const [incomingOrders, setIncomingOrders] = useState<OrderRequest[]>([]);
  const [quoteAmounts, setQuoteAmounts] = useState<{ [key: string]: string }>({});

  // Driver Assignment State
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Live Chat Drawer State
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<OrderMessage[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Quick Counter Bill State (Zero inventory required)
  const [billCustomer, setBillCustomer] = useState('');
  const [billPhone, setBillPhone] = useState('');
  const [billItems, setBillItems] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPaymentMethod, setBillPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');

  // Optional Product Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  useEffect(() => {
    fetchActiveInventory();
    fetchIncomingOrders();
    fetchStaffList();

    // 1. Listen for new customer orders/grocery lists in real-time
    const unsubNewOrder = signalRService.onNewOrder((order) => {
      setIncomingOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        if (exists) return prev;
        return [order, ...prev];
      });
      Alert.alert(
        'New Customer Order! 🛒',
        `Order ${order.id} received from ${order.customerName}.\n\nItems:\n${order.itemsText || 'General'}\n\nCheck Orders tab to quote shelf price.`
      );
    });

    // 2. Listen for customer payment confirmations & status updates
    const unsubStatus = signalRService.onOrderStatusUpdated((data) => {
      setIncomingOrders(prev =>
        prev.map(o => o.id === data.orderId ? { ...o, status: data.status } : o)
      );
    });

    // 3. Listen for in-order messages
    const unsubChat = signalRService.onOrderMessage((msg) => {
      if (activeChatOrderId === msg.orderId) {
        setChatMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      unsubNewOrder();
      unsubStatus();
      unsubChat();
    };
  }, [activeChatOrderId]);

  const fetchActiveInventory = async () => {
    try {
      const response = await fetch(`${BASE_URL}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch {
      console.error('Error connecting to catalog repository.');
    }
  };

  const fetchIncomingOrders = async () => {
    try {
      const response = await fetch(`${BASE_URL}/orders`);
      if (response.ok) {
        const data: OrderRequest[] = await response.json();
        setIncomingOrders(data);
      }
    } catch {
      console.error('Error fetching incoming orders.');
    }
  };

  const fetchStaffList = async () => {
    try {
      const response = await fetch(`${BASE_URL}/staff`);
      if (response.ok) {
        const data: StaffMember[] = await response.json();
        setStaffList(data);
      }
    } catch {
      console.log('Error loading staff list.');
    }
  };

  // 1. Send Price Quote for an uncataloged customer list order
  const handleSendQuote = async (orderId: string) => {
    const amountStr = quoteAmounts[orderId];
    const amount = parseFloat(amountStr || '0');

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid quoted total bill amount.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/orders/${orderId}/quote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotedAmount: amount }),
      });

      if (response.ok) {
        Alert.alert('Quote Dispatched! 🏷️', `Quote of ₹${amount} sent to customer for order ${orderId}.`);
        fetchIncomingOrders();
      } else {
        Alert.alert('Error', 'Failed to dispatch price quote.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  // 2. Assign Delivery Partner
  const handleAssignDriver = async (orderId: string, staff: StaffMember) => {
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/assign-driver`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: staff.name,
          driverPhone: staff.phone
        })
      });

      if (res.ok) {
        Alert.alert('Driver Assigned! 🛵', `${staff.name} has been assigned to order ${orderId}. Status updated to Out for Delivery.`);
        setAssigningOrderId(null);
        fetchIncomingOrders();
      } else {
        Alert.alert('Error', 'Failed to assign driver.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach server.');
    }
  };

  // 3. In-Order Chat Methods
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
          senderRole: 'Merchant',
          senderName: 'Kirana Junction',
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

  // 4. Mark order as Delivered directly
  const handleMarkDelivered = async (orderId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Delivered' }),
      });

      if (response.ok) {
        Alert.alert('Order Completed', `Order ${orderId} marked as Delivered.`);
        fetchIncomingOrders();
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  // 5. Counter Quick Bill
  const handleCreateQuickBill = async () => {
    const parsedAmount = parseFloat(billAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid total sale amount.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/orders/quick-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: billCustomer.trim() || 'Walk-in Customer',
          customerPhone: billPhone.trim(),
          shopName: 'Kirana Junction',
          itemsText: billItems.trim() || 'Counter Sale',
          itemsCount: 1,
          totalAmount: parsedAmount,
          paymentMethod: billPaymentMethod
        }),
      });

      if (response.ok) {
        const created = await response.json();
        Alert.alert('Sale Recorded! 💰', `Invoice ${created.id} for ₹${parsedAmount} recorded via ${billPaymentMethod}!`);
        setBillCustomer('');
        setBillPhone('');
        setBillItems('');
        setBillAmount('');
        fetchIncomingOrders();
      } else {
        Alert.alert('Error', 'Failed to record sale.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  // 6. Add item to optional product catalog
  const handleAddProduct = async () => {
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);

    if (!name.trim() || isNaN(parsedPrice) || isNaN(parsedStock)) {
      Alert.alert("Input Error", "Please provide item name, price and stock count.");
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: parsedPrice,
          stock: parsedStock,
          category: 'Groceries',
          isAvailable: parsedStock > 0
        })
      });

      if (response.ok) {
        Alert.alert("Success", `${name} added to live shop stock!`);
        setName('');
        setPrice('');
        setStock('');
        fetchActiveInventory();
      }
    } catch (error) {
      console.error("Save product fault:", error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      {/* 3-Section Merchant Workflow Tabs */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, tab === 'quotes' && styles.navItemActive]}
          onPress={() => setTab('quotes')}
        >
          <ShoppingBag size={16} color={tab === 'quotes' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.navText, tab === 'quotes' && styles.navTextActive]}>
            Orders ({incomingOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, tab === 'quickbill' && styles.navItemActive]}
          onPress={() => setTab('quickbill')}
        >
          <Receipt size={16} color={tab === 'quickbill' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.navText, tab === 'quickbill' && styles.navTextActive]}>
            Quick Bill
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, tab === 'catalog' && styles.navItemActive]}
          onPress={() => setTab('catalog')}
        >
          <Package size={16} color={tab === 'catalog' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.navText, tab === 'catalog' && styles.navTextActive]}>
            Stock ({products.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. Customer Orders & Grocery Lists */}
      {tab === 'quotes' && (
        <FlatList
          data={incomingOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          onRefresh={fetchIncomingOrders}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Orders Pending</Text>
              <Text style={styles.emptySub}>
                Customer lists and catalog orders will appear here automatically in real time.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderCustomer}>{item.customerName}</Text>
                  <Text style={styles.orderMeta}>{item.id} • {item.customerPhone || 'No Phone'}</Text>
                </View>
                <View style={[
                  styles.statusPill,
                  item.status === 'QuoteRequested' ? styles.pillOrange :
                  item.status === 'PriceQuoted' ? styles.pillBlue :
                  item.status === 'Processing' ? styles.pillGreen :
                  item.status === 'Out for Delivery' ? styles.pillPurple : styles.pillGray
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    item.status === 'QuoteRequested' ? { color: '#B36B00' } :
                    item.status === 'PriceQuoted' ? { color: '#007AFF' } :
                    item.status === 'Processing' ? { color: '#248A3D' } :
                    item.status === 'Out for Delivery' ? { color: '#6D28D9' } : { color: '#8E8E93' }
                  ]}>
                    {item.status === 'QuoteRequested' ? '⏳ Quote Needed' :
                     item.status === 'PriceQuoted' ? '🏷️ Quoted' :
                     item.status === 'Processing' ? '🟢 Confirmed' :
                     item.status === 'Out for Delivery' ? '🛵 Out for Delivery' : item.status}
                  </Text>
                </View>
              </View>

              {/* Customer Grocery Items List */}
              <View style={styles.itemsBox}>
                <Text style={styles.itemsBoxLabel}>Requested Items:</Text>
                <Text style={styles.itemsContent}>{item.itemsText || 'Standard items order'}</Text>
              </View>

              {/* Bill & Discount Summary */}
              {item.totalAmount > 0 ? (
                <View style={styles.billSummaryRow}>
                  <Text style={styles.billSummaryText}>Bill: ₹{item.totalAmount}</Text>
                  {item.discountAmount && item.discountAmount > 0 ? (
                    <Text style={styles.billDiscountText}> (Coupon {item.couponCode || 'PROMO'}: -₹{item.discountAmount})</Text>
                  ) : null}
                  {item.deliveryOtp && !['Delivered', 'Cancelled'].includes(item.status) ? (
                    <Text style={styles.billOtpBadge}>🔑 OTP: {item.deliveryOtp}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Delivery Driver Assigned Badge */}
              {item.deliveryPartnerName ? (
                <View style={styles.driverInfoCard}>
                  <Truck size={14} color="#1E40AF" />
                  <Text style={styles.driverInfoText}>
                    Assigned: {item.deliveryPartnerName} {item.deliveryPartnerPhone ? `(${item.deliveryPartnerPhone})` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Review & Rating Display */}
              {item.rating ? (
                <View style={styles.reviewSnippet}>
                  <Text style={styles.reviewStars}>{'⭐'.repeat(item.rating)} Customer Rating ({item.rating}/5)</Text>
                  {item.reviewComment ? <Text style={styles.reviewComment}>“{item.reviewComment}”</Text> : null}
                </View>
              ) : null}

              {/* Action 1: Quote Price */}
              {item.status === 'QuoteRequested' && (
                <View style={styles.quoteRow}>
                  <View style={styles.quoteInputWrapper}>
                    <IndianRupee size={16} color="#8E8E93" style={{ marginRight: 4 }} />
                    <TextInput
                      style={styles.quoteInput}
                      placeholder="Total Bill (₹)"
                      keyboardType="numeric"
                      value={quoteAmounts[item.id] || ''}
                      onChangeText={val => setQuoteAmounts({ ...quoteAmounts, [item.id]: val })}
                    />
                  </View>
                  <TouchableOpacity style={styles.quoteBtn} onPress={() => handleSendQuote(item.id)}>
                    <Send size={15} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.quoteBtnText}>Send Bill</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action 2: Price Quoted notice */}
              {item.status === 'PriceQuoted' && (
                <View style={styles.quotedNotice}>
                  <Text style={styles.quotedNoticeText}>
                    Bill of ₹{item.totalAmount} sent. Awaiting customer confirmation & payment.
                  </Text>
                </View>
              )}

              {/* Action 3: Mark order as delivered */}
              {item.status === 'Processing' && (
                <View style={styles.processingActionsRow}>
                  {false && (
                    <TouchableOpacity 
                      style={styles.assignDriverBtn} 
                      onPress={() => setAssigningOrderId(item.id)}
                    >
                      <Truck size={15} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.assignDriverBtnText}>Assign Driver</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.deliverBtn} 
                    onPress={() => handleMarkDelivered(item.id)}
                  >
                    <CheckCircle2 size={15} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.deliverBtnText}>Deliver Direct</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Communication Bar: In-Order Live Chat only */}
              <View style={styles.commRow}>
                {false && item.customerPhone ? (
                  <TouchableOpacity 
                    style={styles.waMerchantBtn}
                    onPress={() => openWhatsAppToCustomer(
                      item.customerPhone,
                      item.customerName,
                      item.id,
                      item.totalAmount,
                      item.deliveryOtp
                    )}
                  >
                    <Text style={styles.waMerchantBtnText}>💬 WhatsApp Customer</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity 
                  style={styles.chatMerchantBtn}
                  onPress={() => handleOpenChat(item.id)}
                >
                  <MessageSquare size={13} color="#007AFF" style={{ marginRight: 4 }} />
                  <Text style={styles.chatMerchantBtnText}>Order Chat</Text>
                </TouchableOpacity>
              </View>

            </View>
          )}
        />
      )}

      {/* 2. Quick Counter Billing (Zero Inventory Maintenance) */}
      {tab === 'quickbill' && (
        <ScrollView contentContainerStyle={styles.quickBillContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>⚡ Quick Counter Bill (No Inventory Needed)</Text>
            <Text style={styles.formSub}>
              Directly punch in total bill amount and customer details to record instant sales.
            </Text>

            <Text style={styles.fieldLabel}>Customer Name</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g., Walk-in Customer / Ramesh"
              value={billCustomer}
              onChangeText={setBillCustomer}
            />

            <Text style={styles.fieldLabel}>Customer Mobile (Optional)</Text>
            <TextInput
              style={styles.inputField}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              value={billPhone}
              onChangeText={setBillPhone}
            />

            <Text style={styles.fieldLabel}>Items Sold / Notes</Text>
            <TextInput
              style={[styles.inputField, { height: 60 }]}
              placeholder="e.g., 2kg Atta, 1L Milk, 1 Bread, Soap"
              multiline
              value={billItems}
              onChangeText={setBillItems}
            />

            <Text style={styles.fieldLabel}>Total Bill Amount (₹) *</Text>
            <TextInput
              style={[styles.inputField, styles.amountInput]}
              placeholder="₹ 0.00"
              keyboardType="numeric"
              value={billAmount}
              onChangeText={setBillAmount}
            />

            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, billPaymentMethod === 'Cash' && styles.methodBtnActive]}
                onPress={() => setBillPaymentMethod('Cash')}
              >
                <Text style={[styles.methodText, billPaymentMethod === 'Cash' && styles.methodTextActive]}>💵 Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, billPaymentMethod === 'UPI' && styles.methodBtnActive]}
                onPress={() => setBillPaymentMethod('UPI')}
              >
                <Text style={[styles.methodText, billPaymentMethod === 'UPI' && styles.methodTextActive]}>📱 UPI</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBillBtn} onPress={handleCreateQuickBill}>
              <Receipt size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitBillBtnText}>Record Sale & Collect Payment</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* 3. Optional Catalog & Stock */}
      {tab === 'catalog' && (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Specific Item to Catalog</Text>
            <Text style={styles.formSub}>Optional: Add specific standard items if you wish to display them.</Text>
            
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.input} 
                placeholder="Product Name (e.g., Basmati Rice)" 
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.rowLayout}>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <IndianRupee size={18} color="#8E8E93" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Price" 
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Layers size={18} color="#8E8E93" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Stock Qty" 
                  keyboardType="numeric"
                  value={stock}
                  onChangeText={setStock}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleAddProduct}>
              <PlusCircle size={20} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Catalog Grid Section */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>Live Stock Catalog</Text>
            <Text style={styles.countBadge}>{products.length} Items</Text>
          </View>

          {products.map(item => (
            <View key={item.id.toString()} style={styles.productCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>
                  Price: ₹{item.price}  |  Stock: {item.stock} units
                </Text>
              </View>
              <View style={[
                styles.stockIndicator, 
                { backgroundColor: item.stock < 5 ? '#FF3B30' : '#34C759' }
              ]} />
            </View>
          ))}
        </ScrollView>
      )}

      {false && (
        <Modal visible={assigningOrderId !== null} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.assignModalCard}>
              <View style={styles.assignModalHeader}>
                <Text style={styles.assignModalTitle}>Assign Delivery Partner</Text>
                <TouchableOpacity onPress={() => setAssigningOrderId(null)}>
                  <X size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <Text style={styles.assignModalSub}>
                Select a staff member to deliver Order {assigningOrderId}.
              </Text>

              <ScrollView style={{ maxHeight: 260, marginVertical: 10 }}>
                {staffList.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: '#8E8E93', marginVertical: 20 }}>
                    No staff members registered. Add delivery drivers in the “👥 Staff” tab.
                  </Text>
                ) : (
                  staffList.map((staff) => (
                    <TouchableOpacity
                      key={staff.id}
                      style={styles.staffItemCard}
                      onPress={() => assigningOrderId && handleAssignDriver(assigningOrderId, staff)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffItemName}>{staff.name}</Text>
                        <Text style={styles.staffItemRole}>
                          {staff.role} • 📞 {staff.phone} {staff.isActive ? '🟢 Active' : '⚪ Inactive'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity style={styles.closeAssignBtn} onPress={() => setAssigningOrderId(null)}>
                <Text style={styles.closeAssignBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL 2: In-Order Live Chat Modal */}
      <Modal visible={activeChatOrderId !== null} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.chatModalContainer}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>Order Chat • {activeChatOrderId}</Text>
                <Text style={styles.chatSubtitle}>Live thread with Customer & Delivery Driver</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveChatOrderId(null)} style={styles.closeBtn}>
                <X size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.messagesList} contentContainerStyle={{ padding: 12 }}>
              {chatMessages.length === 0 ? (
                <Text style={styles.emptyChatText}>No messages yet. Send an update about item availability or packing!</Text>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderRole.toLowerCase() === 'merchant';
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

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  navBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', gap: 6 },
  navItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 4 },
  navItemActive: { backgroundColor: '#E5F1FF' },
  navText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  navTextActive: { color: '#007AFF' },
  listContainer: { padding: 16 },
  scrollContainer: { paddingBottom: 40 },
  quickBillContainer: { padding: 16 },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 30, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#8E8E93', textAlign: 'center', lineHeight: 18 },
  orderCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderCustomer: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  orderMeta: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillOrange: { backgroundColor: '#FFF9E6' },
  pillBlue: { backgroundColor: '#E5F1FF' },
  pillGreen: { backgroundColor: '#E5F9ED' },
  pillPurple: { backgroundColor: '#F3E8FF' },
  pillGray: { backgroundColor: '#F2F2F7' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  itemsBox: { backgroundColor: '#F8F9FA', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E5E5EA' },
  itemsBoxLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 4 },
  itemsContent: { fontSize: 13, color: '#1C1C1E', lineHeight: 18 },
  billSummaryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  billSummaryText: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  billDiscountText: { fontSize: 12, fontWeight: '600', color: '#059669' },
  billOtpBadge: { marginLeft: 'auto', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 11, fontWeight: '800', color: '#92400E' },
  driverInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', padding: 8, borderRadius: 6, marginBottom: 8 },
  driverInfoText: { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  reviewSnippet: { backgroundColor: '#F0FDF4', padding: 8, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  reviewStars: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  reviewComment: { fontSize: 11, color: '#166534', fontStyle: 'italic', marginTop: 2 },
  quoteRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  quoteInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 8, paddingHorizontal: 10, height: 40 },
  quoteInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  quoteBtn: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 16, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  quoteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  quotedNotice: { backgroundColor: '#E5F1FF', padding: 10, borderRadius: 8, marginBottom: 8 },
  quotedNoticeText: { color: '#007AFF', fontSize: 12, fontWeight: '600' },
  processingActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  assignDriverBtn: { flex: 1, backgroundColor: '#6D28D9', height: 40, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  assignDriverBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  deliverBtn: { flex: 1, backgroundColor: '#34C759', height: 40, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deliverBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  commRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  waMerchantBtn: { flex: 1, backgroundColor: '#25D366', height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  waMerchantBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  chatMerchantBtn: { flex: 1, backgroundColor: '#E5F1FF', height: 34, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#007AFF' },
  chatMerchantBtnText: { color: '#007AFF', fontSize: 12, fontWeight: '700' },
  formCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 1 },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  formSub: { fontSize: 12, color: '#8E8E93', marginBottom: 14, lineHeight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#3A3A3C', marginBottom: 6 },
  inputField: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, fontSize: 14, color: '#1C1C1E', marginBottom: 12 },
  amountInput: { fontSize: 18, fontWeight: '700', color: '#007AFF' },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  methodBtn: { flex: 1, backgroundColor: '#F2F2F7', paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA' },
  methodBtnActive: { backgroundColor: '#E5F1FF', borderColor: '#007AFF' },
  methodText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  methodTextActive: { color: '#007AFF' },
  submitBillBtn: { backgroundColor: '#34C759', height: 46, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  submitBillBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 8, paddingHorizontal: 10, marginBottom: 12, height: 44 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1C1C1E' },
  rowLayout: { flexDirection: 'row', gap: 12 },
  submitButton: { flexDirection: 'row', backgroundColor: '#007AFF', borderRadius: 8, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 8 },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  countBadge: { fontSize: 13, fontWeight: '600', color: '#8E8E93', backgroundColor: '#E5E5EA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  productCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  productMeta: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  stockIndicator: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  assignModalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  assignModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignModalTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  assignModalSub: { fontSize: 12, color: '#8E8E93', marginTop: 4, marginBottom: 8 },
  staffItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E5EA' },
  staffItemName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  staffItemRole: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  closeAssignBtn: { backgroundColor: '#F2F2F7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  closeAssignBtnText: { color: '#8E8E93', fontWeight: '700' },
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
  sendBtn: { backgroundColor: '#007AFF', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }
});
