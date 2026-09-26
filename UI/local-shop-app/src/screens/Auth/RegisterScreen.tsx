import { ArrowRight, Lock, MapPin, Phone, User } from 'lucide-react-native';
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
import { BASE_URL } from '../../services/apiConfig';

interface RegisterScreenProps {
  onRegisterSuccess: (userName: string) => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterScreen({ onRegisterSuccess, onSwitchToLogin }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !password.trim() || !address.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all details including your security password.');
      return;
    }

    if (phone.trim().length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords do not match. Please re-enter.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          passwordHash: password.trim(),
          role: 'Customer',
          address: address.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success 🎉', 'Account registered securely! You can now log in anytime with your phone and password.');
        onRegisterSuccess(data.user || { name: name.trim(), phone: phone.trim(), address: address.trim() });
      } else {
        Alert.alert('Registration Failed', data.message || 'Error saving user.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot connect to C# server. Verify your BASE_URL IP.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        {/* Header / Intro */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Register to browse nearby local shops and order essentials instantly.</Text>
        </View>

        {/* Input Cards */}
        <View style={styles.formCard}>
          
          {/* Full Name Field */}
          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputWrapper}>
            <User size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="e.g., Turja Mukherjee"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Mobile Number Field */}
          <Text style={styles.inputLabel}>Mobile Number</Text>
          <View style={styles.inputWrapper}>
            <Phone size={18} color="#8E8E93" style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={phoneText => setPhone(phoneText.replace(/[^0-9]/g, ''))} // numbers only
            />
          </View>

          {/* Password Field */}
          <Text style={styles.inputLabel}>Security Password</Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="Create password (min 4 characters)"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Confirm Password Field */}
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="Re-enter password"
              secureTextEntry={true}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          {/* Delivery Address Field */}
          <Text style={styles.inputLabel}>Delivery Address</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <MapPin size={18} color="#8E8E93" style={[styles.inputIcon, { marginTop: 10 }]} />
            <TextInput 
              style={[styles.input, styles.textArea]}
              placeholder="Flat/House No, Building, Street, Landmark"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleRegister}>
            <Text style={styles.submitButtonText}>Get Started</Text>
            <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        {/* Switch back to Login */}
        {onSwitchToLogin && (
          <TouchableOpacity style={styles.switchButton} onPress={onSwitchToLogin}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Log In</Text>
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  headerSection: {
    marginBottom: 24,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 6,
  },
  textAreaWrapper: {
    height: 90,
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  textArea: {
    height: '100%',
    paddingTop: 8,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
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
    fontWeight: '700',
  },
});