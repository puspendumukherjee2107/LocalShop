import { CreditCard, History, Landmark, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BASE_URL } from '../services/apiConfig';

interface Transaction {
  id: string;
  storeName: string;
  amount: number;
  date: string;
  method: string;
  status: 'Successful' | 'Refunded';
}

interface Props {
  customerPhone?: string;
}

export default function CustomerPaymentScreen({ customerPhone = '9876543210' }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 'TXN-44910', storeName: 'Kirana Junction', amount: 215, date: '10 July 2026', method: 'UPI', status: 'Successful' },
    { id: 'TXN-43892', storeName: 'Gupta Supermarket', amount: 60, date: '08 July 2026', method: 'Card', status: 'Successful' },
    { id: 'TXN-41203', storeName: 'Deluxe Dairy Hub', amount: 160, date: '04 July 2026', method: 'UPI', status: 'Refunded' },
  ]);
  const [loading, setLoading] = useState(false);

  const fetchPaymentHistory = useCallback(async () => {
    if (!customerPhone) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/orders/customer/${customerPhone}/payments`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.value || [];
        if (list.length > 0) {
          setTransactions(list);
        }
      }
    } catch {
      console.log('Using cached payment history.');
    } finally {
      setLoading(false);
    }
  }, [customerPhone]);

  useEffect(() => {
    fetchPaymentHistory();
  }, [fetchPaymentHistory]);

  const triggerPaymentSimulation = (method: string) => {
    Alert.alert('Processing Payment', `Connecting securely to the banking gateway via ${method}...`, [
      { text: 'Simulate Success', onPress: () => Alert.alert('Transaction Complete', 'Invoice successfully paid!') }
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Checkout Methods</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.payBtn} onPress={() => triggerPaymentSimulation('UPI / Instant NetBanking')}>
          <Landmark size={20} color="#007AFF" />
          <Text style={styles.payText}>Pay via UPI</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.payBtn} onPress={() => triggerPaymentSimulation('Debit/Credit Card Gateway')}>
          <CreditCard size={20} color="#34C759" />
          <Text style={styles.payText}>Pay via Card</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.sectionTitle}><History size={16} color="#1C1C1E" /> Payment History Ledger</Text>
        <TouchableOpacity onPress={fetchPaymentHistory}>
          <RefreshCw size={14} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchPaymentHistory}
        renderItem={({ item }) => (
          <View style={styles.txCard}>
            <View>
              <Text style={styles.txStore}>{item.storeName}</Text>
              <Text style={styles.txMeta}>{item.date} • {item.method}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.txAmount}>₹{item.amount}</Text>
              <Text style={[styles.txStatus, { color: item.status === 'Successful' ? '#34C759' : '#FF3B30' }]}>
                {item.status}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  payBtn: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', elevation: 1, gap: 8 },
  payText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  txCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  txStore: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  txMeta: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  txStatus: { fontSize: 13, fontWeight: '600', marginTop: 2 }
});