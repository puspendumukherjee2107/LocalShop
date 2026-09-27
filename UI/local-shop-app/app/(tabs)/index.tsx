import CustomerPaymentScreen from '@/src/screens/CustomerPaymentScreen';
import MerchantSettlementScreen from '@/src/screens/MerchantSettlementScreen';
import OrderTrackingScreen from '@/src/screens/OrderTrackingScreen';
import React, { useState } from 'react';
import { Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DeliveryPartnerScreen from '../../src/screens/DeliveryPartnerScreen';
import DeliveryLoginScreen from '../../src/screens/DeliveryLoginScreen';
import AdminDashboardScreen from '../../src/screens/AdminDashboardScreen';
import AdminLoginScreen from '../../src/screens/AdminLoginScreen';
import RegisterScreen from '../../src/screens/Auth/RegisterScreen';
import CustomerScreen from '../../src/screens/CustomerScreen';
import CustomerSettingsScreen from '../../src/screens/CustomerSettingsScreen';
import InventoryScreen from '../../src/screens/InventoryScreen';
import LoginScreen from '../../src/screens/LoginScreen';
import MerchantAuthScreen from '../../src/screens/MerchantAuthScreen';
import MerchantSettingsScreen from '../../src/screens/MerchantSettingsScreen';
import StaffManagementScreen from '../../src/screens/StaffManagementScreen';
type MainRole = 'customer' | 'merchant' | 'delivery' | 'admin';
type CustomerTab = 'browse' | 'tracking' | 'payments' | 'settings';
type MerchantTab = 'inventory' | 'staff' | 'settlements' | 'settings';

export default function HomeScreen() {
  const [mainRole, setMainRole] = useState<MainRole | null>(null);
  
  // Authentication Trackers
  const [customerAuth, setCustomerAuth] = useState(false);
  const [merchantShop, setMerchantShop] = useState<string | null>(null);
  const [adminAuth, setAdminAuth] = useState(false);
  const [deliveryAuth, setDeliveryAuth] = useState(false);
  
  // Workspace Internal Tab Toggles
  const [merchantSubTab, setMerchantSubTab] = useState<MerchantTab>('inventory');
  const [customerSubTab, setCustomerSubTab] = useState<CustomerTab>('browse');
  const [custScreenState, setCustScreenState] = useState<'login' | 'register'>('login');

  const chooseRole = (role: MainRole) => {
    setMainRole(role);
    if (role !== 'customer') {
      setCustScreenState('login');
    }
  };

  const goBackToRoleSelection = () => {
    setMainRole(null);
    setCustomerAuth(false);
    setMerchantShop(null);
    setAdminAuth(false);
    setDeliveryAuth(false);
  };

  // System User Identity Session
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; phone: string; address?: string }>({
    name: 'Turja Sharma',
    phone: '9876543210',
    address: 'Flat 4B, Greenfield Apartments'
  });

  const handleCustomerAuth = (user?: any) => {
    if (user && typeof user === 'object') {
      setCurrentUser(prev => ({
        ...prev,
        ...user,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
        address: user.address || prev.address
      }));
    } else if (typeof user === 'string' && user.trim()) {
      setCurrentUser(prev => ({ ...prev, name: user.trim() }));
    }
    setCustomerAuth(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>L</Text>
          </View>
          <Text style={styles.headerTitle}>LocalShop</Text>
        </View>
        {mainRole && (
          <TouchableOpacity style={styles.backButton} onPress={goBackToRoleSelection}>
            <Text style={styles.backButtonText}>← Choose another role</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Sandbox Layout Area Router */}
      <View style={styles.content}>
        {!mainRole && (
          <ScrollView contentContainerStyle={styles.roleSelectorContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.heroPanel}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80' }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.heroOverlay} />
              <View style={styles.heroGradient} />
              <View style={styles.heroGlow} />
              <View style={styles.heroContent}>
                <Text style={styles.heroBadge}>Fresh local shopping</Text>
                <Text style={styles.heroTitle}>Your neighborhood store, made simpler.</Text>
                <Text style={styles.heroText}>Choose how you want to shop or run your store.</Text>
              </View>
            </View>

            <Text style={styles.roleIntro}>Who are you?</Text>
            <Text style={styles.roleSubtitle}>Select your role to continue to the password screen.</Text>

            <View style={styles.roleGrid}>
              <TouchableOpacity style={[styles.roleCard, styles.customerCard]} onPress={() => chooseRole('customer')}>
                <View style={styles.roleIconWrap}>
                  <Text style={styles.roleEmoji}>🛍️</Text>
                </View>
                <Text style={styles.roleLabel}>Customer</Text>
                <Text style={styles.roleHint}>Shop & track orders</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.roleCard, styles.merchantCard]} onPress={() => chooseRole('merchant')}>
                <View style={styles.roleIconWrap}>
                  <Text style={styles.roleEmoji}>🏪</Text>
                </View>
                <Text style={styles.roleLabel}>Merchant</Text>
                <Text style={styles.roleHint}>Manage stock & sales</Text>
              </TouchableOpacity>

              {false && (
                <TouchableOpacity style={[styles.roleCard, styles.deliveryCard]} onPress={() => chooseRole('delivery')}>
                  <View style={styles.roleIconWrap}>
                    <Text style={styles.roleEmoji}>🛵</Text>
                  </View>
                  <Text style={styles.roleLabel}>Delivery</Text>
                  <Text style={styles.roleHint}>Handle drops</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.roleCard, styles.adminCard]} onPress={() => chooseRole('admin')}>
                <View style={styles.roleIconWrap}>
                  <Text style={styles.roleEmoji}>🛡️</Text>
                </View>
                <Text style={styles.roleLabel}>Admin</Text>
                <Text style={styles.roleHint}>System control</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
        
        {/* Customer View Management Wrapper */}
        {mainRole === 'customer' && (
          !customerAuth ? (
            custScreenState === 'login' ? (
              <LoginScreen onLoginSuccess={handleCustomerAuth} onSwitchToRegister={() => setCustScreenState('register')} />
            ) : (
              <RegisterScreen onRegisterSuccess={handleCustomerAuth} onSwitchToLogin={() => setCustScreenState('login')} />
            )
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.subTabBar}>
                  <TouchableOpacity style={[styles.subTabItem, customerSubTab === 'browse' && styles.subTabActive]} onPress={() => setCustomerSubTab('browse')}><Text style={[styles.subTabText, customerSubTab === 'browse' && styles.subTabActiveText]}>🛍️ Shop</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.subTabItem, customerSubTab === 'tracking' && styles.subTabActive]} onPress={() => setCustomerSubTab('tracking')}><Text style={[styles.subTabText, customerSubTab === 'tracking' && styles.subTabActiveText]}>📦 Track</Text></TouchableOpacity>
                  {false && (
                    <TouchableOpacity style={[styles.subTabItem, customerSubTab === 'payments' && styles.subTabActive]} onPress={() => setCustomerSubTab('payments')}><Text style={[styles.subTabText, customerSubTab === 'payments' && styles.subTabActiveText]}>💳 Pay</Text></TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.subTabItem, customerSubTab === 'settings' && styles.subTabActive]} onPress={() => setCustomerSubTab('settings')}><Text style={[styles.subTabText, customerSubTab === 'settings' && styles.subTabActiveText]}>⚙️ Account</Text></TouchableOpacity>
              </View>
              {customerSubTab === 'browse' && <CustomerScreen currentUser={currentUser} />}
              {customerSubTab === 'tracking' && <OrderTrackingScreen />}
              {false && customerSubTab === 'payments' && <CustomerPaymentScreen customerPhone={currentUser.phone} />}
              {customerSubTab === 'settings' && <CustomerSettingsScreen currentUser={currentUser} onProfileUpdated={setCurrentUser} />}
            </View>
          )
        )}

        {/* Merchant Control Views */}
        {mainRole === 'merchant' && (
          !merchantShop ? (
            <MerchantAuthScreen onAuthSuccess={(name) => setMerchantShop(name)} />
          ) : (
             <View style={{ flex: 1 }}>
              <View style={styles.subTabBar}>
                <TouchableOpacity style={[styles.subTabItem, merchantSubTab === 'inventory' && styles.subTabActive]} onPress={() => setMerchantSubTab('inventory')}><Text style={[styles.subTabText, merchantSubTab === 'inventory' && styles.subTabActiveText]}>📦 Stock</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.subTabItem, merchantSubTab === 'staff' && styles.subTabActive]} onPress={() => setMerchantSubTab('staff')}><Text style={[styles.subTabText, merchantSubTab === 'staff' && styles.subTabActiveText]}>👥 Staff</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.subTabItem, merchantSubTab === 'settlements' && styles.subTabActive]} onPress={() => setMerchantSubTab('settlements')}><Text style={[styles.subTabText, merchantSubTab === 'settlements' && styles.subTabActiveText]}>🏦 Bank</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.subTabItem, merchantSubTab === 'settings' && styles.subTabActive]} onPress={() => setMerchantSubTab('settings')}><Text style={[styles.subTabText, merchantSubTab === 'settings' && styles.subTabActiveText]}>⚙️ Profile</Text></TouchableOpacity>
              </View>
                {merchantSubTab === 'inventory' && <InventoryScreen />}
                {merchantSubTab === 'staff' && <StaffManagementScreen />}
                {merchantSubTab === 'settlements' && <MerchantSettlementScreen />}
                {merchantSubTab === 'settings' && <MerchantSettingsScreen />}
            </View>
          )
        )}

        {false && mainRole === 'delivery' && (
          !deliveryAuth ? (
            <DeliveryLoginScreen onAuthSuccess={(name) => {
              setDeliveryAuth(true);
              // keep the driver name for downstream delivery actions
              // this data is retained in screen state by the delivery dashboard itself
              if (name) {
                // no-op placeholder to keep auth flow consistent
              }
            }} />
          ) : (
            <DeliveryPartnerScreen />
          )
        )}

        {/* System Administration Control Panel */}
        {mainRole === 'admin' && (
          !adminAuth ? (
          <AdminLoginScreen onAdminAuth={() => setAdminAuth(true)} />
          ) : (
        <AdminDashboardScreen />
          )
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { paddingTop: 12, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  brandBadge: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#1E90FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandBadgeText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  backButton: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F2F2F7' },
  backButtonText: { color: '#007AFF', fontWeight: '600', fontSize: 13 },
  content: { flex: 1 },
  roleSelectorContainer: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 50 },
  heroPanel: { height: 220, borderRadius: 24, overflow: 'hidden', position: 'relative', marginBottom: 22, backgroundColor: '#DDEBFF', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 30, 46, 0.28)' },
  heroGradient: { ...StyleSheet.absoluteFill, backgroundColor: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0))' },
  heroGlow: { position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(120, 199, 255, 0.22)' },
  heroContent: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1, color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', marginBottom: 10 },
  heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginBottom: 6 },
  heroText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  roleIntro: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', textAlign: 'center', marginTop: 4 },
  roleSubtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', marginTop: 8, marginBottom: 26 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  roleCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 14, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.06)' },
  customerCard: { backgroundColor: '#F3F9FF' },
  merchantCard: { backgroundColor: '#F5F2FF' },
  deliveryCard: { backgroundColor: '#F0FFF6' },
  adminCard: { backgroundColor: '#FFF7E8' },
  roleIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  roleEmoji: { fontSize: 30 },
  roleLabel: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  roleHint: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  subTabBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', gap: 8 },
  subTabItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  subTabActive: { backgroundColor: '#E5F1FF' },
  subTabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  subTabActiveText: { color: '#007AFF' },
  adminDashboard: { flex: 1, backgroundColor: '#1C1C1E', padding: 20 },
  adminMetricCard: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 16, marginTop: 20 },
  metricText: { color: '#FFF', fontSize: 16, marginBottom: 8, fontWeight: '600' }
});