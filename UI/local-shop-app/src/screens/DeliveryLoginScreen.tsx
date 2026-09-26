import { Bike, Lock, User } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { setAuthToken } from '../services/apiConfig';

interface DeliveryLoginProps {
  onAuthSuccess: (driverName: string) => void;
}

export default function DeliveryLoginScreen({ onAuthSuccess }: DeliveryLoginProps) {
  const [driverName, setDriverName] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleLogin = async () => {
    if (!driverName.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter your name and password.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: driverName.trim(), password: password.trim(), role: 'Delivery' }),
      });

      const data = await response.json();
      if (response.ok) {
        setAuthToken(data.token);
        const name = driverName.trim();
        Alert.alert('Welcome Back', `Delivery console for ${name} is ready.`);
        onAuthSuccess(name);
        return;
      }

      Alert.alert('Access Denied', data.message || 'Incorrect delivery password. Please try again.');
    } catch {
      Alert.alert('Network Error', 'Could not connect to the delivery API.');
    }
  };

  const handleForgotPassword = () => {
    if (!driverName.trim()) {
      Alert.alert('Driver Name Required', 'Please enter your name before resetting your password.');
      return;
    }

    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      Alert.alert('Missing Password', 'Please enter and confirm your new delivery password.');
      return;
    }

    if (newPassword.trim().length < 4) {
      Alert.alert('Weak Password', 'Password must be at least 4 characters long.');
      return;
    }

    if (newPassword.trim() !== confirmNewPassword.trim()) {
      Alert.alert('Password Mismatch', 'The new password and confirmation do not match.');
      return;
    }

    (async () => {
      try {
        const response = await fetch('http://localhost:5000/api/auth/reset-password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: driverName.trim(), newPassword: newPassword.trim(), role: 'Delivery' }),
        });

        const data = await response.json();
        if (response.ok) {
          setPassword(newPassword.trim());
          setNewPassword('');
          setConfirmNewPassword('');
          setShowForgotPassword(false);
          Alert.alert('Password Updated', data.message || 'Your delivery password has been reset successfully.');
        } else {
          Alert.alert('Reset Failed', data.message || 'Unable to reset delivery password.');
        }
      } catch {
        Alert.alert('Network Error', 'Could not reset the delivery password.');
      }
    })();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Bike size={42} color="#007AFF" />
        </View>

        <Text style={styles.title}>Delivery Partner Access</Text>
        <Text style={styles.subtitle}>Select your role first, then sign in to the delivery console.</Text>

        <Text style={styles.label}>Driver Name</Text>
        <View style={styles.inputBox}>
          <User size={18} color="#8E8E93" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            value={driverName}
            onChangeText={setDriverName}
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputBox}>
          <Lock size={18} color="#8E8E93" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter delivery password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity onPress={() => setShowForgotPassword(!showForgotPassword)}>
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>

        {showForgotPassword && (
          <View style={styles.resetCard}>
            <Text style={styles.resetTitle}>Reset delivery password</Text>
            <TextInput style={styles.resetInput} placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={styles.resetInput} placeholder="Confirm new password" secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
            <TouchableOpacity style={styles.resetButton} onPress={handleForgotPassword}>
              <Text style={styles.resetButtonText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleLogin}>
          <Text style={styles.btnText}>Continue to Delivery Hub</Text>
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
    backgroundColor: '#F2F2F7',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 6,
    marginTop: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  resetCard: {
    backgroundColor: '#F7F7F8',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
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
  btn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
