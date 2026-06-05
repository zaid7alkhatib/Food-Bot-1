import "dotenv/config";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "./lib/db.js";
import {
  User,
  Restaurant,
  Branch,
  Category,
  MenuItem,
  Order,
  Conversation,
  Campaign,
  Feedback,
  WhatsAppSession,
} from "./models/index.js";
import { hashPassword } from "./lib/auth.js";

async function seed() {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Restaurant.deleteMany({});
  await Branch.deleteMany({});
  await Category.deleteMany({});
  await MenuItem.deleteMany({});
  await Order.deleteMany({});
  await Conversation.deleteMany({});
  await Campaign.deleteMany({});
  await Feedback.deleteMany({});
  await WhatsAppSession.deleteMany({});

  console.log("[Seed] Cleared existing data");

  // Create default admin user
  const adminUser = await User.create({
    email: "admin@mrtabboush.de",
    password: hashPassword("tabboush2024"),
    name: "MR. Tabboush Admin",
    role: "restaurant_admin",
  });
  console.log("[Seed] Created admin user:", adminUser.email);

  // Create restaurant
  const restaurant = await Restaurant.create({
    name: "MR. Tabboush",
    legalName: "Farman GmbH",
    logo: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=128&h=128&fit=crop&q=80",
    primaryColor: "#ea580c",
    secondaryColor: "#1f2937",
    phone: "+49 202 1234567",
    whatsappNumber: "+49 176 88889999",
    email: "info@mrtabboush.de",
    address: "Berliner Str. 179, 42277 Wuppertal, Germany",
    defaultLanguage: "de",
    supportedLanguages: ["ar", "de", "en"],
    defaultCurrency: "EUR",
    timezone: "Europe/Berlin",
    isActive: true,
    googleMapsReviewLink: "https://g.page/r/Cgooglemapsreview",
    taxVatRate: 0,
  });
  console.log("[Seed] Created restaurant:", restaurant.name);

  // Create branch
  const branch = await Branch.create({
    restaurantId: restaurant._id,
    name: "MR. Tabboush Wuppertal",
    address: "Berliner Str. 179",
    city: "Wuppertal",
    postalCode: "42277",
    country: "Germany",
    latitude: 51.2667,
    longitude: 7.1833,
    phone: "+49 202 1234567",
    openingHours: "12:00 - 22:30",
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryRadiusKm: 4,
    deliveryFee: 1.5,
    minOrderAmount: 10,
    isActive: true,
  });
  console.log("[Seed] Created branch:", branch.name);

  // Create categories
  const categories = await Category.insertMany([
    {
      restaurantId: restaurant._id,
      branchIds: [branch._id],
      name: { ar: "شاورما", de: "Shawarma", en: "Shawarma" },
      description: {
        ar: "شاورما دجاج ولحم محضرة بأشهى البهارات الشامية",
        de: "Hähnchen- und Rindfleisch-Shawarma nach syrischer Rezeptur",
        en: "Syrian-style chicken and beef shawarma marinated in rich spices",
      },
      sortOrder: 1,
      isActive: true,
      availableForDelivery: true,
      availableForPickup: true,
    },
    {
      restaurantId: restaurant._id,
      branchIds: [branch._id],
      name: { ar: "بروستد دجاج", de: "Broasted Chicken", en: "Broasted Chicken" },
      description: {
        ar: "بروستد مقرمش مع البطاطا والثومية اللذيذة",
        de: "Knuspriges Brathähnchen, serviert mit Pommes und Knoblauchsoße",
        en: "Crispy Syrian traditional deep-fried chicken with fries and garlic sauce",
      },
      sortOrder: 2,
      isActive: true,
      availableForDelivery: true,
      availableForPickup: true,
    },
    {
      restaurantId: restaurant._id,
      branchIds: [branch._id],
      name: { ar: "دجاج مشوي", de: "Gegrilltes Hähnchen", en: "Grilled Chicken" },
      description: {
        ar: "دجاج مشوي على الفحم متبل بخلطتنا الخاصة",
        de: "Gegrilltes Hähnchen am Spieß, mariniert mit unserer Haussoße",
        en: "Charcoal rotisserie grilled chicken with signature marinade",
      },
      sortOrder: 3,
      isActive: true,
      availableForDelivery: true,
      availableForPickup: true,
    },
    {
      restaurantId: restaurant._id,
      branchIds: [branch._id],
      name: { ar: "مشروبات", de: "Getränke", en: "Drinks" },
      description: {
        ar: "مشروبات باردة ومنعشة",
        de: "Kalte Erfrischungsgetränke",
        en: "Cold refreshing beverages",
      },
      sortOrder: 4,
      isActive: true,
      availableForDelivery: true,
      availableForPickup: true,
    },
  ]);
  console.log("[Seed] Created", categories.length, "categories");

  const catShawarma = categories[0]._id;
  const catBroasted = categories[1]._id;
  const catGrilled = categories[2]._id;
  const catDrinks = categories[3]._id;

  // Create menu items
  const menuItems = await MenuItem.insertMany([
    {
      restaurantId: restaurant._id,
      categoryId: catShawarma,
      name: { ar: "شاورما دجاج سوبر", de: "Hähnchen Shawarma Super", en: "Chicken Shawarma Super" },
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
          name: { ar: "الصلصات الإضافية", de: "Zusätzliche Soßen", en: "Extra Sauces" },
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
          name: { ar: "البصل والبقدونس", de: "Zwiebeln & Petersilie", en: "Onions & Parsley" },
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
      restaurantId: restaurant._id,
      categoryId: catShawarma,
      name: { ar: "وجبة شاورما عربي دجاج", de: "Arabisches Hähnchen-Shawarma Teller", en: "Arabic Chicken Shawarma Meal" },
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
          name: { ar: "حجم الوجبة", de: "Teller-Größe", en: "Meal Size" },
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
      restaurantId: restaurant._id,
      categoryId: catBroasted,
      name: { ar: "بروستد دجاج 4 قطع", de: "Knusper-Broasted Hähnchen (4 Stck)", en: "Crispy Broasted Chicken (4 Pcs)" },
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
          name: { ar: "الدرجة الحرارة", de: "Schärfegrad", en: "Spiciness Level" },
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
      restaurantId: restaurant._id,
      categoryId: catGrilled,
      name: { ar: "دجاجة كاملة مشوية على الفحم", de: "Ganzes Grillhähnchen vom Holzkohlegrill", en: "Whole Charcoal Grilled Chicken" },
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
      restaurantId: restaurant._id,
      categoryId: catDrinks,
      name: { ar: "شنينة / لبن عيران تركية", de: "Yogurt Ayran", en: "Yogurt Ayran" },
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
      restaurantId: restaurant._id,
      categoryId: catDrinks,
      name: { ar: "بيبسي علبة باردة", de: "Pepsi Dose (0.33L)", en: "Pepsi Can (0.33L)" },
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
  ]);
  console.log("[Seed] Created", menuItems.length, "menu items");

  // Create orders
  const orders = await Order.insertMany([
    {
      orderNumber: "TAB-1001",
      restaurantId: restaurant._id,
      branchId: branch._id,
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
          selectedUpsell: { id: "up-sambu", name: { ar: "علبة ثومية عملاقة", de: "XXL-Knoblauchsoße hinzufügen", en: "Add XXL Garlic Dip Cup" }, price: 0.80 },
          totalPrice: 28.60,
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
      currency: "EUR",
      paymentMethod: "Cash on Delivery",
      paymentStatus: "pending",
      status: "received",
      deliveryAddress: "Berliner Str. 110, 42277 Wuppertal",
      notes: "Please ring family Malkous on 2nd floor. Extra bread please!",
    },
    {
      orderNumber: "TAB-1002",
      restaurantId: restaurant._id,
      branchId: branch._id,
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
      currency: "EUR",
      paymentMethod: "Cash on Pickup",
      paymentStatus: "pending",
      status: "preparing",
      pickupTime: "21:15",
      notes: "Keep it warm, I will pick up on bicycle.",
    },
    {
      orderNumber: "TAB-1003",
      restaurantId: restaurant._id,
      branchId: branch._id,
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
      currency: "EUR",
      paymentMethod: "Cash on Delivery",
      paymentStatus: "pending",
      status: "delivered",
      deliveryAddress: "Gathe 43, 42103 Wuppertal",
    },
  ]);
  console.log("[Seed] Created", orders.length, "orders");

  // Create conversations
  await Conversation.insertMany([
    {
      customerName: "Ahmad Malkous",
      whatsAppPhone: "+491571234567",
      restaurantId: restaurant._id,
      branchId: branch._id,
      botEnabled: true,
      messages: [
        { id: "m1", sender: "customer", text: "Hallo, ich möchte bestellen", timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
        { id: "m2", sender: "bot", text: "أهلاً بك في مستر طابوش! 🌯\nWillkommen bei MR. Tabboush!\n\nFür Lieferung antworten Sie mit *1*.\nFür Abholung antworten Sie mit *2*.\n\nReply with *1* for Delivery or *2* for Pickup.", timestamp: new Date(Date.now() - 39 * 60 * 1000).toISOString() },
        { id: "m3", sender: "customer", text: "1", timestamp: new Date(Date.now() - 38 * 60 * 1000).toISOString() },
        { id: "m4", sender: "bot", text: "رائع! يرجى إرسال عنوان التوصيل الخاص بك في فوبيرتال.\nSuper! Bitte geben Sie Ihre Lieferadresse in Wuppertal an.", timestamp: new Date(Date.now() - 37 * 60 * 1000).toISOString() },
        { id: "m5", sender: "customer", text: "Berliner Str. 110, 42277 Wuppertal", timestamp: new Date(Date.now() - 36 * 60 * 1000).toISOString() },
      ],
      currentStep: "menu",
    },
    {
      customerName: "Thomas Müller",
      whatsAppPhone: "+4917633221144",
      restaurantId: restaurant._id,
      branchId: branch._id,
      botEnabled: true,
      messages: [
        { id: "m10", sender: "customer", text: "Hallo, Shawarma bitte", timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
      ],
      currentStep: "welcome",
    },
  ]);
  console.log("[Seed] Created 2 conversations");

  // Create campaigns
  await Campaign.insertMany([
    {
      restaurantId: restaurant._id,
      branchId: branch._id,
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
      restaurantId: restaurant._id,
      branchId: branch._id,
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
  ]);
  console.log("[Seed] Created 2 campaigns");

  // Create feedbacks
  await Feedback.create({
    orderId: "TAB-1003",
    restaurantId: restaurant._id,
    branchId: branch._id,
    customerName: "Majid Al-Saeed",
    whatsAppPhone: "+4915177778888",
    rating: 5,
    comment: "Excellent food, still hot on arrival! The garlic sauce is incredible.",
    status: "resolved",
  });
  console.log("[Seed] Created 1 feedback");

  // Create WhatsApp session
  await WhatsAppSession.create({
    branchId: branch._id,
    sessionName: "wuppertal-main",
    qrStatus: "pending",
    connected: false,
    isActive: true,
  });
  console.log("[Seed] Created 1 WhatsApp session");

  console.log("\n✅ Database seeded successfully!");
  console.log("Default login: admin@mrtabboush.de / tabboush2024");
  await disconnectDB();
}

seed().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});
