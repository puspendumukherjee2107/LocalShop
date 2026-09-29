import { ArrowRight, Briefcase, Lock, Phone, ShieldCheck, Store } from 'lucide-react-native';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [category, setCategory] = useState('');

  // Secure Password Reset with OTP
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleAuth = async () => {
    if (!phone.trim() || !password.trim() || (!isLogin && (!shopName.trim() || !category.trim() || !confirmPassword.trim()))) {
      Alert.alert('Missing Info', 'Please fill out all required fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords do not match. Please re-enter and verify your password.');
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
    } else {
      try {
        const regResponse = await fetch(`${BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: shopName.trim(),
            phone: phone.trim(),
            passwordHash: password.trim(),
            role: 'Merchant',
            address: category.trim(),
          }),
        });

        const regData = await regResponse.json();
        if (!regResponse.ok) {
          Alert.alert('Store Creation Failed', regData.message || 'Error registering store.');
          return;
        }

        // Initialize StoreProfile in database
        await fetch(`${BASE_URL}/stores/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopName: shopName.trim(),
            category: category.trim(),
            isOpen: true,
            operatingHours: '08:00 AM - 09:30 PM',
            deliveryRadiusKm: 3.0,
            minOrderAmount: 150,
            kycStatus: 'Approved',
          }),
        });

        // Automatically log in
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), password: password.trim(), role: 'Merchant' }),
        });

        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.token) {
          setAuthToken(loginData.token);
        }

        Alert.alert('Store Registered 🎉', `${shopName.trim()} has been registered and is now live!`);
        onAuthSuccess(shopName.trim());
        return;
      } catch {
        Alert.alert('Network Error', 'Check your server connection.');
        return;
      }
    }
  };

  const handleSendOtp = async () => {
    const targetPhone = (resetPhone || phone).trim();
    if (!targetPhone || targetPhone.length < 10) {
      Alert.alert('Phone Required', 'Please enter your registered 10-digit business phone number.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/send-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, role: 'Merchant' }),
      });

      const data = await response.json();
      if (response.ok) {
        setOtpSent(true);
        if (data.otp) {
          setOtp(data.otp);
          Alert.alert('Security Code Sent', `A 6-digit verification code was sent to ${targetPhone}.\n\nDemo Verification Code: ${data.otp}`);
        } else {
          Alert.alert('Security Code Sent', `A 6-digit verification code has been sent to ${targetPhone}.`);
        }
      } else {
        Alert.alert('Request Failed', data.message || 'Could not verify business phone number.');
      }
    } catch {
      Alert.alert('Network Error', 'Check your server connection.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleForgotPassword = async () => {
    const targetPhone = (resetPhone || phone).trim();
    const targetOtp = otp.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmNewPassword.trim();

    if (!targetPhone) {
      Alert.alert('Phone Required', 'Please enter your registered business phone number.');
      return;
    }

    if (!targetOtp || targetOtp.length < 6) {
      Alert.alert('OTP Required', 'Please enter the 6-digit verification code sent to your phone.');
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

    setIsResetting(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          otp: targetOtp,
          newPassword: trimmedNewPassword,
          role: 'Merchant'
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Password Updated 🎉', data.message || 'Your merchant password has been reset securely.');
        setPhone(targetPhone);
        setPassword(trimmedNewPassword);
        setNewPassword('');
        setConfirmNewPassword('');
        setOtp('');
        setOtpSent(false);
        setShowForgotPassword(false);
      } else {
        Alert.alert('Reset Failed', data.message || 'Unable to reset password.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not reset password. Check your API connection.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.heroPanel}>
            <View style={styles.heroRow}>
              <View style={styles.brandBadge}>
                <Store size={24} color="#FFF" />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>MERCHANT NETWORK</Text>
              </View>
            </View>
            <Text style={styles.title}>{isLogin ? 'Store Login' : 'Store Registration'}</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Sign in to access your direct neighborhood delivery portal.' : 'Register your grocery or essentials store to serve neighbors.'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {!isLogin && (
            <>
              <Text style={styles.label}>Shop Name</Text>
              <View style={styles.inputBox}>
                <Store size={18} color="#8E8E93" style={styles.icon} />
                <TextInput style={styles.input} placeholder="e.g., Tarama Stores" value={shopName} onChangeText={setShopName} />
              </View>

              <Text style={styles.label}>Store Category</Text>
              <View style={styles.inputBox}>
                <Briefcase size={18} color="#8E8E93" style={styles.icon} />
                <TextInput style={styles.input} placeholder="e.g., Groceries & Essentials" value={category} onChangeText={setCategory} />
              </View>
            </>
          )}

          <Text style={styles.label}>Business Phone</Text>
          <View style={styles.inputBox}>
            <Phone size={18} color="#8E8E93" style={styles.icon} />
            <TextInput style={styles.input} placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} value={phone} onChangeText={setPhone} />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputBox}>
            <Lock size={18} color="#8E8E93" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={isLogin ? "Password (min 8 chars)" : "Create password (min 8 chars)"}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {!isLogin && (
            <>
              <Text style={styles.label}>Re-verify Password</Text>
              <View style={styles.inputBox}>
                <Lock size={18} color="#8E8E93" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password to verify"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </>
          )}

          {isLogin && (
            <TouchableOpacity onPress={() => setShowForgotPassword(!showForgotPassword)}>
              <Text style={styles.forgotPasswordText}>
                {showForgotPassword ? '▲ Close password reset' : '🔒 Forgot password? Verify with OTP'}
              </Text>
            </TouchableOpacity>
          )}

          {showForgotPassword && (
            <View style={styles.resetCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <ShieldCheck size={18} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.resetTitle}>Verified Merchant Password Reset</Text>
              </View>
              <Text style={styles.resetSubtitle}>
                A 6-digit security code must be confirmed on your registered business phone before changing the password.
              </Text>

              <Text style={styles.fieldLabel}>Registered Business Phone</Text>
              <View style={styles.inputBox}>
                <Phone size={18} color="#8E8E93" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="10-digit registered number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={resetPhone || phone}
                  onChangeText={setResetPhone}
                />
              </View>

              <TouchableOpacity
                style={[styles.otpSendBtn, isSendingOtp && { opacity: 0.6 }]}
                onPress={handleSendOtp}
                disabled={isSendingOtp}
              >
                <Text style={styles.otpSendBtnText}>
                  {isSendingOtp ? 'Sending Security Code...' : otpSent ? '🔄 Resend Verification Code' : '📲 Send Verification Code (OTP)'}
                </Text>
              </TouchableOpacity>

              {otpSent && (
                <>
                  <Text style={styles.fieldLabel}>6-Digit Verification Code</Text>
                  <View style={styles.inputBox}>
                    <Lock size={18} color="#10B981" style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>New Password (min 8 chars)</Text>
                  <View style={styles.inputBox}>
                    <Lock size={18} color="#8E8E93" style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Confirm New Password</Text>
                  <View style={styles.inputBox}>
                    <Lock size={18} color="#8E8E93" style={styles.icon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      secureTextEntry
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.resetButton, isResetting && { opacity: 0.6 }]}
                    onPress={handleForgotPassword}
                    disabled={isResetting}
                  >
                    <Text style={styles.resetButtonText}>
                      {isResetting ? 'Verifying...' : '✅ Verify Code & Reset Password'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {isLogin && (
            <TouchableOpacity 
              style={{ backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 12 }}
              onPress={() => {
                setPhone('9876500000');
                setPassword('Merchant@2026!');
              }}
            >
              <Text style={{ color: '#6D28D9', fontSize: 13, fontWeight: '600' }}>⚡ Quick Fill Demo: Tarama Stores (Merchant)</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btn} onPress={handleAuth}>
            <Text style={styles.btnText}>{isLogin ? 'Login As Merchant' : 'Create Store'}</Text>
            <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switch} onPress={() => {
          setIsLogin(!isLogin);
          setConfirmPassword('');
        }}>
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
  scroll: { padding: 20, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  header: { marginBottom: 16 },
  heroPanel: {
    backgroundColor: '#E7F7EE',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D5F1E1',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  subtitle: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, shadowRadius: 8, shadowOpacity: 0.04, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 13, fontWeight: '600', color: '#3A3A3C', marginBottom: 6, marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6 },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#0F172A' },
  forgotPasswordText: { color: '#007AFF', fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  resetCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  resetTitle: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  resetSubtitle: { color: '#64748B', fontSize: 12, lineHeight: 16, marginBottom: 10, marginTop: 2 },
  otpSendBtn: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 4, marginBottom: 10 },
  otpSendBtnText: { color: '#15803D', fontSize: 13, fontWeight: '700' },
  resetButton: { backgroundColor: '#16A34A', borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  resetButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btn: { flexDirection: 'row', backgroundColor: '#16A34A', borderRadius: 10, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16, shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  switch: { marginTop: 18, alignItems: 'center' },
  switchText: { fontSize: 14, color: '#8E8E93' },
  link: { color: '#16A34A', fontWeight: '700' },
});