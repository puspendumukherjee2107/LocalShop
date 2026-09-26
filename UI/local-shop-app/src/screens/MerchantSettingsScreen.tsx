import { BadgeCheck, Clock, Truck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BASE_URL } from '../services/apiConfig';

export default function MerchantSettingsScreen() {
  // Operational states
  const [isOpen, setIsOpen] = useState(true);
  const [hours, setHours] = useState('08:00 AM - 09:30 PM');
  const [deliveryRadius, setDeliveryRadius] = useState('3');
  const [minOrder, setMinOrder] = useState('150');
  
  // Verification compliance states
  const [tradeLicense, setTradeLicense] = useState('');
  const [kycStatus, setKycStatus] = useState('Approved');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${BASE_URL}/stores/profile?shopName=Kirana Junction`);
      if (response.ok) {
        const data = await response.json();
        setIsOpen(data.isOpen);
        setHours(data.operatingHours || '08:00 AM - 09:30 PM');
        setDeliveryRadius(data.deliveryRadiusKm?.toString() || '3');
        setMinOrder(data.minOrderAmount?.toString() || '150');
        setTradeLicense(data.tradeLicense || '');
        setKycStatus(data.kycStatus || 'Approved');
      }
    } catch {
      console.warn('Error loading store profile.');
    }
  };

  const toggleStoreOpen = async (val: boolean) => {
    setIsOpen(val);
    try {
      await fetch(`${BASE_URL}/stores/toggle-open?shopName=Kirana Junction`, { method: 'PUT' });
    } catch {
      console.warn('Error toggling store status.');
    }
  };

  const handleSaveParameters = async () => {
    try {
      const response = await fetch(`${BASE_URL}/stores/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Kirana Junction',
          operatingHours: hours.trim(),
          deliveryRadiusKm: parseFloat(deliveryRadius) || 3.0,
          minOrderAmount: parseFloat(minOrder) || 150.0
        })
      });

      if (response.ok) {
        Alert.alert('Saved ✅', 'Operating parameters saved to SQLite database.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  const handleSubmitKyc = async () => {
    if (!tradeLicense.trim()) {
      Alert.alert('Invalid', 'Please enter your trade license / registration token.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/stores/submit-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Kirana Junction',
          tradeLicense: tradeLicense.trim()
        })
      });

      if (response.ok) {
        setKycStatus('Pending');
        Alert.alert('Verification Staged 🎉', 'Compliance credentials have been submitted to the Admin console for review.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Real-time storefront state switch */}
      <View style={[styles.statusCard, { backgroundColor: isOpen ? '#E5F9ED' : '#FFEBEA' }]}>
        <View>
          <Text style={[styles.statusTitle, { color: isOpen ? '#34C759' : '#FF3B30' }]}>
            Store Status: {isOpen ? 'OPEN' : 'CLOSED'}
          </Text>
          <Text style={styles.statusSub}>Control if nearby customers can process instant checkout actions.</Text>
        </View>
        <Switch value={isOpen} onValueChange={toggleStoreOpen} trackColor={{ true: '#34C759' }} />
      </View>

      {/* Operational Settings */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}><Clock size={16} color="#007AFF" /> Operating Parameters</Text>
        <Text style={styles.label}>Execution Timers</Text>
        <TextInput style={styles.input} value={hours} onChangeText={setHours} placeholder="e.g., 09:00 AM - 08:00 PM" />

        <Text style={styles.sectionHeader}><Truck size={16} color="#5856D6" /> Delivery Routing Parameters</Text>
        <Text style={styles.label}>Max Logistics Radius (Kilometers)</Text>
        <TextInput style={styles.input} value={deliveryRadius} onChangeText={setDeliveryRadius} keyboardType="numeric" />
        
        <Text style={styles.label}>Minimum Base Invoice (₹)</Text>
        <TextInput style={styles.input} value={minOrder} onChangeText={setMinOrder} keyboardType="numeric" />

        <TouchableOpacity style={[styles.btn, { backgroundColor: '#007AFF', marginBottom: 6 }]} onPress={handleSaveParameters}>
          <Text style={styles.btnText}>Save Parameters</Text>
        </TouchableOpacity>
      </View>

      {/* Official Government Verification Matrix */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}><BadgeCheck size={16} color="#34C759" /> KYC Business Verification ({kycStatus})</Text>
        <Text style={styles.helperText}>Input valid trade authority numbers to secure verified badges on consumer marketplace screens.</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder="Trade License / Registration Token ID" 
          value={tradeLicense} 
          onChangeText={setTradeLicense}
          editable={kycStatus !== 'Pending'}
        />
        
        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: kycStatus === 'Pending' ? '#8E8E93' : '#34C759' }]}
          disabled={kycStatus === 'Pending'}
          onPress={handleSubmitKyc}
        >
          <Text style={styles.btnText}>{kycStatus === 'Pending' ? 'Staged For Verification Review' : 'Submit Audit Credentials'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 16 },
  statusTitle: { fontSize: 16, fontWeight: '700' },
  statusSub: { fontSize: 12, color: '#8E8E93', marginTop: 4, width: '75%', lineHeight: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#3A3A3C', marginBottom: 6 },
  helperText: { fontSize: 13, color: '#8E8E93', marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 15 },
  btn: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#FFF', fontWeight: '700' }
});