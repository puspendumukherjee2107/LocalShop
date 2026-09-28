import {
  AlertCircle,
  Check,
  FileText,
  Heart,
  MapPin,
  Minus,
  Plus,
  PlusCircle,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BASE_URL } from '../services/apiConfig';
import { openWhatsAppToMerchant } from '../utils/whatsappHelper';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

interface StoreItem {
  id: string;
  shopName: string;
  category: string;
  isOpen: boolean;
  operatingHours: string;
  deliveryRadiusKm: number;
  minOrderAmount: number;
  kycStatus: string;
  rating: number;
  distanceKm: number;
}

interface CustomerAddress {
  id: number;
  customerPhone: string;
  label: string;
  addressLine: string;
  isDefault: boolean;
}

interface CustomerScreenProps {
  currentUser?: {
    name: string;
    phone: string;
    address?: string;
  };
}

export default function CustomerScreen({ currentUser }: CustomerScreenProps) {
  // Multi-Store Discovery State
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreItem>({
    id: 'default',
    shopName: 'Kirana Junction',
    category: 'Groceries & Daily Essentials',
    isOpen: true,
    operatingHours: '08:00 AM - 09:30 PM',
    deliveryRadiusKm: 3.0,
    minOrderAmount: 150,
    kycStatus: 'Approved',
    rating: 4.8,
    distanceKm: 1.2
  });

  // Order Mode: 'list' (No inventory maintenance needed) vs 'catalog'
  const [orderMode, setOrderMode] = useState<'list' | 'catalog'>('list');
  const [groceryListText, setGroceryListText] = useState('');

  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [categories] = useState<string[]>(['All', 'Groceries', 'Dairy', 'Bakery']);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // PHASE 4: Coupon & Promotion State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);

  // PHASE 4: Saved Delivery Addresses
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>(
    currentUser?.address || 'Flat 4B, Greenfield Apartments'
  );
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('Home');
  const [newAddressLine, setNewAddressLine] = useState('');

  const quickSuggestions = [
    'Amul Milk (500ml)',
    'Aashirvaad Atta (1kg)',
    'Brown Bread',
    'Eggs (6 pcs)',
    'Fortune Mustard Oil (1L)',
    'Tata Salt (1kg)',
    'Sugar (1kg)',
    'Maggi 4-Pack'
  ];

  const quickCoupons = [
    { code: 'FIRST50', label: '₹50 OFF' },
    { code: 'KIRANA10', label: '10% OFF' },
    { code: 'FLAT20', label: '₹20 OFF' }
  ];

  const loadStores = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/stores`);
      if (res.ok) {
        const data = await res.json();
        const storeList: StoreItem[] = Array.isArray(data) ? data : data.value || [];
        if (storeList.length > 0) {
          setStores(storeList);
          const current = storeList.find(s => s.shopName === selectedStore.shopName);
          if (current) setSelectedStore(current);
        }
      }
    } catch {
      console.log('Stores offline fallback');
    }
  }, [selectedStore.shopName]);

  useEffect(() => {
    loadStores();
    loadMarketplaceCatalog();
    if (currentUser?.phone) {
      loadSavedAddresses(currentUser.phone);
    }
  }, [currentUser?.phone, loadStores]);

  const loadMarketplaceCatalog = async () => {
    try {
      const response = await fetch(`${BASE_URL}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch {
      console.error('Error fetching catalog.');
    }
  };

  const loadSavedAddresses = async (phone: string) => {
    try {
      const res = await fetch(`${BASE_URL}/customers/${phone}/addresses`);
      if (res.ok) {
        const data: CustomerAddress[] = await res.json();
        setSavedAddresses(data);
        if (data.length > 0) {
          const defaultAddr = data.find(a => a.isDefault) || data[0];
          setSelectedAddress(defaultAddr.addressLine);
        }
      }
    } catch {
      console.log('Addresses fallback');
    }
  };

  const handleAddNewAddress = async () => {
    if (!newAddressLine.trim() || !currentUser?.phone) return;
    try {
      const res = await fetch(`${BASE_URL}/customers/${currentUser.phone}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone: currentUser.phone,
          label: newAddressLabel,
          addressLine: newAddressLine.trim(),
          isDefault: savedAddresses.length === 0
        })
      });
      if (res.ok) {
        const created = await res.json();
        setSavedAddresses(prev => [...prev, created]);
        setSelectedAddress(created.addressLine);
        setShowAddAddressModal(false);
        setNewAddressLine('');
        Alert.alert('Address Saved', `${newAddressLabel} address saved successfully.`);
      }
    } catch {
      Alert.alert('Error', 'Failed to save address.');
    }
  };

  // Coupon Validation
  const handleApplyCoupon = async (codeToTry?: string) => {
    const code = (codeToTry || couponCodeInput).trim().toUpperCase();
    if (!code) {
      Alert.alert('Invalid Coupon', 'Please enter a coupon code.');
      return;
    }

    setCouponValidating(true);
    try {
      const res = await fetch(`${BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          orderAmount: totalPrice,
          shopName: selectedStore.shopName
        })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon({ code: data.code, discountAmount: data.discountAmount });
        setCouponCodeInput(data.code);
        Alert.alert('Coupon Applied! 🎉', `You saved ₹${data.discountAmount} with ${data.code}!`);
      } else {
        setAppliedCoupon(null);
        Alert.alert('Coupon Error', data.message || 'Coupon could not be applied.');
      }
    } catch {
      Alert.alert('Error', 'Failed to validate coupon.');
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
  };

  const toggleFavorite = (productId: string) => {
    if (favorites.includes(productId)) {
      setFavorites(favorites.filter(id => id !== productId));
    } else {
      setFavorites([...favorites, productId]);
    }
  };

  // Submit list order
  const handleSendListOrder = async () => {
    if (!groceryListText.trim()) {
      Alert.alert('Empty List', 'Please write at least one item.');
      return;
    }

    if (!selectedStore.isOpen) {
      Alert.alert('Store Closed', `${selectedStore.shopName} is currently closed.`);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/orders/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: currentUser?.name || 'Turja Mukherjee',
          customerPhone: currentUser?.phone || '9876543210',
          shopName: selectedStore.shopName,
          itemsText: groceryListText.trim(),
          deliveryAddress: selectedAddress
        }),
      });

      if (response.ok) {
        const order = await response.json();
        Alert.alert(
          'Grocery List Dispatched! 📋',
          `Order ${order.id} sent to ${selectedStore.shopName}.\n\nDelivery Address: ${selectedAddress}\n\nThe shopkeeper will check shelves and quote a price in the "📦 Track" tab.`
        );
        setGroceryListText('');
      } else {
        Alert.alert('Error', 'Failed to dispatch grocery list.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot connect to API server.');
    }
  };

  // Submit Catalog Checkout
  const handleCatalogCheckout = async () => {
    if (cart.length === 0) return;

    if (!selectedStore.isOpen) {
      Alert.alert('Store Closed', `${selectedStore.shopName} is currently closed.`);
      return;
    }

    const discount = appliedCoupon?.discountAmount || 0;
    const finalBill = Math.max(0, totalPrice - discount);

    if (finalBill < selectedStore.minOrderAmount) {
      Alert.alert(
        'Minimum Order Required',
        `Minimum order for ${selectedStore.shopName} is ₹${selectedStore.minOrderAmount}. Your current total after discount is ₹${finalBill}.`
      );
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/orders/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: currentUser?.name || 'Turja Mukherjee',
          customerPhone: currentUser?.phone || '9876543210',
          shopName: selectedStore.shopName,
          items: cart.map(item => ({ productId: item.id, quantity: item.quantity })),
          deliveryAddress: selectedAddress,
          discountAmount: discount,
          couponCode: appliedCoupon?.code
        }),
      });

      if (response.ok) {
        const order = await response.json();
        Alert.alert(
          'Order Placed! 🎉',
          `Order ${order.id} placed at ${selectedStore.shopName} (Total: ₹${order.totalAmount}).\n\n🔑 Delivery Verification Code: ${order.deliveryOtp || 'Generated'}\n\nSwitch to "📦 Track" tab to view real-time delivery progression.`,
          [{ text: 'View Tracker', onPress: () => setCart([]) }]
        );
        setAppliedCoupon(null);
        setCouponCodeInput('');
        loadMarketplaceCatalog();
      } else {
        const err = await response.json();
        Alert.alert('Checkout Failed', err.message || 'Error processing catalog order.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot connect to API server.');
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.id === productId);
    if (!existing) return;
    if (existing.quantity === 1) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      setCart(cart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item));
    }
  };

  const appendSuggestion = (item: string) => {
    const line = `• ${item}`;
    if (!groceryListText.includes(item)) {
      setGroceryListText(prev => (prev ? `${prev}\n${line}` : line));
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountVal = appliedCoupon?.discountAmount || 0;
  const payableAmount = Math.max(0, totalPrice - discountVal);

  return (
    <View style={styles.container}>
      {/* 1. Neighborhood Multi-Store Selector Strip */}
      {stores.length > 0 && (
        <View style={styles.storeSelectorContainer}>
          <Text style={styles.storeSelectLabel}>🏪 Nearby Neighborhood Stores:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {stores.map(store => {
              const isSelected = selectedStore.shopName === store.shopName;
              return (
                <TouchableOpacity
                  key={store.id}
                  style={[styles.storePill, isSelected && styles.storePillActive]}
                  onPress={() => setSelectedStore(store)}
                >
                  <Text style={[styles.storePillText, isSelected && styles.storePillActiveText]}>
                    {store.shopName} {store.isOpen ? '🟢' : '🔴'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 2. Active Selected Shop Hero Banner */}
      <View style={styles.shopBanner}>
        <View style={styles.shopAvatar}>
          <Store size={22} color="#007AFF" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.shopName}>{selectedStore.shopName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: selectedStore.isOpen ? '#E5F9ED' : '#FFEBEA' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: selectedStore.isOpen ? '#34C759' : '#FF3B30' }}>
                {selectedStore.isOpen ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
          </View>
          <Text style={styles.shopMeta}>{selectedStore.category} • ⭐ {selectedStore.rating} ({selectedStore.distanceKm}km)</Text>
          <Text style={styles.shopHours}>🕒 {selectedStore.operatingHours} • Min Order: ₹{selectedStore.minOrderAmount}</Text>
        </View>

        {false && (
          <TouchableOpacity
            style={styles.heroWaBtn}
            onPress={() => openWhatsAppToMerchant('9876543210', selectedStore.shopName, 'INQUIRY', 'Hi, I would like to inquire about item availability.')}
          >
            <Text style={styles.heroWaBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Delivery Address Selection Bar */}
      <View style={styles.addressBarContainer}>
        <MapPin size={14} color="#007AFF" />
        <Text style={styles.addressBarLabel}>Delivering to:</Text>
        <Text style={styles.addressBarValue} numberOfLines={1}>
          {selectedAddress}
        </Text>
        <TouchableOpacity onPress={() => setShowAddAddressModal(true)} style={styles.changeAddrBtn}>
          <Text style={styles.changeAddrBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Store Closed Warning Banner */}
      {!selectedStore.isOpen && (
        <View style={styles.closedAlert}>
          <AlertCircle size={16} color="#FF9500" style={{ marginRight: 6 }} />
          <Text style={styles.closedAlertText}>
            This store is currently closed. You can browse, but new orders will be paused.
          </Text>
        </View>
      )}

      {/* 3. Dual Mode Toggle Bar */}
      <View style={styles.modeTabBar}>
        <TouchableOpacity
          style={[styles.modeTab, orderMode === 'list' && styles.modeTabActive]}
          onPress={() => setOrderMode('list')}
        >
          <FileText size={16} color={orderMode === 'list' ? '#007AFF' : '#8E8E93'} style={{ marginRight: 6 }} />
          <Text style={[styles.modeTabText, orderMode === 'list' && styles.modeTabActiveText]}>
            📝 Write Grocery List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, orderMode === 'catalog' && styles.modeTabActive]}
          onPress={() => setOrderMode('catalog')}
        >
          <ShoppingBag size={16} color={orderMode === 'catalog' ? '#007AFF' : '#8E8E93'} style={{ marginRight: 6 }} />
          <Text style={[styles.modeTabText, orderMode === 'catalog' && styles.modeTabActiveText]}>
            🛍️ Browse Catalog
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODE A: Write Grocery List (Zero Inventory Required) */}
      {orderMode === 'list' ? (
        <ScrollView style={styles.listOrderContainer}>
          <View style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <Text style={styles.listCardTitle}>Order Anything from {selectedStore.shopName}</Text>
              <Text style={styles.listCardSub}>
                Type what you need or tap daily essentials. The shopkeeper will check physical shelves and quote a price.
              </Text>
            </View>

            <Text style={styles.chipHeader}>Tap to add daily essentials:</Text>
            <View style={styles.chipsRow}>
              {quickSuggestions.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.chip} onPress={() => appendSuggestion(item)}>
                  <Text style={styles.chipText}>+ {item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Your Grocery List:</Text>
            <TextInput
              style={styles.listInput}
              multiline
              numberOfLines={5}
              placeholder="e.g.&#10;• 2 packets Amul milk&#10;• 1kg Aashirvaad Atta&#10;• 1 loaf bread&#10;• 6 eggs"
              placeholderTextColor="#8E8E93"
              value={groceryListText}
              onChangeText={setGroceryListText}
            />

            <TouchableOpacity
              style={[styles.sendListBtn, !selectedStore.isOpen && { opacity: 0.5 }]}
              onPress={handleSendListOrder}
            >
              <Send size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.sendListBtnText}>Send List for Price Quote</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* MODE B: Traditional Product Catalog with Auto Stock Decrement */
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search milk, bread, rice, oil..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryBadge, selectedCategory === cat && styles.categoryActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryActiveText]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const cartItem = cart.find(c => c.id === item.id);
              const isFav = favorites.includes(item.id);

              return (
                <View style={[styles.itemCard, !item.isAvailable && styles.itemDisabled]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={{ marginLeft: 6 }}>
                        <Heart size={16} color={isFav ? '#FF3B30' : '#8E8E93'} fill={isFav ? '#FF3B30' : 'none'} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.itemMeta}>₹{item.price} • {item.category}</Text>
                    {!item.isAvailable && (
                      <Text style={styles.outOfStockText}>⚠️ Currently Out of Stock</Text>
                    )}
                  </View>

                  {item.isAvailable ? (
                    cartItem ? (
                      <View style={styles.quantityRow}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                          <Minus size={16} color="#007AFF" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{cartItem.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                          <Plus size={16} color="#007AFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                        <Text style={styles.addButtonText}>Add</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    <View style={styles.unavailableBadge}>
                      <Text style={styles.unavailableText}>Unavailable</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />

          {/* Sticky Checkout & Coupon Summary Bar */}
          {totalItems > 0 && (
            <View style={styles.cartStickyBar}>
              {/* Coupon Bar */}
              <View style={styles.couponContainer}>
                {appliedCoupon ? (
                  <View style={styles.appliedCouponRow}>
                    <Tag size={14} color="#059669" />
                    <Text style={styles.appliedCouponText}>
                      Code {appliedCoupon.code} applied: -₹{appliedCoupon.discountAmount}
                    </Text>
                    <TouchableOpacity onPress={handleRemoveCoupon}>
                      <X size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={styles.couponInputRow}>
                      <TextInput
                        style={styles.couponInput}
                        placeholder="Enter Promo Code (e.g. FIRST50)"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="characters"
                        value={couponCodeInput}
                        onChangeText={setCouponCodeInput}
                      />
                      <TouchableOpacity 
                        style={styles.applyCouponBtn} 
                        onPress={() => handleApplyCoupon()}
                        disabled={couponValidating}
                      >
                        <Text style={styles.applyCouponBtnText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.couponPillsRow}>
                      {quickCoupons.map(c => (
                        <TouchableOpacity key={c.code} style={styles.couponChip} onPress={() => handleApplyCoupon(c.code)}>
                          <Text style={styles.couponChipText}>🏷️ {c.code} ({c.label})</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Checkout Metrics & Trigger */}
              <View style={styles.checkoutMetricsRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ShoppingCart size={22} color="#FFF" style={{ marginRight: 10 }} />
                  <View>
                    <Text style={styles.cartCountText}>{totalItems} Item{totalItems > 1 ? 's' : ''}</Text>
                    <Text style={styles.cartPriceText}>
                      ₹{payableAmount} {discountVal > 0 ? <Text style={styles.originalPriceText}>(₹{totalPrice})</Text> : null}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.checkoutBtn, !selectedStore.isOpen && { opacity: 0.5 }]}
                  onPress={handleCatalogCheckout}
                >
                  <Text style={styles.checkoutBtnText}>Submit Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* MODAL: Delivery Address Picker / Creator */}
      <Modal visible={showAddAddressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.addressModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Select Delivery Address</Text>
              <TouchableOpacity onPress={() => setShowAddAddressModal(false)}>
                <X size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.savedAddrSectionLabel}>Saved Locations:</Text>
            {savedAddresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.savedAddrCard, selectedAddress === addr.addressLine && styles.savedAddrCardActive]}
                onPress={() => {
                  setSelectedAddress(addr.addressLine);
                  setShowAddAddressModal(false);
                }}
              >
                <MapPin size={16} color={selectedAddress === addr.addressLine ? '#007AFF' : '#8E8E93'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedAddrLabel}>{addr.label}</Text>
                  <Text style={styles.savedAddrLine}>{addr.addressLine}</Text>
                </View>
                {selectedAddress === addr.addressLine && <Check size={16} color="#007AFF" />}
              </TouchableOpacity>
            ))}

            <Text style={[styles.savedAddrSectionLabel, { marginTop: 14 }]}>Or Add New Address:</Text>
            <View style={styles.labelPickerRow}>
              {['Home', 'Work', 'Other'].map(lbl => (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.labelChoiceBtn, newAddressLabel === lbl && styles.labelChoiceActive]}
                  onPress={() => setNewAddressLabel(lbl)}
                >
                  <Text style={[styles.labelChoiceText, newAddressLabel === lbl && styles.labelChoiceActiveText]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.addressInputField}
              placeholder="e.g., Flat 102, Blossom Heights, Sector 4"
              value={newAddressLine}
              onChangeText={setNewAddressLine}
            />

            <TouchableOpacity style={styles.saveNewAddrBtn} onPress={handleAddNewAddress}>
              <PlusCircle size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveNewAddrBtnText}>Save and Use Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  storeSelectorContainer: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  storeSelectLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 6 },
  storePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA' },
  storePillActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  storePillText: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  storePillActiveText: { color: '#FFF' },
  shopBanner: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 16, marginTop: 10, borderRadius: 12, elevation: 1 },
  shopAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  shopName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  shopMeta: { fontSize: 12, color: '#636366', marginTop: 2 },
  shopHours: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  heroWaBtn: { backgroundColor: '#25D366', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'center', marginLeft: 8 },
  heroWaBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  addressBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  addressBarLabel: { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  addressBarValue: { flex: 1, fontSize: 12, color: '#1E3A8A' },
  changeAddrBtn: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  changeAddrBtnText: { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  closedAlert: { backgroundColor: '#FFF8E1', marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#FF9500' },
  closedAlertText: { color: '#B78103', fontSize: 12, fontWeight: '500', flex: 1 },
  modeTabBar: { flexDirection: 'row', backgroundColor: '#E5E5EA', marginHorizontal: 16, marginTop: 10, borderRadius: 10, padding: 3 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  modeTabActive: { backgroundColor: '#FFF', elevation: 2 },
  modeTabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  modeTabActiveText: { color: '#007AFF' },
  listOrderContainer: { flex: 1, padding: 16 },
  listCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 18, elevation: 2, marginBottom: 30 },
  listCardHeader: { marginBottom: 16 },
  listCardTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  listCardSub: { fontSize: 13, color: '#8E8E93', marginTop: 4, lineHeight: 18 },
  chipHeader: { fontSize: 13, fontWeight: '700', color: '#3A3A3C', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  chip: { backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#007AFF' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#3A3A3C', marginBottom: 6 },
  listInput: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 12, fontSize: 15, color: '#1C1C1E', minHeight: 110, marginBottom: 16 },
  sendListBtn: { backgroundColor: '#007AFF', borderRadius: 10, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  sendListBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 10, borderRadius: 10, paddingHorizontal: 10, height: 40, elevation: 1 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14 },
  categoryScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  categoryBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA' },
  categoryActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  categoryActiveText: { color: '#FFF' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 160 },
  itemCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemDisabled: { opacity: 0.6 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  itemMeta: { fontSize: 13, color: '#8E8E93', marginTop: 3 },
  outOfStockText: { fontSize: 12, color: '#FF3B30', fontWeight: '500', marginTop: 4 },
  addButton: { backgroundColor: '#E5F1FF', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#007AFF' },
  addButtonText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 6, padding: 2 },
  qtyBtn: { padding: 6 },
  qtyText: { paddingHorizontal: 8, fontSize: 14, fontWeight: '600' },
  unavailableBadge: { backgroundColor: '#E5E5EA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  unavailableText: { color: '#8E8E93', fontSize: 13, fontWeight: '500' },
  cartStickyBar: { position: 'absolute', bottom: 16, left: 14, right: 14, backgroundColor: '#1E293B', borderRadius: 14, padding: 12, elevation: 6 },
  couponContainer: { backgroundColor: '#334155', borderRadius: 8, padding: 8, marginBottom: 10 },
  appliedCouponRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appliedCouponText: { color: '#34D399', fontSize: 12, fontWeight: '700', flex: 1, marginLeft: 6 },
  couponInputRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  couponInput: { flex: 1, backgroundColor: '#1E293B', borderRadius: 6, paddingHorizontal: 10, height: 32, fontSize: 12, color: '#FFF' },
  applyCouponBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, borderRadius: 6, justifyContent: 'center' },
  applyCouponBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  couponPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  couponChip: { backgroundColor: '#475569', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  couponChipText: { color: '#E2E8F0', fontSize: 10, fontWeight: '600' },
  checkoutMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartCountText: { color: '#CBD5E1', fontSize: 12 },
  cartPriceText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  originalPriceText: { color: '#94A3B8', fontSize: 12, textDecorationLine: 'line-through' },
  checkoutBtn: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  checkoutBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  addressModalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  savedAddrSectionLabel: { fontSize: 12, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 6 },
  savedAddrCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FA', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E5EA' },
  savedAddrCardActive: { borderColor: '#007AFF', backgroundColor: '#EFF6FF' },
  savedAddrLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  savedAddrLine: { fontSize: 12, color: '#636366', marginTop: 2 },
  labelPickerRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  labelChoiceBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F2F2F7', alignItems: 'center' },
  labelChoiceActive: { backgroundColor: '#007AFF' },
  labelChoiceText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  labelChoiceActiveText: { color: '#FFF' },
  addressInputField: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 },
  saveNewAddrBtn: { backgroundColor: '#007AFF', height: 42, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveNewAddrBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' }
});
