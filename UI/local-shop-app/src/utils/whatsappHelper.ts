import { Linking, Platform } from 'react-native';

/**
 * Normalizes Indian mobile numbers to international format (e.g. 919876543210)
 */
export function formatWhatsAppPhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
}

/**
 * Opens WhatsApp on web or mobile with a pre-filled message
 */
export async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  
  // Universal Link format supported across iOS, Android, and Desktop WhatsApp Web
  const url = `https://wa.me/${formattedPhone}?text=${encodedText}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen || Platform.OS === 'web') {
      await Linking.openURL(url);
      return true;
    } else {
      // Fallback to web link
      await Linking.openURL(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`);
      return true;
    }
  } catch (error) {
    console.warn('Could not open WhatsApp URL:', error);
    // Fallback direct open
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Customer messaging shopkeeper
 */
export async function openWhatsAppToMerchant(
  merchantPhone: string = '9876500000',
  shopName: string = 'Kirana Junction',
  orderId: string,
  itemsSummary: string
) {
  const msg = `Hello ${shopName}! 👋\n\nRegarding my Order *#${orderId}*:\n${itemsSummary}\n\nPlease let me know when it will be ready or if any items need substitution. Thank you!`;
  return openWhatsApp(merchantPhone, msg);
}

/**
 * Shopkeeper messaging customer with invoice/quote
 */
export async function openWhatsAppToCustomer(
  customerPhone: string,
  customerName: string,
  orderId: string,
  billAmount: number,
  deliveryOtp?: string,
  itemsSummary?: string
) {
  let msg = `Hello ${customerName}! 👋\n\nGreetings from *Kirana Junction*.\nYour Order *#${orderId}* total bill is *₹${billAmount}*.\n`;
  if (itemsSummary) {
    msg += `\n*Items:*\n${itemsSummary}\n`;
  }
  if (deliveryOtp) {
    msg += `\n🔑 *Delivery Confirmation Code:* ${deliveryOtp}\n`;
  }
  msg += `\nYour order is currently being packed. Thank you for shopping with your neighborhood store! 🛍️`;
  return openWhatsApp(customerPhone, msg);
}

/**
 * Delivery partner messaging customer about arrival
 */
export async function openWhatsAppToCustomerFromDriver(
  customerPhone: string,
  customerName: string,
  orderId: string,
  deliveryOtp: string,
  address?: string
) {
  const msg = `Hello ${customerName}! 🛵\n\nI am your delivery partner for LocalStore Order *#${orderId}*.\nI am on my way to *${address || 'your address'}*.\n\nPlease keep your 4-digit Delivery OTP *${deliveryOtp}* ready to receive the package. See you soon!`;
  return openWhatsApp(customerPhone, msg);
}
