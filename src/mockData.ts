import { Category, MenuItem, Branch, Currency, Order, Campaign, Feedback } from "./types";

export const defaultCurrency: Currency = {
  code: "EUR",
  symbol: "€",
  position: "after",
  decimalPlaces: 2,
  locale: "de-DE",
};

export const defaultBranch: Branch = {
  id: "wuppertal-1",
  name: "MR. Tabboush Wuppertal",
  address: "Berliner Str. 179",
  city: "Wuppertal",
  postalCode: "42277",
  country: "Germany",
  phone: "+49 202 1234567",
  whatsAppNumber: "+49 176 88889999",
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryRadiusKm: 4,
  deliveryFee: 1.50,
  minOrderAmount: 10.00,
  paymentMethods: ["Cash on Delivery", "Cash on Pickup"],
  isOpen: true,
  openingHours: "12:00 - 22:30",
};

export const initialCategories: Category[] = [
  {
    id: "cat-shawarma",
    name: {
      ar: "شاورما",
      de: "Shawarma",
      en: "Shawarma",
    },
    description: {
      ar: "شاورما دجاج ولحم محضرة بأشهى البهارات الشامية",
      de: "Hähnchen- und Rindfleisch-Shawarma nach syrischer Rezeptur",
      en: "Syrian-style chicken and beef shawarma marinated in rich spices",
    },
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "cat-broasted",
    name: {
      ar: "بروستد دجاج",
      de: "Broasted Chicken",
      en: "Broasted Chicken",
    },
    description: {
      ar: "بروستد مقرمش مع البطاطا والثومية اللذيذة",
      de: "Knuspriges Brathähnchen, serviert mit Pommes und Knoblauchsoße",
      en: "Crispy Syrian traditional deep-fried chicken with fries and garlic sauce",
    },
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "cat-grilled",
    name: {
      ar: "دجاج مشوي",
      de: "Gegrilltes Hähnchen",
      en: "Grilled Chicken",
    },
    description: {
      ar: "دجاج مشوي على الفحم متبل بخلطتنا الخاصة",
      de: "Gegrilltes Hähnchen am Spieß, mariniert mit unserer Haussoße",
      en: "Charcoal rotisserie grilled chicken with signature marinade",
    },
    sortOrder: 3,
    isActive: true,
  },
  {
    id: "cat-drinks",
    name: {
      ar: "مشروبات",
      de: "Getränke",
      en: "Drinks",
    },
    description: {
      ar: "مشروبات باردة ومنعشة",
      de: "Kalte Erfrischungsgetränke",
      en: "Cold refreshing beverages",
    },
    sortOrder: 4,
    isActive: true,
  },
];

export const initialMenuItems: MenuItem[] = [
  {
    id: "item-shawarma-chicken",
    categoryId: "cat-shawarma",
    name: {
      ar: "شاورما دجاج سوبر",
      de: "Hähnchen Shawarma Super",
      en: "Chicken Shawarma Super",
    },
    description: {
      ar: "ساندويتش شاورما دجاج كبير، بطاطا، مخلل وثومية",
      de: "Großer Hähnchen-Shawarma-Wrap, Pommes, saure Gurken und Knoblauchcreme",
      en: "Large chicken shawarma wrap with French fries, pickles, and garlic sauce inside",
    },
    basePrice: 6.50,
    image: "https://images.unsplash.com/photo-1561651823-34fed0225408?w=500&auto=format&fit=crop",
    skucode: "SHW-CHIK-01",
    preparationTimeMinutes: 10,
    isAvailableForDelivery: true,
    isAvailableForPickup: true,
    isActive: true,
    isBestSeller: true,
    sortOrder: 1,
    modifierGroups: [
      {
        id: "mod-sauce-chicken",
        name: {
          ar: "الصلصات الإضافية",
          de: "Zusätzliche Soßen",
          en: "Extra Sauces",
        },
        type: "multiple",
        isRequired: false,
        minSelections: 0,
        maxSelections: 3,
        options: [
          { id: "opt-garlic-extra", name: { ar: "ثومية إضافية", de: "Extra Knoblauch", en: "Extra Garlic Sauce" }, priceAdjustment: 0.50 },
          { id: "opt-spicy", name: { ar: "شطة حارة", de: "Scharfe Soße", en: "Spicy Chili" }, priceAdjustment: 0.50 },
          { id: "opt-pome", name: { ar: "دبس رمان", de: "Granatapfel-Sirup", en: "Pomegranate Molasses" }, priceAdjustment: 0.00 },
        ],
      },
      {
        id: "mod-onions",
        name: {
          ar: "البصل والبقدونس",
          de: "Zwiebeln & Petersilie",
          en: "Onions & Parsley",
        },
        type: "single",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "opt-onion-yes", name: { ar: "مع بصل وبقدونس", de: "Mit Zwiebeln & Petersilie", en: "With Onions & Parsley" }, priceAdjustment: 0.00 },
          { id: "opt-onion-no", name: { ar: "بدون بصل وبقدونس", de: "Ohne Zwiebeln & Petersilie", en: "No Onions & Parsley" }, priceAdjustment: 0.00 },
        ],
      },
    ],
    upsellSuggestions: [
      { id: "up-fries", suggestedItemName: { ar: "إضافة بطاطا ومشروب غازي كوجبة كومبو", de: "Fügen Sie Pommes & Getränk als Combo hinzu", en: "Upgrade to Fries + Soft Drink Combo" }, price: 3.00, isActive: true },
    ],
  },
  {
    id: "item-shawarma-arabic-chicken",
    categoryId: "cat-shawarma",
    name: {
      ar: "وجبة شاورما عربي دجاج",
      de: "Arabisches Hähnchen-Shawarma Teller",
      en: "Arabic Chicken Shawarma Meal",
    },
    description: {
      ar: "شاورما مقطعة بالخبز الصاج مع البطاطا المقلية، مخللات وثومية كريمية",
      de: "Geschnittenes Shawarma im Fladenbrot serviert mit Pommes, Essiggurken & Knoblauchdip",
      en: "Sliced toasted wrap on saj bread, served with fries, signature garlic cream & pickles",
    },
    basePrice: 9.50,
    image: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=500&auto=format&fit=crop",
    skucode: "SHW-ARAB-02",
    preparationTimeMinutes: 12,
    isAvailableForDelivery: true,
    isAvailableForPickup: true,
    isActive: true,
    isBestSeller: true,
    sortOrder: 2,
    modifierGroups: [
      {
        id: "mod-arabic-size",
        name: {
          ar: "حجم الوجبة",
          de: "Teller-Größe",
          en: "Meal Size",
        },
        type: "single",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "opt-arab-normal", name: { ar: "وجبة عادية", de: "Normaler Teller", en: "Regular Meal" }, priceAdjustment: 0.00 },
          { id: "opt-arab-double", name: { ar: "وجبة دبل (مزدوجة)", de: "Doppelter Teller", en: "Double Meal" }, priceAdjustment: 4.00 },
        ],
      },
    ],
    upsellSuggestions: [
      { id: "up-sambu", suggestedItemName: { ar: "إضافة علبة ثومية عملاقة", de: "XXL-Knoblauchsoße hinzufügen", en: "Add XXL Garlic Dip Cup" }, price: 0.80, isActive: true },
    ],
  },
  {
    id: "item-broasted-4pcs",
    categoryId: "cat-broasted",
    name: {
      ar: "بروستد دجاج 4 قطع",
      de: "Knusper-Broasted Hähnchen (4 Stck)",
      en: "Crispy Broasted Chicken (4 Pcs)",
    },
    description: {
      ar: "4 قطع دجاج بروستد ذهبي ومقرمش، بطاطا بوري، ثومية، خبز ومخلل",
      de: "4 knusprige Teile Brathähnchen, Pommes frites, Knoblauchcreme, Brot, Salat",
      en: "4 pieces of golden hand-battered fried chicken with French fries, garlic dip & pickles",
    },
    basePrice: 11.00,
    image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&auto=format&fit=crop",
    skucode: "BRST-4PC-01",
    preparationTimeMinutes: 15,
    isAvailableForDelivery: true,
    isAvailableForPickup: true,
    isActive: true,
    isBestSeller: false,
    sortOrder: 3,
    modifierGroups: [
      {
        id: "mod-broasted-spice",
        name: {
          ar: "الدرجة الحرارة",
          de: "Schärfegrad",
          en: "Spiciness Level",
        },
        type: "single",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "opt-brst-normal", name: { ar: "عادي / كلاسيك", de: "Klassisch Mild", en: "Mild Classic" }, priceAdjustment: 0.00 },
          { id: "opt-brst-spicy", name: { ar: "حار جداً مقرمش", de: "Super Knusprig Scharf", en: "Flaming Spicy" }, priceAdjustment: 0.00 },
        ],
      },
    ],
    upsellSuggestions: [
      { id: "up-ayran-combo", suggestedItemName: { ar: "إضافة عصير عيران بارد طبيعي", de: "Kaltes Erfrischungsayran hinzufügen", en: "Add natural cold Ayran drink" }, price: 1.80, isActive: true },
    ],
  },
  {
    id: "item-grilled-whole",
    categoryId: "cat-grilled",
    name: {
      ar: "دجاجة كاملة مشوية على الفحم",
      de: "Ganzes Grillhähnchen vom Holzkohlegrill",
      en: "Whole Charcoal Grilled Chicken",
    },
    description: {
      ar: "دجاجة كاملة مشوية على الفحم بالمهارة الطرابيشية، تخدم مع بطاطا متبلة، كريم الثوم والخبز الشامي",
      de: "Ganzes saftiges Grillhähnchen mit spezieller Marinade, Beilage Pommes, Fladenbrot und Knoblauchsoße",
      en: "Whole juicy rotisserie bird flavored in Damascus spice blend, served with fries, garlic dip, and thin bread",
    },
    basePrice: 14.50,
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop",
    skucode: "GRILL-WHL-01",
    preparationTimeMinutes: 20,
    isAvailableForDelivery: true,
    isAvailableForPickup: true,
    isActive: true,
    isBestSeller: true,
    sortOrder: 4,
    modifierGroups: [],
    upsellSuggestions: [
      { id: "up-coke-1l", suggestedItemName: { ar: "ترقية المشروب إلى كوكا كولا عائلي 1 لتر", de: "Unde Cola auf 1L Flasche upgraden", en: "Upgrade drink to a Family-size Coca-Cola (1 Liter)" }, price: 2.50, isActive: true },
    ],
  },
  {
    id: "item-ayran",
    categoryId: "cat-drinks",
    name: {
      ar: "شنينة / لبن عيران تركية",
      de: "Yogurt Ayran",
      en: "Yogurt Ayran",
    },
    description: {
      ar: "لبن عيران طازج ومملح خفيف بارد ومثالي مع المشاوي والشاورما",
      de: "Kühles erfrischendes Joghurtgetränk, perfekt zu Grillgut oder Shawarma",
      en: "Traditional cold salted-savory yogurt drink, optimal companion for spicy food and meat wraps",
    },
    basePrice: 1.80,
    image: "https://images.unsplash.com/photo-1528498033373-3c6c08e93d79?w=500&auto=format&fit=crop",
    skucode: "DRK-AYRN-01",
    preparationTimeMinutes: 2,
    isAvailableForDelivery: true,
    isAvailableForPickup: true,
    isActive: true,
    isBestSeller: false,
    sortOrder: 5,
    modifierGroups: [],
    upsellSuggestions: [],
  },
  {
    id: "item-pepsi",
    categoryId: "cat-drinks",
    name: {
      ar: "بيبسي علبة باردة",
      de: "Pepsi Dose (0.33L)",
      en: "Pepsi Can (0.33L)",
    },
    description: { ar: "علبة بيبسي مثلجة", de: "Eiskalte Pepsi Dose", en: "Ice cold Pepsi can" },
    basePrice: 2.50,
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop",
    skucode: "DRK-PEPS-02",
    preparationTimeMinutes: 2,
    isAvailableForDelivery: true,
    isAvailableForPickup: true,
    isActive: true,
    isBestSeller: false,
    sortOrder: 6,
    modifierGroups: [],
    upsellSuggestions: [],
  },
];

export const initialOrders: Order[] = [
  {
    id: "ord-1001",
    orderNumber: "TAB-1001",
    branchId: "wuppertal-1",
    customerName: "Ahmad Malkous",
    whatsAppPhone: "+491571234567",
    orderType: "delivery",
    items: [
      {
        itemId: "item-shawarma-arabic-chicken",
        name: { ar: "وجبة شاورما عربي دجاج", de: "Arabisches Hähnchen-Shawarma Teller", en: "Arabic Chicken Shawarma Meal" },
        basePrice: 9.50,
        quantity: 2,
        selectedModifiers: [
          {
            groupId: "mod-arabic-size",
            groupName: { ar: "حجم الوجبة", de: "Teller-Größe", en: "Meal Size" },
            option: { id: "opt-arab-double", name: { ar: "وجبة دبل (مزدوجة)", de: "Doppelter Teller", en: "Double Meal" }, priceAdjustment: 4.00 },
          },
        ],
        selectedUpsell: {
          id: "up-sambu",
          name: { ar: "علبة ثومية عملاقة", de: "XXL-Knoblauchsoße hinzufügen", en: "Add XXL Garlic Dip Cup" },
          price: 0.80,
        },
        totalPrice: 28.60, // (9.50 + 4.00) * 2 + 0.80 * 2 = 28.60
      },
      {
        itemId: "item-pepsi",
        name: { ar: "بيبسي علبة باردة", de: "Pepsi Dose (0.33L)", en: "Pepsi Can (0.33L)" },
        basePrice: 2.50,
        quantity: 2,
        selectedModifiers: [],
        totalPrice: 5.00,
      },
    ],
    subtotal: 33.60,
    deliveryFee: 1.50,
    total: 35.10,
    status: "received",
    paymentMethod: "Cash on Delivery",
    deliveryAddress: "Berliner Str. 110, 42277 Wuppertal",
    notes: "Please ring family Malkous on 2nd floor. Extra bread please!",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-1002",
    orderNumber: "TAB-1002",
    branchId: "wuppertal-1",
    customerName: "Thomas Müller",
    whatsAppPhone: "+4917633221144",
    orderType: "pickup",
    items: [
      {
        itemId: "item-shawarma-chicken",
        name: { ar: "شاورما دجاج سوبر", de: "Hähnchen Shawarma Super", en: "Chicken Shawarma Super" },
        basePrice: 6.50,
        quantity: 1,
        selectedModifiers: [
          {
            groupId: "mod-sauce-chicken",
            groupName: { ar: "الصلصات الإضافية", de: "Zusätzliche Soßen", en: "Extra Sauces" },
            option: { id: "opt-garlic-extra", name: { ar: "ثومية إضافية", de: "Extra Knoblauch", en: "Extra Garlic Sauce" }, priceAdjustment: 0.50 },
          },
          {
            groupId: "mod-onions",
            groupName: { ar: "البصل والبقدونس", de: "Zwiebeln & Petersilie", en: "Onions & Parsley" },
            option: { id: "opt-onion-no", name: { ar: "بدون بصل وبقدونس", de: "Ohne Zwiebeln & Petersilie", en: "No Onions & Parsley" }, priceAdjustment: 0.00 },
          },
        ],
        totalPrice: 7.00,
      },
      {
        itemId: "item-ayran",
        name: { ar: "شنينة / لبن عيران تركية", de: "Yogurt Ayran", en: "Yogurt Ayran" },
        basePrice: 1.80,
        quantity: 1,
        selectedModifiers: [],
        totalPrice: 1.80,
      },
    ],
    subtotal: 8.80,
    deliveryFee: 0.00,
    total: 8.80,
    status: "preparing",
    paymentMethod: "Cash on Pickup",
    pickupTime: "21:15",
    notes: "Keep it warm, I will pick up on bicycle.",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-1003",
    orderNumber: "TAB-1003",
    branchId: "wuppertal-1",
    customerName: "Majid Al-Saeed",
    whatsAppPhone: "+4915177778888",
    orderType: "delivery",
    items: [
      {
        itemId: "item-grilled-whole",
        name: { ar: "دجاجة كاملة مشوية على الفحم", de: "Ganzes Grillhähnchen vom Holzkohlegrill", en: "Whole Charcoal Grilled Chicken" },
        basePrice: 14.50,
        quantity: 1,
        selectedModifiers: [],
        totalPrice: 14.50,
      },
    ],
    subtotal: 14.50,
    deliveryFee: 1.50,
    total: 16.00,
    status: "delivered",
    paymentMethod: "Cash on Delivery",
    deliveryAddress: "Gathe 43, 42103 Wuppertal",
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(), // 3 hours ago
    updatedAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
  },
];

export const initialCampaigns: Campaign[] = [
  {
    id: "camp-ramadan",
    title: "Ramadan Mubarak Special Offer",
    segment: "all",
    language: "ar",
    message: {
      ar: "🌙 طابوش يبارك لكم الشهر الفضيل! عرض العائلة للرمضان: دجاجتان مشويتان على الفحم + وجبتين شاورما عربي دبل + لتر عيران طازج + حمص ومخلل مجاناً بـ 39.99€ فقط! اطلب الآن مباشرة عبر الـ WhatsApp بالرد بكلمة 'رمضان'.",
      de: "🌙 MR. Tabboush wünscht gesegneten Ramadan! Unser Familien-Ramadan-Angebot: 2 ganze Hähnchen vom Holzkohlegrill + 2 doppelte arabische Shawarma-Gerichte + 1L frisches Ayran + Hummus und Essiggurken gratis für nur 39,99 €! Jetzt direkt bestellen, indem Sie mit 'RAMADAN' antworten.",
      en: "🌙 MR. Tabboush wishes you a blessed Ramadan! Our Family Ramadan Feast: 2 whole charcoal-grilled chickens + 2 double Arabic Shawarma platters + 1L fresh Ayran + free Hummus and pickles for just €39.99! Order now on WhatsApp by replying with 'RAMADAN'.",
    },
    status: "sent",
    sentCount: 154,
    failedCount: 2,
    totalTarget: 156,
  },
  {
    id: "camp-weekend",
    title: "Wuppertal Broasted Weekend",
    segment: "active",
    language: "all",
    message: {
      ar: "🍗 عرض نهاية الأسبوع المقرمش في فرع فوبيرتال! اطلب وجبة بروستد 4 قطع واحصل على بيبسي وعيران مجاناً! اكتب 'عرض المقرمش' للطلب الآن.",
      de: "🍗 Knuspriges Wochenendangebot im Branch Wuppertal! Bestellen Sie ein 4er-Broasted-Hähnchen-Menü und erhalten Sie ein Pepsi & ein Ayran gratis dazu! Antworten Sie mit 'SPICY WEEKEND' zum Bestellen.",
      en: "🍗 Crispy Weekend special at Wuppertal branch! Order a 4-pcs Crispy Broasted Meal and get a free Pepsi and Ayran! Reply with 'SPICY WEEKEND' to order now.",
    },
    status: "draft",
    sentCount: 0,
    failedCount: 0,
    totalTarget: 210,
  },
];

export const initialFeedbacks: Feedback[] = [
  {
    id: "fb-1",
    orderId: "ord-1003",
    customerName: "Majid Al-Saeed",
    rating: 5,
    comment: "Excellent food, still hot on arrival! The garlic sauce is incredible.",
    status: "resolved",
    createdAt: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
  },
];

// Customizable WhatsApp welcome flow and notifications texts (Restaurant settings)
export const orderStatusMessages = {
  received: {
    ar: "✅ تم استلام طلبك رقم *{orderNumber}* بنجاح! وهو قيد المراجعة والتدقيق الآن من قبل فريق {restaurantName}. سنخطرك فور قبوله والبدء في التحضير.",
    de: "✅ Ihre Bestellung *{orderNumber}* wurde erfolgreich empfangen! Unser Team prüft sie jetzt. Wir informieren Sie, sobald mit der Zubereitung begonnen wird.",
    en: "✅ Your order *{orderNumber}* has been successfully received and is currently under review by the {restaurantName} team. We will notify you once accepted and preparing.",
  },
  accepted: {
    ar: "👍 تم قبول طلبك رقم *{orderNumber}* من قبل الكاشير. إجمالي الطلب: {total}. طريقة الدفع: {paymentMethod}.",
    de: "👍 Ihre Bestellung *{orderNumber}* wurde akzeptiert. Gesamtbetrag: {total}. Zahlungsmethode: {paymentMethod}.",
    en: "👍 Your order *{orderNumber}* has been accepted. Total amount: {total}. Payment method: {paymentMethod}.",
  },
  preparing: {
    ar: "👨‍🍳 بدأت رائحة الشواء تفوح! طلبك رقم *{orderNumber}* الآن in المطبخ قيد التحضير الطازج والدقيق. وقت التحضير المتوقع هو {prepTime} دقيقة.",
    de: "👨‍🍳 Frisch in der Küche! Ihre Bestellung *{orderNumber}* wird jetzt sorgfältig zubereitet. Erwartete Zubereitungszeit: {prepTime} Minuten.",
    en: "👨‍🍳 Cooking fresh in the kitchen! Your order *{orderNumber}* is now being lovingly prepared. Expected preparation time: {prepTime} minutes.",
  },
  ready_for_pickup: {
    ar: "📦 طلبك الساخن رقم *{orderNumber}* جاهز تماماً للاستلام الآن في فرعنا بـ {address}! ننتظر تشريفك.",
    de: "📦 Ihre heiße Bestellung *{orderNumber}* steht jetzt in unserem Restaurant inder {address} zur Abholung bereit! Wir freuen uns auf Ihren Besuch.",
    en: "📦 Your hot order *{orderNumber}* is now packed and ready for pickup at our branch at {address}! We look forward to seeing you.",
  },
  out_for_delivery: {
    ar: "🛵 انطلق الكابتن! طلبك رقم *{orderNumber}* في طريقه إليك الآن مع سائق التوصيل. يرجى إبقاء الهاتف متاحاً لاستقبال الاتصال.",
    de: "🛵 Lieferfahrer ist unterwegs! Ihre Bestellung *{orderNumber}* wurde an den Kurier übergeben und ist auf dem Weg zu Ihnen. Bitte halten Sie Ihr Handy bereit.",
    en: "🛵 Delivery hero dispatched! Your order *{orderNumber}* is on its way. Please keep your phone active for the delivery feedback.",
  },
  delivered: {
    ar: "🍽️ بالهناء والشفاء! تم تسليم الطلب رقم *{orderNumber}*. نأمل أن تنال الوجبة إعجابكم. شكرًا لاختياركم {restaurantName}!",
    de: "🍽️ Guten Appetit! Ihre Bestellung *{orderNumber}* wurde erfolgreich geliefert. Wir hoffen, es schmeckt Ihnen. Vielen Dank für Ihre Wahl!",
    en: "🍽️ Enjoy your meal! Your order *{orderNumber}* has been delivered successfully. We hope you love the taste of Syria. Thank you for choosing {restaurantName}!",
  },
  cancelled: {
    ar: "❌ نعتذر منك بشدة، تم إلغاء طلبك رقم *{orderNumber}*. للتعرف على السبب أو للاستفسار، يمكنك الرد بكلمة 'وكيل' للتحدث مع الدعم الفني.",
    de: "❌ Es tut uns leid, Ihre Bestellung *{orderNumber}* musste storniert werden. Für Fragen antworten Sie mit 'SUPPORT', um einen Mitarbeiter zu kontaktieren.",
    en: "❌ We are deeply sorry, your order *{orderNumber}* has been cancelled. For details or questions, reply with 'AGENT' to speak with our support representative.",
  },
};
