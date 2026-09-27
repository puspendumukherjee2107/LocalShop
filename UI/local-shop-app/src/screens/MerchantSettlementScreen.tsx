import { ArrowUpRight, Banknote } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BASE_URL } from '../services/apiConfig';

interface Settlement {
  id: string;
  amount: number;
  date?: string;
  dispatchedAt?: string;
  bankAccount: string;
  status: 'Settled' | 'Processing';
}

export default function MerchantSettlementScreen() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Settlement[]>([]);

  useEffect(() => {
    fetchSettlementOverview();
  }, []);

  const fetchSettlementOverview = async () => {
    try {
      const response = await fetch(`${BASE_URL}/settlements?shopName=Kirana Junction`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data.withdrawableBalance);
        setHistory(data.history || []);
      }
    } catch {
      console.warn('Error fetching settlements.');
    }
  };

  const requestSettlement = () => {
    if (balance <= 0) {
      Alert.alert('Zero Balance', 'There are no digital funds left to settle right now.');
      return;
    }
    Alert.alert(
      'Trigger Payout',
      `Transfer ₹${balance} directly into your linked HDFC bank account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Transfer',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/settlements/payout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  shopName: 'Kirana Junction',
                  amount: balance,
                  bankAccount: 'HDFC ****4321'
                })
              });

              if (response.ok) {
                const data = await response.json();
                setHistory([data.settlement, ...history]);
                setBalance(0);
                Alert.alert('Payout Initiated 🏦', 'Funds will clear into your business account within 2-4 hours.');
              } else {
                Alert.alert('Error', 'Unable to initiate settlement.');
              }
            } catch {
              Alert.alert('Network Error', 'Cannot reach API server.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Balance Tracker Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Withdrawable Balance</Text>
        <Text style={styles.heroAmount}>₹{balance}</Text>
        <Text style={styles.heroSub}>Digital customer transactions collected this week.</Text>
        
        <TouchableOpacity style={styles.settleBtn} onPress={requestSettlement}>
          <Banknote size={18} color="#007AFF" />
          <Text style={styles.settleBtnText}>Settle Funds to Bank</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Past Settlement Despatches</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.setCard}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.setText}>Payout: ₹{item.amount}</Text>
                <ArrowUpRight size={14} color="#8E8E93" />
              </View>
              <Text style={styles.setMeta}>{item.date} • {item.bankAccount}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: item.status === 'Settled' ? '#E5F9ED' : '#FFF9E6' }]}>
              <Text style={[styles.badgeText, { color: item.status === 'Settled' ? '#34C759' : '#FF9500' }]}>
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
  heroCard: { backgroundColor: '#007AFF', borderRadius: 16, padding: 20, marginBottom: 24, elevation: 2 },
  heroTitle: { color: 'rgba(255,255,255,0.76)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  heroAmount: { color: '#FFF', fontSize: 32, fontWeight: '800', marginVertical: 6 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  settleBtn: { backgroundColor: '#FFF', borderRadius: 10, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  settleBtnText: { color: '#007AFF', fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#1C1C1E' },
  setCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  setText: { fontSize: 15, fontWeight: '600' },
  setMeta: { fontSize: 12, color: '#8E8E93', marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' }
});