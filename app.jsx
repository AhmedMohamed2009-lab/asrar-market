// ===== 0. تهيئة React =====
const React = window.React;
const ReactDOM = window.ReactDOM;
const useState = React.useState;
const useEffect = React.useEffect;
const useCallback = React.useCallback;
const useRef = React.useRef;

// ===== 1. تهيئة EmailJS =====
(function() {
  if (typeof emailjs !== 'undefined' && emailjs.init) {
    emailjs.init("6J7XS0qI_R3w429IF");
    console.log("✅ EmailJS initialized");
  }
})();

window.CONFIG = {
  PUBLIC_KEY: "6J7XS0qI_R3w429IF",
  SERVICE_ID: "service_syr3c3j",
  TEMPLATE_ID: "template_1bifr6b",
  TO_EMAIL: "tolbafawzy67@gmail.com"
};

// ===== 2. تهيئة Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyCT70W2uRK2XvjqGp9e6bGALcxd8UZzWVY",
  authDomain: "kartona-store.firebaseapp.com",
  projectId: "kartona-store",
  storageBucket: "kartona-store.firebasestorage.app",
  messagingSenderId: "978275058904",
  appId: "1:978275058904:web:86ce1a48a8e10d051503ad",
  measurementId: "G-EW2YDDQCVG"
};

const ADMIN_EMAIL = "tolbafawzy67@gmail.com";

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const storage = firebase.storage();
  console.log("✅ Firebase initialized");
  
  window.db = db;
  window.auth = auth;
  window.storage = storage;
  
  window.cloudStore = {
    get: async () => {
      try {
        const catSnap = await db.collection('main').doc('categories').get();
        const prodSnap = await db.collection('main').doc('products').get();
        const ordSnap = await db.collection('main').doc('orders').get();
        
        const data = {};
        if (catSnap.exists) data.categories = catSnap.data().items || [];
        if (prodSnap.exists) data.products = prodSnap.data().items || [];
        if (ordSnap.exists) data.orders = ordSnap.data().items || [];
        
        // دمج الطلبات من collection الطلبات الفردية (عشان الأدمن يشوف كل الطلبات)
        try {
          const individualOrdersSnap = await db.collection('orders').get();
          const individualOrders = [];
          individualOrdersSnap.forEach(doc => individualOrders.push(doc.data()));
          const map = {};
          (data.orders || []).forEach(o => { if (o && o.id) map[o.id] = o; });
          individualOrders.forEach(o => { if (o && o.id) map[o.id] = o; });
          data.orders = Object.values(map).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } catch (mergeErr) {
          console.warn("Could not merge individual orders:", mergeErr);
        }
        
        const setSnap = await db.collection('settings').doc('general').get();
        if (setSnap.exists) data.settings = setSnap.data();

        return data;
      } catch (e) {
        console.error("Error fetching data:", e);
        return null;
      }
    },
    
    set: async (data) => {
      try {
        if (!data) return;
        
        await db.collection('main').doc('categories').set({ 
          items: data.categories || [] 
        });
        await db.collection('main').doc('products').set({ 
          items: data.products || [] 
        });
        await db.collection('main').doc('orders').set({ 
          items: data.orders || [] 
        });
        // الإعدادات للأدمن فقط — لو فشل مش نوقف باقي الحفظ
        try {
          await db.collection('settings').doc('general').set(
            data.settings || { deliveryFee: 15, walletNumber: "01000000000", adminPassword: "kartona2026", coupons: [] }
          );
        } catch (settingsErr) {
          console.warn("Settings save skipped (admin only):", settingsErr && settingsErr.message);
        }
        
        console.log("✅ Data saved successfully to Firebase!");
        return true;
      } catch (e) {
        console.error("❌ Error saving data:", e);
        throw e;
      }
    },

    // تحديث المنتجات فقط (خصم المخزون) — يعمل للعميل المسجّل
    updateProducts: async (products) => {
      try {
        await db.collection('main').doc('products').set({ items: products || [] });
        console.log("✅ Products/stock updated in Firebase");
        return true;
      } catch (e) {
        console.error("❌ Error updating products:", e);
        return false;
      }
    },

    // تحديث قائمة الطلبات في main
    updateOrdersList: async (orders) => {
      try {
        await db.collection('main').doc('orders').set({ items: orders || [] });
        console.log("✅ Orders list updated in Firebase");
        return true;
      } catch (e) {
        console.error("❌ Error updating orders list:", e);
        return false;
      }
    },
    
    uploadImage: async (file) => {
      const fileRef = storage.ref(`product-images/${Date.now()}_${file.name}`);
      await fileRef.put(file);
      return await fileRef.getDownloadURL();
    },
    
    saveOrder: async (order) => {
      try {
        await db.collection('orders').doc(order.id).set(order);
        console.log("✅ Order saved to orders collection:", order.id);
        return true;
      } catch (e) {
        console.error("❌ Error saving order:", e);
        return false;
      }
    },
    
    getCustomerOrders: async (userId) => {
      try {
        // بدون orderBy عشان محتاجش index مركب، هنرتب محلياً
        const snapshot = await db.collection('orders')
          .where('userId', '==', userId)
          .get();
        
        const orders = [];
        snapshot.forEach(doc => orders.push(doc.data()));
        orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        console.log(`📦 Found ${orders.length} orders for user ${userId}`);
        return orders;
      } catch (e) {
        console.error("❌ Error fetching customer orders:", e);
        return [];
      }
    },
    
    updateCustomer: async (uid, data) => {
      try {
        await db.collection('customers').doc(uid).set(data, { merge: true });
        console.log("✅ Customer data updated");
        return true;
      } catch (e) {
        console.error("❌ Error updating customer:", e);
        return false;
      }
    },
    
    getCustomer: async (uid) => {
      try {
        const doc = await db.collection('customers').doc(uid).get();
        if (doc.exists) return doc.data();
        return null;
      } catch (e) {
        console.error("❌ Error fetching customer:", e);
        return null;
      }
    }
  };
} else {
  console.warn("⚠️ Firebase not loaded yet");
}

// ===== 3. دوال مساعدة =====
function money(n) {
  return Number(n).toLocaleString("ar-EG") + " ج.م";
}

function seedData() {
  return {
    categories: [
      { id: "c1", name: "مواد غذائية" },
      { id: "c2", name: "أدوات منزلية" },
      { id: "c3", name: "عناية شخصية" },
      { id: "c4", name: "منتجات أطفال" }
    ],
    products: [
      { 
        id: "p1", 
        name: "زيت عباد الشمس 1 لتر", 
        description: "زيت طبخ نقي، عبوة لتر واحد.", 
        price: 85, 
        stock: 24, 
        categoryId: "c1", 
        recommended: true, 
        images: ["https://picsum.photos/seed/oil1/300/300", "https://picsum.photos/seed/oil2/300/300"],
        rating: 4.5, 
        reviews: [] 
      },
      { 
        id: "p2", 
        name: "أرز أبيض 5 كيلو", 
        description: "أرز مصري درجة أولى.", 
        price: 210, 
        stock: 3, 
        categoryId: "c1", 
        recommended: true, 
        images: ["https://picsum.photos/seed/rice1/300/300"],
        rating: 4.2, 
        reviews: [] 
      },
      { 
        id: "p3", 
        name: "طقم أطباق ميلامين 12 قطعة", 
        description: "طقم أطباق متين لسفرة العائلة.", 
        price: 340, 
        stock: 8, 
        categoryId: "c2", 
        recommended: false, 
        images: ["https://picsum.photos/seed/plates1/300/300", "https://picsum.photos/seed/plates2/300/300"],
        rating: 3.8, 
        reviews: [] 
      },
      { 
        id: "p4", 
        name: "منظف أرضيات معطر 1.5 لتر", 
        description: "رائحة تدوم لفترة أطول.", 
        price: 45, 
        stock: 0, 
        categoryId: "c2", 
        recommended: false, 
        images: ["https://picsum.photos/seed/cleaner1/300/300"],
        rating: 0, 
        reviews: [] 
      },
      { 
        id: "p5", 
        name: "شامبو للشعر الجاف 400 مل", 
        description: "بروتين وزيت أرجان.", 
        price: 95, 
        stock: 15, 
        categoryId: "c3", 
        recommended: true, 
        images: ["https://picsum.photos/seed/shampoo1/300/300", "https://picsum.photos/seed/shampoo2/300/300"],
        rating: 4.7, 
        reviews: [] 
      },
      { 
        id: "p6", 
        name: "حفاضات أطفال مقاس 4", 
        description: "عبوة 40 حفاضة.", 
        price: 175, 
        stock: 6, 
        categoryId: "c4", 
        recommended: false, 
        images: ["https://picsum.photos/seed/diapers1/300/300"],
        rating: 4.0, 
        reviews: [] 
      }
    ],
    orders: [],
    settings: { 
      deliveryFee: 15,
      walletNumber: "01000000000",
      adminPassword: "kartona2026",
      coupons: [] 
    }
  };
}

// ===== 4. أيقونات SVG =====
const IconBase = ({ children, size = 18, color = "currentColor", strokeWidth = 1.8, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const Search = (p) => <IconBase {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></IconBase>;
const ShoppingCart = (p) => <IconBase {...p}><circle cx="9" cy="21" r="1.4" /><circle cx="18" cy="21" r="1.4" /><path d="M2.5 3h2l2.6 12.2a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.5L21 8H6" /></IconBase>;
const Plus = (p) => <IconBase {...p}><path d="M12 5v14M5 12h14" /></IconBase>;
const Minus = (p) => <IconBase {...p}><path d="M5 12h14" /></IconBase>;
const Trash2 = (p) => <IconBase {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" /></IconBase>;
const X = (p) => <IconBase {...p}><path d="M18 6 6 18M6 6l12 12" /></IconBase>;
const Package = (p) => <IconBase {...p}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></IconBase>;
const LayoutDashboard = (p) => <IconBase {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></IconBase>;
const Boxes = (p) => <IconBase {...p}><path d="M3 8l6-3.5L15 8l-6 3.5L3 8z" /><path d="M3 8v6l6 3.5V11.5" /><path d="M15 8v6l6 3.5V11.5" /><path d="M9 11.5 15 8" /></IconBase>;
const ClipboardList = (p) => <IconBase {...p}><rect x="4" y="4" width="16" height="18" rx="2" /><path d="M9 2h6v4H9z" /><path d="M8 11h8M8 15h8M8 19h5" /></IconBase>;
const SettingsIcon = (p) => <IconBase {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></IconBase>;
const Lock = (p) => <IconBase {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></IconBase>;
const LogOut = (p) => <IconBase {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></IconBase>;
const AlertTriangle = (p) => <IconBase {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 9v5M12 17h.01" /></IconBase>;
const Star = ({ fill, ...p }) => <IconBase {...p} fill={fill || "none"}><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7-6.2-3.6L5.8 21l1.4-7L2 8.3l7-.8L12 2z" /></IconBase>;
const ChevronRight = (p) => <IconBase {...p}><path d="M9 6l6 6-6 6" /></IconBase>;
const ChevronLeft = (p) => <IconBase {...p}><path d="M15 6l-6 6 6 6" /></IconBase>;
const Check = (p) => <IconBase {...p}><path d="M20 6 9 17l-5-5" /></IconBase>;
const Tag = (p) => <IconBase {...p}><path d="M20 12l-8 8-9-9V4h7l10 10z" /><circle cx="7.5" cy="7.5" r="1" /></IconBase>;
const Pencil = (p) => <IconBase {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></IconBase>;
const Save = (p) => <IconBase {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></IconBase>;
const ImageOff = (p) => <IconBase {...p}><path d="M3 3l18 18" /><path d="M21 15V5a2 2 0 0 0-2-2H8" /><path d="M3 8v11a2 2 0 0 0 2 2h11" /></IconBase>;
const Truck = (p) => <IconBase {...p}><rect x="1" y="7" width="14" height="10" rx="1" /><path d="M15 10h4l3 3v4h-7z" /><circle cx="6" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></IconBase>;
const Wallet = (p) => <IconBase {...p}><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H5" /><rect x="3" y="7" width="18" height="12" rx="2" /><circle cx="16" cy="13" r="1.3" /></IconBase>;
const Banknote = (p) => <IconBase {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></IconBase>;
const Sun = (p) => <IconBase {...p}><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></IconBase>;
const Moon = (p) => <IconBase {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></IconBase>;
const BarChart = (p) => <IconBase {...p}><rect x="3" y="12" width="4" height="8" /><rect x="9" y="6" width="4" height="14" /><rect x="15" y="9" width="4" height="11" /><rect x="21" y="3" width="4" height="17" /></IconBase>;
const User = (p) => <IconBase {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></IconBase>;
const ChevronLeftCircle = (p) => <IconBase {...p}><circle cx="12" cy="12" r="10" /><path d="M14 8l-4 4 4 4" /></IconBase>;
const ChevronRightCircle = (p) => <IconBase {...p}><circle cx="12" cy="12" r="10" /><path d="M10 8l4 4-4 4" /></IconBase>;
const Facebook = (p) => <IconBase {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></IconBase>;

const LOW_STOCK = 5;
const TEAM_NAME = "Nexta Team";
const STORE_NAME = "أسرار ماركت";
const STORE_TAGLINE = "سوبر ماركت أسرار معاك في الشروق من شرقها لغربها";
const LOGO_URL = "logo.jpg";

// موقع المحل — ماركت أسرار، الشروق
const STORE_LAT = 30.1649187;
const STORE_LNG = 31.6521624;
// قيم افتراضية — الأدمن يقدر يغيّرها من الإعدادات
const DELIVERY_MIN_FEE = 15;
const DELIVERY_PER_KM = 5;
const DELIVERY_FREE_RADIUS_KM = 3;

function getDeliveryConfig(settings) {
  const s = settings || {};
  return {
    minFee: Number(s.deliveryMinFee ?? s.deliveryFee ?? DELIVERY_MIN_FEE) || DELIVERY_MIN_FEE,
    perKm: Number(s.deliveryPerKm ?? DELIVERY_PER_KM) || DELIVERY_PER_KM,
    radiusKm: Number(s.deliveryRadiusKm ?? DELIVERY_FREE_RADIUS_KM) || DELIVERY_FREE_RADIUS_KM,
  };
}

// هوية بصرية من اليافطة (أسود + أبيض)
const BRAND = {
  primary: "#0A0A0A",
  primarySoft: "#1A1A1A",
  accent: "#FFFFFF",
  accentMuted: "#F5F5F5",
  gold: "#0A0A0A",
  text: "#0A0A0A",
  textMuted: "#6B7280",
};

// حساب المسافة بين نقطتين (كم) — Haversine
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// تقريب المسافة: 3.3→3 ، 3.6→4 ، 3.5 تفضل 3.5
function roundDistanceKm(km) {
  if (km == null || isNaN(km)) return 0;
  const whole = Math.floor(km);
  const frac = km - whole;
  if (Math.abs(frac - 0.5) < 0.001) return whole + 0.5;
  if (frac < 0.5) return whole;
  return whole + 1;
}

function calcDeliveryFee(distanceKm, settings) {
  const { minFee, perKm, radiusKm } = getDeliveryConfig(settings);
  if (distanceKm == null || isNaN(distanceKm)) return minFee;
  const d = roundDistanceKm(distanceKm);
  if (d <= radiusKm) return minFee;
  return Math.round(d * perKm * 100) / 100;
}

/** نص عرض قصير للكوبون (للبانر) */
function formatCouponBannerText(coupon, categories) {
  if (!coupon) return "";
  const val = coupon.type === "percent" ? `${coupon.value}%` : `${coupon.value} ج.م`;
  const cats = (coupon.categoryIds || [])
    .map((id) => (categories || []).find((c) => c.id === id)?.name)
    .filter(Boolean);
  const scope = cats.length ? `على ${cats.join(" و ")}` : "على كل المنتجات";
  return `عرض ${coupon.code}: خصم ${val} ${scope}`;
}

// ===== 5. دوال الحالة =====
const STATUS_MAP = {
  pending: { label: "قيد المراجعة", color: "#B7791F", bg: "#FEF3E2" },
  confirmed: { label: "مؤكد", color: "#0A0A0A", bg: "#F5F5F5" },
  delivering: { label: "جاري التوصيل", color: "#6B46C1", bg: "#F1E9FC" },
  delivered: { label: "تم التسليم", color: "#1F8A55", bg: "#E5F7ED" },
  cancelled: { label: "ملغي", color: "#C0392B", bg: "#FCEAE8" },
};

// ===== 6. useStore =====
function useStore() {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (typeof window.cloudStore !== 'undefined' && window.cloudStore.get) {
          const cloudData = await window.cloudStore.get();
          
          if (cloudData && (cloudData.products?.length > 0 || cloudData.categories?.length > 0)) {
            if (!cloudData.settings) {
              cloudData.settings = { 
                deliveryFee: 20, 
                walletNumber: "01000000000", 
                adminPassword: "kartona2026" 
              };
            }
            setData(cloudData);
            console.log("📦 Data loaded from Firebase");
          } else {
            console.log("🆕 No data in Firebase, seeding...");
            const initial = seedData();
            await window.cloudStore.set(initial);
            setData(initial);
          }
        } else {
          setData(seedData());
        }
      } catch (e) {
        console.error("❌ Failed to load data:", e);
        setData(seedData());
      } finally {
        setLoading(false);
        setReady(true);
      }
    })();
  }, []);

  const save = useCallback(async (updater) => {
    try {
      let nextData;
      
      setData((prev) => {
        nextData = typeof updater === "function" ? updater(prev) : updater;
        return nextData;
      });
      
      if (typeof window.cloudStore !== 'undefined' && window.cloudStore.set) {
        await window.cloudStore.set(nextData);
        console.log("✅ Data saved to Firebase");
        return true;
      }
      return false;
    } catch (e) {
      console.error("❌ Failed to save:", e);
      // الحالة المحلية متحدثة بالفعل — المهم إن Firebase يتحدث للمنتجات
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      if (typeof window.cloudStore !== 'undefined' && window.cloudStore.get) {
        const cloudData = await window.cloudStore.get();
        if (cloudData) {
          setData(cloudData);
          console.log("🔄 Data refreshed from Firebase");
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("❌ Failed to refresh:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, ready, loading, save, refresh };
}

// ===== 7. Image Gallery (مع سحب باللمس على الموبايل) =====
function ImageGallery({ images, alt, isDark }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const touchStartX = useRef(null);
  const touchDeltaX = useRef(0);
  
  if (!images || images.length === 0 || imgError) {
    return (
      <div className="w-full aspect-square rounded-xl flex items-center justify-center" 
           style={{ background: isDark ? "#0A0A0A" : "linear-gradient(145deg,#F5F5F5,#FFFFFF)", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
        <Package size={64} color={isDark ? "#0A0A0A" : "#0A0A0A"} strokeWidth={1.6} />
      </div>
    );
  }

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 40) {
      if (touchDeltaX.current < 0) nextImage();
      else prevImage();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  return (
    <div 
      className="relative w-full aspect-square rounded-xl overflow-hidden select-none" 
      style={{ background: isDark ? "#0A0A0A" : "#F5F5F5", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5", touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img 
        src={images[currentIndex]} 
        alt={alt}
        className="w-full h-full object-contain pointer-events-none"
        onError={() => setImgError(true)}
        loading="lazy"
        draggable={false}
      />
      
      {images.length > 1 && (
        <>
          <button type="button" onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition hover:scale-110" style={{ background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.95)", color: isDark ? "#FFF" : "#0A0A0A", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <ChevronLeftCircle size={18} />
          </button>
          <button type="button" onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition hover:scale-110" style={{ background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.95)", color: isDark ? "#FFF" : "#0A0A0A", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <ChevronRightCircle size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button key={idx} type="button" onClick={() => setCurrentIndex(idx)} className="rounded-full transition" style={{ background: idx === currentIndex ? (isDark ? "#0A0A0A" : "#0A0A0A") : (isDark ? "#2A2A2A" : "#CBD5E1"), width: idx === currentIndex ? "14px" : "8px", height: "8px" }} />
            ))}
          </div>
          <div className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}

// ===== 8. المكونات المساعدة =====
function BoxThumb({ product, size = "normal", isDark }) {
  const dim = size === "small" ? "w-16 h-16" : "w-full aspect-square";
  const [imgError, setImgError] = useState(false);
  const image = product?.images && product.images.length > 0 ? product.images[0] : null;
  
  return (
    <div className={`${dim} rounded-xl flex items-center justify-center relative overflow-hidden shrink-0`} 
         style={{ background: isDark ? "linear-gradient(145deg,#111111,#0A0A0A)" : "linear-gradient(145deg,#F5F5F5,#F5F5F5)", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
      {product && image && !imgError ? (
        <img src={image} alt={product.name} className="w-full h-full object-cover" onError={() => setImgError(true)} loading="lazy" />
      ) : (
        <Package size={size === "small" ? 22 : 34} color={isDark ? "#FFFFFF" : "#0A0A0A"} strokeWidth={1.6} />
      )}
      {product && product.recommended && <div className="stamp-badge">مقترح</div>}
      {product && product.images && product.images.length > 1 && (
        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full">+{product.images.length - 1}</div>
      )}
    </div>
  );
}

function StockBadge({ stock }) {
  if (stock <= 0) return <span className="tag-badge" style={{ color: "#C0392B", background: "#FCEAE8", borderColor: "#F3C6C0" }}>غير متوفر</span>;
  if (stock <= LOW_STOCK) return <span className="tag-badge" style={{ color: "#B7791F", background: "#FEF3E2", borderColor: "#F5DBAA" }}>باقي {stock} بس</span>;
  return <span className="tag-badge" style={{ color: "#1F8A55", background: "#E5F7ED", borderColor: "#BFE7CE" }}>متوفر ({stock})</span>;
}

function StarRating({ rating, onRate, size = 16, isDark }) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];
  
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {stars.map((star) => (
        <button key={star} onClick={() => onRate && onRate(star)} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} className="focus:outline-none">
          <Star size={size} fill={(hover || rating) >= star ? "#D97706" : "none"} color={(hover || rating) >= star ? "#D97706" : isDark ? "#64748B" : "#CBD5E1"} />
        </button>
      ))}
      {rating > 0 && <span className="text-xs mr-1" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>({rating.toFixed(1)})</span>}
    </div>
  );
}

// ===== 9. Field, PayOption =====
function Field({ label, value, onChange, type = "text", textarea, isDark }) {
  const isPhone = type === "tel";
  return (
    <label className="text-xs block">
      <span className="block mb-0.5 font-medium" style={{ color: isDark ? "#94A3B8" : "#3B5578" }}>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-1.5 text-sm outline-none" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={isPhone ? "ltr" : undefined}
          inputMode={isPhone ? "tel" : undefined}
          className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
          style={{
            background: isDark ? "#0A0A0A" : "#FFF",
            color: isDark ? "#FFF" : "#000",
            border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5",
            textAlign: isPhone ? "left" : undefined,
            unicodeBidi: isPhone ? "isolate" : undefined,
          }}
        />
      )}
    </label>
  );
}

// عرض رقم تليفون صح في واجهة RTL
function PhoneText({ children, className = "", style = {} }) {
  return (
    <span className={className} dir="ltr" style={{ display: "inline-block", unicodeBidi: "isolate", ...style }}>
      {children}
    </span>
  );
}

function PayOption({ icon, label, active, onClick, isDark }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-right w-full" style={active ? { background: isDark ? "#0A0A0A" : "#F5F5F5", border: "1.5px solid #0A0A0A", color: isDark ? "#FFFFFF" : "#0A0A0A" } : { background: isDark ? "#0A0A0A" : "#F5F5F5", border: isDark ? "1.5px solid #2A2A2A" : "1.5px solid #E2ECF6", color: isDark ? "#94A3B8" : "#3B5578" }}>
      {icon} {label}
    </button>
  );
}

// ===== 10. التطبيق الرئيسي =====
function KartonaApp() {
  const { data, ready, loading, save, refresh } = useStore();
  const [view, setView] = useState("store");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [checkoutStage, setCheckoutStage] = useState(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", payment: "cod", note: "" });
  const [lastOrderId, setLastOrderId] = useState(null);
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [emailSent, setEmailSent] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Firebase Auth
  const [adminUser, setAdminUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminError, setAdminError] = useState("");

  const [customerUser, setCustomerUser] = useState(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [customerError, setCustomerError] = useState("");
  const [showCustomerAccount, setShowCustomerAccount] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerCreatedAt, setCustomerCreatedAt] = useState(null);

  // Auth listeners
  useEffect(() => {
    if (typeof window.auth !== 'undefined') {
      const unsubAdmin = window.auth.onAuthStateChanged((u) => {
        setAdminUser(u);
        if (u && u.email === ADMIN_EMAIL) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      });

      const unsubCustomer = window.auth.onAuthStateChanged(async (u) => {
        if (u && u.email !== ADMIN_EMAIL) {
          setCustomerUser(u);
          if (typeof window.cloudStore !== 'undefined' && window.cloudStore.getCustomer) {
            const customerData = await window.cloudStore.getCustomer(u.uid);
            if (customerData) {
              setCustomerName(customerData.name || "");
              setCustomerPhone(customerData.phone || "");
              setCustomerAddress(customerData.address || "");
              setCustomerCreatedAt(customerData.createdAt || null);
            }
          }
          if (typeof window.cloudStore !== 'undefined' && window.cloudStore.getCustomerOrders) {
            const orders = await window.cloudStore.getCustomerOrders(u.uid);
            setCustomerOrders(orders);
          }
        } else {
          if (u && u.email === ADMIN_EMAIL) {
            // الأدمن مسجل
          } else {
            setCustomerUser(null);
            setCustomerOrders([]);
          }
        }
      });

      return () => {
        unsubAdmin();
        unsubCustomer();
      };
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  // زر رجوع الموبايل: يرجع خطوة جوّه الموقع مش يخرج
  useEffect(() => {
    const onPop = (e) => {
      if (checkoutStage) { setCheckoutStage(null); window.history.pushState({ view }, ""); return; }
      if (showCart) { setShowCart(false); window.history.pushState({ view }, ""); return; }
      if (view === "product") { setView("store"); setSelectedProductId(null); window.history.pushState({ view: "store" }, ""); return; }
      if (view === "account") { setView("store"); window.history.pushState({ view: "store" }, ""); return; }
      if (view === "admin") { setView("store"); window.history.pushState({ view: "store" }, ""); return; }
      if (view === "login") { setView("store"); window.history.pushState({ view: "store" }, ""); return; }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [view, checkoutStage, showCart]);

  useEffect(() => {
    if (view && view !== "store") {
      window.history.pushState({ view }, "");
    }
  }, [view]);

  // إشعار فوري للإدارة عند طلب جديد (من غير Refresh)
  useEffect(() => {
    if (!isAdmin || view !== "admin" || typeof window.db === "undefined") return;
    let firstSnap = true;
    const unsub = window.db.collection("orders")
      .onSnapshot((snap) => {
        if (firstSnap) { firstSnap = false; return; }
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const o = change.doc.data();
            setNewOrderAlert(o);
            notify(`🔔 طلب جديد: ${o.id} — ${o.customerName || ""}`);
            refresh();
          }
        });
      }, (err) => console.warn("orders listener:", err));
    return () => unsub && unsub();
  }, [isAdmin, view]);

  // ===== دوال الأدمن =====
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      if (typeof window.auth !== 'undefined') {
        await window.auth.signInWithEmailAndPassword(adminEmail, adminPassword);
        notify("✅ تم دخول الإدارة بنجاح");
        setShowAdminLogin(false);
        setView("admin");
        setAdminError("");
      }
    } catch (err) {
      setAdminError("بيانات الدخول غير صحيحة");
      notify("❌ بيانات الدخول غير صحيحة");
    }
  };

  const handleAdminLogout = () => {
    if (typeof window.auth !== 'undefined') {
      window.auth.signOut();
      setAdminUser(null);
      setIsAdmin(false);
      setView("store");
      notify("تم خروج الأدمن");
    }
  };

  // ===== دوال العميل =====
  const handleCustomerAuth = async (e) => {
    e.preventDefault();
    setCustomerError("");
    try {
      if (typeof window.auth !== 'undefined') {
        if (isLoginMode) {
          await window.auth.signInWithEmailAndPassword(customerEmail, customerPassword);
          notify("✅ تم تسجيل الدخول بنجاح");
          // نفضل في صفحة الحساب بعد الدخول
          setView("account");
        } else {
          const userCredential = await window.auth.createUserWithEmailAndPassword(customerEmail, customerPassword);
          const customerData = {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            address: customerAddress || "",
            createdAt: new Date().toISOString()
          };
          if (typeof window.cloudStore !== 'undefined' && window.cloudStore.updateCustomer) {
            await window.cloudStore.updateCustomer(userCredential.user.uid, customerData);
          }
          notify("🎉 تم إنشاء حسابك بنجاح!");
          setView("account");
        }
      }
    } catch (err) {
      setCustomerError(err.message);
    }
  };

  const handleCustomerLogout = async () => {
    if (typeof window.auth !== 'undefined') {
      await window.auth.signOut();
      setCustomerUser(null);
      setView("store");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerOrders([]);
      notify("تم تسجيل الخروج");
    }
  };

  const updateCustomerProfile = async () => {
    try {
      if (customerUser && typeof window.cloudStore !== 'undefined' && window.cloudStore.updateCustomer) {
        await window.cloudStore.updateCustomer(customerUser.uid, {
          name: customerName,
          phone: customerPhone,
          address: customerAddress
        });
        setIsEditingCustomer(false);
        notify("✅ تم تحديث بياناتك بنجاح");
      }
    } catch (e) {
      console.error("Error updating profile:", e);
      notify("❌ حصل خطأ في تحديث البيانات");
    }
  };

  const fetchCustomerOrders = useCallback(async () => {
    if (customerUser && typeof window.cloudStore !== 'undefined' && window.cloudStore.getCustomerOrders) {
      try {
        const orders = await window.cloudStore.getCustomerOrders(customerUser.uid);
        setCustomerOrders(orders);
        console.log("📦 Customer orders fetched:", orders.length);
      } catch (e) {
        console.error("Error fetching orders:", e);
      }
    }
  }, [customerUser]);

  useEffect(() => {
    if (customerUser) {
      fetchCustomerOrders();
    }
  }, [fetchCustomerOrders]);

  const cancelOrder = async (orderId) => {
    if (!confirm("متأكد إنك عايز تلغي الأوردر ده؟")) return;
    
    // تحديث في collection الطلبات الفردية أولاً (حسب الـ rules)
    try {
      if (typeof window.db !== 'undefined') {
        await window.db.collection('orders').doc(orderId).update({ status: "cancelled" });
      }
    } catch (e) {
      console.error("Error cancelling order:", e);
      notify("❌ مش قادر تلغي الطلب دلوقتي (ممكن يكون اتأكد بالفعل)");
      return;
    }
    
    // تحديث القائمة المحلية + main لو أمكن
    try {
      await save((prev) => ({ 
        ...prev, 
        orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, status: "cancelled" } : o) 
      }));
    } catch (e) {
      console.warn("Could not update main orders list:", e);
    }
    
    notify("🚫 تم إلغاء الأوردر");
    fetchCustomerOrders();
    try { await refresh(); } catch (e) {}
  };

  // ===== دوال المنتجات =====
  const productById = (id) => data?.products?.find(p => p.id === id) || null;
  const categoryName = (id) => data?.categories?.find(c => c.id === id)?.name || "غير مصنف";
  const filteredProducts = data?.products?.filter(p => {
    const matchCategory = activeCategory === "all" || p.categoryId === activeCategory;
    const matchSearch = p.name.includes(search) || p.description.includes(search);
    return matchCategory && matchSearch;
  }) || [];
  const recommended = data?.products?.filter(p => p.recommended && p.stock > 0) || [];
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartLines = cart.map(c => ({ ...c, product: productById(c.productId) })).filter(c => c.product);
  const cartTotal = cartLines.reduce((s, c) => s + c.product.price * c.qty, 0);
  const [gpsDistanceKm, setGpsDistanceKm] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null); // { lat, lng }
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  // سعر التوصيل من GPS أو الافتراضي من الإعدادات
  const deliveryFee = gpsDistanceKm != null
    ? calcDeliveryFee(gpsDistanceKm, data?.settings)
    : getDeliveryConfig(data?.settings).minFee;
  const grandTotal = Math.max(0, cartTotal + deliveryFee - couponDiscount);

  const requestGpsLocation = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("المتصفح مش بيدعم تحديد الموقع");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const dist = haversineKm(STORE_LAT, STORE_LNG, lat, lng);
        setGpsDistanceKm(dist);
        setGpsCoords({ lat, lng });
        setGpsLoading(false);
        const rounded = roundDistanceKm(dist);
        const fee = calcDeliveryFee(dist, data?.settings);
        notify(`📍 المسافة ≈ ${dist.toFixed(1)} كم (تُحسب ${rounded} كم) — التوصيل ${money(fee)}`);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(err.code === 1 ? "لازم تسمح بالوصول للموقع" : "مش قادر أحدد موقعك، جرّب تاني");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const applyCoupon = () => {
    const code = (couponCode || "").trim().toUpperCase();
    const list = data?.settings?.coupons || [];
    const found = list.find((c) => (c.code || "").toUpperCase() === code && c.active !== false);
    if (!found) {
      setCouponDiscount(0);
      notify("❌ كود الخصم غير صالح");
      return;
    }
    // لو الكوبون مربوط بكاتيجوريز: الخصم على منتجات الكاتيجوري بس
    const catIds = found.categoryIds || [];
    let eligibleTotal = cartTotal;
    if (catIds.length > 0) {
      eligibleTotal = cartLines.reduce((s, line) => {
        if (catIds.includes(line.product.categoryId)) {
          return s + line.product.price * line.qty;
        }
        return s;
      }, 0);
      if (eligibleTotal <= 0) {
        setCouponDiscount(0);
        notify("❌ الكوبون مش ينطبق على منتجات سلتك");
        return;
      }
    }
    let disc = 0;
    if (found.type === "percent") disc = Math.round(eligibleTotal * (Number(found.value) || 0) / 100);
    else disc = Number(found.value) || 0;
    disc = Math.min(disc, eligibleTotal, cartTotal);
    setCouponDiscount(disc);
    notify(`✅ تم تطبيق الخصم: ${money(disc)}${catIds.length ? " (على أقسام محددة)" : ""}`);
  };
  const getRelatedProducts = (id) => {
    if (!data) return [];
    const p = productById(id);
    if (!p) return [];
    return data.products.filter(pr => pr.id !== id && pr.categoryId === p.categoryId && pr.stock > 0).slice(0, 4);
  };

  const addReview = (productId, rating, comment) => {
    save((prev) => ({
      ...prev,
      products: prev.products.map((p) => {
        if (p.id !== productId) return p;
        const reviews = [...(p.reviews || []), { id: "r" + Date.now(), rating, comment, date: new Date().toISOString() }];
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        return { ...p, reviews, rating: Math.round(avg * 10) / 10 };
      })
    }));
    notify("⭐ شكراً على تقييمك!");
  };

  const addToCart = (product) => {
    if (!customerUser) {
      notify("🔐 لازم تسجل دخول عشان تضيف منتجات للسلة");
      setIsLoginMode(true);
      setView("account");
      return;
    }
    
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      const currentQty = existing ? existing.qty : 0;
      if (currentQty >= product.stock) { notify("الكمية المتاحة في المخزن خلصت"); return prev; }
      if (existing) return prev.map((c) => (c.productId === product.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { productId: product.id, qty: 1 }];
    });
    notify(`✅ اتضاف "${product.name}" للسلة`);
  };

  const changeQty = (productId, delta) => {
    setCart((prev) => {
      const product = productById(productId);
      return prev.map((c) => {
        if (c.productId !== productId) return c;
        const newQty = c.qty + delta;
        if (product && newQty > product.stock) return c;
        return { ...c, qty: newQty };
      }).filter((c) => c.qty > 0);
    });
  };

  const removeFromCart = (productId) => setCart((prev) => prev.filter((c) => c.productId !== productId));
  const startCheckout = () => { 
    if (!cartLines.length) return; 
    setShowCart(false); 
    // تعبئة بيانات العميل من الحساب لو مسجل
    if (customerUser) {
      setCustomer(prev => ({
        ...prev,
        name: customerName || prev.name,
        phone: customerPhone || prev.phone,
        address: customerAddress || prev.address
      }));
    }
    setCheckoutStage("form"); 
  };
  const goToPreview = () => {
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) { notify("من فضلك كمّل بيانات الاستلام كلها"); return; }
    setCheckoutStage("preview");
  };

  const sendOrderEmail = async (order) => {
    try {
      if (typeof emailjs === 'undefined') {
        console.warn("⚠️ EmailJS not available");
        return false;
      }
      const templateParams = {
        to_email: window.CONFIG.TO_EMAIL, 
        order_id: order.id, 
        customer_name: order.customerName,
        phone: order.phone, 
        address: order.address,
        items: order.items.map(it => `${it.name} × ${it.qty}`).join("، "),
        total: money(order.total), 
        payment: order.paymentMethod === "cod" ? "كاش عند الاستلام" : "InstaPay عند الاستلام",
        note: order.note || "لا توجد ملاحظات", 
        delivery_fee: money(order.deliveryFee),
        location_link: order.mapsLink || "لم يتم تحديد موقع GPS",
        distance: order.distanceKm != null ? `${order.distanceKm} كم` : "—"
      };
      await emailjs.send(window.CONFIG.SERVICE_ID, window.CONFIG.TEMPLATE_ID, templateParams, window.CONFIG.PUBLIC_KEY);
      setEmailSent(true);
      notify("✅ تم إرسال تفاصيل الطلب للإدارة");
      return true;
    } catch (err) {
      console.error("❌ Failed to send email:", err);
      notify("⚠️ فشل إرسال البريد، لكن الطلب اتحفظ في النظام");
      return false;
    }
  };

  const confirmOrder = async () => {
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      notify("من فضلك كمّل بيانات الاستلام كلها");
      return;
    }
    // يُفضّل تسجيل الدخول عشان الطلب يظهر في حسابك
    if (!customerUser) {
      notify("سجّل دخول أو أنشئ حساب عشان تقدر تتابع طلبك");
      setIsLoginMode(false);
      setView("account");
      return;
    }

    const orderId = "AS" + Date.now().toString().slice(-8);
    const mapsLink = gpsCoords
      ? `https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`
      : null;
    const order = {
      id: orderId, 
      customerName: customer.name, 
      phone: customer.phone, 
      address: customer.address,
      userId: customerUser.uid,
      customerEmail: customerUser.email || customerEmail || "",
      items: cartLines.map((c) => ({ productId: c.product.id, name: c.product.name, price: c.product.price, qty: c.qty })),
      paymentMethod: customer.payment, 
      note: customer.note, 
      deliveryFee, 
      distanceKm: gpsDistanceKm != null ? Number(gpsDistanceKm.toFixed(2)) : null,
      customerLat: gpsCoords ? gpsCoords.lat : null,
      customerLng: gpsCoords ? gpsCoords.lng : null,
      mapsLink: mapsLink,
      couponCode: couponDiscount > 0 ? couponCode : "",
      discount: couponDiscount || 0,
      total: grandTotal,
      status: "pending", 
      createdAt: new Date().toISOString(),
    };
    
    // خصم الكمية من المخزون
    const nextProducts = data.products.map((p) => {
      const line = cartLines.find((c) => c.product.id === p.id);
      return line ? { ...p, stock: Math.max(0, Number(p.stock) - Number(line.qty)) } : p;
    });
    const nextOrders = [order, ...(data.orders || []).filter(o => o.id !== order.id)];
    
    // 1) حفظ الطلب في collection الطلبات الفردية (مهم للعميل والأدمن)
    let orderSaved = false;
    if (typeof window.cloudStore !== 'undefined' && window.cloudStore.saveOrder) {
      orderSaved = await window.cloudStore.saveOrder(order);
    }
    
    // 2) خصم المخزون مباشرة من main/products (مهم!)
    let stockUpdated = false;
    if (typeof window.cloudStore !== 'undefined' && window.cloudStore.updateProducts) {
      stockUpdated = await window.cloudStore.updateProducts(nextProducts);
    }
    
    // 3) تحديث قائمة الطلبات في main
    if (typeof window.cloudStore !== 'undefined' && window.cloudStore.updateOrdersList) {
      await window.cloudStore.updateOrdersList(nextOrders);
    }
    
    // 4) تحديث الحالة المحلية فوراً (حتى لو Firebase اتأخر)
    await save((prev) => ({ 
      ...prev, 
      orders: nextOrders, 
      products: nextProducts 
    }));
    
    await sendOrderEmail(order);

    setLastOrderId(orderId);
    setCheckoutStage("done");
    setCart([]);
    setCouponCode("");
    setCouponDiscount(0);
    setGpsDistanceKm(null);
    setGpsCoords(null);
    
    // مش بنعمل refresh فوراً عشان ميرجعش المخزون القديم قبل ما Firebase يخلص
    // نحدّث طلبات العميل بس
    fetchCustomerOrders();
    
    if (orderSaved && stockUpdated) {
      notify("✅ تم تأكيد الطلب وخصم الكمية من المخزون");
    } else if (orderSaved) {
      notify("✅ تم تأكيد الطلب (تحقق من قواعد Firebase لو المخزون متغيرش)");
    } else {
      notify("⚠️ الطلب اتحفظ جزئياً، راجع Console والـ Rules");
    }
  };

  const closeCheckout = () => { setCheckoutStage(null); setCustomer({ name: "", phone: "", address: "", payment: "cod", note: "" }); setEmailSent(false); };
  
  const doAdminLogin = () => {
    if (adminUser && adminUser.email === ADMIN_EMAIL) {
      setView("admin");
      setIsAdmin(true);
    } else {
      setShowAdminLogin(true);
      setView("login");
    }
  };
  
  const closeAdminLogin = () => {
    setShowAdminLogin(false);
    setView("store");
    setAdminError("");
    setAdminEmail("");
    setAdminPassword("");
  };

  const doOpenCustomerAccount = () => {
    if (customerUser) {
      setView("account");
      fetchCustomerOrders();
    } else {
      setIsLoginMode(true);
      setView("account");
    }
  };

  const closeCustomerAccount = () => {
    setView("store");
    setCustomerError("");
    setIsEditingCustomer(false);
  };

  // ===== دوال الإدارة =====
  const updateStock = (productId, newStock) => {
    const stock = Math.max(0, Number(newStock) || 0);
    save((prev) => ({ ...prev, products: prev.products.map((p) => (p.id === productId ? { ...p, stock } : p)) }));
    notify("✅ تم تحديث الكمية وحفظها في Firebase");
  };
  
  const toggleRecommended = (productId) => {
    save((prev) => ({ ...prev, products: prev.products.map((p) => (p.id === productId ? { ...p, recommended: !p.recommended } : p)) }));
    notify("✅ تم تحديث حالة المنتج");
  };
  
  const saveProduct = (product) => {
    save((prev) => {
      const exists = prev.products.some((p) => p.id === product.id);
      const products = exists ? prev.products.map((p) => (p.id === product.id ? product : p)) : [...prev.products, product];
      return { ...prev, products };
    });
    notify("✅ تم حفظ المنتج في Firebase");
  };
  
  const deleteProduct = (productId) => {
    save((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== productId) }));
    notify("✅ تم حذف المنتج من Firebase");
  };
  
  const addCategory = (name) => {
    if (!name.trim()) return;
    save((prev) => ({ ...prev, categories: [...prev.categories, { id: "c" + Date.now(), name: name.trim() }] }));
    notify("✅ تم إضافة الكاتيجوري");
  };
  
  const deleteCategory = (id) => {
    if (data.products.some((p) => p.categoryId === id)) { 
      notify("⚠️ في منتجات مربوطة بالكاتيجوري دي، مينفعش تتمسح"); 
      return; 
    }
    save((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }));
    notify("✅ تم حذف الكاتيجوري");
  };
  
  const changeOrderStatus = async (orderId, status) => {
    // تحديث الـ collection الفردية أولاً عشان العميل يشوف الحالة فوراً
    try {
      if (typeof window.db !== 'undefined') {
        await window.db.collection('orders').doc(orderId).update({ status: status });
      }
    } catch (e) {
      console.error("Error updating order status in orders collection:", e);
    }
    
    try {
      await save((prev) => ({ ...prev, orders: (prev.orders || []).map((o) => (o.id === orderId ? { ...o, status } : o)) }));
    } catch (e) {
      console.warn("Could not update main orders:", e);
    }
    
    notify("✅ تم تحديث حالة الطلب");
    try { await refresh(); } catch (e) {}
  };
  
  const updateSettings = (patch) => {
    save((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    notify("✅ تم حفظ الإعدادات في Firebase");
  };

  const pendingCount = data?.orders?.filter((o) => o.status === "pending").length || 0;
  const lowStockProducts = data?.products?.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK) || [];
  const outOfStockProducts = data?.products?.filter((p) => p.stock <= 0) || [];

  const isCurrentUserAdmin = adminUser && adminUser.email === ADMIN_EMAIL;

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: isDark ? "#0A0A0A" : "#FFFFFF" }}>
        <div className="text-center px-4">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="logo-spin-ring" />
            <img
              src={LOGO_URL}
              alt={STORE_NAME}
              className="absolute inset-2 w-20 h-20 rounded-full object-cover bg-white"
              style={{ border: "2px solid " + (isDark ? "#fff" : "#0A0A0A") }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          </div>
          <p className="text-sm font-bold" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A", fontFamily: "Cairo, sans-serif" }}>
            جاري التحميل...
          </p>
          <p className="text-[11px] mt-1" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
            {STORE_NAME}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ background: isDark ? "#0A0A0A" : "#FFFFFF", minHeight: "100vh", color: isDark ? "#FFFFFF" : "#0A0A0A" }}>
      {toast && <div className="toast-pop">{toast}</div>}
      
      {view === "store" && (
        <StoreView 
          data={data} 
          search={search} 
          setSearch={setSearch} 
          activeCategory={activeCategory} 
          setActiveCategory={setActiveCategory} 
          filteredProducts={filteredProducts} 
          recommended={recommended} 
          categoryName={categoryName} 
          cartCount={cartCount} 
          onOpenCart={() => setShowCart(true)} 
          onAddToCart={addToCart} 
          onOpenDetail={(id) => { setSelectedProductId(id); setView("product"); }} 
          onGoAdmin={doAdminLogin} 
          isDark={isDark} 
          toggleTheme={toggleTheme} 
          authUser={adminUser}
          isAdmin={isCurrentUserAdmin}
          onLogout={handleAdminLogout}
          customerUser={customerUser}
          onOpenCustomerAccount={doOpenCustomerAccount}
        />
      )}
      
      {view === "product" && selectedProductId && productById(selectedProductId) && (
        <ProductPage 
          product={productById(selectedProductId)} 
          categoryName={categoryName(productById(selectedProductId).categoryId)} 
          cartQty={(cart.find((c) => c.productId === selectedProductId) || {}).qty || 0} 
          onAdd={() => addToCart(productById(selectedProductId))} 
          onBack={() => { setView("store"); setSelectedProductId(null); }} 
          isDark={isDark}
          relatedProducts={getRelatedProducts(selectedProductId)}
          onOpenDetail={(id) => { setSelectedProductId(id); setView("product"); }}
        />
      )}
      
      {view === "login" && (
        <AdminLogin 
          email={adminEmail}
          setEmail={setAdminEmail}
          password={adminPassword}
          setPassword={setAdminPassword}
          loginError={adminError}
          onLogin={handleAdminLogin}
          onBack={closeAdminLogin}
          isDark={isDark}
        />
      )}
      
      {view === "admin" && isCurrentUserAdmin && (
        <>
          {newOrderAlert && (
            <div className="sticky top-0 z-30 px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: "#0A0A0A", color: "#FFFFFF", borderBottom: "1px solid #FFFFFF" }}>
              <p className="text-xs font-bold">
                🔔 طلب جديد: {newOrderAlert.id} — {newOrderAlert.customerName} — {money(newOrderAlert.total || 0)}
              </p>
              <button onClick={() => { setNewOrderAlert(null); setAdminTab("orders"); }} className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0" style={{ background: "#FFFFFF", color: "#0A0A0A" }}>
                عرض الطلبات
              </button>
            </div>
          )}
          <AdminView 
            data={data} 
            adminTab={adminTab} 
            setAdminTab={setAdminTab} 
            pendingCount={pendingCount} 
            lowStockProducts={lowStockProducts} 
            outOfStockProducts={outOfStockProducts} 
            categoryName={categoryName} 
            onUpdateStock={updateStock} 
            onToggleRecommended={toggleRecommended} 
            onSaveProduct={saveProduct} 
            onDeleteProduct={deleteProduct} 
            onAddCategory={addCategory} 
            onDeleteCategory={deleteCategory} 
            onChangeOrderStatus={changeOrderStatus} 
            onUpdateSettings={updateSettings} 
            onExitToStore={() => setView("store")} 
            onLogout={handleAdminLogout} 
            isDark={isDark} 
            toggleTheme={toggleTheme} 
            onManualSave={() => {
              if (data && typeof window.cloudStore !== 'undefined' && window.cloudStore.set) {
                window.cloudStore.set(data);
                notify("✅ تم حفظ جميع البيانات يدوياً في Firebase");
              }
            }}
            onRefresh={refresh}
          />
        </>
      )}
      
      {view === "account" && (
        <CustomerAccountPage 
          customerUser={customerUser}
          isLoginMode={isLoginMode}
          setIsLoginMode={setIsLoginMode}
          customerEmail={customerEmail}
          setCustomerEmail={setCustomerEmail}
          customerPassword={customerPassword}
          setCustomerPassword={setCustomerPassword}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerAddress={customerAddress}
          setCustomerAddress={setCustomerAddress}
          isEditingCustomer={isEditingCustomer}
          setIsEditingCustomer={setIsEditingCustomer}
          customerError={customerError}
          setCustomerError={setCustomerError}
          onLogin={handleCustomerAuth}
          onLogout={handleCustomerLogout}
          onUpdateProfile={updateCustomerProfile}
          onClose={closeCustomerAccount}
          customerOrders={customerOrders}
          onCancelOrder={cancelOrder}
          isDark={isDark}
          customerCreatedAt={customerCreatedAt}
          onRefreshOrders={fetchCustomerOrders}
        />
      )}
      
      {showCart && (
        <CartDrawer 
          cartLines={cartLines} 
          cartTotal={cartTotal} 
          onChangeQty={changeQty} 
          onRemove={removeFromCart} 
          onClose={() => setShowCart(false)} 
          onCheckout={startCheckout} 
          isDark={isDark} 
        />
      )}
      
      {checkoutStage && (
        <CheckoutModal 
          stage={checkoutStage} 
          setStage={setCheckoutStage} 
          customer={customer} 
          setCustomer={setCustomer} 
          cartLines={cartLines} 
          cartTotal={cartTotal} 
          deliveryFee={deliveryFee} 
          grandTotal={grandTotal} 
          walletNumber={data.settings.walletNumber} 
          onGoPreview={goToPreview} 
          onConfirm={confirmOrder} 
          onClose={closeCheckout} 
          lastOrderId={lastOrderId} 
          emailSent={emailSent} 
          isDark={isDark}
          gpsDistanceKm={gpsDistanceKm}
          gpsLoading={gpsLoading}
          gpsError={gpsError}
          onRequestGps={requestGpsLocation}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          couponDiscount={couponDiscount}
          onApplyCoupon={applyCoupon}
        />
      )}
    </div>
  );
}

// ===== 11. StoreView =====
function OffersBanner({ coupons, categories, isDark }) {
  const active = (coupons || []).filter((c) => c && c.active !== false);
  if (!active.length) return null;
  const texts = active.map((c) => formatCouponBannerText(c, categories));
  const line = texts.join("   •   ");
  return (
    <div className="offers-banner overflow-hidden" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF", borderBottom: "1px solid " + (isDark ? "#E5E5E5" : "#333") }}>
      <div className="offers-banner-track py-1.5 text-[11px] sm:text-xs font-bold whitespace-nowrap">
        <span className="inline-block px-4">🎉 {line}</span>
        <span className="inline-block px-4" aria-hidden="true">🎉 {line}</span>
      </div>
    </div>
  );
}

function StoreView({ data, search, setSearch, activeCategory, setActiveCategory, filteredProducts, recommended, categoryName, cartCount, onOpenCart, onAddToCart, onOpenDetail, onGoAdmin, isDark, toggleTheme, authUser, isAdmin, onLogout, customerUser, onOpenCustomerAccount }) {
  const categoryScrollRef = useRef(null);
  
  return (
    <div className="pb-20">
      <OffersBanner coupons={data?.settings?.coupons} categories={data?.categories} isDark={isDark} />
      <header className="sticky top-0 z-20" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A", borderBottom: isDark ? "1px solid #E5E5E5" : "1px solid #0A0A0A" }}>
        <div className="max-w-5xl mx-auto px-2 sm:px-3 py-2 flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <img 
              src={LOGO_URL} 
              alt={STORE_NAME} 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover bg-white"
              style={{ border: isDark ? "2px solid #0A0A0A" : "2px solid #fff" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span className="hidden sm:inline text-base sm:text-lg font-extrabold tracking-tight" style={{ fontFamily: "Cairo, sans-serif", color: isDark ? "#0A0A0A" : "#FFFFFF" }}>
              {STORE_NAME}
            </span>
          </div>
          <div className="flex-1 relative min-w-0">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-2.5" color="#6B7280" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="دور على منتج..." 
              className="w-full rounded-full py-2 pr-9 pl-3 text-sm outline-none"
              style={{ background: isDark ? "#F5F5F5" : "#FFFFFF", color: "#0A0A0A", border: "1px solid #E5E5E5" }} 
            />
          </div>
          <button onClick={toggleTheme} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: isDark ? "#0A0A0A" : "#1A1A1A" }} title="الوضع">
            {isDark ? <Sun size={16} color="#fff" /> : <Moon size={16} color="#fff" />}
          </button>
          
          <button onClick={onOpenCustomerAccount} className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: isDark ? "#0A0A0A" : "#1A1A1A" }} title="حسابي">
            <User size={16} color="#fff" />
            {customerUser && <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full" style={{ background: "#FFFFFF", border: "2px solid #0A0A0A" }}></span>}
          </button>

          <button onClick={onOpenCart} className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: isDark ? "#0A0A0A" : "#1A1A1A" }} title="السلة">
            <ShoppingCart size={16} color="#fff" />
            {cartCount > 0 && <span className="absolute -top-0.5 -left-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: isDark ? "#0A0A0A" : "#FFFFFF", color: isDark ? "#fff" : "#0A0A0A", border: "1px solid #0A0A0A" }}>{cartCount}</span>}
          </button>
          
          {isAdmin && (
            <div className="hidden sm:flex items-center gap-1">
              <button onClick={onGoAdmin} className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: isDark ? "#0A0A0A" : "#FFFFFF", color: isDark ? "#fff" : "#0A0A0A" }}>
                الإدارة
              </button>
              <button onClick={onLogout} className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "#0A0A0A", color: "#fff", border: "1px solid #fff" }}>
                خروج
              </button>
            </div>
          )}
        </div>
        <div className="text-center pb-1.5 px-2">
          <p className="text-[10px] sm:text-xs font-medium" style={{ fontFamily: "Cairo, sans-serif", color: isDark ? "#0A0A0A" : "rgba(255,255,255,0.85)" }}>{STORE_TAGLINE}</p>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-3">
        {recommended.length > 0 && !search && activeCategory === "all" && (
          <section className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} color="#0A0A0A" fill="#0A0A0A" />
              <h2 className="font-bold text-sm" style={{ fontFamily: "Cairo, sans-serif" }}>منتجات مقترحة</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 shelf-scroll snap-x snap-mandatory">
              {recommended.map((p) => (
                <div key={p.id} className="shrink-0 w-36 snap-start">
                  <ProductCard product={p} categoryName={categoryName(p.categoryId)} onAdd={() => onAddToCart(p)} onOpenDetail={() => onOpenDetail(p.id)} compact isDark={isDark} />
                </div>
              ))}
            </div>
          </section>
        )}
        
        <section className="mt-4 relative">
          <div ref={categoryScrollRef} className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button onClick={() => setActiveCategory("all")} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition snap-start" style={activeCategory === "all" ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { background: isDark ? "#111111" : "#fff", color: isDark ? "#94A3B8" : "#3B5578", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
              الكل
            </button>
            {data.categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition snap-start" style={activeCategory === c.id ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { background: isDark ? "#111111" : "#fff", color: isDark ? "#94A3B8" : "#3B5578", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
                {c.name}
              </button>
            ))}
          </div>
        </section>
        
        <section className="mt-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12" style={{ color: "#8FA8C4" }}>
              <ImageOff size={28} className="mx-auto mb-2" />
              <p className="text-sm">مفيش منتجات مطابقة للبحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredProducts.map((p) => (
                <ProductCard key={p.id} product={p} categoryName={categoryName(p.categoryId)} onAdd={() => onAddToCart(p)} onOpenDetail={() => onOpenDetail(p.id)} isDark={isDark} />
              ))}
            </div>
          )}
        </section>
      </main>
      
      <footer className="max-w-5xl mx-auto px-4 mt-10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderTop: isDark ? "1px dashed #2A2A2A" : "1px dashed #E5E5E5" }}>
        <div className="text-center sm:text-right">
          <p className="text-[11px] font-bold mb-0.5" style={{ color: isDark ? "#F5F5F5" : "#0A0A0A", fontFamily: "Cairo, sans-serif" }}>{STORE_NAME}</p>
          <p className="text-[10px]" style={{ color: isDark ? "#94A3B8" : "#6B7280" }}>{STORE_TAGLINE}</p>
          <p className="text-[10px] mt-1" style={{ color: isDark ? "#94A3B8" : "#8FA8C4" }}>
            © خدمة توصيل لسكان مدينة الشروق — بواسطة{" "}
            <a 
              href="https://www.facebook.com/profile.php?id=61590223634140" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-bold hover:underline"
              style={{ color: isDark ? "#0A0A0A" : "#0A0A0A" }}
            >
              {TEAM_NAME}
            </a>
          </p>
        </div>
        <button 
          onClick={onGoAdmin} 
          className="text-[9px] flex items-center gap-0.5 opacity-50 hover:opacity-100 transition"
          style={{ color: isDark ? "#64748B" : "#8FA8C4" }}
          title="دخول الإدارة"
        >
          <Lock size={10} /> إدارة
        </button>
      </footer>
    </div>
  );
}

// ===== 12. ProductCard =====
function ProductCard({ product, categoryName, onAdd, onOpenDetail, compact, isDark }) {
  return (
    <div className="rounded-2xl p-2.5 flex flex-col gap-2 cursor-pointer transition hover:shadow-md fade-in-up" 
         style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }} 
         onClick={onOpenDetail} role="button">
      <BoxThumb product={product} isDark={isDark} />
      <div className="flex-1">
        <p className="text-[10px] mb-0.5" style={{ color: isDark ? "#94A3B8" : "#8FA8C4" }}>{categoryName}</p>
        <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: isDark ? "#F8FAFC" : "#16233A" }}>{product.name}</p>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="font-extrabold text-sm" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A", fontFamily: "Cairo, sans-serif" }}>{money(product.price)}</span>
      </div>
      <StockBadge stock={product.stock} />
      <button 
        onClick={(e) => { e.stopPropagation(); onAdd(); }} 
        disabled={product.stock <= 0} 
        className="w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
        style={product.stock > 0 ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { background: isDark ? "#2A2A2A" : "#EDF1F6", color: "#B4C0CE", cursor: "not-allowed" }}>
        <Plus size={12} /> أضف للسلة
      </button>
    </div>
  );
}

// ===== 13. ProductPage =====
function ProductPage({ product, categoryName, cartQty, onAdd, onBack, isDark, relatedProducts, onOpenDetail }) {
  return (
    <div className="min-h-screen" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
      <div className="max-w-2xl mx-auto px-3 py-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-3" style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>
          <ChevronRight size={16} /> رجوع للمتجر
        </button>
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: isDark ? "#111111" : "#fff" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="tag-badge text-[10px]" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A", background: isDark ? "#0A0A0A" : "#F5F5F5", borderColor: isDark ? "#2A2A2A" : "#E5E5E5" }}>
              {categoryName}
            </span>
            {product.recommended && (
              <span className="tag-badge text-[10px]" style={{ color: "#0A0A0A", background: "#F5F5F5", borderColor: "#E5E5E5" }}>
                مقترح
              </span>
            )}
          </div>
          
          <ImageGallery images={product.images} alt={product.name} isDark={isDark} />
          
          <h1 className="font-bold text-xl mt-4 mb-1" style={{ fontFamily: "Cairo, sans-serif", color: isDark ? "#FFF" : "#000" }}>
            {product.name}
          </h1>
          <p className="font-extrabold text-2xl mb-2" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A", fontFamily: "Cairo, sans-serif" }}>
            {money(product.price)}
          </p>
          
          <div className="mb-3"><StockBadge stock={product.stock} /></div>
          {product.description && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-1" style={{ color: isDark ? "#94A3B8" : "#3B5578" }}>تفاصيل المنتج</p>
              <p className="text-sm leading-relaxed" style={{ color: isDark ? "#CBD5E1" : "#5A6B84" }}>{product.description}</p>
            </div>
          )}
          
          {cartQty > 0 && <p className="text-xs mb-2" style={{ color: "#1F8A55" }}>✅ عندك {cartQty} في السلة بالفعل</p>}
          <button 
            onClick={onAdd} 
            disabled={product.stock <= 0} 
            className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
            style={product.stock > 0 ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { background: isDark ? "#2A2A2A" : "#EDF1F6", color: "#B4C0CE", cursor: "not-allowed" }}
          >
            <Plus size={16} /> أضف للسلة
          </button>
        </div>

        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-base mb-3" style={{ fontFamily: "Cairo, sans-serif", color: isDark ? "#FFF" : "#16233A" }}>
              🛍️ منتجات قد تعجبك
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {relatedProducts.map((p) => (
                <div 
                  key={p.id} 
                  className="rounded-xl p-2.5 cursor-pointer transition hover:shadow-md"
                  style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}
                  onClick={() => onOpenDetail(p.id)}
                >
                  <BoxThumb product={p} size="small" isDark={isDark} />
                  <p className="text-xs font-semibold mt-1.5 line-clamp-1" style={{ color: isDark ? "#FFF" : "#16233A" }}>{p.name}</p>
                  <p className="font-extrabold text-xs" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A" }}>{money(p.price)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 14. CartDrawer =====
function CartDrawer({ cartLines, cartTotal, onChangeQty, onRemove, onClose, onCheckout, isDark }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end" style={{ background: "rgba(15,25,40,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-sm h-full flex flex-col" onClick={(e) => e.stopPropagation()} dir="rtl" style={{ background: isDark ? "#111111" : "#fff" }}>
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
          <h3 className="font-bold text-base" style={{ fontFamily: "Cairo, sans-serif", color: isDark ? "#FFF" : "#000" }}>سلة المشتريات</h3>
          <button onClick={onClose} style={{ color: isDark ? "#FFF" : "#000" }}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {cartLines.length === 0 ? (
            <p className="text-center mt-8 text-sm" style={{ color: "#8FA8C4" }}>السلة فاضية دلوقتي</p>
          ) : (
            cartLines.map((line) => (
              <div key={line.productId} className="flex gap-2 items-center">
                <BoxThumb product={line.product} size="small" isDark={isDark} />
                <div className="flex-1">
                  <p className="text-sm font-semibold line-clamp-1" style={{ color: isDark ? "#FFF" : "#000" }}>{line.product.name}</p>
                  <p className="text-xs" style={{ color: "#8FA8C4" }}>{money(line.product.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onChangeQty(line.productId, -1)} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5", color: isDark ? "#FFF" : "#000" }}>
                    <Minus size={10} />
                  </button>
                  <span className="text-xs w-3 text-center" style={{ color: isDark ? "#FFF" : "#000" }}>{line.qty}</span>
                  <button onClick={() => onChangeQty(line.productId, 1)} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5", color: isDark ? "#FFF" : "#000" }}>
                    <Plus size={10} />
                  </button>
                </div>
                <button onClick={() => onRemove(line.productId)}><Trash2 size={14} color="#C0392B" /></button>
              </div>
            ))
          )}
        </div>
        {cartLines.length > 0 && (
          <div className="p-3" style={{ borderTop: isDark ? "1px dashed #2A2A2A" : "1px dashed #E5E5E5" }}>
            <div className="flex justify-between mb-2 text-sm">
              <span style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>الإجمالي</span>
              <span className="font-bold" style={{ color: isDark ? "#FFF" : "#000" }}>{money(cartTotal)}</span>
            </div>
            <button onClick={onCheckout} className="w-full py-2 rounded-xl font-bold text-sm text-white" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A" }}>
              متابعة الطلب
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 15. CheckoutModal =====
function CheckoutModal({ stage, setStage, customer, setCustomer, cartLines, cartTotal, deliveryFee, grandTotal, walletNumber, onGoPreview, onConfirm, onClose, lastOrderId, emailSent, isDark, gpsDistanceKm, gpsLoading, gpsError, onRequestGps, couponCode, setCouponCode, couponDiscount, onApplyCoupon }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3" style={{ background: "rgba(15,25,40,0.6)" }}>
      <div className="w-full max-w-md rounded-2xl max-h-[90vh] overflow-y-auto" dir="rtl" style={{ background: isDark ? "#111111" : "#fff", color: isDark ? "#FFF" : "#000" }}>
        {stage === "form" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base" style={{ fontFamily: "Cairo, sans-serif" }}>بيانات الاستلام</h3>
              <button onClick={onClose}><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-2.5">
              <Field label="الاسم بالكامل" value={customer.name} onChange={(v) => setCustomer({ ...customer, name: v })} isDark={isDark} />
              <Field label="رقم التليفون" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} type="tel" isDark={isDark} />
              <Field label="العنوان بالتفصيل" value={customer.address} onChange={(v) => setCustomer({ ...customer, address: v })} textarea isDark={isDark} />
              
              {/* تحديد الموقع GPS */}
              <div className="rounded-xl p-3" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
                <p className="text-xs font-bold mb-1.5 flex items-center gap-1"><Truck size={13} /> سعر التوصيل حسب المسافة</p>
                <p className="text-[10px] mb-2" style={{ color: "#8FA8C4" }}>
                  السعر الأدنى / سعر الكيلو حسب إعدادات الإدارة
                </p>
                <button type="button" onClick={onRequestGps} disabled={gpsLoading} className="w-full py-2 rounded-xl text-xs font-bold text-white mb-1.5" style={{ background: gpsLoading ? "#9CA3AF" : "#0A0A0A" }}>
                  {gpsLoading ? "جاري تحديد موقعك..." : "📍 تحديد موقعي وحساب التوصيل"}
                </button>
                {gpsDistanceKm != null && (
                  <p className="text-xs font-bold" style={{ color: "#1F8A55" }}>
                    المسافة ≈ {gpsDistanceKm.toFixed(1)} كم (تُحسب {roundDistanceKm(gpsDistanceKm)} كم) — التوصيل: {money(deliveryFee)}
                  </p>
                )}
                {gpsError && <p className="text-[10px]" style={{ color: "#C0392B" }}>{gpsError}</p>}
              </div>

              {/* كوبون خصم */}
              <div>
                <span className="block mb-0.5 font-medium text-xs" style={{ color: isDark ? "#94A3B8" : "#3B5578" }}>كود خصم (اختياري)</span>
                <div className="flex gap-1.5">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="مثال: ASRAR10" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} />
                  <button type="button" onClick={onApplyCoupon} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#0A0A0A" }}>تطبيق</button>
                </div>
                {couponDiscount > 0 && <p className="text-[10px] mt-1 font-bold" style={{ color: "#1F8A55" }}>خصم: −{money(couponDiscount)}</p>}
              </div>

              <div>
                <p className="text-sm font-semibold mb-1.5">طريقة الدفع</p>
                <div className="flex flex-col gap-1.5">
                  <PayOption icon={<Banknote size={14} />} label="كاش عند الاستلام" active={customer.payment === "cod"} onClick={() => setCustomer({ ...customer, payment: "cod" })} isDark={isDark} />
                  <PayOption icon={<Wallet size={14} />} label="InstaPay عند الاستلام" active={customer.payment === "instapay"} onClick={() => setCustomer({ ...customer, payment: "instapay" })} isDark={isDark} />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: "#8FA8C4" }}>
                  الدفع يتم مع المندوب عند التسليم — مفيش تحويل مسبق ولا كود استلام.
                </p>
              </div>
            </div>
            <button onClick={onGoPreview} className="w-full mt-4 py-2 rounded-xl font-bold text-sm text-white" style={{ background: "#0A0A0A" }}>
              معاينة الطلب
            </button>
          </div>
        )}
        {stage === "preview" && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setStage("form")}><ChevronRight size={18} /></button>
              <h3 className="font-bold text-base" style={{ fontFamily: "Cairo, sans-serif" }}>معاينة الطلب</h3>
            </div>
            <div className="flex flex-col gap-1.5 mb-2.5">
              {cartLines.map((l) => (
                <div key={l.productId} className="flex justify-between text-sm">
                  <span>{l.product.name} × {l.qty}</span>
                  <span>{money(l.product.price * l.qty)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 pt-2.5 text-sm" style={{ borderTop: isDark ? "1px dashed #2A2A2A" : "1px dashed #E5E5E5" }}>
              <div className="flex justify-between"><span style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>المنتجات</span><span>{money(cartTotal)}</span></div>
              <div className="flex justify-between"><span style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>التوصيل{gpsDistanceKm != null ? ` (${roundDistanceKm(gpsDistanceKm)} كم)` : ""}</span><span>{money(deliveryFee)}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between" style={{ color: "#1F8A55" }}><span>خصم</span><span>−{money(couponDiscount)}</span></div>}
              <div className="flex justify-between font-bold text-base mt-1">
                <span>الإجمالي</span>
                <span style={{ color: isDark ? "#0A0A0A" : "#0A0A0A" }}>{money(grandTotal)}</span>
              </div>
            </div>
            <div className="mt-3 text-xs rounded-xl p-3" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
              <p className="font-semibold mb-1">هيتم التوصيل لـ:</p>
              <p style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>{customer.name} — <PhoneText>{customer.phone}</PhoneText></p>
              <p style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>{customer.address}</p>
              <p style={{ color: isDark ? "#94A3B8" : "#5A6B84" }} className="mt-1">طريقة الدفع: {customer.payment === "cod" ? "كاش عند الاستلام" : "InstaPay عند الاستلام"}</p>
            </div>
            <button onClick={onConfirm} className="w-full mt-4 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2" style={{ background: "#1F8A55" }}>
              <Check size={16} /> تأكيد الطلب
            </button>
          </div>
        )}
        {stage === "done" && (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#E5F7ED" }}>
              <Check size={22} color="#1F8A55" />
            </div>
            <h3 className="font-bold text-lg mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>طلبك اتسجل بنجاح!</h3>
            <p className="text-xs mb-1" style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>رقم طلبك</p>
            <p className="font-extrabold text-xl mb-3" style={{ color: isDark ? "#0A0A0A" : "#0A0A0A", fontFamily: "Cairo, sans-serif" }}>{lastOrderId}</p>
            {emailSent && <p className="text-xs mb-2" style={{ color: "#1F8A55" }}>✅ تم إرسال تفاصيل الطلب لبريد الإدارة</p>}
            <p className="text-xs mb-4" style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>هيتم مراجعته وتأكيده. رسوم التوصيل: {money(deliveryFee)}.</p>
            <button onClick={onClose} className="w-full py-2 rounded-xl font-bold text-sm text-white" style={{ background: "#0A0A0A" }}>
              رجوع للمتجر
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 16. AdminLogin =====
function AdminLogin({ email, setEmail, password, setPassword, loginError, onLogin, onBack, isDark }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-3">
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
          <Lock size={18} color={isDark ? "#FFFFFF" : "#0A0A0A"} />
        </div>
        <h2 className="font-bold text-lg mb-0.5" style={{ fontFamily: "Cairo, sans-serif" }}>دخول لوحة الإدارة</h2>
        <p className="text-xs mb-3" style={{ color: "#8FA8C4" }}>الصفحة دي لمسئول أسرار ماركت بس</p>
        <form onSubmit={onLogin}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-1.5" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر" className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-1.5" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} required />
          {loginError && <p className="text-xs mb-1.5" style={{ color: "#C0392B" }}>{loginError}</p>}
          <button type="submit" className="w-full py-2 rounded-xl font-bold text-sm text-white mb-1.5" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A" }}>
            دخول
          </button>
        </form>
        <button onClick={onBack} className="w-full py-1.5 rounded-xl text-xs" style={{ color: "#8FA8C4" }}>رجوع للمتجر</button>
      </div>
    </div>
  );
}

// ===== 17. CustomerAccountPage (صفحة كاملة) =====
function CustomerAccountPage({ 
  customerUser, isLoginMode, setIsLoginMode, customerEmail, setCustomerEmail, 
  customerPassword, setCustomerPassword, customerName, setCustomerName, 
  customerPhone, setCustomerPhone, customerAddress, setCustomerAddress,
  isEditingCustomer, setIsEditingCustomer, customerError, setCustomerError,
  onLogin, onLogout, onUpdateProfile, onClose, customerOrders, onCancelOrder, isDark, customerCreatedAt,
  onRefreshOrders
}) {
  return (
    <div className="min-h-[85vh] pb-10" dir="rtl">
      <div className="sticky top-0 z-20 px-3 py-2.5 flex items-center justify-between" style={{ background: isDark ? "#111111" : "#0A0A0A" }}>
        <button onClick={onClose} className="flex items-center gap-1 text-white text-xs font-bold">
          <ChevronRight size={16} /> رجوع للمتجر
        </button>
        <h2 className="font-extrabold text-white text-base" style={{ fontFamily: "Cairo, sans-serif" }}>حسابي</h2>
        <div className="w-16" />
      </div>

      <div className="max-w-lg mx-auto px-3 pt-4">
        {!customerUser ? (
          <div className="rounded-2xl p-5" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
            <h3 className="font-bold text-xl mb-3 text-center" style={{ fontFamily: "Cairo, sans-serif" }}>
              {isLoginMode ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </h3>

            <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
              <button onClick={() => setIsLoginMode(true)} className="flex-1 py-2 rounded-lg text-xs font-bold" style={isLoginMode ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { color: "#8FA8C4" }}>
                دخول
              </button>
              <button onClick={() => setIsLoginMode(false)} className="flex-1 py-2 rounded-lg text-xs font-bold" style={!isLoginMode ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { color: "#8FA8C4" }}>
                حساب جديد
              </button>
            </div>

            <form onSubmit={onLogin} className="flex flex-col gap-2.5">
              {!isLoginMode && (
                <Field label="الاسم بالكامل" value={customerName} onChange={setCustomerName} isDark={isDark} />
              )}
              <Field label="البريد الإلكتروني" type="email" value={customerEmail} onChange={setCustomerEmail} isDark={isDark} />
              <Field label="كلمة السر" type="password" value={customerPassword} onChange={setCustomerPassword} isDark={isDark} />
              {!isLoginMode && (
                <>
                  <Field label="رقم التليفون" type="tel" value={customerPhone} onChange={setCustomerPhone} isDark={isDark} />
                  <Field label="العنوان" value={customerAddress} onChange={setCustomerAddress} isDark={isDark} />
                </>
              )}
              
              {customerError && <p className="text-xs" style={{ color: "#C0392B" }}>{customerError}</p>}
              
              <button type="submit" className="w-full py-2.5 rounded-xl font-bold text-sm text-white mt-1" style={{ background: isDark ? "#0A0A0A" : "#0A0A0A" }}>
                {isLoginMode ? "دخول" : "إنشاء الحساب"}
              </button>
              {isLoginMode && (
                <button type="button" onClick={async () => {
                  if (!customerEmail.trim()) { setCustomerError("اكتب الإيميل الأول عشان نبعت لينك استعادة"); return; }
                  try {
                    await window.auth.sendPasswordResetEmail(customerEmail.trim());
                    setCustomerError("");
                    alert("✅ تم إرسال لينك إعادة تعيين كلمة السر على إيميلك");
                  } catch (err) {
                    setCustomerError(err.message || "فشل إرسال لينك الاستعادة");
                  }
                }} className="text-xs text-center mt-1 font-medium" style={{ color: isDark ? "#0A0A0A" : "#0A0A0A" }}>
                  نسيت كلمة السر؟
                </button>
              )}
            </form>
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-4 mb-4" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: isDark ? "#2A2A2A" : "#0A0A0A" }}>
                    <User size={20} color="#fff" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{customerName || "عميل"}</p>
                    <p className="text-[11px]" style={{ color: "#8FA8C4" }}>{customerUser.email}</p>
                  </div>
                </div>
                <button onClick={onLogout} className="text-[11px] flex items-center gap-0.5 px-2.5 py-1.5 rounded-full font-bold" style={{ background: "#FCEAE8", color: "#C0392B" }}>
                  <LogOut size={12} /> خروج
                </button>
              </div>

              <div className="text-xs space-y-1 mb-3" style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>
                <p>📱 {customerPhone ? <PhoneText>{customerPhone}</PhoneText> : "لم يُضف رقم"}</p>
                <p>📍 {customerAddress || "لم يُضف عنوان"}</p>
                {customerCreatedAt && (
                  <p>🗓️ عضو منذ: {new Date(customerCreatedAt).toLocaleDateString("ar-EG")}</p>
                )}
              </div>
              
              {!isEditingCustomer ? (
                <button onClick={() => setIsEditingCustomer(true)} className="w-full text-xs font-semibold py-2 rounded-xl" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5", color: isDark ? "#FFFFFF" : "#0A0A0A" }}>
                  ✏️ تعديل بياناتي (الاسم / التليفون / العنوان)
                </button>
              ) : (
                <div className="flex flex-col gap-2 mt-1">
                  <Field label="الاسم" value={customerName} onChange={setCustomerName} isDark={isDark} />
                  <Field label="رقم التليفون" type="tel" value={customerPhone} onChange={setCustomerPhone} isDark={isDark} />
                  <Field label="العنوان" value={customerAddress} onChange={setCustomerAddress} isDark={isDark} />
                  <div className="flex gap-1.5">
                    <button onClick={onUpdateProfile} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#1F8A55" }}>
                      حفظ التعديلات
                    </button>
                    <button onClick={() => setIsEditingCustomer(false)} className="px-4 py-2 rounded-xl text-xs" style={{ color: "#8FA8C4" }}>
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-base" style={{ fontFamily: "Cairo, sans-serif" }}>📦 طلباتي</h4>
              <button onClick={onRefreshOrders} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: isDark ? "#2A2A2A" : "#F5F5F5", color: isDark ? "#FFFFFF" : "#0A0A0A" }}>
                🔄 تحديث
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {customerOrders.length === 0 ? (
                <div className="rounded-xl p-6 text-center" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
                  <Package size={32} color="#8FA8C4" className="mx-auto mb-2" />
                  <p className="text-sm" style={{ color: "#8FA8C4" }}>لسه معملتش أي طلبات</p>
                  <button onClick={onClose} className="mt-3 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A" }}>
                    ابدأ التسوق
                  </button>
                </div>
              ) : (
                customerOrders.map((o) => {
                  const st = STATUS_MAP[o.status] || { label: o.status, color: "#8FA8C4", bg: "#F5F5F5" };
                  const canCancel = o.status === "pending" || o.status === "confirmed";
                  return (
                    <div key={o.id} className="rounded-xl p-3.5" style={{ background: isDark ? "#111111" : "#fff", border: "1px solid " + (o.status === "cancelled" ? "#C0392B" : (isDark ? "#2A2A2A" : "#E2ECF6")) }}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-sm">{o.id}</span>
                        <span className="tag-badge text-[10px]" style={{ color: st.color, background: st.bg, borderColor: st.color + "33" }}>{st.label}</span>
                      </div>
                      <p className="text-[11px] mb-1" style={{ color: "#8FA8C4" }}>{new Date(o.createdAt).toLocaleString("ar-EG")}</p>
                      <div className="text-xs mb-1.5 space-y-0.5">
                        {(o.items || []).map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.name} × {it.qty}</span>
                            <span>{money(it.price * it.qty)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-1.5" style={{ borderTop: isDark ? "1px dashed #2A2A2A" : "1px dashed #E2ECF6" }}>
                        <span className="text-xs" style={{ color: "#8FA8C4" }}>التوصيل: {money(o.deliveryFee || 0)}</span>
                        <p className="font-bold text-sm" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A" }}>الإجمالي: {money(o.total)}</p>
                      </div>
                      {(o.address || o.phone) && (
                        <p className="text-[10px] mt-1.5" style={{ color: "#8FA8C4" }}>📍 {o.address} · 📞 <PhoneText>{o.phone}</PhoneText></p>
                      )}
                      {o.mapsLink && (
                        <a href={o.mapsLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[10px] font-bold underline" style={{ color: isDark ? "#fff" : "#0A0A0A" }}>
                          🗺️ موقع التوصيل على الخريطة
                        </a>
                      )}
                      
                      {canCancel && (
                        <button onClick={() => onCancelOrder(o.id)} className="mt-2 w-full text-[11px] font-bold py-1.5 rounded-lg" style={{ background: "#FCEAE8", color: "#C0392B" }}>
                          🚫 إلغاء الطلب (متاح فقط أثناء قيد المراجعة أو مؤكد)
                        </button>
                      )}
                      {!canCancel && o.status !== "cancelled" && (
                        <p className="mt-2 text-[10px] text-center" style={{ color: "#8FA8C4" }}>
                          لا يمكن التعديل بعد تأكيد الشحن / التسليم
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== 18. AdminView =====
function AdminView(props) {
  const { adminTab, setAdminTab, onExitToStore, onLogout, isDark, toggleTheme, onManualSave, onRefresh } = props;
  const tabs = [
    { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
    { id: "products", label: "المنتجات", icon: Boxes },
    { id: "categories", label: "الكاتيجوريز", icon: Tag },
    { id: "orders", label: "الطلبات", icon: ClipboardList },
    { id: "reports", label: "التقارير", icon: BarChart },
    { id: "settings", label: "الإعدادات", icon: SettingsIcon },
  ];
  
  return (
    <div className="flex flex-col sm:flex-row min-h-[85vh]">
      <aside className="hidden sm:flex sm:w-48 shrink-0 p-3 flex-col gap-1" style={{ background: isDark ? "#111111" : "#fff", borderLeft: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <div className="px-2 py-2 mb-1 flex items-center gap-1.5">
          <Package size={18} color={isDark ? "#FFFFFF" : "#0A0A0A"} />
          <span className="font-extrabold text-sm" style={{ fontFamily: "Cairo, sans-serif" }}>إدارة أسرار ماركت</span>
        </div>
        <p className="text-[9px] px-2 mb-1 font-bold" style={{ color: isDark ? "#94A3B8" : "#8FA8C4" }}>بواسطة: {TEAM_NAME}</p>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setAdminTab(t.id)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-right" style={adminTab === t.id ? { background: isDark ? "#0A0A0A" : "#F5F5F5", color: isDark ? "#FFFFFF" : "#0A0A0A" } : { color: isDark ? "#94A3B8" : "#5A6B84" }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={toggleTheme} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ color: isDark ? "#FACC15" : "#3B5578" }}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />} {isDark ? "فاتح" : "داكن"}
        </button>
        <button onClick={onManualSave} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ color: "#1F8A55" }}>
          <Save size={14} /> حفظ يدوي
        </button>
        <button onClick={onRefresh} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ color: "#FFFFFF" }}>
          🔄 تحديث
        </button>
        <button onClick={onExitToStore} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>
          <ChevronLeft size={14} /> رجوع للمتجر
        </button>
        <button onClick={onLogout} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ color: "#C0392B" }}>
          <LogOut size={14} /> خروج
        </button>
      </aside>
      
      <div className="flex-1 p-3 sm:p-5 overflow-y-auto">
        <div className="sm:hidden flex gap-1.5 overflow-x-auto pb-2 mb-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setAdminTab(t.id)} className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1" style={adminTab === t.id ? { background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" } : { background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6", color: isDark ? "#94A3B8" : "#5A6B84" }}>
              <t.icon size={11} /> {t.label}
            </button>
          ))}
          <button onClick={onManualSave} className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ background: "#1F8A55", color: "#fff" }}>
            <Save size={11} /> حفظ
          </button>
          <button onClick={onRefresh} className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ background: "#FFFFFF", color: "#fff" }}>
            🔄 تحديث
          </button>
        </div>
        
        {adminTab === "dashboard" && <DashboardTab {...props} />}
        {adminTab === "products" && <ProductsTab {...props} />}
        {adminTab === "categories" && <CategoriesTab {...props} />}
        {adminTab === "orders" && <OrdersTab {...props} />}
        {adminTab === "reports" && <ReportsTab {...props} />}
        {adminTab === "settings" && <SettingsTab {...props} />}
      </div>
    </div>
  );
}

// ===== 19. StatCard =====
function StatCard({ label, value, color, isDark }) {
  return (
    <div className="rounded-xl p-3 flex-1" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
      <p className="text-[10px] mb-0.5" style={{ color: "#8FA8C4" }}>{label}</p>
      <p className="text-xl font-extrabold" style={{ color, fontFamily: "Cairo, sans-serif" }}>{value}</p>
    </div>
  );
}

// ===== 20. DashboardTab =====
function DashboardTab({ data, pendingCount, lowStockProducts, outOfStockProducts, isDark }) {
  return (
    <div>
      <h2 className="font-bold text-lg mb-3" style={{ fontFamily: "Cairo, sans-serif" }}>نظرة عامة</h2>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <StatCard label="طلبات قيد المراجعة" value={pendingCount} color="#B7791F" isDark={isDark} />
        <StatCard label="عدد المنتجات" value={data.products.length} color={isDark ? "#FFFFFF" : "#0A0A0A"} isDark={isDark} />
        <StatCard label="كمية قربت تخلص" value={lowStockProducts.length} color="#C0392B" isDark={isDark} />
      </div>
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="rounded-xl p-3" style={{ background: isDark ? "#2A2A2A" : "#FEF3E2", border: "1px solid #F5DBAA" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={14} color="#B7791F" />
            <p className="font-bold text-sm">تنبيهات المخزون</p>
          </div>
          <ul className="text-xs flex flex-col gap-0.5" style={{ color: isDark ? "#F1F5F9" : "#7A5A1E" }}>
            {outOfStockProducts.map((p) => <li key={p.id}>• {p.name} — خلصت خالص</li>)}
            {lowStockProducts.map((p) => <li key={p.id}>• {p.name} — باقي {p.stock} بس</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== 21. ReportsTab =====
function ReportsTab({ data, isDark }) {
  const totalOrders = data.orders.length;
  const totalRevenue = data.orders.reduce((sum, o) => sum + o.total, 0);
  const completedOrders = data.orders.filter(o => o.status === "delivered").length;
  const pendingOrders = data.orders.filter(o => o.status === "pending").length;
  
  const productSales = {};
  data.orders.forEach(order => {
    order.items.forEach(item => {
      if (productSales[item.name]) {
        productSales[item.name] += item.qty;
      } else {
        productSales[item.name] = item.qty;
      }
    });
  });
  
  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  return (
    <div>
      <h2 className="font-bold text-lg mb-3" style={{ fontFamily: "Cairo, sans-serif" }}>📊 تقرير المبيعات</h2>
      
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard label="إجمالي الطلبات" value={totalOrders} color={isDark ? "#FFFFFF" : "#0A0A0A"} isDark={isDark} />
        <StatCard label="الإيرادات" value={money(totalRevenue)} color="#1F8A55" isDark={isDark} />
        <StatCard label="طلبات مكتملة" value={completedOrders} color="#1F8A55" isDark={isDark} />
        <StatCard label="طلبات معلقة" value={pendingOrders} color="#B7791F" isDark={isDark} />
      </div>
      
      <div className="rounded-xl p-3 mb-3" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <h3 className="font-bold text-base mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>🏆 المنتجات الأكثر مبيعاً</h3>
        {topProducts.length === 0 ? (
          <p className="text-xs" style={{ color: "#8FA8C4" }}>لا توجد مبيعات حتى الآن</p>
        ) : (
          <div className="space-y-1.5">
            {topProducts.map(([name, qty], index) => (
              <div key={name} className="flex items-center gap-2.5 p-1.5 rounded-lg text-xs" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
                <span className="font-bold text-sm" style={{ color: index === 0 ? "#D97706" : "#8FA8C4" }}>
                  #{index + 1}
                </span>
                <span className="flex-1 font-medium">{name}</span>
                <span className="font-bold" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A" }}>{qty} وحدة</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="rounded-xl p-3" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <h3 className="font-bold text-base mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>📋 آخر الطلبات</h3>
        {data.orders.length === 0 ? (
          <p className="text-xs" style={{ color: "#8FA8C4" }}>لا توجد طلبات</p>
        ) : (
          <div className="space-y-1.5">
            {data.orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between items-center p-1.5 rounded-lg text-xs" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
                <div>
                  <p className="font-semibold text-xs">{order.id}</p>
                  <p className="text-[10px]" style={{ color: "#8FA8C4" }}>{order.customerName}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-xs" style={{ color: isDark ? "#FFFFFF" : "#0A0A0A" }}>{money(order.total)}</p>
                  <p className="text-[10px]" style={{ color: STATUS_MAP[order.status]?.color || "#8FA8C4" }}>
                    {STATUS_MAP[order.status]?.label || order.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 22. ProductsTab =====
function ProductsTab({ data, categoryName, onUpdateStock, onToggleRecommended, onSaveProduct, onDeleteProduct, isDark }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState(false);
  const [imageInput, setImageInput] = useState("");

  const startEdit = (p) => { setEditingId(p.id); setDraft({ ...p }); setImageInput(""); };
  const startAdd = () => {
    setAdding(true);
    setDraft({ 
      id: "p" + Date.now(), 
      name: "", 
      description: "", 
      price: 0, 
      stock: 0, 
      categoryId: data.categories[0]?.id || "", 
      recommended: false, 
      images: [],
      rating: 0, 
      reviews: [] 
    });
    setImageInput("");
  };
  const cancelEdit = () => { setEditingId(null); setAdding(false); setDraft(null); setImageInput(""); };

  const addImage = () => {
    if (!imageInput.trim()) return;
    setDraft({ ...draft, images: [...(draft.images || []), imageInput.trim()] });
    setImageInput("");
  };

  const removeImage = (index) => {
    setDraft({ ...draft, images: draft.images.filter((_, i) => i !== index) });
  };

  const submit = () => {
    if (!draft.name.trim()) return;
    onSaveProduct({ 
      ...draft, 
      price: Number(draft.price) || 0, 
      stock: Math.max(0, Number(draft.stock) || 0),
      images: draft.images || []
    });
    cancelEdit();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg" style={{ fontFamily: "Cairo, sans-serif" }}>المنتجات</h2>
        <button onClick={startAdd} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A" }}>
          <Plus size={13} /> منتج جديد
        </button>
      </div>

      {(adding || editingId) && draft && (
        <div className="rounded-xl p-3 mb-3" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1.5px solid #FFFFFF" : "1.5px solid #0A0A0A" }}>
          <p className="font-bold mb-2 text-sm">{adding ? "إضافة منتج جديد" : "تعديل المنتج"}</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Field label="اسم المنتج" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} isDark={isDark} />
            <label className="text-xs">
              <span className="block mb-0.5 font-medium" style={{ color: isDark ? "#94A3B8" : "#3B5578" }}>الكاتيجوري</span>
              <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })} className="w-full rounded-lg px-3 py-1.5 text-sm outline-none" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
                {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Field label="السعر (جنيه)" type="number" value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} isDark={isDark} />
            <Field label="الكمية بالمخزن" type="number" value={draft.stock} onChange={(v) => setDraft({ ...draft, stock: v })} isDark={isDark} />
            <div className="sm:col-span-2"><Field label="الوصف" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} textarea isDark={isDark} /></div>
            
            <div className="sm:col-span-2">
              <span className="block mb-0.5 font-medium text-xs" style={{ color: isDark ? "#94A3B8" : "#3B5578" }}>
                🖼️ صور المنتج (رابط URL لكل صورة)
              </span>
              <div className="flex items-center gap-2">
                <input 
                  type="url" 
                  value={imageInput} 
                  onChange={(e) => setImageInput(e.target.value)} 
                  placeholder="https://picsum.photos/seed/name/300/300"
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}
                />
                <button onClick={addImage} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A" }}>
                  إضافة
                </button>
              </div>
              
              {draft.images && draft.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {draft.images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: isDark ? "#2A2A2A" : "#E5E5E5" }}>
                      <img src={img} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeImage(idx)} 
                        className="absolute top-0 right-0 w-4 h-4 rounded-full flex items-center justify-center text-white"
                        style={{ background: "#C0392B", fontSize: "8px" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-xs sm:col-span-2">
              <input type="checkbox" checked={draft.recommended} onChange={(e) => setDraft({ ...draft, recommended: e.target.checked })} />
              منتج مقترح (يظهر في أعلى الصفحة الرئيسية)
            </label>
          </div>
          <div className="flex gap-1.5 mt-3">
            <button onClick={submit} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1" style={{ background: "#1F8A55" }}>
              <Save size={12} /> حفظ
            </button>
            <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "#8FA8C4" }}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {data.products.map((p) => (
          <div key={p.id} className="rounded-xl p-2.5 flex flex-wrap items-center gap-2" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
            <BoxThumb product={p} size="small" isDark={isDark} />
            <div className="flex-1 min-w-[100px]">
              <p className="font-semibold text-xs">{p.name}</p>
              <p className="text-[10px]" style={{ color: "#8FA8C4" }}>{categoryName(p.categoryId)} · {money(p.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: isDark ? "#94A3B8" : "#5A6B84" }}>الكمية</span>
              <input type="number" defaultValue={p.stock} key={p.stock} onBlur={(e) => onUpdateStock(p.id, e.target.value)} className="w-14 rounded-lg px-1.5 py-0.5 text-xs outline-none text-center" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} />
            </div>
            <button onClick={() => onToggleRecommended(p.id)} title="مقترح" className="w-6 h-6 rounded-lg flex items-center justify-center" style={p.recommended ? { background: "#FEF3E2" } : { background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
              <Star size={12} color={p.recommended ? "#D97706" : "#B4C0CE"} fill={p.recommended ? "#D97706" : "none"} />
            </button>
            <button onClick={() => startEdit(p)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
              <Pencil size={12} color={isDark ? "#FFFFFF" : "#3B5578"} />
            </button>
            <button onClick={() => { if (confirm(`متأكد إنك عايز تمسح "${p.name}"؟`)) onDeleteProduct(p.id); }} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#FCEAE8" }}>
              <Trash2 size={12} color="#C0392B" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 23. CategoriesTab =====
function CategoriesTab({ data, onAddCategory, onDeleteCategory, isDark }) {
  const [name, setName] = useState("");
  return (
    <div>
      <h2 className="font-bold text-lg mb-3" style={{ fontFamily: "Cairo, sans-serif" }}>الكاتيجوريز</h2>
      <div className="flex gap-1.5 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم كاتيجوري جديدة" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none" style={{ background: isDark ? "#111111" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} />
        <button onClick={() => { onAddCategory(name); setName(""); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: isDark ? "#FFFFFF" : "#0A0A0A" }}>
          إضافة
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {data.categories.map((c) => (
          <div key={c.id} className="rounded-xl p-2.5 flex items-center justify-between" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
            <span className="text-xs font-medium">{c.name}</span>
            <button onClick={() => onDeleteCategory(c.id)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#FCEAE8" }}>
              <Trash2 size={12} color="#C0392B" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 24. طباعة فاتورة =====
function printOrderInvoice(order, settings) {
  const storePhone = (settings && (settings.storePhone || settings.walletNumber)) || "";
  const itemsHtml = (order.items || []).map((it) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${it.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${Number(it.price).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">${(it.price * it.qty).toFixed(2)} ج</td>
    </tr>
  `).join("");
  const subtotal = (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>فاتورة ${order.id}</title>
  <style>
    body{font-family:Tahoma,Arial,sans-serif;margin:0;padding:24px;color:#0A0A0A;background:#fff}
    .box{max-width:720px;margin:0 auto;border:2px solid #0A0A0A;padding:24px;border-radius:12px}
    h1{margin:0 0 4px;font-size:22px}
    .muted{color:#666;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
    th{background:#0A0A0A;color:#fff;padding:8px;text-align:right}
    .totals{margin-top:12px;font-size:14px}
    .totals div{display:flex;justify-content:space-between;padding:4px 0}
    .grand{font-weight:bold;font-size:18px;border-top:2px solid #0A0A0A;padding-top:8px;margin-top:8px}
    .actions{margin-top:20px;text-align:center}
    button{padding:10px 20px;margin:0 6px;border:none;border-radius:8px;cursor:pointer;font-weight:bold}
    .print{background:#0A0A0A;color:#fff}
    .close{background:#eee;color:#0A0A0A}
    @media print{.actions{display:none}.box{border:none}}
  </style></head><body>
  <div class="box">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <h1>${STORE_NAME}</h1>
        <p class="muted">${STORE_TAGLINE}</p>
        ${storePhone ? `<p class="muted">☎ ${storePhone}</p>` : ""}
      </div>
      <div style="text-align:left">
        <p style="font-weight:bold;font-size:16px;margin:0">فاتورة طلب</p>
        <p class="muted" style="margin:4px 0">رقم: <b>${order.id}</b></p>
        <p class="muted" style="margin:0">${new Date(order.createdAt).toLocaleString("ar-EG")}</p>
      </div>
    </div>
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0"/>
    <p style="margin:0 0 4px"><b>العميل:</b> ${order.customerName || ""}</p>
    <p style="margin:0 0 4px"><b>التليفون:</b> <span dir="ltr" style="unicode-bidi:isolate">${order.phone || ""}</span></p>
    <p style="margin:0 0 4px"><b>العنوان:</b> ${order.address || ""}</p>
    <p style="margin:0"><b>الدفع:</b> ${order.paymentMethod === "cod" ? "كاش عند الاستلام" : "InstaPay عند الاستلام"}</p>
    <table>
      <thead><tr><th>المنتج</th><th style="text-align:center">الكمية</th><th style="text-align:center">السعر</th><th style="text-align:left">الإجمالي</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div><span>مجموع المنتجات</span><span>${subtotal.toFixed(2)} ج</span></div>
      <div><span>التوصيل</span><span>${Number(order.deliveryFee || 0).toFixed(2)} ج</span></div>
      ${order.discount ? `<div><span>خصم</span><span>−${Number(order.discount).toFixed(2)} ج</span></div>` : ""}
      <div class="grand"><span>الإجمالي</span><span>${Number(order.total || 0).toFixed(2)} ج</span></div>
    </div>
    <p class="muted" style="margin-top:20px;text-align:center">شكرًا لتعاملكم مع ${STORE_NAME}</p>
    <div class="actions">
      <button class="print" onclick="window.print()">🖨️ طباعة</button>
      <button class="close" onclick="window.close()">إغلاق</button>
    </div>
  </div>
  </body></html>`;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    alert("المتصفح منع النافذة — اسمح بالـ Pop-ups عشان تطبع الفاتورة");
    return;
  }
  w.document.write(html);
  w.document.close();
}

// ===== 24b. OrdersTab =====
function OrdersTab({ data, onChangeOrderStatus, isDark }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div>
      <h2 className="font-bold text-lg mb-3" style={{ fontFamily: "Cairo, sans-serif" }}>الطلبات</h2>
      {data.orders.length === 0 ? (
        <p className="text-xs" style={{ color: "#8FA8C4" }}>لسه مفيش طلبات</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data.orders.map((o) => {
            const st = STATUS_MAP[o.status];
            const open = openId === o.id;
            return (
              <div key={o.id} className="rounded-xl overflow-hidden" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
                <button onClick={() => setOpenId(open ? null : o.id)} className="w-full flex items-center justify-between p-2.5">
                  <div className="text-right">
                    <p className="font-semibold text-xs" style={{ color: isDark ? "#FFF" : "#000" }}>{o.id} — {o.customerName}</p>
                    <p className="text-[10px]" style={{ color: "#8FA8C4" }}>{new Date(o.createdAt).toLocaleString("ar-EG")}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="tag-badge text-[8px]" style={{ color: st.color, background: st.bg, borderColor: st.color + "33" }}>{st.label}</span>
                    <span className="font-bold text-xs" style={{ color: isDark ? "#FFF" : "#000" }}>{money(o.total)}</span>
                  </div>
                </button>
                {open && (
                  <div className="p-2.5 pt-0 text-xs">
                    <div className="rounded-lg p-2.5 mb-1.5" style={{ background: isDark ? "#111" : "#F5F5F5" }}>
                      <p>📞 <PhoneText>{o.phone}</PhoneText></p>
                      <p>📍 {o.address}</p>
                      {o.distanceKm != null && <p>📏 المسافة ≈ {o.distanceKm} كم</p>}
                      {o.mapsLink && (
                        <p className="mt-1">
                          <a href={o.mapsLink} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: isDark ? "#fff" : "#0A0A0A" }}>
                            🗺️ فتح موقع العميل على الخريطة
                          </a>
                        </p>
                      )}
                      {!o.mapsLink && <p className="text-[10px]" style={{ color: "#8FA8C4" }}>لم يُحدَّد موقع GPS مع الطلب</p>}
                      <p>💳 {o.paymentMethod === "cod" ? "الدفع عند الاستلام" : "InstaPay / محفظة"}</p>
                      {o.note && <p>📝 {o.note}</p>}
                    </div>
                    <div className="flex flex-col gap-0.5 mb-2">
                      {o.items.map((it) => (
                        <div key={it.productId} className="flex justify-between text-[10px]">
                          <span>{it.name} × {it.qty}</span>
                          <span>{money(it.price * it.qty)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[10px]" style={{ color: "#8FA8C4" }}>
                        <span>التوصيل</span>
                        <span>{money(o.deliveryFee)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => printOrderInvoice(o, data.settings)}
                      className="w-full mb-2 py-2 rounded-lg text-xs font-bold"
                      style={{ background: isDark ? "#FFFFFF" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#FFFFFF" }}
                    >
                      🖨️ طباعة / تحميل الفاتورة
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(STATUS_MAP).map((s) => (
                        <button key={s} onClick={() => onChangeOrderStatus(o.id, s)} className="px-2 py-0.5 rounded-lg text-[9px] font-medium" style={o.status === s ? { background: STATUS_MAP[s].color, color: "#fff" } : { background: isDark ? "#0A0A0A" : "#F5F5F5", color: isDark ? "#94A3B8" : "#5A6B84", border: "1px solid #E2ECF6" }}>
                          {STATUS_MAP[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== 25. SettingsTab =====
function SettingsTab({ data, onUpdateSettings, isDark }) {
  const cfg0 = getDeliveryConfig(data.settings);
  const [deliveryMinFee, setDeliveryMinFee] = useState(cfg0.minFee);
  const [deliveryPerKm, setDeliveryPerKm] = useState(cfg0.perKm);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(cfg0.radiusKm);
  const [walletNumber, setWalletNumber] = useState(data.settings.walletNumber);
  const [storePhone, setStorePhone] = useState(data.settings.storePhone || data.settings.walletNumber || "");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [coupons, setCoupons] = useState(data.settings.coupons || []);
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("fixed");
  const [newValue, setNewValue] = useState("");
  const [newCatIds, setNewCatIds] = useState([]);

  const savePricing = () => onUpdateSettings({
    deliveryMinFee: Number(deliveryMinFee) || DELIVERY_MIN_FEE,
    deliveryPerKm: Number(deliveryPerKm) || DELIVERY_PER_KM,
    deliveryRadiusKm: Number(deliveryRadiusKm) || DELIVERY_FREE_RADIUS_KM,
    deliveryFee: Number(deliveryMinFee) || DELIVERY_MIN_FEE, // توافق مع النسخ القديمة
    walletNumber,
    storePhone,
    coupons,
  });
  const changePassword = () => {
    if (curPass !== data.settings.adminPassword) { setPassMsg("الباسورد الحالي غلط"); return; }
    if (!newPass.trim() || newPass.length < 4) { setPassMsg("الباسورد الجديد لازم 4 حروف/أرقام على الأقل"); return; }
    onUpdateSettings({ adminPassword: newPass });
    setPassMsg("اتغير الباسورد بنجاح");
    setCurPass(""); setNewPass("");
  };
  const toggleNewCat = (id) => {
    setNewCatIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const addCoupon = () => {
    if (!newCode.trim() || !newValue) return;
    const next = [...coupons, {
      code: newCode.trim().toUpperCase(),
      type: newType,
      value: Number(newValue) || 0,
      active: true,
      categoryIds: [...newCatIds], // فاضي = على كل الأقسام
    }];
    setCoupons(next);
    onUpdateSettings({ coupons: next });
    setNewCode(""); setNewValue(""); setNewCatIds([]);
  };
  const removeCoupon = (code) => {
    const next = coupons.filter((c) => c.code !== code);
    setCoupons(next);
    onUpdateSettings({ coupons: next });
  };
  const catName = (id) => (data.categories.find((c) => c.id === id) || {}).name || id;

  return (
    <div className="max-w-md">
      <h2 className="font-bold text-lg mb-3" style={{ fontFamily: "Cairo, sans-serif" }}>الإعدادات</h2>
      <div className="rounded-xl p-3 mb-3" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <p className="font-bold text-xs mb-2 flex items-center gap-1"><Truck size={13} /> التوصيل والدفع</p>
        <p className="text-[10px] mb-2" style={{ color: "#8FA8C4" }}>
          لو المسافة ≤ الحد الأدنى بالكم → السعر الأدنى. لو أكتر → المسافة × سعر الكيلو.
        </p>
        <div className="flex flex-col gap-2">
          <Field label="السعر الأدنى للتوصيل (ج.م)" type="number" value={deliveryMinFee} onChange={setDeliveryMinFee} isDark={isDark} />
          <Field label="سعر كل كيلومتر (ج.م)" type="number" value={deliveryPerKm} onChange={setDeliveryPerKm} isDark={isDark} />
          <Field label="حد المسافة للسعر الأدنى (كم)" type="number" value={deliveryRadiusKm} onChange={setDeliveryRadiusKm} isDark={isDark} />
          <Field label="رقم InstaPay / المحفظة" type="tel" value={walletNumber} onChange={setWalletNumber} isDark={isDark} />
          <Field label="تليفون المحل (للفاتورة)" type="tel" value={storePhone} onChange={setStorePhone} isDark={isDark} />
          <button onClick={savePricing} className="self-start px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#0A0A0A" }}>
            حفظ
          </button>
        </div>
      </div>

      <div className="rounded-xl p-3 mb-3" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <p className="font-bold text-xs mb-2">🎟️ الكوبونات والعروض</p>
        <div className="flex flex-col gap-1.5 mb-2">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="كود الخصم (ASRAR10)" className="w-full rounded-lg px-3 py-1.5 text-sm outline-none" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} />
          <div className="flex gap-1.5">
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }}>
              <option value="fixed">مبلغ ثابت (جنيه)</option>
              <option value="percent">نسبة %</option>
            </select>
            <input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="القيمة" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none" style={{ background: isDark ? "#0A0A0A" : "#FFF", color: isDark ? "#FFF" : "#000", border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E5E5" }} />
          </div>
          <p className="text-[10px] font-medium" style={{ color: "#8FA8C4" }}>الأقسام (اختياري — لو فاضي ينطبق على الكل):</p>
          <div className="flex flex-wrap gap-1">
            {(data.categories || []).map((c) => (
              <button key={c.id} type="button" onClick={() => toggleNewCat(c.id)} className="px-2 py-1 rounded-full text-[10px] font-bold" style={newCatIds.includes(c.id) ? { background: "#0A0A0A", color: "#fff" } : { background: isDark ? "#0A0A0A" : "#F5F5F5", color: isDark ? "#94A3B8" : "#5A6B84", border: "1px solid #E5E5E5" }}>
                {c.name}
              </button>
            ))}
          </div>
          <button onClick={addCoupon} className="self-start px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#1F8A55" }}>إضافة كوبون</button>
        </div>
        <div className="flex flex-col gap-1">
          {(coupons || []).length === 0 && <p className="text-[10px]" style={{ color: "#8FA8C4" }}>مفيش كوبونات لسه</p>}
          {(coupons || []).map((c) => (
            <div key={c.code} className="flex flex-col gap-0.5 text-xs rounded-lg px-2 py-1.5" style={{ background: isDark ? "#0A0A0A" : "#F5F5F5" }}>
              <div className="flex items-center justify-between">
                <span className="font-bold">{c.code}</span>
                <span>{c.type === "percent" ? `${c.value}%` : money(c.value)}</span>
                <button onClick={() => removeCoupon(c.code)} className="text-[10px] font-bold" style={{ color: "#C0392B" }}>حذف</button>
              </div>
              <p className="text-[9px]" style={{ color: "#8FA8C4" }}>
                {(c.categoryIds && c.categoryIds.length) ? ("أقسام: " + c.categoryIds.map(catName).join("، ")) : "على كل الأقسام"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ background: isDark ? "#111111" : "#fff", border: isDark ? "1px solid #2A2A2A" : "1px solid #E2ECF6" }}>
        <p className="font-bold text-xs mb-2 flex items-center gap-1"><Lock size={13} /> تغيير باسورد الدخول</p>
        <div className="flex flex-col gap-2">
          <Field label="الباسورد الحالي" type="password" value={curPass} onChange={setCurPass} isDark={isDark} />
          <Field label="الباسورد الجديد" type="password" value={newPass} onChange={setNewPass} isDark={isDark} />
          {passMsg && <p className="text-[10px]" style={{ color: passMsg.includes("بنجاح") ? "#1F8A55" : "#C0392B" }}>{passMsg}</p>}
          <button onClick={changePassword} className="self-start px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#0A0A0A" }}>
            تغيير الباسورد
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 26. التشغيل =====
if (document.getElementById("root")) {
  ReactDOM.render(<KartonaApp />, document.getElementById("root"));
}