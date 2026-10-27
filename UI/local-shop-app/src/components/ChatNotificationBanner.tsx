import * as Haptics from 'expo-haptics';
import { MessageSquare, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface ChatNotificationBannerProps {
  visible: boolean;
  senderName: string;
  senderRole: string;
  messageText: string;
  orderId: string;
  onPress: () => void;
  onDismiss: () => void;
}

export default function ChatNotificationBanner({
  visible,
  senderName,
  senderRole,
  messageText,
  orderId,
  onPress,
  onDismiss,
}: ChatNotificationBannerProps) {
  const slideAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (visible) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, 6000);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, messageText, orderId]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -140,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible && (slideAnim as any)._value === -140) return null;

  const roleColor = senderRole === 'Merchant' ? '#10B981' : '#0284C7';
  const orderShortId = orderId ? orderId.slice(-6).toUpperCase() : '';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        activeOpacity={0.9}
        onPress={() => {
          handleDismiss();
          onPress();
        }}
      >
        <View style={[styles.iconBadge, { backgroundColor: roleColor }]}>
          <MessageSquare size={20} color="#FFFFFF" />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.senderName} numberOfLines={1}>
              {senderName || (senderRole === 'Merchant' ? 'Merchant' : 'Customer')}
            </Text>
            {orderShortId ? (
              <View style={styles.orderPill}>
                <Text style={styles.orderPillText}>#{orderShortId}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.messageSnippet} numberOfLines={2}>
            {messageText}
          </Text>

          <Text style={styles.tapActionText}>Tap to open chat & reply →</Text>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={18} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 6,
  },
  orderPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  messageSnippet: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  tapActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
