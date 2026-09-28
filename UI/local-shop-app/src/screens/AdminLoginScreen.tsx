import { KeyRound, ShieldAlert } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BASE_URL, setAuthToken } from '../services/apiConfig';

export default function AdminLoginScreen({ onAdminAuth }: { onAdminAuth: () => void }) {
  const [adminKey, setAdminKey] = useState('');
  const [password, setPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleAdminLogin = async () => {
    if (!adminKey.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your admin key and password.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminKey.trim(), password: password.trim(), role: 'Admin' }),
      });

      const data = await response.json();
      if (response.ok) {
        setAuthToken(data.token);
        Alert.alert('System Approved', 'Elevated Admin Access Granted.');
        onAdminAuth();
      } else {
        Alert.alert('Access Denied', data.message || 'Invalid Master Administrative Credentials.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not connect to the admin API.');
    }
  };

  const handleForgotPassword = () => {
    if (!adminKey.trim()) {
      Alert.alert('Admin Key Required', 'Please enter your master admin key before resetting the password.');
      return;
    }

    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      Alert.alert('Missing Password', 'Please enter and confirm the new admin password.');
      return;
    }

    if (newPassword.trim().length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (newPassword.trim() !== confirmNewPassword.trim()) {
      Alert.alert('Password Mismatch', 'The new password and confirmation do not match.');
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/reset-password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: adminKey.trim(), newPassword: newPassword.trim(), role: 'Admin' }),
        });

        const data = await response.json();
        if (response.ok) {
          setPassword(newPassword.trim());
          setNewPassword('');
          setConfirmNewPassword('');
          setShowReset(false);
          Alert.alert('Password Updated', data.message || 'Your admin password has been reset successfully.');
        } else {
          Alert.alert('Reset Failed', data.message || 'Unable to reset admin password.');
        }
      } catch {
        Alert.alert('Network Error', 'Could not reset the admin password.');
      }
    })();
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroPanel}>
        <View style={styles.heroRow}>
          <View style={styles.iconBadge}>
            <ShieldAlert size={42} color="#FFF" />
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Admin Access</Text>
          </View>
        </View>
        <Text style={styles.title}>System Control Center</Text>
        <Text style={styles.subtitle}>Enter root administrative cryptographic access configurations.</Text>
        <View style={styles.visualBlock}>
          <Text style={styles.visualLabel}>Secure operations</Text>
          <Text style={styles.visualTitle}>Manage orders, staff and storefronts</Text>
        </View>
      </View>

      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Master Admin Key" value={adminKey} onChangeText={setAdminKey} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Secret Password" secureTextEntry value={password} onChangeText={setPassword} />

        <TouchableOpacity onPress={() => setShowReset(!showReset)}>
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>

        {showReset && (
          <View style={styles.resetCard}>
            <Text style={styles.resetTitle}>Reset admin password</Text>
            <TextInput style={styles.input} placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={styles.input} placeholder="Confirm new password" secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
            <TouchableOpacity style={styles.resetButton} onPress={handleForgotPassword}>
              <Text style={styles.resetButtonText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
          onPress={() => {
            setAdminKey('superadmin');
            setPassword('Admin@2026!');
          }}
        >
          <Text style={{ color: '#B45309', fontSize: 13, fontWeight: '600' }}>⚡ Quick Fill Demo: Super Admin</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={handleAdminLogin}>
          <KeyRound size={18} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.btnText}>Authenticate Root Console</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7ED', justifyContent: 'center', padding: 24 },
  heroPanel: {
    backgroundColor: '#FFF1DD',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FCD7A1',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBadge: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#FF9500', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF9500', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 6 },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: '#9A5B00',
    fontSize: 10,
    fontWeight: '700',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 12, paddingHorizontal: 10, lineHeight: 20 },
  visualBlock: {
    height: 92,
    borderRadius: 16,
    backgroundColor: '#FFE9C8',
    padding: 14,
    marginTop: 10,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#FCD7A1',
  },
  visualLabel: {
    color: '#9A5B00',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  visualTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    maxWidth: '72%',
  },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: 'rgba(15, 23, 42, 0.04)' },
  input: { backgroundColor: '#F2F4F8', borderRadius: 12, padding: 12, marginBottom: 12, color: '#1C1C1E', fontSize: 15, borderWidth: 1, borderColor: '#E8ECF3' },
  forgotPasswordText: { color: '#FF9500', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  resetCard: { backgroundColor: '#F7F7F8', borderRadius: 12, padding: 12, marginBottom: 12 },
  resetTitle: { color: '#1C1C1E', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  resetButton: { backgroundColor: '#FF9500', borderRadius: 10, height: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  resetButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  btn: { flexDirection: 'row', backgroundColor: '#FF9500', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});