import { ShieldKeyhole, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BASE_URL } from '../services/apiConfig';

interface Props {
  currentUser?: {
    name: string;
    phone: string;
    address?: string;
  };
  onProfileUpdated?: (updated: any) => void;
}

export default function CustomerSettingsScreen({ currentUser, onProfileUpdated }: Props) {
  const [name, setName] = useState(currentUser?.name || 'Turja Sharma');
  const [phone] = useState(currentUser?.phone || '9876543210');
  const [address, setAddress] = useState(currentUser?.address || 'Flat 4B, Greenfield Apartments');
  const [recoveryEmail, setRecoveryEmail] = useState('turja.recovery@email.com');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setName(currentUser.name);
      if (currentUser.address) setAddress(currentUser.address);
    }
  }, [currentUser]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Name cannot be blank.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          name: name.trim(),
          address: address.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        Alert.alert('Saved ✅', 'Your account details have been saved to the database.');
        if (onProfileUpdated && data.user) {
          onProfileUpdated(data.user);
        }
      } else {
        Alert.alert('Update Failed', 'Could not update profile information.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const triggerPasswordReset = () => {
    Alert.alert('Recovery Dispatched', `A master password reset token has been dispatched to ${recoveryEmail}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Account & Protection</Text>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}><User size={16} color="#007AFF" /> Core Identity</Text>
        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
        <Text style={styles.fieldLabel}>Registered Phone</Text>
        <TextInput style={[styles.input, { color: '#8E8E93' }]} value={phone} editable={false} />
        <Text style={styles.fieldLabel}>Primary Delivery Address</Text>
        <TextInput style={styles.input} placeholder="Primary Delivery Address" value={address} onChangeText={setAddress} multiline />
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#007AFF' }]} onPress={handleUpdate} disabled={loading}>
          <Text style={styles.btnText}>Commit Account Details</Text>
        </TouchableOpacity>
      </View>

      {/* Security & Recovery Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}><ShieldKeyhole size={16} color="#FF9500" /> Account Recovery Configurations</Text>
        <Text style={styles.helperText}>Configure a secondary email vault link to regain access if password or device credentials become locked.</Text>
        <TextInput style={styles.input} placeholder="Secure Recovery Email" value={recoveryEmail} onChangeText={setRecoveryEmail} keyboardType="email-address" autoCapitalize="none" />
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#FF9500' }]} onPress={triggerPasswordReset}>
          <Text style={styles.btnText}>Test Recovery Dispatch</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 1 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#636366', marginBottom: 4 },
  helperText: { fontSize: 13, color: '#8E8E93', marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 15 },
  btn: { height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontWeight: '600', fontSize: 14 }
});