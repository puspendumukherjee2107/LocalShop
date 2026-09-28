import React, { useState, useEffect } from 'react';
// Hyperlocal commerce portal
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import SimpleCustomerScreen from '../../src/screens/SimpleCustomerScreen';
import SimpleMerchantScreen from '../../src/screens/SimpleMerchantScreen';
import LoginScreen from '../../src/screens/LoginScreen';
import RegisterScreen from '../../src/screens/Auth/RegisterScreen';
import MerchantAuthScreen from '../../src/screens/MerchantAuthScreen';
import AdminLoginScreen from '../../src/screens/AdminLoginScreen';
import AdminDashboardScreen from '../../src/screens/AdminDashboardScreen';
import { BASE_URL, FIXED_CLOUD_API, LOCAL_LAN_API, setServerEndpoint } from '../../src/services/apiConfig';

type MainRole = 'customer' | 'merchant' | 'admin';

export default function HomeScreen() {
  const [mainRole, setMainRole] = useState<MainRole | null>(null);

  // Server Endpoint & Connectivity State
  const [currentApiUrl, setCurrentApiUrl] = useState<string>(BASE_URL);
  const [serverHealth, setServerHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customInputUrl, setCustomInputUrl] = useState(BASE_URL);

  const testHealth = async (urlToCheck: string = currentApiUrl) => {
    setServerHealth('checking');
    try {
      const clean = urlToCheck.trim().replace(/\/+$/, '');
      const testUrl = clean.endsWith('/api') ? `${clean}/stores` : `${clean}/api/stores`;
      const res = await fetch(testUrl);
      if (res.ok) {
        setServerHealth('online');
      } else {
        setServerHealth('offline');
      }
    } catch {
      setServerHealth('offline');
    }
  };

  useEffect(() => {
    testHealth(currentApiUrl);
  }, [currentApiUrl]);

  // Auth States
  const [customerAuth, setCustomerAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [custScreenState, setCustScreenState] = useState<'login' | 'register'>('login');

  const [merchantShop, setMerchantShop] = useState<string | null>(null);
  const [adminAuth, setAdminAuth] = useState(false);

  const handleSelectRole = (role: MainRole) => {
    setMainRole(role);
    setCustScreenState('login');
  };

  const handleLogoutOrSwitchRole = () => {
    setMainRole(null);
    setCustomerAuth(false);
    setCurrentUser(null);
    setMerchantShop(null);
    setAdminAuth(false);
    setCustScreenState('login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>L</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>LocalShop</Text>
              <Text style={styles.headerSubtitle}>
                {mainRole === 'customer'
                  ? (customerAuth ? `Customer: ${currentUser?.name || 'Turja'}` : 'Customer Login')
                  : mainRole === 'merchant'
                  ? (merchantShop ? `Merchant: ${merchantShop}` : 'Merchant Portal')
                  : mainRole === 'admin'
                  ? (adminAuth ? 'Admin Console' : 'Admin Login')
                  : 'Hyperlocal Store Platform'}
              </Text>
            </View>
          </View>

          {mainRole !== null && (
            <TouchableOpacity style={styles.switchRoleBtn} onPress={handleLogoutOrSwitchRole}>
              <Text style={styles.switchRoleText}>← Switch Role</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Body */}
      <View style={styles.content}>
        {/* 1. INITIAL LANDING: ROLE SELECTION */}
        {mainRole === null && (
          <ScrollView contentContainerStyle={styles.roleSelectorContainer}>
            <View style={styles.heroPanel}>
              <Text style={styles.heroBadge}>HYPERLOCAL COMMERCE</Text>
              <Text style={styles.heroTitle}>Welcome to LocalShop</Text>
              <Text style={styles.heroText}>
                Direct neighborhood store delivery without delivery middlemen.
              </Text>
            </View>

            <Text style={styles.roleIntro}>Select who you are:</Text>
            <Text style={styles.roleSubtitle}>Choose your account type to continue</Text>

            <View style={styles.roleGrid}>
              {/* Customer Option */}
              <TouchableOpacity
                style={[styles.roleCard, styles.customerCard]}
                onPress={() => handleSelectRole('customer')}
              >
                <View style={styles.roleIconWrap}>
                  <Text style={styles.roleEmoji}>🛒</Text>
                </View>
                <Text style={styles.roleLabel}>Customer</Text>
                <Text style={styles.roleHint}>
                  Browse local stores, order groceries, approve quotes & track orders.
                </Text>
              </TouchableOpacity>

              {/* Merchant Option */}
              <TouchableOpacity
                style={[styles.roleCard, styles.merchantCard]}
                onPress={() => handleSelectRole('merchant')}
              >
                <View style={styles.roleIconWrap}>
                  <Text style={styles.roleEmoji}>🏪</Text>
                </View>
                <Text style={styles.roleLabel}>Store Owner</Text>
                <Text style={styles.roleHint}>
                  Receive customer lists, calculate shelf prices, pack & deliver.
                </Text>
              </TouchableOpacity>

              {/* Admin Option */}
              <TouchableOpacity
                style={[styles.roleCard, styles.adminCard]}
                onPress={() => handleSelectRole('admin')}
              >
                <View style={styles.roleIconWrap}>
                  <Text style={styles.roleEmoji}>🛡️</Text>
                </View>
                <Text style={styles.roleLabel}>Administrator</Text>
                <Text style={styles.roleHint}>
                  Store approvals, platform metrics & system oversight.
                </Text>
              </TouchableOpacity>
            </View>

            {/* Server Connection Banner */}
            <View style={styles.serverBox}>
              <View style={styles.serverRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.serverLabel}>📡 API Server Connection</Text>
                  <Text style={styles.serverUrlText} numberOfLines={1}>{currentApiUrl}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    serverHealth === 'online' ? styles.statusBadgeOnline : styles.statusBadgeOffline
                  ]}
                  onPress={() => testHealth(currentApiUrl)}
                >
                  <Text style={styles.statusBadgeText}>
                    {serverHealth === 'checking' ? '⏳ Testing' : serverHealth === 'online' ? '🟢 Online' : '🔴 Offline'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.serverBtnRow}>
                <TouchableOpacity
                  style={styles.serverMiniBtn}
                  onPress={() => {
                    const newUrl = setServerEndpoint(FIXED_CLOUD_API);
                    setCurrentApiUrl(newUrl);
                    testHealth(newUrl);
                  }}
                >
                  <Text style={styles.serverMiniBtnText}>☁️ Google Cloud</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.serverMiniBtn}
                  onPress={() => {
                    const newUrl = setServerEndpoint(LOCAL_LAN_API);
                    setCurrentApiUrl(newUrl);
                    testHealth(newUrl);
                  }}
                >
                  <Text style={styles.serverMiniBtnText}>📶 Local Wi-Fi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.serverMiniBtn}
                  onPress={() => {
                    setCustomInputUrl(currentApiUrl);
                    setShowConfigModal(true);
                  }}
                >
                  <Text style={styles.serverMiniBtnText}>⚙️ Custom URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {/* 2. CUSTOMER WORKFLOW */}
        {mainRole === 'customer' && (
          !customerAuth ? (
            custScreenState === 'login' ? (
              <LoginScreen
                onLoginSuccess={(user) => {
                  setCurrentUser(user);
                  setCustomerAuth(true);
                }}
                onSwitchToRegister={() => setCustScreenState('register')}
              />
            ) : (
              <RegisterScreen
                onRegisterSuccess={() => {
                  setCustScreenState('login');
                }}
                onSwitchToLogin={() => setCustScreenState('login')}
              />
            )
          ) : (
            <SimpleCustomerScreen />
          )
        )}

        {/* 3. MERCHANT WORKFLOW */}
        {mainRole === 'merchant' && (
          !merchantShop ? (
            <MerchantAuthScreen
              onAuthSuccess={(shopName) => {
                setMerchantShop(shopName);
              }}
            />
          ) : (
            <SimpleMerchantScreen shopName={merchantShop || 'Kirana Junction'} />
          )
        )}

        {/* 4. ADMIN WORKFLOW */}
        {mainRole === 'admin' && (
          !adminAuth ? (
            <AdminLoginScreen
              onAdminAuth={() => {
                setAdminAuth(true);
              }}
            />
          ) : (
            <AdminDashboardScreen />
          )
        )}
      </View>

      {/* Custom Server Endpoint Modal */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚙️ Set API Server Endpoint</Text>
            <Text style={styles.modalSubtitle}>
              Enter your backend URL or tunnel endpoint (e.g., https://... or http://192.168.x.x:5000)
            </Text>

            <TextInput
              style={styles.modalInput}
              value={customInputUrl}
              onChangeText={setCustomInputUrl}
              placeholder="https://your-tunnel.loca.lt/api"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  if (!customInputUrl.trim()) {
                    Alert.alert('Invalid URL', 'Please enter a valid server URL.');
                    return;
                  }
                  const newUrl = setServerEndpoint(customInputUrl);
                  setCurrentApiUrl(newUrl);
                  setShowConfigModal(false);
                  testHealth(newUrl);
                  Alert.alert('Endpoint Updated', `Active API is now:\n${newUrl}`);
                }}
              >
                <Text style={styles.modalSaveText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandBadgeText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  switchRoleBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  switchRoleText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  roleSelectorContainer: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  heroPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  roleIntro: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 4,
  },
  roleSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  roleGrid: {
    gap: 14,
  },
  roleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'column',
  },
  customerCard: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  merchantCard: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  adminCard: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleEmoji: {
    fontSize: 24,
  },
  roleLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  roleHint: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  serverBox: {
    marginTop: 20,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  serverLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  serverUrlText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeOnline: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeOffline: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  serverBtnRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  serverMiniBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serverMiniBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});