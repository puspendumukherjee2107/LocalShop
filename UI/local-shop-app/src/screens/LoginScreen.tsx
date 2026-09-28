import { Lock, LogIn, Phone } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { BASE_URL, setAuthToken } from '../services/apiConfig';

interface LoginProps {
  onLoginSuccess: (userName: string) => void;
  onSwitchToRegister: () => void;
}

export default function LoginScreen({ onLoginSuccess, onSwitchToRegister }: LoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
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
        body: JSON.stringify({ phone: trimmedPhone, newPassword: trimmedNewPassword, role: 'Customer' }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Password Updated', data.message || 'Your password has been reset successfully.');
        setPassword(trimmedNewPassword);
        setNewPassword('');
        setConfirmNewPassword('');
        setShowForgotPassword(false);
        setLoginError('');
      } else {
        Alert.alert('Reset Failed', data.message || 'Unable to reset password.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not reset password. Check your API connection.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.cardContainer}>
        <View style={styles.heroPanel}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>L</Text>
            </View>
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>Fresh & Fast</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>LocalShop</Text>
          <Text style={styles.heroSubtitle}>Groceries, essentials, and trusted local stores delivered near you.</Text>

          <View style={styles.visualPanel}>
            <View style={styles.visualGlow} />
            <Text style={styles.visualBadge}>Fresh picks</Text>
            <Text style={styles.visualTitle}>Groceries at your doorstep</Text>
          </View>
        </View>

        <View style={styles.headerSection}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to access your local shops and order history.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Registered Mobile Number</Text>
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

          <TouchableOpacity onPress={() => setShowForgotPassword(!showForgotPassword)}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {showForgotPassword && (
            <View style={styles.resetCard}>
              <Text style={styles.resetTitle}>Reset your password</Text>

              <TextInput
                style={styles.resetInput}
                placeholder="New password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TextInput
                style={styles.resetInput}
                placeholder="Confirm new password"
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />

              <TouchableOpacity style={styles.resetButton} onPress={handleForgotPassword}>
                <Text style={styles.resetButtonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
            onPress={() => {
              setPhone('9876543210');
              setPassword('Customer@2026!');
            }}
          >
            <Text style={{ color: '#1D4ED8', fontSize: 13, fontWeight: '600' }}>⚡ Quick Fill Demo: Turja Mukherjee (Customer)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={handleLogin}>
            <LogIn size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.submitButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switchButton} onPress={onSwitchToRegister}>
          <Text style={styles.switchText}>
            New to LocalShop? <Text style={styles.switchLink}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F3F7FF',
  },
  cardContainer: {
    width: '100%',
  },
  heroPanel: {
    backgroundColor: '#EAF4FF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#D9EAFE',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroTag: {
    backgroundColor: '#DFF7EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroTagText: {
    color: '#127A46',
    fontSize: 11,
    fontWeight: '700',
  },
  brandBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1E90FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 5,
  },
  brandBadgeText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginTop: 6,
  },
  visualPanel: {
    height: 110,
    borderRadius: 18,
    marginTop: 14,
    backgroundColor: '#DDEEFF',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 14,
    borderWidth: 1,
    borderColor: '#CFE3FF',
  },
  visualGlow: {
    position: 'absolute',
    right: -20,
    top: -12,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  visualBadge: {
    position: 'absolute',
    left: 14,
    top: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  visualTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: '70%',
  },
  headerSection: {
    marginBottom: 18,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 22,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.04)',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F8',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E8ECF3',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#D93025',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  resetCard: {
    backgroundColor: '#F7F7F8',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  resetTitle: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  resetInput: {
    backgroundColor: '#FFF',
    borderColor: '#E5E5EA',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  switchLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
});