import { Lock, LogIn, Phone, ShoppingBag, ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { BASE_URL, setAuthToken } from '../services/apiConfig';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onSwitchToRegister: () => void;
}

export default function LoginScreen({ onLoginSuccess, onSwitchToRegister }: LoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Secure Password Reset with OTP
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      const message = 'Please enter phone and password.';
      setLoginError(message);
      Alert.alert('Missing Fields', message);
      return;
    }

    setLoginError('');

    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password: password.trim(), role: 'Customer' }),
      });

      const data = await response.json();

      if (response.ok) {
        setAuthToken(data.token);
        Alert.alert('Welcome Back', `Logged in as ${data.user.name}`);
        onLoginSuccess(data.user);
      } else {
        const message = data?.message || 'Incorrect security password. Please try again.';
        setLoginError(message);
        Alert.alert('Login Failed', message);
      }
    } catch {
      const message = 'Check your C# API server connectivity state.';
      setLoginError(message);
      Alert.alert('Network Error', message);
    }
  };

  const handleSendOtp = async () => {
    const targetPhone = (resetPhone || phone).trim();
    if (!targetPhone || targetPhone.length < 10) {
      Alert.alert('Phone Required', 'Please enter your registered 10-digit mobile number.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/send-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, role: 'Customer' }),
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
        Alert.alert('Request Failed', data.message || 'Could not verify mobile number.');
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
      Alert.alert('Phone Required', 'Please enter your registered mobile number.');
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
          role: 'Customer'
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Password Updated 🎉', data.message || 'Your password has been reset securely.');
        setPhone(targetPhone);
        setPassword(trimmedNewPassword);
        setNewPassword('');
        setConfirmNewPassword('');
        setOtp('');
        setOtpSent(false);
        setShowForgotPassword(false);
        setLoginError('');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Compact, Clean Header */}
        <View style={styles.compactHeader}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <ShoppingBag size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.brandTitle}>LocalShop</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>🛒 Customer</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Sign in to browse neighborhood stores & order essentials
              </Text>
            </View>
          </View>
        </View>

        {/* Login Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Mobile Number</Text>
          <View style={styles.inputWrapper}>
            <Phone size={18} color="#8E8E93" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={text => setPhone(text.replace(/[^0-9]/g, ''))}
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your security password"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {loginError ? (
            <Text style={styles.errorText}>{loginError}</Text>
          ) : null}

          {/* Quick Demo Fill */}
          <TouchableOpacity
            style={styles.quickFillBtn}
            onPress={() => {
              setPhone('9876543210');
              setPassword('Customer@2026!');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quickFillText}>⚡ Quick Fill: Turja Mukherjee (Customer Demo)</Text>
          </TouchableOpacity>

          {/* SUBMIT LOG IN BUTTON - PROMINENT & HIGH ON SCREEN */}
          <TouchableOpacity style={styles.submitButton} onPress={handleLogin} activeOpacity={0.8}>
            <LogIn size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Log In</Text>
          </TouchableOpacity>

          {/* Forgot Password Toggle */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => {
              setShowForgotPassword(!showForgotPassword);
              if (!showForgotPassword) {
                setResetPhone(phone);
              }
            }}
          >
            <Text style={styles.forgotPasswordText}>
              {showForgotPassword ? '▲ Close password reset' : '🔒 Forgot password? Verify with OTP'}
            </Text>
          </TouchableOpacity>

          {/* Secure 2-Step OTP Reset Panel */}
          {showForgotPassword && (
            <View style={styles.resetCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <ShieldCheck size={18} color="#007AFF" style={{ marginRight: 6 }} />
                <Text style={styles.resetTitle}>Verified Password Reset</Text>
              </View>
              <Text style={styles.resetSubtitle}>
                A 6-digit verification code must be confirmed on your mobile number to authorize changing the password.
              </Text>

              <Text style={styles.fieldLabel}>Registered Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color="#8E8E93" style={styles.inputIcon} />
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
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#10B981" style={styles.inputIcon} />
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
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
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
        </View>

        {/* Create Account Link */}
        <TouchableOpacity style={styles.switchButton} onPress={onSwitchToRegister} activeOpacity={0.7}>
          <Text style={styles.switchText}>
            New to LocalShop? <Text style={styles.switchLink}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7FF',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  compactHeader: {
    backgroundColor: '#EAF4FF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D9EAFE',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleTag: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTagText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  quickFillBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  quickFillText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
  },
  resetCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  resetSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  otpSendBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  otpSendBtnText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  resetButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#64748B',
  },
  switchLink: {
    color: '#007AFF',
    fontWeight: '700',
  },
});