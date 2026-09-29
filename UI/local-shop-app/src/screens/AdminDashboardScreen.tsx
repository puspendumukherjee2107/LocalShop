import { CheckCircle2, FileSpreadsheet, Settings, XCircle, KeyRound, Phone, Eye, EyeOff, UserCheck } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { BASE_URL, getAuthToken } from '../services/apiConfig';

type AdminSubTab = 'approvals' | 'customers' | 'reports' | 'logs' | 'config';

interface MerchantRecord {
  id: string;
  shopName: string;
  category: string;
  tradeLicense: string;
  kycStatus: string;
  isOpen: boolean;
  phone?: string;
  ownerName?: string;
  status?: string;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  address?: string;
  status: string;
}

interface LogRecord {
  id: string;
  event: string;
  time: string;
  actor: string;
}

interface PlatformOverview {
  grossMerchandiseVolume: number;
  totalInvoices: number;
  platformFeePercent: number;
  collectedPlatformFee: number;
  settledMerchantAssets: number;
  activeStores: number;
  totalCustomers: number;
  maintenanceMode: boolean;
}

interface AdminDashboardScreenProps {
  onLogout?: () => void;
}

export default function AdminDashboardScreen({ onLogout }: AdminDashboardScreenProps = {}) {
  const [activeTab, setActiveTab] = useState<AdminSubTab>('approvals');
  const [loading, setLoading] = useState(false);

  // Live Datasets from Backend
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);

  // System Configurations
  const [platformFee, setPlatformFee] = useState('2.5');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Admin Password Reset State
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<{
    id?: string;
    name: string;
    phone: string;
    role: 'Merchant' | 'Customer';
  } | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('Temp@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const openResetModal = (target: { id?: string; name: string; phone: string; role: 'Merchant' | 'Customer' }) => {
    setResetTargetUser(target);
    setAdminNewPassword('Temp@2026');
    setShowPassword(false);
    setResetModalVisible(true);
  };

  const handleConfirmPasswordReset = async () => {
    if (!resetTargetUser || !resetTargetUser.phone) {
      Alert.alert('Error', 'Missing mobile number for password reset.');
      return;
    }
    if (!adminNewPassword || adminNewPassword.trim().length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters long.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE_URL}/admin/reset-user-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          phone: resetTargetUser.phone.trim(),
          newPassword: adminNewPassword.trim(),
          role: resetTargetUser.role
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert(
          'Password Reset Done! 🔑',
          `Password for ${resetTargetUser.role} "${resetTargetUser.name}" (${resetTargetUser.phone}) is now updated.\n\nNew Password: ${adminNewPassword.trim()}\n\nYou can inform the user to log in with this password.`
        );
        setResetModalVisible(false);
      } else {
        Alert.alert('Reset Failed', data.message || 'Server rejected password reset.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const loadTabContent = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      if (activeTab === 'approvals') {
        const res = await fetch(`${BASE_URL}/admin/merchants`, { headers });
        if (res.ok) {
          const data = await res.json();
          setMerchants(Array.isArray(data) ? data : data.value || []);
        }
      } else if (activeTab === 'customers') {
        const res = await fetch(`${BASE_URL}/admin/customers`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCustomers(Array.isArray(data) ? data : data.value || []);
        }
      } else if (activeTab === 'reports') {
        const res = await fetch(`${BASE_URL}/admin/overview`, { headers });
        if (res.ok) {
          const data = await res.json();
          setOverview(data);
          if (data.platformFeePercent) setPlatformFee(data.platformFeePercent.toString());
          if (data.maintenanceMode !== undefined) setMaintenanceMode(data.maintenanceMode);
        }
      } else if (activeTab === 'logs') {
        const res = await fetch(`${BASE_URL}/admin/logs`, { headers });
        if (res.ok) {
          const data = await res.json();
          setLogs(Array.isArray(data) ? data : data.value || []);
        }
      } else if (activeTab === 'config') {
        const res = await fetch(`${BASE_URL}/admin/config`, { headers });
        if (res.ok) {
          const data = await res.json();
          setPlatformFee(data.platformFeePercent?.toString() || '2.5');
          setMaintenanceMode(data.maintenanceMode || false);
        }
      }
    } catch {
      console.warn('Error loading admin tab data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTabContent();
  }, [loadTabContent]);

  const handleKycAction = async (id: string, action: 'Approved' | 'Rejected') => {
    try {
      const res = await fetch(`${BASE_URL}/admin/merchants/${id}/kyc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kycStatus: action })
      });

      if (res.ok) {
        setMerchants(prev => prev.map(m => m.id === id ? { ...m, kycStatus: action } : m));
        Alert.alert('KYC Updated', `Store KYC status updated to ${action}.`);
      } else {
        Alert.alert('Error', 'Failed to update store KYC status.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  const handleToggleCustomer = async (id: string) => {
    try {
      const res = await fetch(`${BASE_URL}/admin/customers/${id}/toggle-status`, {
        method: 'PUT'
      });

      if (res.ok) {
        const updated = await res.json();
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: updated.status } : c));
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  const handleSaveConfig = async (newFee?: string, newMode?: boolean) => {
    const feeVal = newFee !== undefined ? parseFloat(newFee) : parseFloat(platformFee);
    const modeVal = newMode !== undefined ? newMode : maintenanceMode;

    try {
      const res = await fetch(`${BASE_URL}/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformFeePercent: isNaN(feeVal) ? 2.5 : feeVal,
          maintenanceMode: modeVal
        })
      });

      if (res.ok) {
        Alert.alert('Config Saved', 'Global platform parameters updated.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot save platform configuration.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Horizontal Administrative Switcher Command Strip */}
      <View style={styles.adminBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['approvals', 'customers', 'reports', 'logs', 'config'] as AdminSubTab[]).map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabButton, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabActiveText]}>
                {tab === 'approvals' ? 'MERCHANTS' : tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          {onLogout && (
            <TouchableOpacity 
              style={[styles.tabButton, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
              onPress={onLogout}
            >
              <Text style={[styles.tabText, { color: '#DC2626', fontWeight: '700' }]}>
                LOGOUT
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Main Administrative Route Switcher Engine */}
      <View style={{ flex: 1, padding: 16 }}>
        
        {/* 1. Merchant Approval Dashboard */}
        {activeTab === 'approvals' && (
          <FlatList
            data={merchants}
            keyExtractor={item => item.id}
            refreshing={loading}
            onRefresh={loadTabContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No registered merchant profiles found.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.cardTitle}>{item.shopName}</Text>
                  <View style={[styles.badge, { backgroundColor: item.kycStatus === 'Approved' ? '#E5F9ED' : item.kycStatus === 'Rejected' ? '#FFEBEA' : '#FFF3E0' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: item.kycStatus === 'Approved' ? '#34C759' : item.kycStatus === 'Rejected' ? '#FF3B30' : '#FF9500' }}>
                      {item.kycStatus?.toUpperCase() || 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Prominently Displayed Merchant Phone & Owner */}
                <View style={styles.merchantMetaRow}>
                  <View style={styles.phoneBadge}>
                    <Phone size={13} color="#FF9500" />
                    <Text style={styles.phoneBadgeText}>Mobile: {item.phone || '9876500000'}</Text>
                  </View>
                  {item.ownerName ? (
                    <Text style={styles.ownerText}>• Owner: {item.ownerName}</Text>
                  ) : null}
                </View>

                <Text style={styles.cardMeta}>Category: {item.category} • License: {item.tradeLicense || 'Not Submitted'}</Text>
                
                <View style={styles.rowGap}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#34C759' }]} 
                    onPress={() => handleKycAction(item.id, 'Approved')}
                  >
                    <CheckCircle2 size={16} color="#FFF" />
                    <Text style={styles.btnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]} 
                    onPress={() => handleKycAction(item.id, 'Rejected')}
                  >
                    <XCircle size={16} color="#FFF" />
                    <Text style={styles.btnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#FF9500' }]} 
                    onPress={() => openResetModal({ id: item.id, name: item.shopName, phone: item.phone || '9876500000', role: 'Merchant' })}
                  >
                    <KeyRound size={15} color="#FFF" />
                    <Text style={styles.btnText}>Reset Pass</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        {/* 2. Customer Management Directory */}
        {activeTab === 'customers' && (
          <FlatList
            data={customers}
            keyExtractor={item => item.id}
            refreshing={loading}
            onRefresh={loadTabContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No registered customers.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {/* Prominently Displayed Customer Phone */}
                    <View style={styles.customerPhoneRow}>
                      <Phone size={14} color="#34C759" />
                      <Text style={styles.customerPhoneText}>Mobile: {item.phone}</Text>
                    </View>
                    {item.address ? <Text style={styles.cardAddress}>{item.address}</Text> : null}
                  </View>
                  <TouchableOpacity 
                    style={[styles.badge, { backgroundColor: item.status === 'Active' ? '#E5F9ED' : '#FFEBEA' }]}
                    onPress={() => handleToggleCustomer(item.id)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: item.status === 'Active' ? '#34C759' : '#FF3B30' }}>
                      {item.status || 'Active'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Reset Password Action Button for Customer */}
                <View style={styles.customerActionRow}>
                  <TouchableOpacity 
                    style={styles.customerResetBtn}
                    onPress={() => openResetModal({ id: item.id, name: item.name, phone: item.phone, role: 'Customer' })}
                  >
                    <KeyRound size={14} color="#FFF" />
                    <Text style={styles.customerResetBtnText}>Reset Password</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        {/* 3. Platform Financial Performance Reports */}
        {activeTab === 'reports' && (
          <ScrollView>
            <View style={styles.metricHero}>
              <FileSpreadsheet size={32} color="#FFF" />
              <Text style={styles.heroLabel}>Total Ecosystem Gross Volume (GMV)</Text>
              <Text style={styles.heroValue}>₹{(overview?.grossMerchandiseVolume || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ecosystem Distribution Summary (Live SQLite)</Text>
              <Text style={styles.reportText}>• Total Processing Invoices: {overview?.totalInvoices || 0}</Text>
              <Text style={styles.reportText}>• Net Collected Platform Fee ({overview?.platformFeePercent || 2.5}%): ₹{(overview?.collectedPlatformFee || 0).toFixed(2)}</Text>
              <Text style={styles.reportText}>• Settled Merchant Assets: ₹{(overview?.settledMerchantAssets || 0).toLocaleString()}</Text>
              <Text style={styles.reportText}>• Active Open Stores: {overview?.activeStores || 1}</Text>
              <Text style={styles.reportText}>• Registered Customers: {overview?.totalCustomers || 1}</Text>
            </View>
          </ScrollView>
        )}

        {/* 4. Immutable Security Audit Logs */}
        {activeTab === 'logs' && (
          <FlatList
            data={logs}
            keyExtractor={item => item.id}
            refreshing={loading}
            onRefresh={loadTabContent}
            renderItem={({ item }) => (
              <View style={styles.logCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.logEvent}>{item.event}</Text>
                  <Text style={styles.logTime}>{item.time}</Text>
                </View>
                <Text style={styles.logActor}>Actor Node Context: {item.actor}</Text>
              </View>
            )}
          />
        )}

        {/* 5. System Configurations Engine */}
        {activeTab === 'config' && (
          <ScrollView style={styles.card}>
            <Text style={styles.cardTitle}><Settings size={18} color="#FF9500" /> Platform Operational Switches</Text>
            
            <Text style={styles.inputLabel}>Global Platform Transaction Fee (%)</Text>
            <TextInput 
              style={styles.input} 
              value={platformFee} 
              onChangeText={setPlatformFee} 
              onEndEditing={() => handleSaveConfig(platformFee)}
              keyboardType="numeric" 
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.switchLabel}>Global Infrastructure Maintenance Lock</Text>
                <Text style={styles.switchSubText}>Disconnects front-end API routing protocols for system database migrations.</Text>
              </View>
              <Switch 
                value={maintenanceMode} 
                onValueChange={(val) => {
                  setMaintenanceMode(val);
                  handleSaveConfig(undefined, val);
                }} 
                trackColor={{ true: '#FF9500' }} 
              />
            </View>
          </ScrollView>
        )}

      </View>

      {/* Password Reset Modal */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KeyRound size={20} color="#FF9500" />
                <Text style={styles.modalTitle}>Admin Password Reset</Text>
              </View>
              <TouchableOpacity onPress={() => setResetModalVisible(false)}>
                <XCircle size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {resetTargetUser && (
              <View style={styles.targetUserBox}>
                <View style={[styles.roleBadge, { backgroundColor: resetTargetUser.role === 'Merchant' ? '#FF9500' : '#007AFF' }]}>
                  <Text style={styles.roleBadgeText}>{resetTargetUser.role.toUpperCase()}</Text>
                </View>
                <Text style={styles.targetUserName}>{resetTargetUser.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Phone size={14} color="#34C759" />
                  <Text style={styles.targetUserPhone}>Mobile: {resetTargetUser.phone}</Text>
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>Set New Password (Min 8 Chars)</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={adminNewPassword}
                onChangeText={setAdminNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#8E8E93"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={{ padding: 8 }}>
                {showPassword ? <EyeOff size={18} color="#8E8E93" /> : <Eye size={18} color="#8E8E93" />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.quickPresetChip}
              onPress={() => setAdminNewPassword('Temp@2026')}
            >
              <Text style={styles.quickPresetText}>⚡ Set Temp Password: <Text style={{ fontWeight: '700', color: '#FF9500' }}>Temp@2026</Text></Text>
            </TouchableOpacity>

            <Text style={styles.modalNote}>
              Note: This will securely re-hash the password on the database, unlock the account, and reset failed login attempts immediately.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setResetModalVisible(false)}
                disabled={isResettingPassword}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmPasswordReset}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <KeyRound size={16} color="#FFF" />
                    <Text style={styles.modalConfirmText}>Confirm Reset</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  adminBar: { backgroundColor: '#2C2C2E', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
  tabButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: '#3A3A3C' },
  tabActive: { backgroundColor: '#FF9500' },
  tabText: { color: '#8E8E93', fontSize: 11, fontWeight: '700' },
  tabActiveText: { color: '#FFF' },
  emptyText: { color: '#8E8E93', textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardRow: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  cardMeta: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  cardAddress: { color: '#AEAEC2', fontSize: 12, marginTop: 2 },
  rowGap: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, height: 38, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  metricHero: { backgroundColor: '#FF9500', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6, fontWeight: '600' },
  heroValue: { color: '#FFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  reportText: { color: '#E5E5EA', fontSize: 14, marginTop: 10, fontWeight: '500' },
  logCard: { backgroundColor: '#2C2C2E', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#FF9500' },
  logEvent: { color: '#FFF', fontSize: 13, fontWeight: '600', width: '75%' },
  logTime: { color: '#8E8E93', fontSize: 12 },
  logActor: { color: '#8E8E93', fontSize: 12, marginTop: 4 },
  inputLabel: { color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#3A3A3C', borderRadius: 8, padding: 10, color: '#FFF', fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, borderTopWidth: 1, borderTopColor: '#3A3A3C', paddingTop: 16 },
  switchLabel: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  switchSubText: { color: '#8E8E93', fontSize: 12, marginTop: 2, lineHeight: 16 },
  merchantMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 2, flexWrap: 'wrap', gap: 8 },
  phoneBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3A3A3C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 5 },
  phoneBadgeText: { color: '#FF9500', fontSize: 13, fontWeight: '700' },
  ownerText: { color: '#AEAEC2', fontSize: 13, fontWeight: '500' },
  customerPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  customerPhoneText: { color: '#34C759', fontSize: 14, fontWeight: '700' },
  customerActionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#3A3A3C', paddingTop: 10 },
  customerResetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF9500', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  customerResetBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 440, backgroundColor: '#2C2C2E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#3A3A3C' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  targetUserBox: { backgroundColor: '#1C1C1E', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#FF9500' },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  roleBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  targetUserName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  targetUserPhone: { color: '#E5E5EA', fontSize: 13, fontWeight: '600' },
  fieldLabel: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3A3A3C', borderRadius: 8, borderWidth: 1, borderColor: '#48484A' },
  passwordInput: { flex: 1, padding: 12, color: '#FFF', fontSize: 15 },
  quickPresetChip: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255, 149, 0, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.4)' },
  quickPresetText: { color: '#E5E5EA', fontSize: 12 },
  modalNote: { color: '#8E8E93', fontSize: 12, marginTop: 14, lineHeight: 16 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, height: 42, borderRadius: 8, backgroundColor: '#3A3A3C', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: '#E5E5EA', fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { flex: 1.5, height: 42, borderRadius: 8, backgroundColor: '#FF9500', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modalConfirmText: { color: '#FFF', fontSize: 14, fontWeight: '700' }
});