import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SimpleCustomerScreen from './src/screens/SimpleCustomerScreen';
import SimpleMerchantScreen from './src/screens/SimpleMerchantScreen';

// Note: Full-featured screens preserved for future multi-role activations:
// import CustomerScreen from './src/screens/CustomerScreen';
// import InventoryScreen from './src/screens/InventoryScreen';
// import DeliveryPartnerScreen from './src/screens/DeliveryPartnerScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';
import MerchantAuthScreen from './src/screens/MerchantAuthScreen';
import { setAuthToken } from './src/services/apiConfig';

export default function App() {
  // Role switcher: 'customer' | 'merchant' | 'admin'
  const [userRole, setUserRole] = useState<'customer' | 'merchant' | 'admin'>('customer');
  
  // Authentication states
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [isCustomerRegistering, setIsCustomerRegistering] = useState(false);
  const [isMerchantLoggedIn, setIsMerchantLoggedIn] = useState(false);
  const [merchantShop, setMerchantShop] = useState('Tarama Stores');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Top Header / Role Switcher */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.headerTitle}>LocalShop</Text>
          <Text style={styles.headerSubtitle}>Direct Hyperlocal Store Delivery</Text>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleButton, userRole === 'customer' && styles.activeToggle]}
            onPress={() => setUserRole('customer')}
          >
            <Text style={[styles.toggleText, userRole === 'customer' && styles.activeText]}>
              🛒 Customer
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toggleButton, userRole === 'merchant' && styles.activeToggle]}
            onPress={() => setUserRole('merchant')}
          >
            <Text style={[styles.toggleText, userRole === 'merchant' && styles.activeText]}>
              🏪 Merchant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleButton, userRole === 'admin' && styles.activeToggle]}
            onPress={() => setUserRole('admin')}
          >
            <Text style={[styles.toggleText, userRole === 'admin' && styles.activeText]}>
              🛡️ Admin
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Body */}
      <View style={styles.content}>
        {userRole === 'customer' ? (
          !customerUser ? (
            isCustomerRegistering ? (
              <RegisterScreen 
                onRegisterSuccess={() => setIsCustomerRegistering(false)} 
                onSwitchToLogin={() => setIsCustomerRegistering(false)} 
              />
            ) : (
              <LoginScreen 
                onLoginSuccess={(user) => setCustomerUser(user)} 
                onSwitchToRegister={() => setIsCustomerRegistering(true)} 
              />
            )
          ) : (
            <SimpleCustomerScreen 
              currentUser={customerUser} 
              onLogout={() => {
                setAuthToken(undefined);
                setCustomerUser(null);
              }} 
            />
          )
        ) : userRole === 'merchant' ? (
          !isMerchantLoggedIn ? (
            <MerchantAuthScreen 
              onAuthSuccess={(shop) => {
                setMerchantShop(shop);
                setIsMerchantLoggedIn(true);
              }} 
            />
          ) : (
            <SimpleMerchantScreen 
              shopName={merchantShop} 
              onLogout={() => {
                setAuthToken(undefined);
                setIsMerchantLoggedIn(false);
              }} 
            />
          )
        ) : !isAdminLoggedIn ? (
          <AdminLoginScreen onAdminAuth={() => setIsAdminLoggedIn(true)} />
        ) : (
          <AdminDashboardScreen 
            onLogout={() => {
              setAuthToken(undefined);
              setIsAdminLoggedIn(false);
            }} 
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    width: '100%',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});