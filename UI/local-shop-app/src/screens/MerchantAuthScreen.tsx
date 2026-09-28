import { ArrowRight, Briefcase, Lock, Phone, Store } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BASE_URL, setAuthToken } from '../services/apiConfig';

interface MerchantAuthProps {
  onAuthSuccess: (shopName: string) => void;
}

export default function MerchantAuthScreen({ onAuthSuccess }: MerchantAuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleAuth = async () => {
    if (!phone.trim() || !password.trim() || (!isLogin && (!shopName.trim() || !category.trim()))) {
      Alert.alert('Missing Info', 'Please fill out all required fields.');
      return;
    }

    if (isLogin) {
      try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), password: password.trim(), role: 'Merchant' }),
        });

        const data = await response.json();
        if (response.ok) {
          setAuthToken(data.token);
          Alert.alert('Welcome Back', `Logged in as ${data.user.name}`);
          onAuthSuccess(data.user.name || 'My Local Store');
          return;
        }

        Alert.alert('Login Failed', data.message || 'Incorrect merchant password.');
        return;
      } catch {
        Alert.alert('Network Error', 'Check your server connection.');
        return;
      }
    }

    Alert.alert('Store Registered', `${shopName} has been created successfully!`);
    onAuthSuccess(shopName.trim());
  };

  const handleForgotPassword = async () => {
    const trimmedPhone = phone.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmNewPassword.trim();

    if (!trimmedPhone) {
      Alert.alert('Phone Required', 'Please enter your registered mobile number first.');
      return;
    }

    if (!trimmedNewPassword || !trimmedConfirmPassword) {
      Alert.alert('Missing Password', 'Please enter and confirm your new password.');
      return;
    }

    if (trimmedNewPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      Alert.alert('Password Mismatch', 'The new password and confirmation do not match.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmedPhone, newPassword: trimmedNewPassword, role: 'Merchant' }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Password Updated', data.message || 'Your merchant password has been reset successfully.');
        setPassword(trimmedNewPassword);
        setNewPassword('');
        setConfirmNewPassword('');
        setShowForgotPassword(false);
      } else {
        Alert.alert('Reset Failed', data.message || 'Unable to reset password.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not reset password. Check your API connection.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.heroPanel}>
            <View style={styles.heroRow}>
              <View style={styles.brandBadge}>
                <Store size={22} color="#FFF" />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>Local Business</Text>
              </View>
            </View>
            <Text style={styles.title}>{isLogin ? 'Merchant Portal' : 'Register Your Business'}</Text>
            <Text style={styles.subtitle}>{isLogin ? 'Manage your storefront and digital ledger.' : 'Grow your business by taking it online.'}</Text>
            <View style={styles.visualBlock}>
              <Text style={styles.visualLabel}>Smart commerce</Text>
              <Text style={styles.visualTitle}>Sell faster with local reach</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          {!isLogin && (
            <>
              <Text style={styles.label}>Shop Name</Text>
              <View style={styles.inputBox}>
                <Store size={18} color="#8E8E93" style={styles.icon} />
                <TextInput style={styles.input} placeholder="e.g., Kirana Junction" value={shopName} onChangeText={setShopName} />
              </View>

              <Text style={styles.label}>Business Category</Text>
              <View style={styles.inputBox}>
                <Briefcase size={18} color="#8E8E93" style={styles.icon} />
                <TextInput style={styles.input} placeholder="e.g., Grocery, Dairy, Bakery" value={category} onChangeText={setCategory} />
              </View>
            </>
          )}

          <Text style={styles.label}>Registered Mobile Number</Text>
          <View style={styles.inputBox}>
            <Phone size={18} color="#8E8E93" style={styles.icon} />
            <TextInput style={styles.input} placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} value={phone} onChangeText={setPhone} />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputBox}>
            <Lock size={18} color="#8E8E93" style={styles.icon} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          </View>

          {isLogin && (
            <TouchableOpacity onPress={() => setShowForgotPassword(!showForgotPassword)}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {showForgotPassword && (
            <View style={styles.resetCard}>
              <Text style={styles.resetTitle}>Reset merchant password</Text>
              <TextInput style={styles.resetInput} placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
              <TextInput style={styles.resetInput} placeholder="Confirm new password" secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
              <TouchableOpacity style={styles.resetButton} onPress={handleForgotPassword}>
                <Text style={styles.resetButtonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          )}

          {isLogin && (
            <TouchableOpacity 
              style={{ backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
              onPress={() => {
                setPhone('9876500000');
                setPassword('Merchant@2026!');
              }}
            >
              <Text style={{ color: '#6D28D9', fontSize: 13, fontWeight: '600' }}>⚡ Quick Fill Demo: Kirana Junction (Merchant)</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btn} onPress={handleAuth}>
            <Text style={styles.btnText}>{isLogin ? 'Login As Merchant' : 'Create Store'}</Text>
            <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switch} onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switchText}>
            {isLogin ? "New Merchant? " : "Already registered? "}
            <Text style={styles.link}>{isLogin ? 'Create a store account' : 'Sign In'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F7FF' },
  scroll: { padding: 20, justifyContent: 'center' },
  header: { marginBottom: 20 },
  heroPanel: {
    backgroundColor: '#E7F7EE',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D5F1E1',
    shadowColor: '#0F766E',
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
  brandBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1C1C1E' },
  subtitle: { fontSize: 14, color: '#475569', marginTop: 6, lineHeight: 20 },
  visualBlock: {
    height: 92,
    borderRadius: 16,
    backgroundColor: '#DDF7E8',
    padding: 14,
    marginTop: 14,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#C9F0D5',
  },
  visualLabel: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '700',
    marginBottom: 4,
  },
  visualTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: '70%',
  },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowRadius: 8, shadowOpacity: 0.04, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#3A3A3C', marginBottom: 6, marginTop: 12 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 12, height: 46 },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15 },
  forgotPasswordText: { color: '#007AFF', fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  resetCard: { backgroundColor: '#F7F7F8', borderRadius: 12, padding: 12, marginTop: 12 },
  resetTitle: { color: '#1C1C1E', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  resetInput: { backgroundColor: '#FFF', borderColor: '#E5E5EA', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 8, fontSize: 14 },
  resetButton: { backgroundColor: '#34C759', borderRadius: 8, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  resetButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btn: { flexDirection: 'row', backgroundColor: '#34C759', borderRadius: 10, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 24, shadowColor: '#16A34A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  switch: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, color: '#8E8E93' },
  link: { color: '#34C759', fontWeight: '600' },
});