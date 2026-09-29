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
  Send,
  XCircle,
  Trash2,
  AlertTriangle,
  Percent
} from 'lucide-react-native';
import { BASE_URL } from '../services/apiConfig';
import { signalRService } from '../services/signalRService';

interface OrderItemDetail {
  id?: string;
  orderId?: string;
  productId?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  isAvailable?: boolean;
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
  discountAmount?: number;
  status: string;
  createdAt: string;
  isDeletedByCustomer?: boolean;
  isDeletedByMerchant?: boolean;
  items?: OrderItemDetail[];
}

interface MerchantCalcItem {
  name: string;
  price: string;
  isAvailable: boolean;
}

interface SimpleMerchantScreenProps {
  shopName?: string;
}

export default function SimpleMerchantScreen({ shopName = 'Tarama Stores' }: SimpleMerchantScreenProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'action_needed' | 'all' | 'completed'>('action_needed');

  // Quoting Calculator State per Order
  const [quoteInputs, setQuoteInputs] = useState<{ [orderId: string]: string }>({});
  const [discountInputs, setDiscountInputs] = useState<{ [orderId: string]: string }>({});
  const [calcItems, setCalcItems] = useState<{ [orderId: string]: MerchantCalcItem[] }>({});
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
      const res = await fetch(`${BASE_URL}/orders?role=merchant`);
      if (res.ok) {
        const data: OrderItem[] = await res.json();
        // Merchant sees their store's orders and excludes soft-deleted items
        const shopOrders = data.filter(
          o => (!shopName || o.shopName.toLowerCase() === shopName.toLowerCase()) && !o.isDeletedByMerchant
        );
        setOrders(shopOrders);
      }
    } catch {
      // quiet fallback in background poll
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [shopName]);

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

  // Price Calculator Helpers with Item-Level Pricing & Stock Availability
  const getCalcItemsForOrder = useCallback((order: OrderItem): MerchantCalcItem[] => {
    if (calcItems[order.id] && calcItems[order.id].length > 0) {
      return calcItems[order.id];
    }
    if (order.items && order.items.length > 0) {
      return order.items.map(it => ({
        name: it.productName,
        price: it.unitPrice > 0 ? it.unitPrice.toString() : '',
        isAvailable: it.isAvailable !== false
      }));
    }
    if (order.itemsText) {
      const rawLines = order.itemsText.split(/[\r\n,]+/);
      const parsed = rawLines
        .map(line => line.trim().replace(/^[•\-*\d.]+\s*/, '').trim())
        .filter(line => line.length > 0)
        .map(line => ({
          name: line,
          price: '',
          isAvailable: true
        }));
      if (parsed.length > 0) return parsed;
    }
    return [{ name: '', price: '', isAvailable: true }];
  }, [calcItems]);

  const recalculateTotal = (orderId: string, items: MerchantCalcItem[], overrideDiscount?: string) => {
    const subtotal = items
      .filter(item => item.isAvailable)
      .reduce((sum, item) => {
        const p = parseFloat(item.price);
        return sum + (isNaN(p) ? 0 : p);
      }, 0);
    const discountStr = overrideDiscount !== undefined ? overrideDiscount : (discountInputs[orderId] || '');
    const disc = parseFloat(discountStr) || 0;
    const finalTotal = Math.max(0, subtotal - disc);
    setQuoteInputs(prev => ({
      ...prev,
      [orderId]: finalTotal > 0 ? finalTotal.toString() : (subtotal > 0 ? '0' : '')
    }));
    return { subtotal, discount: disc, finalTotal };
  };

  const handlePriceInputChange = (orderId: string, text: string) => {
    setQuoteInputs(prev => ({ ...prev, [orderId]: text }));
  };

  const handleDiscountInputChange = (order: OrderItem, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    setDiscountInputs(prev => ({ ...prev, [order.id]: clean }));
    const items = getCalcItemsForOrder(order);
    recalculateTotal(order.id, items, clean);
  };

  const handleApplyPresetDiscount = (order: OrderItem, presetVal: number) => {
    const currentDiscount = parseFloat(discountInputs[order.id] || '0') || 0;
    const newDiscount = currentDiscount === presetVal ? '' : presetVal.toString();
    setDiscountInputs(prev => ({ ...prev, [order.id]: newDiscount }));
    const items = getCalcItemsForOrder(order);
    recalculateTotal(order.id, items, newDiscount);
  };

  const handleUpdateItemName = (order: OrderItem, index: number, name: string) => {
    const current = [...getCalcItemsForOrder(order)];
    current[index] = { ...current[index], name };
    setCalcItems(prev => ({ ...prev, [order.id]: current }));
  };

  const handleUpdateItemPrice = (order: OrderItem, index: number, price: string) => {
    const current = [...getCalcItemsForOrder(order)];
    current[index] = { ...current[index], price };
    recalculateTotal(order.id, current);
    setCalcItems(prev => ({ ...prev, [order.id]: current }));
  };

  const handleToggleItemAvailability = (order: OrderItem, index: number) => {
    const current = [...getCalcItemsForOrder(order)];
    const newAvail = !current[index].isAvailable;
    current[index] = {
      ...current[index],
      isAvailable: newAvail,
      price: newAvail ? (current[index].price === '0' ? '' : current[index].price) : '0'
    };
    recalculateTotal(order.id, current);
    setCalcItems(prev => ({ ...prev, [order.id]: current }));
  };

  const handleAddCalcItem = (order: OrderItem) => {
    const current = [...getCalcItemsForOrder(order)];
    const updated = [...current, { name: '', price: '', isAvailable: true }];
    setCalcItems(prev => ({ ...prev, [order.id]: updated }));
  };

  const handleRemoveCalcItem = (order: OrderItem, index: number) => {
    const current = [...getCalcItemsForOrder(order)];
    if (current.length <= 1) {
      current[0] = { name: '', price: '', isAvailable: true };
    } else {
      current.splice(index, 1);
    }
    recalculateTotal(order.id, current);
    setCalcItems(prev => ({ ...prev, [order.id]: current }));
  };

  // 1. Merchant Sends Price Quote with Itemized Details, Stock Status & Discount
  const handleSendQuote = async (order: OrderItem) => {
    const orderId = order.id;
    const currentItems = getCalcItemsForOrder(order);
    const validItems = currentItems.filter(i => i.name.trim().length > 0);

    const discountVal = parseFloat(discountInputs[orderId] || '0') || 0;
    const rawVal = quoteInputs[orderId];
    let amount = parseFloat(rawVal || '0');

    if (isNaN(amount) || amount <= 0) {
      const subtotal = validItems
        .filter(i => i.isAvailable)
        .reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
      amount = Math.max(0, subtotal - discountVal);
    }

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Price', 'Please enter a price for available items. Total bill must be greater than ₹0.');
      return;
    }

    const payloadItems = validItems.map(i => ({
      name: i.name.trim(),
      price: i.isAvailable ? (parseFloat(i.price) || 0) : 0,
      isAvailable: i.isAvailable,
      quantity: 1
    }));

    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/quote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotedAmount: amount,
          discountAmount: discountVal,
          items: payloadItems
        })
      });

      if (res.ok) {
        Alert.alert(
          'Quote Dispatched! 🏷️',
          `Quote of ₹${amount}${discountVal > 0 ? ` (with ₹${discountVal} store discount)` : ''} sent to customer with item breakdown.`
        );
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

  // 1b. Merchant Does Not Approve / Declines Customer Order
  const handleDeclineOrder = (orderId: string, customerName?: string) => {
    Alert.alert(
      'Do Not Approve Order',
      `Are you sure you want to decline / not approve the order from ${customerName || 'the customer'}?`,
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
                  role: 'merchant',
                  reason: 'Store was unable to fulfill this grocery order.'
                })
              });

              if (res.ok) {
                Alert.alert('Order Declined ❌', `Order from ${customerName || 'customer'} was not approved.`);
                fetchOrders();
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

  // 4. Soft Delete a Single Order from Merchant History (preserves 100% of audit data in database)
  const handleDeleteMerchantOrder = (orderId: string) => {
    Alert.alert(
      'Remove from Store History? 🗑️',
      'This order will be removed from your dashboard history. (All transaction details are permanently archived in the database for auditing and accounts).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setOrders(prev => prev.filter(o => o.id !== orderId));
            try {
              const res = await fetch(`${BASE_URL}/orders/${orderId}/merchant-history`, {
                method: 'DELETE'
              });
              if (!res.ok) {
                fetchOrders(false);
              }
            } catch {
              fetchOrders(false);
            }
          }
        }
      ]
    );
  };

  // 5. Clear All Completed/Cancelled Orders from Merchant History
  const handleClearMerchantHistory = () => {
    const hasCompleted = orders.some(
      o => o.status === 'Completed' || o.status === 'Delivered' || o.status === 'Cancelled' || o.status === 'DeclinedByCustomer' || o.status === 'RejectedByMerchant' || o.status === 'DeliveredAndPaymentDone'
    );
    if (!hasCompleted) {
      Alert.alert('No Completed Orders', 'There are no completed or settled orders to clear.');
      return;
    }

    Alert.alert(
      'Clear Completed Orders? 🗑️',
      'Remove all completed and cancelled orders from your merchant view? They will remain permanently saved in the database for auditing and accounting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Completed',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BASE_URL}/orders/merchant-history/clear?shopName=${encodeURIComponent(shopName)}`, {
                method: 'DELETE'
              });
              fetchOrders(true);
            } catch {
              Alert.alert('Network Error', 'Failed to clear completed orders.');
            }
          }
        }
      ]
    );
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

        {filter === 'completed' && orders.some(o => o.status === 'Completed' || o.status === 'Delivered' || o.status === 'Cancelled' || o.status === 'DeclinedByCustomer' || o.status === 'RejectedByMerchant' || o.status === 'DeliveredAndPaymentDone') && (
          <TouchableOpacity style={styles.clearHistoryBtn} onPress={handleClearMerchantHistory}>
            <Trash2 size={13} color="#FF3B30" />
            <Text style={styles.clearHistoryBtnText}>Clear Completed</Text>
          </TouchableOpacity>
        )}
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
            const isRejected = item.status === 'Cancelled' || item.status === 'DeclinedByCustomer' || item.status === 'RejectedByMerchant';
            const isProcessing = processingOrderId === item.id;

            const orderCalcItems = getCalcItemsForOrder(item);
            const availCount = orderCalcItems.filter(ci => ci.isAvailable).length;
            const unavailCount = orderCalcItems.length - availCount;
            const autoTotal = orderCalcItems
              .filter(ci => ci.isAvailable)
              .reduce((sum, ci) => sum + (parseFloat(ci.price) || 0), 0);
            const currentDiscount = parseFloat(discountInputs[item.id] || '0') || 0;
            const netTotal = Math.max(0, autoTotal - currentDiscount);
            const displayTotal = quoteInputs[item.id] !== undefined ? quoteInputs[item.id] : (netTotal > 0 ? netTotal.toString() : '');

            return (
              <View style={styles.orderCard}>
                {/* Order Top Header with Status Pill & Delete History */}
                <View style={styles.orderTop}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
                    <Text style={styles.customerPhone}>📞 {item.customerPhone || 'No Phone'}</Text>
                    <Text style={styles.orderIdText}>Order #{item.id}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[
                      styles.statusBadgePill,
                      isQuoteNeeded ? styles.pillOrange :
                      isWaitingApproval ? styles.pillBlue :
                      isApprovedReadyToPack ? styles.pillGreen :
                      isPackedReadyToDeliver ? styles.pillPurple :
                      isDeliveredWaitingCustomer ? styles.pillAmber :
                      isCompleted ? styles.pillGreen :
                      isRejected ? styles.pillRed : styles.pillGray
                    ]}>
                      <Text style={[
                        styles.statusBadgePillText,
                        isQuoteNeeded ? { color: '#B45309' } :
                        isWaitingApproval ? { color: '#1D4ED8' } :
                        isApprovedReadyToPack ? { color: '#15803D' } :
                        isPackedReadyToDeliver ? { color: '#6D28D9' } :
                        isDeliveredWaitingCustomer ? { color: '#C2410C' } :
                        isCompleted ? { color: '#15803D' } :
                        isRejected ? { color: '#B91C1C' } : { color: '#4B5563' }
                      ]}>
                        {isQuoteNeeded ? '⏳ Quote Needed' :
                         isWaitingApproval ? '🏷️ Quoted' :
                         isApprovedReadyToPack ? '✅ Approved' :
                         isPackedReadyToDeliver ? '📦 Packed' :
                         isDeliveredWaitingCustomer ? '💰 Payment Pending' :
                         isCompleted ? '🎉 Completed' :
                         isRejected ? (item.status === 'DeclinedByCustomer' ? '❌ Customer Declined' : item.status === 'RejectedByMerchant' ? '❌ Not Approved' : '❌ Cancelled') : item.status}
                      </Text>
                    </View>
                    {(isCompleted || isRejected) && (
                      <TouchableOpacity
                        style={styles.deleteOrderBtn}
                        onPress={() => handleDeleteMerchantOrder(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Grocery Items List Requested */}
                <View style={styles.itemsBox}>
                  <Text style={styles.itemsLabel}>Customer's Grocery List:</Text>
                  <Text style={styles.itemsContent}>{item.itemsText || 'General order'}</Text>
                </View>

                {/* Itemized Pricing Breakdown for Quoted, Approved, Packed orders */}
                {!isQuoteNeeded && item.items && item.items.length > 0 && (
                  <View style={styles.merchantItemizedCard}>
                    <Text style={styles.merchantItemizedTitle}>Itemized Price & Stock Breakdown:</Text>
                    {item.items.map((it, idx) => (
                      <View key={idx} style={[styles.merchantItemRow, !it.isAvailable && styles.merchantItemRowUnavailable]}>
                        <Text style={[styles.merchantItemNameText, !it.isAvailable && styles.merchantItemNameUnavailable]}>
                          {it.isAvailable ? '• ' : '❌ '}{it.productName}
                        </Text>
                        <Text style={it.isAvailable ? styles.merchantItemPriceText : styles.merchantItemOutBadge}>
                          {it.isAvailable ? `₹${it.unitPrice}` : 'Out of Stock'}
                        </Text>
                      </View>
                    ))}
                    {item.discountAmount && item.discountAmount > 0 ? (
                      <View style={styles.itemizedDiscountSummary}>
                        <View style={styles.itemizedSummaryRow}>
                          <Text style={styles.itemizedSummaryLabel}>Subtotal:</Text>
                          <Text style={styles.itemizedSummaryVal}>₹{(item.quotedAmount || item.totalAmount) + item.discountAmount}</Text>
                        </View>
                        <View style={styles.itemizedSummaryRow}>
                          <Text style={[styles.itemizedSummaryLabel, { color: '#059669', fontWeight: '700' }]}>Store Discount:</Text>
                          <Text style={[styles.itemizedSummaryVal, { color: '#059669', fontWeight: '700' }]}>- ₹{item.discountAmount}</Text>
                        </View>
                        <View style={[styles.itemizedSummaryRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                          <Text style={[styles.itemizedSummaryLabel, { fontWeight: '800', color: '#111827' }]}>Net Bill:</Text>
                          <Text style={[styles.itemizedSummaryVal, { fontWeight: '800', color: '#059669' }]}>₹{item.quotedAmount || item.totalAmount}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* 1. STATE: NEW ORDER -> CALCULATE & QUOTE PRICE */}
                {isQuoteNeeded && (
                  <View style={styles.actionBoxQuote}>
                    <View style={styles.actionBoxHeader}>
                      <Calculator size={18} color="#D97706" />
                      <Text style={styles.actionBoxTitle}>Calculate & Send Price Quote</Text>
                    </View>
                    <Text style={styles.actionDesc}>
                      Enter the price for each item. Tap "Available" to mark any item as "Not Available" (Out of Stock). The total bill will be automatically calculated.
                    </Text>

                    {/* Itemized Pricing & Availability Checklist */}
                    <View style={styles.calcItemsList}>
                      {orderCalcItems.map((ci, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.itemCalcCard,
                            !ci.isAvailable && styles.itemCalcCardUnavailable
                          ]}
                        >
                          {/* Row 1: Item Name + Availability Pill + Delete */}
                          <View style={styles.itemCalcRowTop}>
                            <TextInput
                              style={[
                                styles.itemCalcNameInput,
                                !ci.isAvailable && styles.itemCalcNameInputUnavailable
                              ]}
                              placeholder="Item name / qty"
                              value={ci.name}
                              onChangeText={v => handleUpdateItemName(item, idx, v)}
                            />

                            {/* Stock Availability Toggle Button */}
                            <TouchableOpacity
                              style={[
                                styles.availPillBtn,
                                ci.isAvailable ? styles.availPillOn : styles.availPillOff
                              ]}
                              onPress={() => handleToggleItemAvailability(item, idx)}
                            >
                              {ci.isAvailable ? (
                                <>
                                  <CheckCircle2 size={13} color="#15803D" />
                                  <Text style={styles.availPillTextOn}>Available</Text>
                                </>
                              ) : (
                                <>
                                  <XCircle size={13} color="#DC2626" />
                                  <Text style={styles.availPillTextOff}>Not Available</Text>
                                </>
                              )}
                            </TouchableOpacity>

                            {/* Remove Item */}
                            <TouchableOpacity
                              style={styles.deleteItemBtn}
                              onPress={() => handleRemoveCalcItem(item, idx)}
                            >
                              <Trash2 size={15} color="#9CA3AF" />
                            </TouchableOpacity>
                          </View>

                          {/* Row 2: Price Input or Unavailable Marker */}
                          <View style={styles.itemCalcRowBottom}>
                            {ci.isAvailable ? (
                              <View style={styles.priceInputWrap}>
                                <Text style={styles.priceRupee}>₹</Text>
                                <TextInput
                                  style={styles.itemPriceInput}
                                  placeholder="0.00"
                                  placeholderTextColor="#9CA3AF"
                                  keyboardType="numeric"
                                  value={ci.price}
                                  onChangeText={p => handleUpdateItemPrice(item, idx, p)}
                                />
                              </View>
                            ) : (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <AlertTriangle size={13} color="#DC2626" style={{ marginRight: 4 }} />
                                <Text style={styles.outOfStockNotice}>
                                  Out of Stock • Excluded from customer bill
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Add More Items Button */}
                    <TouchableOpacity
                      style={styles.addCalcItemBtn}
                      onPress={() => handleAddCalcItem(item)}
                    >
                      <Plus size={14} color="#D97706" />
                      <Text style={styles.addCalcItemText}>+ Add Another Item Row</Text>
                    </TouchableOpacity>

                    {/* Items Subtotal Box */}
                    <View style={styles.calcSubtotalSummaryBox}>
                      <View style={styles.calcTotalRow}>
                        <View>
                          <Text style={styles.calcSubtotalLabel}>Items Subtotal:</Text>
                          <Text style={styles.calcTotalSub}>
                            {availCount} item{availCount !== 1 ? 's' : ''} available
                            {unavailCount > 0 ? ` • ${unavailCount} out of stock` : ''}
                          </Text>
                        </View>
                        <Text style={styles.calcSubtotalAmount}>₹{autoTotal > 0 ? autoTotal : '0'}</Text>
                      </View>
                    </View>

                    {/* Merchant Discount Section (Optional) */}
                    <View style={styles.discountSectionBox}>
                      <View style={styles.discountHeaderRow}>
                        <Tag size={15} color="#059669" />
                        <Text style={styles.discountSectionTitle}>Give Store Discount (Optional)</Text>
                      </View>
                      <Text style={styles.discountSectionSub}>
                        Reward the customer with an instant discount off their grocery bill:
                      </Text>

                      {/* Quick Discount Preset Chips */}
                      <View style={styles.discountChipsRow}>
                        {[10, 20, 50, 100].map(val => {
                          const isSelected = discountInputs[item.id] === val.toString();
                          return (
                            <TouchableOpacity
                              key={val}
                              style={[styles.discountChip, isSelected && styles.discountChipSelected]}
                              onPress={() => handleApplyPresetDiscount(item, val)}
                            >
                              <Text style={[styles.discountChipText, isSelected && styles.discountChipTextSelected]}>
                                ₹{val} OFF
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        {parseFloat(discountInputs[item.id] || '0') > 0 && (
                          <TouchableOpacity
                            style={styles.discountChipClear}
                            onPress={() => handleDiscountInputChange(item, '')}
                          >
                            <Text style={styles.discountChipClearText}>Clear</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Custom Discount Input */}
                      <View style={styles.discountInputRow}>
                        <Text style={styles.discountPrefix}>- ₹</Text>
                        <TextInput
                          style={styles.discountInput}
                          placeholder="Custom discount amount (e.g. 25)"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          value={discountInputs[item.id] || ''}
                          onChangeText={txt => handleDiscountInputChange(item, txt)}
                        />
                      </View>
                    </View>

                    {/* Automatically Calculated Total Box with Discount Breakdown */}
                    <View style={styles.calcTotalSummaryBox}>
                      {parseFloat(discountInputs[item.id] || '0') > 0 && (
                        <>
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Items Subtotal:</Text>
                            <Text style={styles.breakdownVal}>₹{autoTotal}</Text>
                          </View>
                          <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#059669', fontWeight: '700' }]}>Special Store Discount:</Text>
                            <Text style={[styles.breakdownVal, { color: '#059669', fontWeight: '700' }]}>- ₹{discountInputs[item.id]}</Text>
                          </View>
                        </>
                      )}
                      <View style={[styles.calcTotalRow, parseFloat(discountInputs[item.id] || '0') > 0 && { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#FDE68A' }]}>
                        <View>
                          <Text style={styles.calcTotalLabel}>Final Total Bill:</Text>
                          <Text style={styles.calcTotalSub}>
                            {parseFloat(discountInputs[item.id] || '0') > 0 ? 'Net bill after store discount' : 'Customer payable amount'}
                          </Text>
                        </View>
                        <Text style={styles.calcTotalAmount}>₹{displayTotal || '0'}</Text>
                      </View>
                    </View>

                    {/* Manual Total Override Input (Optional adjustment) */}
                    <View style={styles.quoteInputRow}>
                      <Text style={styles.rupeeSymbol}>₹</Text>
                      <TextInput
                        style={styles.quoteInput}
                        placeholder="Final Total Bill (₹)"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={displayTotal}
                        onChangeText={v => handlePriceInputChange(item.id, v)}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.sendQuoteBtn, isProcessing && { opacity: 0.6 }]}
                      onPress={() => handleSendQuote(item)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <View style={styles.btnRow}>
                          <Send size={16} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.btnText}>
                            Send Price Quote to Customer (₹{displayTotal || '0'})
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.declineOrderBtn, isProcessing && { opacity: 0.6 }]}
                      onPress={() => handleDeclineOrder(item.id, item.customerName)}
                      disabled={isProcessing}
                    >
                      <View style={styles.btnRow}>
                        <XCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
                        <Text style={styles.declineOrderBtnText}>Do Not Approve / Decline Order</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. STATE: QUOTE SENT -> WAITING FOR CUSTOMER APPROVAL */}
                {isWaitingApproval && (
                  <View style={styles.infoBannerQuoteSent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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

                    <TouchableOpacity
                      style={styles.cancelQuoteBtn}
                      onPress={() => handleDeclineOrder(item.id, item.customerName)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.cancelQuoteBtnText}>✕ Cancel / Withdraw Quote</Text>
                    </TouchableOpacity>
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

                {/* 7. STATE: DECLINED / CANCELLED / NOT APPROVED */}
                {isRejected && (
                  <View style={styles.infoBannerDeclined}>
                    <XCircle size={16} color="#DC2626" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.infoBannerTitleDeclined}>
                        {item.status === 'DeclinedByCustomer'
                          ? 'Customer Did Not Approve Quote'
                          : item.status === 'RejectedByMerchant'
                          ? 'Order Declined by Store (Not Approved)'
                          : 'Order Cancelled'}
                      </Text>
                      <Text style={styles.infoBannerSubDeclined}>
                        {item.status === 'DeclinedByCustomer'
                          ? 'The customer chose not to approve the quoted bill. No further action needed.'
                          : item.status === 'RejectedByMerchant'
                          ? 'You chose not to approve this order from the customer.'
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
  itemCalcCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  itemCalcCardUnavailable: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  itemCalcRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemCalcNameInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 13,
    color: '#111827',
  },
  itemCalcNameInputUnavailable: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  availPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  availPillOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  availPillOff: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  availPillTextOn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    marginLeft: 4,
  },
  availPillTextOff: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 4,
  },
  deleteItemBtn: {
    padding: 6,
    marginLeft: 4,
  },
  itemCalcRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 130,
  },
  priceRupee: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginRight: 2,
  },
  itemPriceInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
  },
  outOfStockNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    fontStyle: 'italic',
  },
  calcTotalSummaryBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  calcTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  calcTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B45309',
  },
  calcTotalSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 3,
  },
  calcSubtotalSummaryBox: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  calcSubtotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  calcSubtotalAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  discountSectionBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginTop: 2,
    marginBottom: 8,
  },
  discountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  discountSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    marginLeft: 5,
  },
  discountSectionSub: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 8,
  },
  discountChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  discountChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  discountChipSelected: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  discountChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  discountChipTextSelected: {
    color: '#FFF',
  },
  discountChipClear: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  discountChipClearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  discountPrefix: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    marginRight: 4,
  },
  discountInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  itemizedDiscountSummary: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  itemizedSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  itemizedSummaryLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  itemizedSummaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  merchantItemizedCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  merchantItemizedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  merchantItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  merchantItemRowUnavailable: {
    opacity: 0.75,
  },
  merchantItemNameText: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
  },
  merchantItemNameUnavailable: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  merchantItemPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  merchantItemOutBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  pillBlue: {
    backgroundColor: '#DBEAFE',
    borderColor: '#BFDBFE'
  },
  pillGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0'
  },
  pillPurple: {
    backgroundColor: '#EDE9FE',
    borderColor: '#DDD6FE'
  },
  pillAmber: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FED7AA'
  },
  pillRed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA'
  },
  pillGray: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB'
  },
  declineOrderBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  declineOrderBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700'
  },
  cancelQuoteBtn: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignSelf: 'flex-start'
  },
  cancelQuoteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280'
  },
  infoBannerDeclined: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  infoBannerTitleDeclined: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626'
  },
  infoBannerSubDeclined: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginLeft: 'auto'
  },
  clearHistoryBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626'
  },
  deleteOrderBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
