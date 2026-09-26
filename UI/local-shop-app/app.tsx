import { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomerScreen from './src/screens/CustomerScreen';
import InventoryScreen from './src/screens/InventoryScreen';
export default function App() {
  // Simulating the user type: 'customer' or 'shopkeeper'
  const [userRole, setUserRole] = useState<'customer' | 'shopkeeper'>('customer');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Header / Role Switcher */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LocalShop App</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleButton, userRole === 'customer' && styles.activeToggle]}
            onPress={() => setUserRole('customer')}
          >
            <Text style={[styles.toggleText, userRole === 'customer' && styles.activeText]}>Customer Mode</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toggleButton, userRole === 'shopkeeper' && styles.activeToggle]}
            onPress={() => setUserRole('shopkeeper')}
          >
            <Text style={[styles.toggleText, userRole === 'shopkeeper' && styles.activeText]}>Shopkeeper Mode</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Body */}
      <View style={styles.content}>
        {userRole === 'customer' ? (
          <CustomerScreen />
        ) : (
          <InventoryScreen />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeText: {
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 15,
    color: '#3A3A3C',
    lineHeight: 22,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});