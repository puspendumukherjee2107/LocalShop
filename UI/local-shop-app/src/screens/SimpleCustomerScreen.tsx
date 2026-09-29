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
  ShoppingBag,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Plus,
  MapPin,
  Phone,
  Check,
  Tag,
  Package,
  IndianRupee,
  XCircle
} from 'lucide-react-native';
import { BASE_URL } from '../services/apiConfig';
import { signalRService } from '../services/signalRService';

interface StoreItem {
  id: string;
  shopName: string;
  category: string;
  isOpen: boolean;
  operatingHours?: string;
  minOrderAmount?: number;
}

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
  deliveryOtp?: string;
}

export default function SimpleCustomerScreen() {
  const [activeTab, setActiveTab] = useState<'new_order' | 'my_orders'>('new_order');

  // Available Merchants
  const [stores, setStores] = useState<StoreItem[]>([
    { id: '1', shopName: 'Tarama Stores', category: 'Groceries & Daily Essentials', isOpen: true, operatingHours: '8:00 AM - 10:00 PM' },
    { id: '2', shopName: 'Gupta Supermarket', category: 'Groceries & Spices', isOpen: true, operatingHours: '7:30 AM - 10:00 PM' },
    { id: '3', shopName: 'Deluxe Dairy Hub', category: 'Dairy, Bakery & Sweets', isOpen: true, operatingHours: '6:00 AM - 9:00 PM' }
  ]);
  const [selectedStore, setSelectedStore] = useState<StoreItem>(stores[0]);

  // Order Input State
  const [groceryText, setGroceryText] = useState('');
  const [customerName, setCustomerName] = useState('Turja Mukherjee');
  const [customerPhone, setCustomerPhone] = useState('9876543210');
  const [deliveryAddress, setDeliveryAddress] = useState('Flat 4B, Greenfield Apartments');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // My Orders State
  const [myOrders, setMyOrders] = useState<OrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Quick suggestions
  const quickItems = [
    'Amul Milk (500ml)',
    'Aashirvaad Atta (1kg)',
    'Brown Bread',
    'Eggs (6 pcs)',
    'Fortune Mustard Oil (1L)',
    'Tata Salt (1kg)',
    'Sugar (1kg)',
    'Maggi 4-Pack',
    'Tea (250g)'
  ];

  const loadStores = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/stores`);
      if (res.ok) {
        const data = await res.json();
        const storeList: StoreItem[] = Array.isArray(data) ? data : data.value || [];
        if (storeList.length > 0) {
          setStores(storeList);
          setSelectedStore(prev => storeList.find(s => s.shopName.toLowerCase() === prev.shopName.toLowerCase()) || storeList[0]);
        }
      }
    } catch {
      // Fallback already pre-seeded in state
    }
  }, []);

  const loadMyOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoadingOrders(true);
    try {
      const res = await fetch(`${BASE_URL}/orders`);
      if (res.ok) {
        const data: OrderItem[] = await res.json();
        // Filter orders for this customer (or show all local orders for demo simplicity)
        const relevant = data.filter(
          o => !customerPhone || o.customerPhone === customerPhone || o.customerName === customerName
        );
        setMyOrders(relevant.length > 0 ? relevant : data);
      }
    } catch {
      // quiet fallback in background poll
    } finally {
      if (showLoading) setIsLoadingOrders(false);
    }
  }, [customerName, customerPhone]);

  useEffect(() => {
    loadStores();
    loadMyOrders(true);

    // 1. SignalR Real-Time Event Listeners
    const unsubQuote = signalRService.onPriceQuote((data) => {
      setMyOrders(prev => prev.map(o => 
        o.id === data.orderId 
          ? { ...o, status: 'PriceQuoted', quotedAmount: data.quoteAmount, totalAmount: data.quoteAmount } 
          : o
      ));
    });

    const unsubStatus = signalRService.onOrderStatusUpdated((data) => {
      setMyOrders(prev => prev.map(o => 
        o.id === data.orderId 
          ? { ...o, status: data.status } 
          : o
      ));
    });

    const unsubStore = signalRService.onStoreStatusUpdated((data) => {
      setStores(prev => prev.map(s => 
        s.shopName.toLowerCase() === data.shopName.toLowerCase() 
          ? { ...s, isOpen: data.isOpen } 
          : s
      ));
      setSelectedStore(prev => 
        prev.shopName.toLowerCase() === data.shopName.toLowerCase() 
          ? { ...prev, isOpen: data.isOpen } 
          : prev
      );
    });

    // 2. High-Frequency Background Polling (Every 2.5 seconds)
    const interval = setInterval(() => {
      loadStores();
      loadMyOrders(false);
    }, 2500);

    return () => {
      unsubQuote();
      unsubStatus();
      unsubStore();
      clearInterval(interval);
    };
  }, [loadStores, loadMyOrders]);

  const handleAddSuggestion = (item: string) => {
    const line = `• ${item}`;
    if (!groceryText.includes(item)) {
      setGroceryText(prev => (prev ? `${prev}\n${line}` : line));
    }
  };

  // 1. Customer Places Order
  const handlePlaceOrder = async () => {
    if (!groceryText.trim()) {
      Alert.alert('Empty Grocery List', 'Please type or tap items to add to your grocery list.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/orders/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          shopName: selectedStore.shopName,
          itemsText: groceryText.trim(),
          deliveryAddress: deliveryAddress.trim()
        })
      });

      if (res.ok) {
        const createdOrder: OrderItem = await res.json();
        Alert.alert(
          'Order Dispatched! 🚀',
          `Your order has been sent to ${selectedStore.shopName}.\n\nThe merchant will calculate prices and send you a quote shortly.`
        );
        setGroceryText('');
        // Switch to My Orders tab and reload
        setActiveTab('my_orders');
        loadMyOrders();
      } else {
        Alert.alert('Order Failed', 'Could not send order to the store. Please try again.');
      }
    } catch {
      Alert.alert('Connection Error', 'Cannot reach the LocalShop API server. Please check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Customer Approves Quoted Price
  const handleApproveQuote = async (orderId: string, amount: number) => {
    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'Direct Transfer' })
      });

      if (res.ok) {
        Alert.alert(
          'Order Approved! ✅',
          `You approved the price of ₹${amount}. The merchant will now pack your order.`
        );
        loadMyOrders();
      } else {
        Alert.alert('Error', 'Failed to approve order.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach server.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 2b. Customer Does Not Approve Quoted Price
  const handleDisapproveQuote = (orderId: string, amount: number) => {
    Alert.alert(
      'Do Not Approve Order',
      `Are you sure you do not want to approve this order with quoted bill ₹${amount}? The order will be cancelled.`,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Do Not Approve',
          style: 'destructive',
          onPress: async () => {
            setProcessingOrderId(orderId);
            try {
              const res = await fetch(`${BASE_URL}/orders/${orderId}/disapprove`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  role: 'customer',
                  reason: 'Customer declined the quoted price and chose not to approve the order.'
                })
              });

              if (res.ok) {
                Alert.alert(
                  'Order Not Approved ❌',
                  'You chose not to approve this order. The store has been notified and the order is closed.'
                );
                loadMyOrders();
              } else {
                Alert.alert('Error', 'Failed to decline order.');
              }
            } catch {
              Alert.alert('Network Error', 'Cannot reach server.');
            } finally {
              setProcessingOrderId(null);
            }
          }
        }
      ]
    );
  };

  // Customer cancels order while waiting for quote
  const handleCancelPendingOrder = (orderId: string) => {
    Alert.alert(
      'Cancel Order Request',
      'Are you sure you want to cancel this grocery order request?',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            setProcessingOrderId(orderId);
            try {
              const res = await fetch(`${BASE_URL}/orders/${orderId}/disapprove`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  role: 'customer',
                  reason: 'Customer cancelled the request before quotation.'
                })
              });

              if (res.ok) {
                Alert.alert('Order Cancelled', 'Your order request has been cancelled.');
                loadMyOrders();
              } else {
                Alert.alert('Error', 'Failed to cancel order.');
              }
            } catch {
              Alert.alert('Network Error', 'Cannot reach server.');
            } finally {
              setProcessingOrderId(null);
            }
          }
        }
      ]
    );
  };

  // 3. Customer Approves Delivery & Payment Done
  const handleCustomerConfirmDelivered = async (orderId: string) => {
    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/customer-confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        Alert.alert(
          'Order Completed! 🎉',
          'You confirmed that delivery and payment were completed successfully. Thank you!'
        );
        loadMyOrders();
      } else {
        Alert.alert('Error', 'Failed to confirm order completion.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach server.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const activeOrdersCount = myOrders.filter(
    o => o.status !== 'Completed' && o.status !== 'Cancelled'
  ).length;

  return (
    <View style={styles.container}>
      {/* Top Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'new_order' && styles.tabButtonActive]}
          onPress={() => setActiveTab('new_order')}
        >
          <ShoppingBag size={18} color={activeTab === 'new_order' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'new_order' && styles.tabTextActive]}>
            New Order
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my_orders' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('my_orders');
            loadMyOrders();
          }}
        >
          <Clock size={18} color={activeTab === 'my_orders' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'my_orders' && styles.tabTextActive]}>
            My Orders
          </Text>
          {activeOrdersCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeOrdersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* TAB 1: NEW ORDER */}
      {activeTab === 'new_order' ? (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* 1. Select Merchant */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Store size={20} color="#007AFF" />
              <Text style={styles.cardTitle}>1. Select Neighborhood Store</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeList}>
              {stores.map(store => {
                const isSelected = selectedStore.shopName === store.shopName;
                return (
                  <TouchableOpacity
                    key={store.id}
                    style={[styles.storeCard, isSelected && styles.storeCardActive]}
                    onPress={() => setSelectedStore(store)}
                  >
                    <View style={styles.storeCardTop}>
                      <Text style={[styles.storeName, isSelected && styles.storeNameActive]}>
                        {store.shopName}
                      </Text>
                      {isSelected && <Check size={16} color="#007AFF" />}
                    </View>
                    <Text style={styles.storeCategory} numberOfLines={1}>{store.category}</Text>
                    <View style={styles.storeStatusRow}>
                      <View style={[styles.statusDot, { backgroundColor: store.isOpen ? '#34C759' : '#FF3B30' }]} />
                      <Text style={styles.storeStatusText}>{store.isOpen ? 'Open' : 'Closed'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 2. Add Grocery Items */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ShoppingBag size={20} color="#007AFF" />
              <Text style={styles.cardTitle}>2. Add Grocery Items</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Tap quick items below or type your custom grocery list:
            </Text>

            {/* Quick Suggestions Chips */}
            <View style={styles.chipsContainer}>
              {quickItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => handleAddSuggestion(item)}
                >
                  <Plus size={12} color="#007AFF" />
                  <Text style={styles.chipText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Multi-line Grocery Input */}
            <TextInput
              style={styles.groceryInput}
              multiline
              numberOfLines={5}
              placeholder="e.g.&#10;• 1kg Aashirvaad Atta&#10;• 500ml Amul Milk&#10;• 1 packet Brown Bread&#10;• 6 Eggs"
              placeholderTextColor="#8E8E93"
              value={groceryText}
              onChangeText={setGroceryText}
            />

            {groceryText.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setGroceryText('')}>
                <Text style={styles.clearBtnText}>Clear List</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 3. Delivery / Customer Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={20} color="#007AFF" />
              <Text style={styles.cardTitle}>3. Contact & Delivery Info</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Name:</Text>
              <TextInput
                style={styles.singleInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Your Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number:</Text>
              <TextInput
                style={styles.singleInput}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
                placeholder="Phone Number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Address / Landmark:</Text>
              <TextInput
                style={styles.singleInput}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Address or Apartment No."
              />
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                ℹ️ Direct Handover: Either the store delivers directly or you can pick it up. No third-party delivery fee!
              </Text>
            </View>
          </View>

          {/* Submit Order Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Send size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>
                  Send Order to {selectedStore.shopName}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* TAB 2: MY ORDERS & APPROVALS */
        <View style={styles.content}>
          <View style={styles.orderListHeader}>
            <Text style={styles.orderListTitle}>My Grocery Orders</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => loadMyOrders(true)} disabled={isLoadingOrders}>
              <RefreshCw size={16} color="#007AFF" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {isLoadingOrders ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Fetching order updates...</Text>
            </View>
          ) : myOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={48} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Orders Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add groceries and place your first order with a neighborhood store!
              </Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setActiveTab('new_order')}>
                <Text style={styles.emptyActionBtnText}>Create New Order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myOrders}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={isLoadingOrders} onRefresh={() => loadMyOrders(true)} />}
              renderItem={({ item }) => {
                const isPriceQuoted = item.status === 'PriceQuoted';
                const isApproved = item.status === 'Approved' || item.status === 'Processing';
                const isPacked = item.status === 'Packed';
                const isDeliveredAndPaid = item.status === 'DeliveredAndPaymentDone';
                const isCompleted = item.status === 'Completed' || item.status === 'Delivered';
                const isWaitingQuote = item.status === 'QuoteRequested' || item.status === 'Placed';
                const isRejected = item.status === 'Cancelled' || item.status === 'DeclinedByCustomer' || item.status === 'RejectedByMerchant';
                const isProcessing = processingOrderId === item.id;

                return (
                  <View style={styles.orderCard}>
                    {/* Order Top Bar with Status Badge */}
                    <View style={styles.orderTopBar}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.orderShopName}>{item.shopName}</Text>
                        <Text style={styles.orderId}>Order #{item.id}</Text>
                      </View>
                      <View style={[
                        styles.statusBadgePill,
                        isWaitingQuote ? styles.pillOrange :
                        isPriceQuoted ? styles.pillEmerald :
                        isApproved ? styles.pillBlue :
                        isPacked ? styles.pillPurple :
                        isDeliveredAndPaid ? styles.pillAmber :
                        isCompleted ? styles.pillGreen :
                        isRejected ? styles.pillRed : styles.pillGray
                      ]}>
                        <Text style={[
                          styles.statusBadgePillText,
                          isWaitingQuote ? { color: '#B45309' } :
                          isPriceQuoted ? { color: '#047857' } :
                          isApproved ? { color: '#1D4ED8' } :
                          isPacked ? { color: '#6D28D9' } :
                          isDeliveredAndPaid ? { color: '#C2410C' } :
                          isCompleted ? { color: '#15803D' } :
                          isRejected ? { color: '#B91C1C' } : { color: '#4B5563' }
                        ]}>
                          {isWaitingQuote ? '⏳ Awaiting Quote' :
                           isPriceQuoted ? '🏷️ Action Needed' :
                           isApproved ? '✅ Approved' :
                           isPacked ? '📦 Packed' :
                           isDeliveredAndPaid ? '💰 Confirm Delivery' :
                           isCompleted ? '🎉 Completed' :
                           isRejected ? (item.status === 'DeclinedByCustomer' ? '❌ Not Approved' : item.status === 'RejectedByMerchant' ? '❌ Declined by Store' : '❌ Cancelled') : item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Items Requested */}
                    <View style={styles.itemsBox}>
                      <Text style={styles.itemsBoxLabel}>Requested Groceries:</Text>
                      <Text style={styles.itemsBoxContent}>{item.itemsText || 'General grocery order'}</Text>
                    </View>

                    {/* STATUS WORKFLOW HIGHLIGHT */}

                    {/* 1. Waiting for Quote */}
                    {isWaitingQuote && (
                      <View style={[styles.statusBanner, styles.bannerWaiting]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Clock size={16} color="#D97706" style={{ marginTop: 2 }} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.bannerTitleWaiting}>Awaiting Merchant Price Quote</Text>
                            <Text style={styles.bannerDesc}>
                              The shopkeeper is checking shelf availability and calculating your total bill.
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.cancelRequestBtn}
                          onPress={() => handleCancelPendingOrder(item.id)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.cancelRequestBtnText}>✕ Cancel Order Request</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* 2. Price Quoted -> Customer Approval or Disapproval */}
                    {isPriceQuoted && (
                      <View style={[styles.statusBanner, styles.bannerActionRequired]}>
                        <View style={styles.bannerHeaderRow}>
                          <Tag size={18} color="#059669" />
                          <Text style={styles.bannerTitleAction}>Price Quote Ready!</Text>
                        </View>
                        <Text style={styles.priceHighlight}>
                          Total Calculated Bill: ₹{item.quotedAmount || item.totalAmount}
                        </Text>
                        <Text style={styles.bannerDesc}>
                          The merchant has quoted the price for your grocery list. Please review and approve to confirm the order, or decline if you do not want it.
                        </Text>

                        <View style={styles.quoteActionButtonsCol}>
                          <TouchableOpacity
                            style={[styles.actionBtnApprove, isProcessing && { opacity: 0.6 }]}
                            onPress={() => handleApproveQuote(item.id, item.quotedAmount || item.totalAmount)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <ActivityIndicator color="#FFF" />
                            ) : (
                              <View style={styles.actionBtnRow}>
                                <CheckCircle2 size={18} color="#FFF" style={{ marginRight: 6 }} />
                                <Text style={styles.actionBtnText}>
                                  Approve Order (₹{item.quotedAmount || item.totalAmount})
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtnDisapprove, isProcessing && { opacity: 0.6 }]}
                            onPress={() => handleDisapproveQuote(item.id, item.quotedAmount || item.totalAmount)}
                            disabled={isProcessing}
                          >
                            <View style={styles.actionBtnRow}>
                              <XCircle size={18} color="#DC2626" style={{ marginRight: 6 }} />
                              <Text style={styles.actionBtnDisapproveText}>
                                Do Not Approve / Decline
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* 3. Approved -> Merchant Packing */}
                    {isApproved && (
                      <View style={[styles.statusBanner, styles.bannerApproved]}>
                        <CheckCircle2 size={16} color="#2563EB" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.bannerTitleApproved}>Order Approved (₹{item.totalAmount})</Text>
                          <Text style={styles.bannerDesc}>
                            Your approval was received! The merchant is now packing your items.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* 4. Packed -> Ready for Transfer */}
                    {isPacked && (
                      <View style={[styles.statusBanner, styles.bannerPacked]}>
                        <Package size={16} color="#7C3AED" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.bannerTitlePacked}>Order Packed & Ready! 📦</Text>
                          <Text style={styles.bannerDesc}>
                            Items are packed. Direct handover or self-pickup in progress.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* 5. Delivered & Payment Done -> Customer Final Approval Required */}
                    {isDeliveredAndPaid && (
                      <View style={[styles.statusBanner, styles.bannerConfirmRequired]}>
                        <View style={styles.bannerHeaderRow}>
                          <IndianRupee size={18} color="#B45309" />
                          <Text style={styles.bannerTitleConfirm}>Confirm Delivery & Payment</Text>
                        </View>
                        <Text style={styles.bannerDesc}>
                          The merchant has marked this order as Delivered and Payment Received (₹{item.totalAmount}). Please confirm that you have received your groceries.
                        </Text>

                        <TouchableOpacity
                          style={[styles.actionBtnConfirm, isProcessing && { opacity: 0.6 }]}
                          onPress={() => handleCustomerConfirmDelivered(item.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator color="#FFF" />
                          ) : (
                            <View style={styles.actionBtnRow}>
                              <CheckCircle2 size={18} color="#FFF" style={{ marginRight: 6 }} />
                              <Text style={styles.actionBtnText}>
                                Confirm Delivery & Payment Done ✅
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* 6. Completed */}
                    {isCompleted && (
                      <View style={[styles.statusBanner, styles.bannerCompleted]}>
                        <CheckCircle2 size={16} color="#15803D" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.bannerTitleCompleted}>Order Completed & Verified 🎉</Text>
                          <Text style={styles.bannerDesc}>
                            Total Bill: ₹{item.totalAmount} • Both delivery and payment verified.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* 7. Cancelled or Not Approved */}
                    {isRejected && (
                      <View style={[styles.statusBanner, styles.bannerCancelled]}>
                        <XCircle size={16} color="#DC2626" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.bannerTitleCancelled}>
                            {item.status === 'DeclinedByCustomer'
                              ? 'Order Not Approved (Declined)'
                              : item.status === 'RejectedByMerchant'
                              ? 'Order Declined by Store'
                              : 'Order Cancelled'}
                          </Text>
                          <Text style={styles.bannerDesc}>
                            {item.status === 'DeclinedByCustomer'
                              ? 'You chose not to approve this quote. The order is closed.'
                              : item.status === 'RejectedByMerchant'
                              ? 'The store was unable to fulfill this order and did not approve it.'
                              : 'This order was cancelled.'}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4
  },
  tabButtonActive: {
    backgroundColor: '#EFF6FF'
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6
  },
  tabTextActive: {
    color: '#007AFF'
  },
  countBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
    padding: 14
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginLeft: 8
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#636366',
    marginBottom: 10
  },
  storeList: {
    paddingVertical: 4,
    gap: 10
  },
  storeCard: {
    width: 170,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FAFAFA'
  },
  storeCardActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F7FF'
  },
  storeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1
  },
  storeNameActive: {
    color: '#007AFF'
  },
  storeCategory: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6
  },
  storeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4
  },
  storeStatusText: {
    fontSize: 11,
    color: '#3C3C43',
    fontWeight: '500'
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA'
  },
  chipText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500'
  },
  groceryInput: {
    backgroundColor: '#F9F9FB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    padding: 12,
    fontSize: 14,
    color: '#1C1C1E',
    textAlignVertical: 'top',
    minHeight: 110
  },
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 6
  },
  clearBtnText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 10
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
    marginBottom: 4
  },
  singleInput: {
    backgroundColor: '#F9F9FB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1C1C1E'
  },
  noteBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  noteText: {
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 16
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700'
  },
  orderListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  orderListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E'
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6
  },
  refreshBtnText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#8E8E93'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 14
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18
  },
  emptyActionBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  emptyActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600'
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA'
  },
  orderTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  orderShopName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E'
  },
  orderId: {
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
  itemsBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#636366',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  itemsBoxContent: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 18
  },
  statusBanner: {
    borderRadius: 8,
    padding: 12,
    marginTop: 4
  },
  bannerWaiting: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bannerTitleWaiting: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309'
  },
  bannerActionRequired: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    padding: 14
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  bannerTitleAction: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginLeft: 6
  },
  priceHighlight: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
    marginVertical: 4
  },
  bannerApproved: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bannerTitleApproved: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  bannerPacked: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bannerTitlePacked: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9'
  },
  bannerConfirmRequired: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    padding: 14
  },
  bannerTitleConfirm: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
    marginLeft: 6
  },
  bannerCompleted: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bannerTitleCompleted: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D'
  },
  bannerDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginTop: 2
  },
  actionBtnApprove: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnConfirm: {
    backgroundColor: '#EA580C',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700'
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  statusBadgePillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  pillOrange: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A'
  },
  pillEmerald: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0'
  },
  pillBlue: {
    backgroundColor: '#DBEAFE',
    borderColor: '#BFDBFE'
  },
  pillPurple: {
    backgroundColor: '#EDE9FE',
    borderColor: '#DDD6FE'
  },
  pillAmber: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FED7AA'
  },
  pillGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0'
  },
  pillRed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA'
  },
  pillGray: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB'
  },
  cancelRequestBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignSelf: 'flex-start'
  },
  cancelRequestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280'
  },
  quoteActionButtonsCol: {
    marginTop: 8
  },
  actionBtnDisapprove: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnDisapproveText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700'
  },
  bannerCancelled: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bannerTitleCancelled: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626'
  }
});
