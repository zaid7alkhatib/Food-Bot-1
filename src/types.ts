export interface Translation {
  ar: string;
  de: string;
  en: string;
  tr?: string;
}

export type UserRole = "super_admin" | "restaurant_admin" | "branch_manager" | "staff" | "support_agent";

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: string;
  branchId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  whatsAppNumber: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minOrderAmount: number;
  paymentMethods: string[];
  isOpen: boolean;
  openingHours: string;
  closedDays?: number[];
  menuBoardSettings?: MenuBoardSettings;
}

export interface MenuBoardLayout {
  screenId: string;
  name?: string;
  categoryIds: string[];
  orientation: "landscape" | "portrait";
  template: "grid" | "split" | "highlights";
  isActive?: boolean;
}

export interface MenuBoardPromoSlide {
  id: string;
  title: Translation;
  imageUrl: string;
  priceText: Translation;
  screenIds: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface MenuBoardSettings {
  enabled: boolean;
  languageMode: "fixed" | "rotate" | "bilingual";
  fixedLanguage: "ar" | "de" | "en" | "tr";
  rotationSeconds: number;
  tickerEnabled: boolean;
  tickerText: Translation;
  layouts: MenuBoardLayout[];
  promoSlides: MenuBoardPromoSlide[];
}

export interface Currency {
  code: string;
  symbol: string;
  position: "before" | "after";
  decimalPlaces: number;
  locale: string;
}

export interface Category {
  id: string;
  name: Translation;
  description?: Translation;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierOption {
  id: string;
  name: Translation;
  priceAdjustment: number;
}

export interface ModifierGroup {
  id: string;
  name: Translation;
  type: "single" | "multiple";
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface UpsellSuggestion {
  id: string;
  triggerCategoryId?: string;
  triggerItemIds?: string[];
  suggestedItemName: Translation;
  suggestedItemId?: string;
  price: number;
  description?: Translation;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: Translation;
  description: Translation;
  basePrice: number;
  image: string;
  skucode: string;
  preparationTimeMinutes: number;
  isAvailableForDelivery: boolean;
  isAvailableForPickup: boolean;
  isActive: boolean;
  isBestSeller: boolean;
  sortOrder: number;
  modifierGroups: ModifierGroup[];
  upsellSuggestions: UpsellSuggestion[];
}

export type OrderType = "delivery" | "pickup" | "dine_in";

export type OrderStatus =
  | "received"
  | "under_review"
  | "accepted"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  itemId: string;
  name: Translation;
  basePrice: number;
  quantity: number;
  selectedModifiers: {
    groupId: string;
    groupName: Translation;
    option: ModifierOption;
  }[];
  selectedUpsell?: {
    id: string;
    name: Translation;
    price: number;
  };
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  customerName: string;
  whatsAppPhone?: string;
  whatsAppJid?: string;
  whatsAppPhoneJid?: string;
  whatsAppLid?: string;
  orderType: OrderType;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  deliveryAddress?: string;
  pickupTime?: string;
  tableNumber?: string;
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sender: "customer" | "bot" | "human";
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string; // usually Customer ID / Phone number
  customerName: string;
  whatsAppPhone: string;
  whatsAppJid?: string;
  whatsAppPhoneJid?: string;
  whatsAppLid?: string;
  customerLanguage?: "ar" | "de" | "en" | "tr";
  botEnabled: boolean;
  assignedTo?: string;
  takeoverReason?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  currentStep?: "welcome" | "language_selection" | "type" | "menu" | "customizing" | "address" | "pickup_time" | "confirming" | "completed";
  unsubmittedOrder?: Partial<Order>;
}

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  segment?: "all" | "active" | "dormant";
  language: "all" | "ar" | "de" | "en" | "tr";
  message: Translation;
  scheduledTime?: string;
  status: "draft" | "sending" | "sent";
  sentCount?: number;
  failedCount?: number;
  totalTarget?: number;
  recipients?: string[];
  createdAt?: string;
}

export interface Feedback {
  id: string;
  orderId: string;
  customerName: string;
  rating: number;
  comment?: string;
  status: "pending" | "resolved";
  createdAt: string;
}

export interface Table {
  id: string;
  _id?: string;
  branchId: string;
  number: string;
  capacity: number;
  shape: "square" | "round" | "rectangle";
  posX: number;
  posY: number;
  section: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reservation {
  id: string;
  _id?: string;
  branchId: string;
  tableId?: string;
  customerName: string;
  whatsAppPhone: string;
  guestCount: number;
  dateTime: string;
  durationMinutes: number;
  status: "pending" | "confirmed" | "seated" | "cancelled" | "completed";
  source: "website" | "whatsapp" | "dashboard";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  name: string;
  phone: string;
  sources: string[];
  ordersCount: number;
  totalSpend: number;
  lastOrderDate?: string;
  lastInteractionDate: string;
  preferredLanguage?: string;
  segment: "active" | "dormant";
  recentOrders: {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    source: string;
    createdAt: string;
  }[];
  recentReservations: {
    id: string;
    dateTime: string;
    tableNumber?: string;
    status: string;
    numPeople?: number;
  }[];
}


