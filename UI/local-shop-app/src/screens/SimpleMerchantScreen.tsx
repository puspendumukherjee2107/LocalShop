import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl
} from 'react-native';
import {
  Store,
  CheckCircle2,
  Clock,
  RefreshCw,
  Tag,
  Package,
  IndianRupee,
  Phone,
  Calculator,
  Plus,
  Send
} from 'lucide-react-native';
import { BASE_URL } from '../services/apiConfig';
import { signalRService } from '../services/signalRService';

interface OrderItem {
  id: string;
  shopName: string;
  customerName: string;
  customerPhone: string;
  itemsText: string;
  itemsCount: number;
  totalAmount: number;
  quotedAmount?: number;
  status: string;
  createdAt: string;
}

interface SimpleMerchantScreenProps {
  shopName?: string;
}

export default function SimpleMerchantScreen({ shopName = 'Kirana Junction' }: SimpleMerchantScreenProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'action_needed' | 'all' | 'completed'>('action_needed');

  // Quoting Calculator State per Order
  const [quoteInputs, setQuoteInputs] = useState<{ [orderId: string]: string }>({});
  const [calcItems, setCalcItems] = useState<{ [orderId: string]: { name: string; price: string }[] }>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const fetchStoreProfile = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/stores/profile?shopName=${encodeURIComponent(shopName)}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.isOpen === 'boolean') {
          setIsOpen(data.isOpen);
        }
      }
    } catch {
      console.log('Error fetching store profile');
    }
  }, [shopName]);

  const handleToggleStoreOpen = async () => {
    setIsTogglingOpen(true);
    try {
      const res = await fetch(`${BASE_URL}/stores/toggle-open?shopName=${encodeURIComponent(shopName)}`, {
        method: 'PUT'
      });
      if (res.ok) {
        const data = await res.json();
        setIsOpen(data.isOpen);
        Alert.alert(
          data.isOpen ? 'Shop is Now OPEN! 🟢' : 'Shop is Now CLOSED 🔴',
          data.isOpen
            ? `${shopName} is now OPEN. Customers can browse and send you grocery orders.`
            : `${shopName} is now CLOSED. Incoming customer orders are paused.`
        );
      } else {
        Alert.alert('Error', 'Failed to toggle shop status.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    } finally {
      setIsTogglingOpen(false);
    }
  };

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/orders`);
      if (res.ok) {
        const data: OrderItem[] = await res.json();
        setOrders(data);
      }
    } catch {
      // quiet fallback in background poll
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(true);
    fetchStoreProfile();

    // 1. SignalR Real-Time Event Listeners
    const unsubNewOrder = signalRService.onNewOrder((order) => {
      setOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        if (exists) return prev;
        return [order, ...prev];
      });
      Alert.alert(
        'New Customer Order! 🛒',
        `Order ${order.id} received from ${order.customerName || 'Customer'}.\n\nItems:\n${order.itemsText || 'General grocery'}\n\nPlease review and quote price.`
      );
    });

    const unsubStatus = signalRService.onOrderStatusUpdated((data) => {
      setOrders(prev => prev.map(o => 
        o.id === data.orderId 
          ? { ...o, status: data.status } 
          : o
      ));
    });

    const unsubQuote = signalRService.onPriceQuote((data) => {
      setOrders(prev => prev.map(o => 
        o.id === data.orderId 
          ? { ...o, status: 'PriceQuoted', quotedAmount: data.quoteAmount, totalAmount: data.quoteAmount } 
          : o
      ));
    });

    const unsubStore = signalRService.onStoreStatusUpdated((data) => {
      if (data.shopName.toLowerCase() === shopName.toLowerCase()) {
        setIsOpen(data.isOpen);
      }
    });

    // 2. High-Frequency Background Polling (Every 2.5 seconds)
    const interval = setInterval(() => {
      fetchOrders(false);
      fetchStoreProfile();
    }, 2500);

    return () => {
      unsubNewOrder();
      unsubStatus();
      unsubQuote();
      unsubStore();
      clearInterval(interval);
    };
  }, [shopName, fetchOrders, fetchStoreProfile]);

  // Price Calculator Helpers
  const handlePriceInputChange = (orderId: string, text: string) => {
    setQuoteInputs(prev => ({ ...prev, [orderId]: text }));
  };

  const handleAddCalcItem = (orderId: string) => {
    setCalcItems(prev => {
      const current = prev[orderId] || [];
      return { ...prev, [orderId]: [...current, { name: '', price: '' }] };
    });
  };

  const handleUpdateCalcItem = (orderId: string, index: number, field: 'name' | 'price', value: string) => {
    setCalcItems(prev => {
      const current = [...(prev[orderId] || [])];
      current[index] = { ...current[index], [field]: value };

      // Auto-sum total if price changed
      const total = current.reduce((sum, item) => {
        const p = parseFloat(item.price);
        return sum + (isNaN(p) ? 0 : p);
      }, 0);

      if (total > 0) {
        setQuoteInputs(qPrev => ({ ...qPrev, [orderId]: total.toString() }));
      }

      return { ...prev, [orderId]: current };
    });
  };

  // 1. Merchant Sends Price Quote
  const handleSendQuote = async (orderId: string) => {
    const rawVal = quoteInputs[orderId];
    const amount = parseFloat(rawVal || '0');

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid total calculated bill amount (₹).');
      return;
    }

    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/quote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotedAmount: amount })
      });

      if (res.ok) {
        Alert.alert('Quote Dispatched! 🏷️', `Quote of ₹${amount} sent to the customer.`);
        fetchOrders();
      } else {
        Alert.alert('Error', 'Failed to dispatch price quote.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach server.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 2. Merchant Marks Order Packed & Ready
  const handleMarkPacked = async (orderId: string) => {
    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/packed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        Alert.alert('Order Packed! 📦', 'Confirmation sent to customer: Order is packed and ready.');
        fetchOrders();
      } else {
        Alert.alert('Error', 'Failed to update order to packed.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach server.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 3. Merchant Marks Delivered & Payment Done
  const handleMarkDeliveredAndPaid = async (orderId: string) => {
    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/delivered-and-paid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        Alert.alert(
          'Marked Delivered & Paid! 💰',
          'Updated! Waiting for the customer to confirm delivery & payment.'
        );
        fetchOrders();
      } else {
        Alert.alert('Error', 'Failed to update delivery status.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach server.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (filter === 'completed') {
      return o.status === 'Completed' || o.status === 'Delivered';
    }
    if (filter === 'action_needed') {
      return (
        o.status === 'QuoteRequested' ||
        o.status === 'Placed' ||
        o.status === 'Approved' ||
        o.status === 'Processing' ||
        o.status === 'Packed'
      );
    }
    return true;
  });

  const pendingQuotesCount = orders.filter(
    o => o.status === 'QuoteRequested' || o.status === 'Placed'
  ).length;

  const toPackCount = orders.filter(
    o => o.status === 'Approved' || o.status === 'Processing'
  ).length;

  return (
    <View style={styles.container}>
      {/* Merchant Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Store size={22} color="#007AFF" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.shopTitle}>{shopName}</Text>
            <Text style={styles.shopSub}>Store Dashboard • Direct Orders</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            fetchOrders();
            fetchStoreProfile();
          }}
          disabled={isLoading}
        >
          <RefreshCw size={16} color="#007AFF" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Store Open / Closed Status & Toggle Control Banner */}
      <View style={[styles.storeStatusBar, isOpen ? styles.statusBarOpen : styles.statusBarClosed]}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <View style={styles.statusDotRow}>
            <View style={[styles.pulseDot, { backgroundColor: isOpen ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.statusTextPrimary, { color: isOpen ? '#065F46' : '#991B1B' }]}>
              {isOpen ? 'SHOP IS OPEN FOR ORDERS' : 'SHOP IS CURRENTLY CLOSED'}
            </Text>
          </View>
          <Text style={styles.statusSubtext}>
            {isOpen
              ? 'Customers can browse and send you grocery orders.'
              : 'Tap button to open your store and start receiving orders.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.toggleOpenBtn, isOpen ? styles.btnMarkClose : styles.btnMarkOpen]}
          onPress={handleToggleStoreOpen}
          disabled={isTogglingOpen}
        >
          {isTogglingOpen ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.toggleOpenBtnText}>
              {isOpen ? 'Close Shop 🔴' : 'Open Shop 🟢'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'action_needed' && styles.filterChipActive]}
          onPress={() => setFilter('action_needed')}
        >
          <Text style={[styles.filterText, filter === 'action_needed' && styles.filterTextActive]}>
            Action Needed ({pendingQuotesCount + toPackCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All Orders ({orders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading incoming orders...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Package size={44} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Orders in this View</Text>
          <Text style={styles.emptySub}>
            Incoming customer grocery orders will appear here for pricing and packing.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchOrders(true); fetchStoreProfile(); }} />}
          renderItem={({ item }) => {
            const isQuoteNeeded = item.status === 'QuoteRequested' || item.status === 'Placed';
            const isWaitingApproval = item.status === 'PriceQuoted';
            const isApprovedReadyToPack = item.status === 'Approved' || item.status === 'Processing';
            const isPackedReadyToDeliver = item.status === 'Packed';
            const isDeliveredWaitingCustomer = item.status === 'DeliveredAndPaymentDone';
            const isCompleted = item.status === 'Completed' || item.status === 'Delivered';
            const isProcessing = processingOrderId === item.id;

            const orderCalcItems = calcItems[item.id] || [];

            return (
              <View style={styles.orderCard}>
                {/* Order Top Header */}
                <View style={styles.orderTop}>
                  <View>
                    <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
                    <Text style={styles.customerPhone}>📞 {item.customerPhone || 'No Phone'}</Text>
                    <Text style={styles.orderIdText}>Order #{item.id}</Text>
                  </View>
                </View>

                {/* Grocery Items List Requested */}
                <View style={styles.itemsBox}>
                  <Text style={styles.itemsLabel}>Customer's Grocery List:</Text>
                  <Text style={styles.itemsContent}>{item.itemsText || 'General order'}</Text>
                </View>

                {/* 1. STATE: NEW ORDER -> CALCULATE & QUOTE PRICE */}
                {isQuoteNeeded && (
                  <View style={styles.actionBoxQuote}>
                    <View style={styles.actionBoxHeader}>
                      <Calculator size={18} color="#D97706" />
                      <Text style={styles.actionBoxTitle}>Calculate & Send Price Quote</Text>
                    </View>

                    {/* Optional Itemized Calculator Rows */}
                    {orderCalcItems.length > 0 && (
                      <View style={styles.calcItemsList}>
                        {orderCalcItems.map((ci, idx) => (
                          <View key={idx} style={styles.calcRow}>
                            <TextInput
                              style={[styles.calcInput, { flex: 2 }]}
                              placeholder="Item name"
                              value={ci.name}
                              onChangeText={v => handleUpdateCalcItem(item.id, idx, 'name', v)}
                            />
                            <TextInput
                              style={[styles.calcInput, { flex: 1, marginLeft: 6 }]}
                              placeholder="₹ Price"
                              keyboardType="numeric"
                              value={ci.price}
                              onChangeText={v => handleUpdateCalcItem(item.id, idx, 'price', v)}
                            />
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.addCalcItemBtn}
                      onPress={() => handleAddCalcItem(item.id)}
                    >
                      <Plus size={14} color="#D97706" />
                      <Text style={styles.addCalcItemText}>+ Add Item Price Calculator Row</Text>
                    </TouchableOpacity>

                    {/* Total Quoted Amount Input */}
                    <View style={styles.quoteInputRow}>
                      <Text style={styles.rupeeSymbol}>₹</Text>
                      <TextInput
                        style={styles.quoteInput}
                        placeholder="Total Quoted Bill (₹)"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={quoteInputs[item.id] || ''}
                        onChangeText={v => handlePriceInputChange(item.id, v)}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.sendQuoteBtn, isProcessing && { opacity: 0.6 }]}
                      onPress={() => handleSendQuote(item.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <View style={styles.btnRow}>
                          <Send size={16} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.btnText}>Send Price Quote to Customer</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. STATE: QUOTE SENT -> WAITING FOR CUSTOMER APPROVAL */}
                {isWaitingApproval && (
                  <View style={styles.infoBannerQuoteSent}>
                    <Clock size={16} color="#059669" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.infoBannerTitle}>
                        Quote of ₹{item.quotedAmount || item.totalAmount} Sent
                      </Text>
                      <Text style={styles.infoBannerSub}>
                        Waiting for customer to approve the total bill on their app.
                      </Text>
                    </View>
                  </View>
                )}

                {/* 3. STATE: CUSTOMER APPROVED -> MERCHANT PACKS */}
                {isApprovedReadyToPack && (
                  <View style={styles.actionBoxPack}>
                    <View style={styles.actionBoxHeader}>
                      <CheckCircle2 size={18} color="#2563EB" />
                      <Text style={[styles.actionBoxTitle, { color: '#1D4ED8' }]}>
                        Customer Approved! (Bill: ₹{item.totalAmount})
                      </Text>
                    </View>
                    <Text style={styles.actionDesc}>
                      The customer accepted your price. Please pack the items into bags.
                    </Text>

                    <TouchableOpacity
                      style={[styles.packBtn, isProcessing && { opacity: 0.6 }]}
                      onPress={() => handleMarkPacked(item.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <View style={styles.btnRow}>
                          <Package size={16} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.btnText}>Mark Order Packed & Ready 📦</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 4. STATE: PACKED -> READY TO DELIVER / HANDOVER */}
                {isPackedReadyToDeliver && (
                  <View style={styles.actionBoxDeliver}>
                    <View style={styles.actionBoxHeader}>
                      <Package size={18} color="#7C3AED" />
                      <Text style={[styles.actionBoxTitle, { color: '#6D28D9' }]}>
                        Order Packed • Direct Transfer
                      </Text>
                    </View>
                    <Text style={styles.actionDesc}>
                      Items are ready for direct handover or customer pickup. Once handed over and payment received:
                    </Text>

                    <TouchableOpacity
                      style={[styles.deliverBtn, isProcessing && { opacity: 0.6 }]}
                      onPress={() => handleMarkDeliveredAndPaid(item.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <View style={styles.btnRow}>
                          <IndianRupee size={16} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.btnText}>
                            Mark Delivered & Payment Done (₹{item.totalAmount}) 💰
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 5. STATE: DELIVERED & PAID -> AWAITING CUSTOMER CONFIRMATION */}
                {isDeliveredWaitingCustomer && (
                  <View style={styles.infoBannerDelivered}>
                    <Clock size={16} color="#B45309" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.infoBannerTitleDelivered}>
                        Delivered & Paid (₹{item.totalAmount})
                      </Text>
                      <Text style={styles.infoBannerSub}>
                        Awaiting final customer confirmation on their screen.
                      </Text>
                    </View>
                  </View>
                )}

                {/* 6. STATE: COMPLETED */}
                {isCompleted && (
                  <View style={styles.infoBannerCompleted}>
                    <CheckCircle2 size={16} color="#15803D" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.infoBannerTitleCompleted}>
                        Completed & Verified by Customer 🎉
                      </Text>
                      <Text style={styles.infoBannerSub}>
                        Total Collected: ₹{item.totalAmount} • Order successfully closed.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA'
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  shopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E'
  },
  shopSub: {
    fontSize: 12,
    color: '#8E8E93'
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6
  },
  refreshText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA'
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F2F2F7'
  },
  filterChipActive: {
    backgroundColor: '#007AFF'
  },
  filterText: {
    fontSize: 12,
    color: '#3C3C43',
    fontWeight: '500'
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '700'
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#8E8E93'
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 12
  },
  emptySub: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA'
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E'
  },
  customerPhone: {
    fontSize: 12,
    color: '#636366',
    marginTop: 2
  },
  orderIdText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2
  },
  itemsBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F2'
  },
  itemsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#636366',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  itemsContent: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 18
  },
  actionBoxQuote: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  actionBoxPack: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  actionBoxDeliver: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE'
  },
  actionBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  actionBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 6
  },
  actionDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 10
  },
  calcItemsList: {
    marginBottom: 8
  },
  calcRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  calcInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: '#1C1C1E'
  },
  addCalcItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  addCalcItemText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
    marginLeft: 4
  },
  quoteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    marginBottom: 10
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B45309',
    marginRight: 4
  },
  quoteInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E'
  },
  sendQuoteBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  packBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  deliverBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700'
  },
  infoBannerQuoteSent: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoBannerDelivered: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoBannerCompleted: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46'
  },
  infoBannerTitleDelivered: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A3412'
  },
  infoBannerTitleCompleted: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D'
  },
  infoBannerSub: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2
  },
  storeStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statusBarOpen: {
    backgroundColor: '#ECFDF5',
    borderBottomColor: '#A7F3D0',
  },
  statusBarClosed: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FECACA',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusTextPrimary: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusSubtext: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  toggleOpenBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  btnMarkOpen: {
    backgroundColor: '#10B981',
  },
  btnMarkClose: {
    backgroundColor: '#EF4444',
  },
  toggleOpenBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
