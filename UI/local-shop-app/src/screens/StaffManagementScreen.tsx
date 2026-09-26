import { ShieldAlert, UserCheck, UserPlus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BASE_URL } from '../services/apiConfig';

interface Staff {
  id: string;
  name: string;
  role: string;
  status: 'Active' | 'Suspended';
}

export default function StaffManagementScreen() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await fetch(`${BASE_URL}/staff`);
      if (response.ok) {
        const data = await response.json();
        setStaffList(data);
      }
    } catch {
      console.warn('Error fetching staff from API.');
    }
  };

  const addStaff = async () => {
    if (!name.trim() || !role.trim()) {
      Alert.alert('Error', 'Please fill out Staff Name and Role.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: 'Kirana Junction',
          name: name.trim(),
          role: role.trim()
        })
      });

      if (response.ok) {
        const created = await response.json();
        setStaffList([created, ...staffList]);
        setName('');
        setRole('');
        Alert.alert('Authorized 🎉', `${created.name} is now authorized in the store team.`);
      } else {
        Alert.alert('Error', 'Failed to save staff member.');
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/staff/${id}/toggle-status`, {
        method: 'PUT'
      });

      if (response.ok) {
        const updated = await response.json();
        setStaffList(staffList.map(s => s.id === id ? { ...s, status: updated.status } : s));
      }
    } catch {
      Alert.alert('Network Error', 'Cannot reach API server.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Staff Member</Text>
        <TextInput style={styles.input} placeholder="Staff Full Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Role (e.g., Delivery, Billing)" value={role} onChangeText={setRole} />
        <TouchableOpacity style={styles.addBtn} onPress={addStaff}>
          <UserPlus size={18} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.addBtnText}>Authorize Staff</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listTitle}>Active Store Team</Text>
      <FlatList
        data={staffList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.staffCard}>
            <View>
              <Text style={styles.staffName}>{item.name}</Text>
              <Text style={styles.staffRole}>{item.role}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.statusToggle, { backgroundColor: item.status === 'Active' ? '#E5F9ED' : '#FFEBEA' }]}
              onPress={() => toggleStatus(item.id)}
            >
              {item.status === 'Active' ? <UserCheck size={16} color="#34C759" /> : <ShieldAlert size={16} color="#FF3B30" />}
              <Text style={[styles.statusText, { color: item.status === 'Active' ? '#34C759' : '#FF3B30' }]}>{item.status}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  formCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 20, elevation: 1 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 15 },
  addBtn: { flexDirection: 'row', backgroundColor: '#007AFF', height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFF', fontWeight: '600' },
  listTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10, color: '#1C1C1E' },
  staffCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  staffName: { fontSize: 15, fontWeight: '600' },
  staffRole: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  statusToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontSize: 13, fontWeight: '600', marginLeft: 4 }
});