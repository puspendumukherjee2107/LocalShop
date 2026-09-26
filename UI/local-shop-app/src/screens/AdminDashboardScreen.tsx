import { CheckCircle2, FileSpreadsheet, Settings, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BASE_URL } from '../services/apiConfig';

type AdminSubTab = 'approvals' | 'customers' | 'reports' | 'logs' | 'config';

interface MerchantRecord {
  id: string;
  shopName: string;
  category: string;
  tradeLicense: string;
  kycStatus: string;
  isOpen: boolean;
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

export default function AdminDashboardScreen() {
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

  const loadTabContent = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'approvals') {
        const res = await fetch(`${BASE_URL}/admin/merchants`);
        if (res.ok) {
          const data = await res.json();
          setMerchants(Array.isArray(data) ? data : data.value || []);
        }
      } else if (activeTab === 'customers') {
        const res = await fetch(`${BASE_URL}/admin/customers`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(Array.isArray(data) ? data : data.value || []);
        }
      } else if (activeTab === 'reports') {
        const res = await fetch(`${BASE_URL}/admin/overview`);
        if (res.ok) {
          const data = await res.json();
          setOverview(data);
          if (data.platformFeePercent) setPlatformFee(data.platformFeePercent.toString());
          if (data.maintenanceMode !== undefined) setMaintenanceMode(data.maintenanceMode);
        }
      } else if (activeTab === 'logs') {
        const res = await fetch(`${BASE_URL}/admin/logs`);
        if (res.ok) {
          const data = await res.json();
          setLogs(Array.isArray(data) ? data : data.value || []);
        }
      } else if (activeTab === 'config') {
        const res = await fetch(`${BASE_URL}/admin/config`);
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
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
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
                <Text style={styles.cardMeta}>Category: {item.category} • License: {item.tradeLicense || 'Not Submitted'}</Text>
                <View style={styles.rowGap}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#34C759' }]} 
                    onPress={() => handleKycAction(item.id, 'Approved')}
                  >
                    <CheckCircle2 size={16} color="#FFF" />
                    <Text style={styles.btnText}>Approve KYC</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]} 
                    onPress={() => handleKycAction(item.id, 'Rejected')}
                  >
                    <XCircle size={16} color="#FFF" />
                    <Text style={styles.btnText}>Reject</Text>
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
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>Phone: {item.phone}</Text>
                  {item.address ? <Text style={styles.cardAddress}>{item.address}</Text> : null}
                </View>
                <TouchableOpacity 
                  style={[styles.badge, { backgroundColor: item.status === 'Active' ? '#E5F9ED' : '#FFEBEA' }]}
                  onPress={() => handleToggleCustomer(item.id)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: item.status === 'Active' ? '#34C759' : '#FF3B30' }}>
                    {item.status || 'Active'} (Tap)
                  </Text>
                </TouchableOpacity>
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
  switchSubText: { color: '#8E8E93', fontSize: 12, marginTop: 2, lineHeight: 16 }
});