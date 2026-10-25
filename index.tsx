import {
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  Alert as RNAlert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

// react-native-web la Alert.alert edhuvum kaatadhu, so web ku window.alert use pannrom
const Alert = {
  alert: (title: string, message?: string) => {
    if (Platform.OS === 'web') {
      window.alert(message ? `${title}\n\n${message}` : title);
    } else {
      RNAlert.alert(title, message);
    }
  },
};

type Product = {
  id: string;
  name: string;
  type: string;
  price: number;
  emoji: string;
  color: string;
  description: string;
  image?: string;
  wholesalePrice?: number;
};

type Profile = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
};

const emptyProfile: Profile = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  pincode: '',
};

const profileFields = [
  { key: 'name', label: 'Full Name', placeholder: 'Your full name', keyboard: 'default', multiline: false },
  { key: 'phone', label: 'Phone Number', placeholder: '10-digit mobile number', keyboard: 'phone-pad', multiline: false },
  { key: 'email', label: 'Email', placeholder: 'you@example.com', keyboard: 'email-address', multiline: false },
  { key: 'address', label: 'Delivery Address', placeholder: 'House no, street, area', keyboard: 'default', multiline: true },
  { key: 'city', label: 'City', placeholder: 'City', keyboard: 'default', multiline: false },
  { key: 'pincode', label: 'Pincode', placeholder: '6-digit pincode', keyboard: 'number-pad', multiline: false },
] as const;

type ExtraPage =
  | 'none'
  | 'service'
  | 'dealer'
  | 'adminLogin'
  | 'admin';

const serviceTypes = ['Installation', 'Repair', 'Filter Change', 'Annual Service'];
const timeSlots = ['Morning (9-12)', 'Afternoon (12-4)', 'Evening (4-7)'];
const orderStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const serviceStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
const dealerStatuses = ['pending', 'approved', 'rejected'];

const formatDate = (value: any) =>
  value?.toDate ? value.toDate().toLocaleString() : 'Date unavailable';

const todayString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

type Theme = {
  bg: string;
  card: string;
  text: string;
  body: string;
  muted: string;
  border: string;
  chipBg: string;
  tint: string;
  primary: string;
  accent: string;
  hero: string;
  green: string;
  greenTint: string;
  red: string;
  redTint: string;
};

const lightTheme: Theme = {
  bg: '#F3F7FB',
  card: '#FFFFFF',
  text: '#0F2A43',
  body: '#475569',
  muted: '#64748B',
  border: '#E2EAF3',
  chipBg: '#E8EEF5',
  tint: '#EAF6FF',
  primary: '#0A5C8A',
  accent: '#0A5C8A',
  hero: '#0A5C8A',
  green: '#16834A',
  greenTint: '#DDF7E8',
  red: '#D14343',
  redTint: '#FDECEC',
};

const darkTheme: Theme = {
  bg: '#0B1620',
  card: '#13222F',
  text: '#E6EEF6',
  body: '#CBD5E1',
  muted: '#94A3B8',
  border: '#243447',
  chipBg: '#1E2D3D',
  tint: '#16384F',
  primary: '#0A5C8A',
  accent: '#5BC0F0',
  hero: '#0B3A57',
  green: '#4ADE80',
  greenTint: '#14382A',
  red: '#F87171',
  redTint: '#3A1D1F',
};

// Fade + slide-up animation used for pages and product cards
function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export default function HomeScreen() {
  // Theme (dark mode follows the phone setting, can be toggled in header)
  const systemScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(systemScheme === 'dark');
  const theme = darkMode ? darkTheme : lightTheme;
  const styles = useMemo(() => makeStyles(theme), [darkMode]);

  // Image zoom
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Referral
  const [myReferralCode, setMyReferralCode] = useState('');
  const [referredBy, setReferredBy] = useState<any>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralInput, setReferralInput] = useState('');
  const [referralBusy, setReferralBusy] = useState(false);
  const [adminReferrals, setAdminReferrals] = useState<any[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);
  const [cart, setCart] = useState<Product[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Extra pages: service booking, dealer, admin
  const [extraPage, setExtraPage] = useState<ExtraPage>('none');

  // Service booking
  const [serviceType, setServiceType] = useState('Repair');
  const [serviceModel, setServiceModel] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceSlot, setServiceSlot] = useState(timeSlots[0]);
  const [serviceIssue, setServiceIssue] = useState('');
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [myServices, setMyServices] = useState<any[]>([]);

  // Dealer
  const [dealer, setDealer] = useState<any>(null);
  const [dealerBusiness, setDealerBusiness] = useState('');
  const [dealerGst, setDealerGst] = useState('');
  const [dealerSaving, setDealerSaving] = useState(false);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminTab, setAdminTab] = useState<
    'orders' | 'services' | 'dealers' | 'products' | 'referrals'
  >('orders');
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminServices, setAdminServices] = useState<any[]>([]);
  const [adminDealers, setAdminDealers] = useState<any[]>([]);
  const [priceEdits, setPriceEdits] = useState<
    Record<string, { price: string; wholesale: string }>
  >({});

  const loadProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));

      const firebaseProducts: Product[] = snapshot.docs.map((document) => {
        const data = document.data();

        return {
          id: document.id,
          name: String(data.name ?? 'Unnamed Product'),
          type: String(data.type ?? data.category ?? 'Water Purifier'),
          price: Number(data.price ?? 0),
          emoji: String(data.emoji ?? '💧'),
          color: String(data.color ?? '#DDF3FF'),
          description: String(data.description ?? ''),
          image: String(data.image ?? ''),
          wholesalePrice: Number(data.wholesalePrice ?? 0),
        };
      });

      setProducts(firebaseProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
      Alert.alert('Error', 'Could not load products from Firebase.');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Load saved profile + dealer status in the background
  useEffect(() => {
    refreshCustomerData();
  }, []);

  // Search and category filtering
  const filteredProducts = products.filter((product) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      product.name.toLowerCase().includes(searchText) ||
      product.type.toLowerCase().includes(searchText);

    const matchesCategory =
      category === 'All' ||
      (category === 'RO Purifiers' &&
        product.type.toLowerCase().includes('ro')) ||
      (category === 'UV Purifiers' &&
        product.type.toLowerCase().includes('uv')) ||
      (category === 'Accessories' &&
        product.type.toLowerCase().includes('filter'));

    return matchesSearch && matchesCategory;
  });

  // Add product to cart
  const addToCart = (product: Product) => {
    setCart((currentCart) => [...currentCart, product]);
    setSelectedProduct(null);
    setShowCart(true);
  };

  // Remove product from cart
  const removeFromCart = (index: number) => {
    setCart((currentCart) =>
      currentCart.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  // Dealer wholesale pricing
  const dealerStatus: string = dealer?.status ?? 'none';
  const dealerApproved = dealerStatus === 'approved';
  const hasWholesale = (product: Product) =>
    dealerApproved && Number(product.wholesalePrice) > 0;
  const priceFor = (product: Product) =>
    hasWholesale(product) ? Number(product.wholesalePrice) : product.price;

  // Calculate cart total
  const total = cart.reduce((sum, product) => sum + priceFor(product), 0);

  // Get the signed-in user (sign in anonymously if needed)
  const getCurrentUser = async () => {
    let user = auth.currentUser;
    if (!user) {
      const credential = await signInAnonymously(auth);
      user = credential.user;
    }
    return user;
  };

  // Read the customer profile from Firestore: customers/{uid}
  const fetchProfile = async (uid: string): Promise<Profile> => {
    const snap = await getDoc(doc(db, 'customers', uid));
    if (!snap.exists()) {
      return emptyProfile;
    }
    const data = snap.data();
    return {
      name: String(data.name ?? ''),
      phone: String(data.phone ?? ''),
      email: String(data.email ?? ''),
      address: String(data.address ?? ''),
      city: String(data.city ?? ''),
      pincode: String(data.pincode ?? ''),
    };
  };

  // Returns an error message, or null if the profile is valid
  const validateProfile = (p: Profile): string | null => {
    if (!p.name.trim()) return 'Please enter your name.';
    if (!/^[6-9]\d{9}$/.test(p.phone.trim()))
      return 'Please enter a valid 10-digit mobile number.';
    if (!/^\S+@\S+\.\S+$/.test(p.email.trim()))
      return 'Please enter a valid email address.';
    if (!p.address.trim()) return 'Please enter your delivery address.';
    if (!p.city.trim()) return 'Please enter your city.';
    if (!/^\d{6}$/.test(p.pincode.trim()))
      return 'Please enter a valid 6-digit pincode.';
    return null;
  };

  const isProfileComplete = (p: Profile) => validateProfile(p) === null;

  const updateProfileField = (field: keyof Profile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  // Open the profile page
  const openProfile = async () => {
    try {
      setProfileLoading(true);
      const user = await getCurrentUser();
      setProfile(await fetchProfile(user.uid));
      loadReferralInfo(user.uid);
      setShowOrderHistory(false);
      setShowCart(false);
      setSelectedProduct(null);
      setCheckoutComplete(false);
      setExtraPage('none');
      setShowProfile(true);
    } catch (error) {
      console.error('Failed to open profile:', error);
      Alert.alert('Error', 'Could not load your profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Save the profile to Firestore
  const saveProfile = async () => {
    const problem = validateProfile(profile);
    if (problem) {
      Alert.alert('Check your details', problem);
      return;
    }

    try {
      setProfileSaving(true);
      const user = await getCurrentUser();

      await setDoc(
        doc(db, 'customers', user.uid),
        {
          name: profile.name.trim(),
          phone: profile.phone.trim(),
          email: profile.email.trim(),
          address: profile.address.trim(),
          city: profile.city.trim(),
          pincode: profile.pincode.trim(),
          userId: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert('Saved', 'Your profile has been saved.');
      setShowProfile(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert(
        'Not saved',
        'Could not save your profile. Please check Firebase rules and try again.'
      );
    } finally {
      setProfileSaving(false);
    }
  };

  // Save the order to Firestore before showing confirmation
  const handleCheckout = async () => {
    if (cart.length === 0 || savingOrder) {
      return;
    }

    try {
      setSavingOrder(true);

      const user = await getCurrentUser();

      // Delivery details must be saved before ordering
      const savedProfile = await fetchProfile(user.uid);
      if (!isProfileComplete(savedProfile)) {
        setProfile(savedProfile);
        Alert.alert(
          'Delivery details needed',
          'Please complete your profile and delivery address before checkout.'
        );
        setShowCart(false);
        setShowProfile(true);
        return;
      }

      const order = {
        userId: user.uid,
        customer: {
          name: savedProfile.name,
          phone: savedProfile.phone,
          email: savedProfile.email,
        },
        deliveryAddress: {
          address: savedProfile.address,
          city: savedProfile.city,
          pincode: savedProfile.pincode,
        },
        items: cart.map((product) => ({
          productId: product.id,
          name: product.name,
          price: priceFor(product),
        })),
        total,
        dealerOrder: dealerApproved,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'orders'), order);
      setShowCart(false);
      setCheckoutComplete(true);
    } catch (error) {
      console.error('Order save failed:', error);
      Alert.alert(
        'Order not saved',
        'We could not save your order. Please check your connection and Firebase rules, then try again.'
      );
    } finally {
      setSavingOrder(false);
    }
  };

  // Load orders of the current (anonymous) user
  const loadOrderHistory = async () => {
    try {
      setOrdersLoading(true);

      let user = auth.currentUser;

      if (!user) {
        const credential = await signInAnonymously(auth);
        user = credential.user;
      }

      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(ordersQuery);

      const history = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));

      setOrders(history);
      setShowOrderHistory(true);
      setShowCart(false);
      setSelectedProduct(null);
      setCheckoutComplete(false);
      setShowProfile(false);
      setExtraPage('none');
    } catch (error) {
      console.error('Failed to load order history:', error);
      Alert.alert(
        'Error',
        'Could not load your order history. Please try again.'
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  // Reload profile + dealer record for the current user
  const refreshCustomerData = async () => {
    try {
      const user = await getCurrentUser();
      setProfile(await fetchProfile(user.uid));
      setDealer(await fetchDealer(user.uid));
    } catch (error) {
      console.error('Failed to load customer data:', error);
    }
  };

  const fetchDealer = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'dealers', uid));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (error) {
      console.error('Failed to load dealer record:', error);
      return null;
    }
  };

  const resetPages = () => {
    setSelectedProduct(null);
    setShowCart(false);
    setCheckoutComplete(false);
    setShowOrderHistory(false);
    setShowProfile(false);
  };

  // ---------- REFERRAL ----------
  // Each user gets a short code (from their uid) stored in referralCodes/{code}
  const loadReferralInfo = async (uid: string) => {
    try {
      let code = '';
      for (const length of [6, 8, 10]) {
        const candidate = uid.slice(0, length).toUpperCase();
        const snap = await getDoc(doc(db, 'referralCodes', candidate));

        if (!snap.exists()) {
          await setDoc(doc(db, 'referralCodes', candidate), {
            uid,
            createdAt: serverTimestamp(),
          });
          code = candidate;
          break;
        }
        if (snap.data().uid === uid) {
          code = candidate;
          break;
        }
      }
      setMyReferralCode(code);

      const mine = await getDoc(doc(db, 'referrals', uid));
      setReferredBy(mine.exists() ? mine.data() : null);

      const countSnap = await getDocs(
        query(collection(db, 'referrals'), where('referrerUid', '==', uid))
      );
      setReferralCount(countSnap.size);
    } catch (error) {
      console.error('Failed to load referral info:', error);
    }
  };

  const applyReferral = async () => {
    const code = referralInput.trim().toUpperCase();
    if (code.length < 6) {
      Alert.alert('Check the code', "Enter your friend's referral code.");
      return;
    }

    try {
      setReferralBusy(true);
      const user = await getCurrentUser();

      if (referredBy) {
        Alert.alert('Already applied', 'You have already used a referral code.');
        return;
      }

      const codeSnap = await getDoc(doc(db, 'referralCodes', code));
      if (!codeSnap.exists()) {
        Alert.alert('Invalid code', 'This referral code was not found.');
        return;
      }

      const referrerUid = String(codeSnap.data().uid);
      if (referrerUid === user.uid) {
        Alert.alert('Not allowed', 'You cannot use your own referral code.');
        return;
      }

      await setDoc(doc(db, 'referrals', user.uid), {
        referredUserUid: user.uid,
        referrerUid,
        code,
        createdAt: serverTimestamp(),
      });

      setReferralInput('');
      await loadReferralInfo(user.uid);
      Alert.alert('Applied', 'Referral code applied successfully.');
    } catch (error) {
      console.error('Referral apply failed:', error);
      Alert.alert(
        'Not applied',
        'Could not apply the code. Please check Firebase rules and try again.'
      );
    } finally {
      setReferralBusy(false);
    }
  };

  // Share works on phone (share sheet) and on web (navigator.share / copy)
  const shareReferral = async () => {
    if (!myReferralCode) {
      return;
    }

    const message = `Join me on Califnco for water purifiers and service! Use my referral code ${myReferralCode} in your profile.`;

    try {
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;

        if (nav?.share) {
          await nav.share({ text: message });
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          Alert.alert('Copied', 'Referral message copied. Paste it to share.');
        } else {
          Alert.alert('Your referral code', message);
        }
        return;
      }

      await Share.share({ message });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return; // user closed the share sheet
      }
      console.error('Share failed:', error);
    }
  };

  // ---------- SERVICE BOOKING ----------
  const loadMyServices = async (uid: string) => {
    const snap = await getDocs(
      query(collection(db, 'serviceRequests'), where('userId', '==', uid))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
    list.sort(
      (a: any, b: any) =>
        (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
    setMyServices(list);
  };

  const openService = async () => {
    try {
      setServiceLoading(true);
      const user = await getCurrentUser();
      const savedProfile = await fetchProfile(user.uid);
      setProfile(savedProfile);

      if (!isProfileComplete(savedProfile)) {
        Alert.alert(
          'Profile needed',
          'Please complete your profile and address before booking a service.'
        );
        await openProfile();
        return;
      }

      await loadMyServices(user.uid);
      resetPages();
      setExtraPage('service');
    } catch (error) {
      console.error('Failed to open service booking:', error);
      Alert.alert('Error', 'Could not open service booking. Please try again.');
    } finally {
      setServiceLoading(false);
    }
  };

  const submitService = async () => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) ||
      isNaN(new Date(`${serviceDate}T00:00:00`).getTime())
    ) {
      Alert.alert('Check your details', 'Enter the date as YYYY-MM-DD.');
      return;
    }
    if (serviceDate < todayString()) {
      Alert.alert('Check your details', 'Please choose today or a future date.');
      return;
    }
    if (!serviceIssue.trim()) {
      Alert.alert('Check your details', 'Please describe the issue or request.');
      return;
    }

    try {
      setServiceSaving(true);
      const user = await getCurrentUser();
      const savedProfile = await fetchProfile(user.uid);

      if (!isProfileComplete(savedProfile)) {
        Alert.alert('Profile needed', 'Please complete your profile first.');
        await openProfile();
        return;
      }

      await addDoc(collection(db, 'serviceRequests'), {
        userId: user.uid,
        serviceType,
        productModel: serviceModel.trim(),
        preferredDate: serviceDate,
        timeSlot: serviceSlot,
        issue: serviceIssue.trim(),
        customer: {
          name: savedProfile.name,
          phone: savedProfile.phone,
          email: savedProfile.email,
        },
        deliveryAddress: {
          address: savedProfile.address,
          city: savedProfile.city,
          pincode: savedProfile.pincode,
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setServiceModel('');
      setServiceDate('');
      setServiceIssue('');
      await loadMyServices(user.uid);
      Alert.alert('Booked', 'Your service request has been submitted.');
    } catch (error) {
      console.error('Service booking failed:', error);
      Alert.alert(
        'Not saved',
        'Could not submit your request. Please check Firebase rules and try again.'
      );
    } finally {
      setServiceSaving(false);
    }
  };

  // ---------- DEALER ----------
  const openDealer = async () => {
    try {
      const user = await getCurrentUser();
      const savedProfile = await fetchProfile(user.uid);
      setProfile(savedProfile);
      setDealer(await fetchDealer(user.uid));
      resetPages();
      setExtraPage('dealer');
    } catch (error) {
      console.error('Failed to open dealer page:', error);
      Alert.alert('Error', 'Could not open the dealer page. Please try again.');
    }
  };

  const submitDealer = async () => {
    if (!dealerBusiness.trim()) {
      Alert.alert('Check your details', 'Please enter your business name.');
      return;
    }
    const gst = dealerGst.trim().toUpperCase();
    if (gst && !/^[0-9A-Z]{15}$/.test(gst)) {
      Alert.alert('Check your details', 'GST number must be 15 characters.');
      return;
    }

    try {
      setDealerSaving(true);
      const user = await getCurrentUser();
      const savedProfile = await fetchProfile(user.uid);

      if (!isProfileComplete(savedProfile)) {
        Alert.alert('Profile needed', 'Please complete your profile first.');
        await openProfile();
        return;
      }

      await setDoc(doc(db, 'dealers', user.uid), {
        userId: user.uid,
        businessName: dealerBusiness.trim(),
        gstNumber: gst,
        contactName: savedProfile.name,
        phone: savedProfile.phone,
        email: savedProfile.email,
        address: savedProfile.address,
        city: savedProfile.city,
        pincode: savedProfile.pincode,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setDealer(await fetchDealer(user.uid));
      Alert.alert('Submitted', 'Your dealer application is under review.');
    } catch (error) {
      console.error('Dealer application failed:', error);
      Alert.alert(
        'Not saved',
        'Could not submit your application. Please check Firebase rules and try again.'
      );
    } finally {
      setDealerSaving(false);
    }
  };

  // ---------- ADMIN ----------
  const loadAdminData = async () => {
    const [orderSnap, serviceSnap, dealerSnap, referralSnap] =
      await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'serviceRequests')),
        getDocs(collection(db, 'dealers')),
        getDocs(collection(db, 'referrals')).catch(() => null),
      ]);

    setAdminOrders(orderSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

    const services = serviceSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
    services.sort(
      (a: any, b: any) =>
        (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
    );
    setAdminServices(services);

    setAdminDealers(dealerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setAdminReferrals(
      referralSnap
        ? referralSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        : []
    );
  };

  const openAdmin = async () => {
    resetPages();
    if (isAdmin) {
      try {
        await loadAdminData();
      } catch (error) {
        console.error('Failed to load admin data:', error);
        Alert.alert('Error', 'Could not load admin data.');
      }
      setExtraPage('admin');
    } else {
      setExtraPage('adminLogin');
    }
  };

  const adminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword) {
      Alert.alert('Check your details', 'Enter admin email and password.');
      return;
    }

    try {
      setAdminBusy(true);
      const credential = await signInWithEmailAndPassword(
        auth,
        adminEmail.trim(),
        adminPassword
      );

      const adminDoc = await getDoc(doc(db, 'admins', credential.user.uid));
      if (!adminDoc.exists()) {
        await signOut(auth);
        Alert.alert('Access denied', 'This account is not an admin.');
        return;
      }

      setIsAdmin(true);
      setAdminPassword('');
      await loadAdminData();
      setExtraPage('admin');
    } catch (error) {
      console.error('Admin login failed:', error);
      Alert.alert('Login failed', 'Please check the email and password.');
    } finally {
      setAdminBusy(false);
    }
  };

  const adminLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
    setIsAdmin(false);
    setAdminOrders([]);
    setAdminServices([]);
    setAdminDealers([]);
    setAdminReferrals([]);
    setProfile(emptyProfile);
    setDealer(null);
    setExtraPage('none');
    refreshCustomerData();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      setAdminOrders((list) =>
        list.map((o) => (o.id === id ? { ...o, status } : o))
      );
    } catch (error) {
      console.error('Order status update failed:', error);
      Alert.alert('Error', 'Could not update the order status.');
    }
  };

  const updateServiceStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'serviceRequests', id), { status });
      setAdminServices((list) =>
        list.map((o) => (o.id === id ? { ...o, status } : o))
      );
    } catch (error) {
      console.error('Service status update failed:', error);
      Alert.alert('Error', 'Could not update the service status.');
    }
  };

  const updateDealerStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'dealers', id), { status });
      setAdminDealers((list) =>
        list.map((o) => (o.id === id ? { ...o, status } : o))
      );
    } catch (error) {
      console.error('Dealer status update failed:', error);
      Alert.alert('Error', 'Could not update the dealer status.');
    }
  };

  const setPriceEdit = (
    id: string,
    field: 'price' | 'wholesale',
    value: string,
    product: Product
  ) => {
    setPriceEdits((current) => ({
      ...current,
      [id]: {
        price: current[id]?.price ?? String(product.price),
        wholesale: current[id]?.wholesale ?? String(product.wholesalePrice ?? 0),
        [field]: value,
      },
    }));
  };

  const saveProductPrices = async (product: Product) => {
    const edit = priceEdits[product.id];
    if (!edit) {
      return;
    }
    const price = Number(edit.price);
    const wholesalePrice = Number(edit.wholesale || 0);

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(wholesalePrice) ||
      wholesalePrice < 0
    ) {
      Alert.alert('Check prices', 'Enter valid numbers for the prices.');
      return;
    }

    try {
      await updateDoc(doc(db, 'products', product.id), {
        price,
        wholesalePrice,
      });
      setProducts((list) =>
        list.map((p) =>
          p.id === product.id ? { ...p, price, wholesalePrice } : p
        )
      );
      Alert.alert('Saved', `${product.name} prices updated.`);
    } catch (error) {
      console.error('Price update failed:', error);
      Alert.alert('Error', 'Could not update prices. Check admin rules.');
    }
  };

  const renderChips = (
    options: string[],
    current: string,
    onSelect: (value: string) => void
  ) => (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, current === option && styles.chipActive]}
          onPress={() => onSelect(option)}
        >
          <Text
            style={[
              styles.chipText,
              current === option && styles.chipTextActive,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Return to home screen
  const openHome = () => {
    setSelectedProduct(null);
    setShowCart(false);
    setCheckoutComplete(false);
    setShowOrderHistory(false);
    setShowProfile(false);
    setExtraPage('none');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.brandRow} onPress={openHome}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>💧</Text>
            </View>

            <View>
              <Text style={styles.logo}>Califnco</Text>
              <Text style={styles.tagline}>Pure water. Better living.</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.themeButton}
              onPress={() => setDarkMode((current) => !current)}
            >
              <Text style={styles.themeButtonText}>
                {darkMode ? '☀️' : '🌙'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => {
                setSelectedProduct(null);
                setShowOrderHistory(false);
                setShowProfile(false);
                setExtraPage('none');
                setCheckoutComplete(false);
                setShowCart(true);
              }}
            >
              <Text style={styles.cartButtonText}>🛒 Cart</Text>

              {cart.length > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cart.length}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* HOME PAGE */}
        {!showOrderHistory &&
          !showProfile &&
          extraPage === 'none' &&
          !checkoutComplete &&
          !selectedProduct &&
          !showCart && (
            <>
              {/* HERO SECTION */}
              <View style={styles.hero}>
                <View style={styles.heroDecor1} />
                <View style={styles.heroDecor2} />

                <Text style={styles.heroEyebrow}>
                  PURE WATER FOR EVERY HOME
                </Text>

                <Text style={styles.heroTitle}>
                  Find the right purifier for your home.
                </Text>

                <Text style={styles.heroDescription}>
                  Explore water purifiers and replacement accessories.
                </Text>

                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search water purifiers..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>
              </View>

              {/* QUICK ACTIONS */}
              <View style={styles.quickCard}>
                {[
                  {
                    icon: '📦',
                    label: ordersLoading ? 'Loading' : 'Orders',
                    onPress: loadOrderHistory,
                  },
                  {
                    icon: '👤',
                    label: profileLoading ? 'Loading' : 'Profile',
                    onPress: openProfile,
                  },
                  {
                    icon: '🛠',
                    label: serviceLoading ? 'Loading' : 'Service',
                    onPress: openService,
                  },
                  {
                    icon: '🤝',
                    label: dealerApproved ? 'Dealer ✓' : 'Dealer',
                    onPress: openDealer,
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.icon}
                    style={styles.quickItem}
                    onPress={item.onPress}
                  >
                    <View style={styles.quickIcon}>
                      <Text style={styles.quickEmoji}>{item.icon}</Text>
                    </View>
                    <Text style={styles.quickLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* CATEGORIES */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shop by Category</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {[
                    { name: 'All', emoji: '🏠' },
                    { name: 'RO Purifiers', emoji: '💧' },
                    { name: 'UV Purifiers', emoji: '🚰' },
                    { name: 'Accessories', emoji: '🧰' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.name}
                      style={[
                        styles.categoryPill,
                        category === item.name && styles.categoryPillActive,
                      ]}
                      onPress={() => setCategory(item.name)}
                    >
                      <Text style={styles.categoryEmoji}>{item.emoji}</Text>

                      <Text
                        style={[
                          styles.categoryPillText,
                          category === item.name &&
                            styles.categoryPillTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* PRODUCTS */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Popular Products</Text>

                  <Text style={styles.productCount}>
                    {filteredProducts.length} products
                  </Text>
                </View>

                {productsLoading ? (
                  <Text style={styles.productType}>Loading products...</Text>
                ) : filteredProducts.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.productName}>No products found</Text>

                    <Text style={styles.productType}>
                      Try another search or category.
                    </Text>

                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => {
                        setSearch('');
                        setCategory('All');
                      }}
                    >
                      <Text style={styles.primaryButtonText}>
                        Show All Products
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.productGrid}>
                    {filteredProducts.map((product, index) => (
                      <FadeIn
                        key={product.id}
                        delay={Math.min(index, 8) * 70}
                        style={styles.gridCardWrap}
                      >
                        <TouchableOpacity
                          style={styles.gridCard}
                          activeOpacity={0.9}
                          onPress={() => setSelectedProduct(product)}
                        >
                          <View
                            style={[
                              styles.gridImage,
                              { backgroundColor: product.color },
                            ]}
                          >
                            {hasWholesale(product) ? (
                              <View
                                style={[
                                  styles.dealerBadge,
                                  styles.dealerBadgeFloat,
                                ]}
                              >
                                <Text style={styles.dealerBadgeText}>
                                  DEALER
                                </Text>
                              </View>
                            ) : null}

                            {product.image ? (
                              <Image
                                source={{ uri: product.image }}
                                style={styles.productPhoto}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text style={styles.productEmoji}>
                                {product.emoji}
                              </Text>
                            )}
                          </View>

                          <View style={styles.gridBody}>
                            <Text style={styles.gridName} numberOfLines={2}>
                              {product.name}
                            </Text>

                            <Text style={styles.gridType} numberOfLines={1}>
                              {product.type}
                            </Text>

                            <View style={styles.gridPriceRow}>
                              <Text style={styles.gridPrice}>
                                ₹{priceFor(product).toLocaleString('en-IN')}
                              </Text>

                              {hasWholesale(product) ? (
                                <Text style={styles.gridOldPrice}>
                                  ₹{product.price.toLocaleString('en-IN')}
                                </Text>
                              ) : null}
                            </View>

                            <View style={styles.gridButton}>
                              <Text style={styles.primaryButtonText}>
                                View Product
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </FadeIn>
                    ))}
                  </View>
                )}
              </View>

              {/* SERVICE BANNER */}
              <TouchableOpacity
                style={styles.serviceBanner}
                onPress={openService}
              >
                <Text style={styles.serviceTitle}>
                  Need purifier servicing?
                </Text>

                <Text style={styles.serviceDescription}>
                  Book a service for your water purifier.
                </Text>

                <Text style={styles.serviceLink}>Explore Service →</Text>
              </TouchableOpacity>

              {/* TRUST STRIP */}
              <View style={styles.trustRow}>
                {[
                  ['✅', 'Genuine products'],
                  ['🛠', 'Service support'],
                  ['🔒', 'Secure checkout'],
                ].map(([emoji, text]) => (
                  <View key={text} style={styles.trustItem}>
                    <Text style={styles.trustEmoji}>{emoji}</Text>
                    <Text style={styles.trustText}>{text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

        {/* PRODUCT DETAILS PAGE */}
        {!showOrderHistory &&
          !showProfile &&
          extraPage === 'none' &&
          !checkoutComplete &&
          selectedProduct && (
            <FadeIn style={styles.section}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedProduct(null)}
              >
                <Text style={styles.backButtonText}>← Back to Products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.92}
                disabled={!selectedProduct.image}
                onPress={() => {
                  setZoomed(false);
                  setZoomOpen(true);
                }}
                style={[
                  styles.detailImage,
                  { backgroundColor: selectedProduct.color },
                ]}
              >
                {selectedProduct.image ? (
                  <Image
                    source={{ uri: selectedProduct.image }}
                    style={styles.detailPhoto}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.detailEmoji}>
                    {selectedProduct.emoji}
                  </Text>
                )}

                {selectedProduct.image ? (
                  <View style={styles.zoomHint}>
                    <Text style={styles.zoomHintText}>🔍 Tap to zoom</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <View style={styles.detailCard}>
                <Text style={styles.detailName}>{selectedProduct.name}</Text>

                <Text style={styles.productType}>{selectedProduct.type}</Text>

                <View style={styles.gridPriceRow}>
                  <Text style={styles.detailPrice}>
                    ₹{priceFor(selectedProduct).toLocaleString('en-IN')}
                  </Text>

                  {hasWholesale(selectedProduct) ? (
                    <Text style={styles.gridOldPrice}>
                      ₹{selectedProduct.price.toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>

                {hasWholesale(selectedProduct) ? (
                  <View style={styles.dealerBadge}>
                    <Text style={styles.dealerBadgeText}>DEALER PRICE</Text>
                  </View>
                ) : null}

                <Text style={styles.detailLabel}>About this product</Text>

                <Text style={styles.detailDescription}>
                  {selectedProduct.description}
                </Text>
              </View>

              <View style={styles.detailCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🚚</Text>
                  <Text style={styles.infoText}>
                    Delivered to your saved address
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🛠</Text>
                  <Text style={styles.infoText}>
                    Installation and service can be booked from the app
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>🔒</Text>
                  <Text style={styles.infoText}>
                    Your orders are saved securely in your account
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.wideButton}
                onPress={() => addToCart(selectedProduct)}
              >
                <Text style={styles.primaryButtonText}>
                  Add to Cart • ₹
                  {priceFor(selectedProduct).toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            </FadeIn>
          )}

        {/* CART PAGE */}
        {!showOrderHistory &&
          !showProfile &&
          extraPage === 'none' &&
          !checkoutComplete &&
          showCart && (
            <FadeIn style={styles.section}>
              <TouchableOpacity style={styles.backButton} onPress={openHome}>
                <Text style={styles.backButtonText}>← Continue Shopping</Text>
              </TouchableOpacity>

              <Text style={styles.cartTitle}>Your Shopping Cart</Text>

              {cart.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>🛒</Text>

                  <Text style={styles.productName}>Your cart is empty</Text>

                  <Text style={styles.productType}>
                    Add a product to get started.
                  </Text>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={openHome}
                  >
                    <Text style={styles.primaryButtonText}>
                      Browse Products
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {cart.map((product, index) => (
                    <View
                      key={`${product.id}-${index}`}
                      style={styles.cartItem}
                    >
                      <View
                        style={[
                          styles.cartImageBox,
                          { backgroundColor: product.color },
                        ]}
                      >
                        {product.image ? (
                          <Image
                            source={{ uri: product.image }}
                            style={styles.cartPhoto}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={styles.cartEmoji}>{product.emoji}</Text>
                        )}
                      </View>

                      <View style={styles.cartItemDetails}>
                        <Text style={styles.cartName} numberOfLines={2}>
                          {product.name}
                        </Text>

                        <Text style={styles.productType} numberOfLines={1}>
                          {product.type}
                        </Text>

                        <Text style={styles.cartPrice}>
                          ₹{priceFor(product).toLocaleString('en-IN')}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeFromCart(index)}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.summaryCard}>
                    <Text style={styles.addressTitle}>Order Summary</Text>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        Items ({cart.length})
                      </Text>
                      <Text style={styles.summaryValue}>
                        ₹{total.toLocaleString('en-IN')}
                      </Text>
                    </View>

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>

                      <Text style={styles.totalPrice}>
                        ₹{total.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addressBox}>
                    <Text style={styles.addressTitle}>Deliver to</Text>

                    {isProfileComplete(profile) ? (
                      <>
                        <Text style={styles.addressText}>
                          {profile.name} • {profile.phone}
                        </Text>
                        <Text style={styles.addressText}>
                          {profile.address}, {profile.city} - {profile.pincode}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.addressText}>
                        No delivery address saved yet.
                      </Text>
                    )}

                    <TouchableOpacity onPress={openProfile}>
                      <Text style={styles.addressEdit}>
                        {isProfileComplete(profile)
                          ? 'Change delivery details'
                          : 'Add delivery details'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.wideButton}
                    onPress={handleCheckout}
                    disabled={savingOrder || cart.length === 0}
                  >
                    <Text style={styles.primaryButtonText}>
                      {savingOrder ? 'Saving Order...' : 'Proceed to Checkout'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </FadeIn>
          )}

        {/* CHECKOUT CONFIRMATION (shown after the order is saved) */}
        {checkoutComplete && (
          <FadeIn style={styles.confirmationBox}>
            <Text style={styles.confirmationIcon}>✓</Text>
            <Text style={styles.confirmationTitle}>Thank you!</Text>
            <Text style={styles.confirmationSubtitle}>
              Your order has been saved successfully.
            </Text>
            <Text style={styles.confirmationText}>
              Items in this order: {cart.length}
            </Text>
            <Text style={styles.confirmationTotal}>
              Total: ₹{total.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.confirmationNote}>
              Your order is recorded in Firebase with pending status.
            </Text>
            <TouchableOpacity
              style={styles.wideButton}
              onPress={() => {
                setCart([]);
                setCheckoutComplete(false);
                setSelectedProduct(null);
                setShowCart(false);
                setShowOrderHistory(false);
                setShowProfile(false);
                setExtraPage('none');
                setSearch('');
                setCategory('All');
              }}
            >
              <Text style={styles.primaryButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          </FadeIn>
        )}

        {/* SERVICE BOOKING PAGE */}
        {extraPage === 'service' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.backButton} onPress={openHome}>
              <Text style={styles.backButtonText}>← Back to Shopping</Text>
            </TouchableOpacity>

            <Text style={styles.cartTitle}>Book a Service</Text>

            <Text style={styles.formLabel}>Service Type</Text>
            {renderChips(serviceTypes, serviceType, setServiceType)}

            <Text style={styles.formLabel}>Purifier Model (optional)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Califnco Pure RO"
              placeholderTextColor="#A0AEC0"
              value={serviceModel}
              onChangeText={setServiceModel}
            />

            <Text style={styles.formLabel}>Preferred Date</Text>
            <TextInput
              style={styles.formInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A0AEC0"
              value={serviceDate}
              onChangeText={setServiceDate}
              maxLength={10}
            />

            <Text style={styles.formLabel}>Time Slot</Text>
            {renderChips(timeSlots, serviceSlot, setServiceSlot)}

            <Text style={styles.formLabel}>Issue / Request</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMultiline]}
              placeholder="Describe the problem or what you need"
              placeholderTextColor="#A0AEC0"
              value={serviceIssue}
              onChangeText={setServiceIssue}
              multiline
            />

            <View style={styles.addressBox}>
              <Text style={styles.addressTitle}>Service address</Text>
              <Text style={styles.addressText}>
                {profile.name} • {profile.phone}
              </Text>
              <Text style={styles.addressText}>
                {profile.address}, {profile.city} - {profile.pincode}
              </Text>
              <TouchableOpacity onPress={openProfile}>
                <Text style={styles.addressEdit}>Change details</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.wideButton}
              onPress={submitService}
              disabled={serviceSaving}
            >
              <Text style={styles.primaryButtonText}>
                {serviceSaving ? 'Submitting...' : 'Submit Service Request'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>My Service Requests</Text>
            {myServices.length === 0 ? (
              <Text style={styles.productType}>No service requests yet.</Text>
            ) : (
              myServices.map((item) => (
                <View key={item.id} style={styles.adminCard}>
                  <Text style={styles.productName}>{item.serviceType}</Text>
                  <Text style={styles.productType}>
                    {item.preferredDate} • {item.timeSlot}
                  </Text>
                  <Text style={styles.productType}>{item.issue}</Text>
                  <Text style={styles.addressEdit}>
                    Status: {String(item.status).toUpperCase()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* DEALER PAGE */}
        {extraPage === 'dealer' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.backButton} onPress={openHome}>
              <Text style={styles.backButtonText}>← Back to Shopping</Text>
            </TouchableOpacity>

            <Text style={styles.cartTitle}>Dealer Account</Text>

            {dealerStatus === 'none' ? (
              <>
                <Text style={styles.productType}>
                  Apply for a dealer account to see wholesale prices. Your
                  profile details are used as the contact information.
                </Text>

                <Text style={styles.formLabel}>Business Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Your shop / company name"
                  placeholderTextColor="#A0AEC0"
                  value={dealerBusiness}
                  onChangeText={setDealerBusiness}
                />

                <Text style={styles.formLabel}>GST Number (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="15-character GSTIN"
                  placeholderTextColor="#A0AEC0"
                  value={dealerGst}
                  onChangeText={setDealerGst}
                  autoCapitalize="characters"
                  maxLength={15}
                />

                <TouchableOpacity
                  style={styles.wideButton}
                  onPress={submitDealer}
                  disabled={dealerSaving}
                >
                  <Text style={styles.primaryButtonText}>
                    {dealerSaving ? 'Submitting...' : 'Apply as Dealer'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.adminCard}>
                <Text style={styles.productName}>{dealer?.businessName}</Text>
                <Text style={styles.addressEdit}>
                  Status: {dealerStatus.toUpperCase()}
                </Text>
                <Text style={styles.productType}>
                  {dealerStatus === 'pending'
                    ? 'Your application is under review.'
                    : dealerStatus === 'approved'
                    ? 'Approved! Wholesale prices now appear on products.'
                    : 'Your application was not approved. Please contact support.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ADMIN LOGIN PAGE */}
        {extraPage === 'adminLogin' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.backButton} onPress={openHome}>
              <Text style={styles.backButtonText}>← Back to Shopping</Text>
            </TouchableOpacity>

            <Text style={styles.cartTitle}>Admin Login</Text>

            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={styles.formInput}
              placeholder="admin@example.com"
              placeholderTextColor="#A0AEC0"
              value={adminEmail}
              onChangeText={setAdminEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.formLabel}>Password</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Password"
              placeholderTextColor="#A0AEC0"
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.wideButton}
              onPress={adminLogin}
              disabled={adminBusy}
            >
              <Text style={styles.primaryButtonText}>
                {adminBusy ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ADMIN PANEL */}
        {extraPage === 'admin' && isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cartTitle}>Admin Panel</Text>
              <TouchableOpacity onPress={adminLogout}>
                <Text style={styles.removeText}>Sign out</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
              {(['orders', 'services', 'dealers', 'products', 'referrals'] as const).map(
                (tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, adminTab === tab && styles.tabActive]}
                    onPress={() => setAdminTab(tab)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        adminTab === tab && styles.tabTextActive,
                      ]}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <TouchableOpacity
              onPress={async () => {
                try {
                  await loadAdminData();
                } catch (error) {
                  Alert.alert('Error', 'Could not refresh data.');
                }
              }}
            >
              <Text style={styles.addressEdit}>↻ Refresh</Text>
            </TouchableOpacity>

            {adminTab === 'orders' &&
              (adminOrders.length === 0 ? (
                <Text style={styles.productType}>No orders yet.</Text>
              ) : (
                adminOrders.map((order) => (
                  <View key={order.id} style={styles.adminCard}>
                    <Text style={styles.productName}>
                      #{String(order.id).slice(0, 8)} • ₹
                      {Number(order.total).toLocaleString('en-IN')}
                      {order.dealerOrder ? '  (Dealer)' : ''}
                    </Text>
                    <Text style={styles.productType}>
                      {order.customer?.name ?? 'Unknown'} •{' '}
                      {order.customer?.phone ?? '-'}
                    </Text>
                    {order.deliveryAddress ? (
                      <Text style={styles.productType}>
                        {order.deliveryAddress.address},{' '}
                        {order.deliveryAddress.city} -{' '}
                        {order.deliveryAddress.pincode}
                      </Text>
                    ) : null}
                    <Text style={styles.productType}>
                      {Array.isArray(order.items)
                        ? order.items.map((i: any) => i.name).join(', ')
                        : ''}
                    </Text>
                    <Text style={styles.productType}>
                      {formatDate(order.createdAt)}
                    </Text>
                    {renderChips(orderStatuses, order.status, (status) =>
                      updateOrderStatus(order.id, status)
                    )}
                  </View>
                ))
              ))}

            {adminTab === 'services' &&
              (adminServices.length === 0 ? (
                <Text style={styles.productType}>No service requests yet.</Text>
              ) : (
                adminServices.map((item) => (
                  <View key={item.id} style={styles.adminCard}>
                    <Text style={styles.productName}>
                      {item.serviceType} • {item.preferredDate}
                    </Text>
                    <Text style={styles.productType}>
                      {item.timeSlot} • {item.productModel || 'Model not given'}
                    </Text>
                    <Text style={styles.productType}>
                      {item.customer?.name} • {item.customer?.phone}
                    </Text>
                    {item.deliveryAddress ? (
                      <Text style={styles.productType}>
                        {item.deliveryAddress.address},{' '}
                        {item.deliveryAddress.city} -{' '}
                        {item.deliveryAddress.pincode}
                      </Text>
                    ) : null}
                    <Text style={styles.productType}>{item.issue}</Text>
                    {renderChips(serviceStatuses, item.status, (status) =>
                      updateServiceStatus(item.id, status)
                    )}
                  </View>
                ))
              ))}

            {adminTab === 'dealers' &&
              (adminDealers.length === 0 ? (
                <Text style={styles.productType}>
                  No dealer applications yet.
                </Text>
              ) : (
                adminDealers.map((item) => (
                  <View key={item.id} style={styles.adminCard}>
                    <Text style={styles.productName}>{item.businessName}</Text>
                    <Text style={styles.productType}>
                      {item.contactName} • {item.phone} • {item.email}
                    </Text>
                    <Text style={styles.productType}>
                      GST: {item.gstNumber || 'Not provided'}
                    </Text>
                    <Text style={styles.productType}>
                      {item.address}, {item.city} - {item.pincode}
                    </Text>
                    {renderChips(dealerStatuses, item.status, (status) =>
                      updateDealerStatus(item.id, status)
                    )}
                  </View>
                ))
              ))}

            {adminTab === 'products' &&
              products.map((product) => (
                <View key={product.id} style={styles.adminCard}>
                  <Text style={styles.productName}>{product.name}</Text>

                  <Text style={styles.formLabel}>Retail price (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    value={priceEdits[product.id]?.price ?? String(product.price)}
                    onChangeText={(text) =>
                      setPriceEdit(product.id, 'price', text, product)
                    }
                  />

                  <Text style={styles.formLabel}>Wholesale price (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    value={
                      priceEdits[product.id]?.wholesale ??
                      String(product.wholesalePrice ?? 0)
                    }
                    onChangeText={(text) =>
                      setPriceEdit(product.id, 'wholesale', text, product)
                    }
                  />

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => saveProductPrices(product)}
                  >
                    <Text style={styles.primaryButtonText}>Save Prices</Text>
                  </TouchableOpacity>
                </View>
              ))}

            {adminTab === 'referrals' &&
              (adminReferrals.length === 0 ? (
                <Text style={styles.productType}>No referrals yet.</Text>
              ) : (
                adminReferrals.map((item) => (
                  <View key={item.id} style={styles.adminCard}>
                    <Text style={styles.productName}>Code {item.code}</Text>
                    <Text style={styles.productType}>
                      Referrer: {String(item.referrerUid).slice(0, 10)}...
                    </Text>
                    <Text style={styles.productType}>
                      New user: {String(item.referredUserUid).slice(0, 10)}...
                    </Text>
                    <Text style={styles.productType}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                ))
              ))}
          </View>
        )}

        {/* PROFILE PAGE */}
        {showProfile && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.backButton} onPress={openHome}>
              <Text style={styles.backButtonText}>← Back to Shopping</Text>
            </TouchableOpacity>

            <Text style={styles.cartTitle}>My Profile</Text>

            {profileFields.map((field) => (
              <View key={field.key}>
                <Text style={styles.formLabel}>{field.label}</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    field.multiline && styles.formInputMultiline,
                  ]}
                  placeholder={field.placeholder}
                  placeholderTextColor="#A0AEC0"
                  value={profile[field.key]}
                  onChangeText={(text) => updateProfileField(field.key, text)}
                  keyboardType={field.keyboard as any}
                  autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                  multiline={field.multiline}
                  maxLength={
                    field.key === 'phone'
                      ? 10
                      : field.key === 'pincode'
                      ? 6
                      : undefined
                  }
                />
              </View>
            ))}

            <TouchableOpacity
              style={styles.wideButton}
              onPress={saveProfile}
              disabled={profileSaving}
            >
              <Text style={styles.primaryButtonText}>
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </Text>
            </TouchableOpacity>

            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Refer a friend</Text>

              {myReferralCode ? (
                <>
                  <Text style={styles.addressText}>Your referral code</Text>
                  <View style={styles.referralCodeBox}>
                    <Text style={styles.referralCodeText}>
                      {myReferralCode}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={shareReferral}
                  >
                    <Text style={styles.primaryButtonText}>Share Code</Text>
                  </TouchableOpacity>

                  <Text style={[styles.addressText, { marginTop: 12 }]}>
                    Friends referred: {referralCount}
                  </Text>
                </>
              ) : (
                <Text style={styles.addressText}>
                  Loading your referral code...
                </Text>
              )}

              {referredBy ? (
                <Text style={[styles.noteText, { marginTop: 10 }]}>
                  You joined using code {referredBy.code}
                </Text>
              ) : (
                <>
                  <Text style={styles.formLabel}>Have a friend's code?</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter referral code"
                    placeholderTextColor="#A0AEC0"
                    value={referralInput}
                    onChangeText={setReferralInput}
                    autoCapitalize="characters"
                    maxLength={10}
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 10 }]}
                    onPress={applyReferral}
                    disabled={referralBusy}
                  >
                    <Text style={styles.primaryButtonText}>
                      {referralBusy ? 'Applying...' : 'Apply Code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* ORDER HISTORY PAGE */}
        {showOrderHistory && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowOrderHistory(false)}
            >
              <Text style={styles.backButtonText}>← Back to Shopping</Text>
            </TouchableOpacity>

            <Text style={styles.cartTitle}>My Order History</Text>

            {ordersLoading ? (
              <Text style={styles.productType}>Loading orders...</Text>
            ) : orders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📦</Text>
                <Text style={styles.productName}>No orders found</Text>
                <Text style={styles.productType}>
                  Your saved orders will appear here.
                </Text>
              </View>
            ) : (
              orders.map((order) => (
                <View key={order.id} style={styles.productCard}>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>
                      Order ID: {order.id}
                    </Text>

                    <Text style={styles.productType}>
                      Status: {order.status}
                    </Text>

                    <Text style={styles.productPrice}>
                      Total: ₹{Number(order.total).toLocaleString('en-IN')}
                    </Text>

                    <Text style={styles.productType}>
                      {Array.isArray(order.items)
                        ? order.items.map((item: any) => item.name).join(', ')
                        : 'Order items unavailable'}
                    </Text>

                    {order.deliveryAddress ? (
                      <Text style={styles.productType}>
                        Deliver to: {order.deliveryAddress.address},{' '}
                        {order.deliveryAddress.city} -{' '}
                        {order.deliveryAddress.pincode}
                      </Text>
                    ) : null}

                    <Text style={styles.productType}>
                      Date:{' '}
                      {order.createdAt?.toDate
                        ? order.createdAt.toDate().toLocaleString()
                        : 'Date unavailable'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* IMAGE ZOOM */}
        <Modal
          visible={zoomOpen && !!selectedProduct?.image}
          transparent
          animationType="fade"
          onRequestClose={() => setZoomOpen(false)}
        >
          <View style={styles.zoomBackdrop}>
            <ScrollView
              horizontal
              scrollEnabled={zoomed}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                width: zoomed ? screenWidth * 2.2 : screenWidth,
              }}
            >
              <ScrollView
                scrollEnabled={zoomed}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  minHeight: screenHeight,
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setZoomed((current) => !current)}
                >
                  <Image
                    source={{ uri: selectedProduct?.image ?? '' }}
                    style={{
                      width: zoomed ? screenWidth * 2.2 : screenWidth,
                      height: zoomed ? screenHeight * 1.2 : screenHeight * 0.7,
                    }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              style={styles.zoomClose}
              onPress={() => setZoomOpen(false)}
            >
              <Text style={styles.zoomCloseText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.zoomTip}>
              {zoomed
                ? 'Drag to move • tap to zoom out'
                : 'Tap the image to zoom in'}
            </Text>
          </View>
        </Modal>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>Califnco</Text>

          <Text style={styles.footerText}>
            Clean water for a better tomorrow.
          </Text>

          <TouchableOpacity onPress={openAdmin}>
            <Text style={styles.footerAdmin}>Admin Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = {
  shadowColor: '#0F2A43',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    // ---------- Header ----------
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },

    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    logoBadge: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: c.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },

    logoBadgeText: {
      fontSize: 22,
    },

    logo: {
      fontSize: 22,
      fontWeight: '800',
      color: c.accent,
      letterSpacing: 0.3,
    },

    tagline: {
      fontSize: 11,
      color: c.muted,
      marginTop: 1,
    },

    cartButton: {
      backgroundColor: c.tint,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
    },

    cartButtonText: {
      color: c.accent,
      fontWeight: '800',
      fontSize: 13,
    },

    cartBadge: {
      position: 'absolute',
      top: -7,
      right: -7,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#E5484D',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },

    cartBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },

    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    themeButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },

    themeButtonText: {
      fontSize: 18,
    },

    // ---------- Zoom ----------
    zoomBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.94)',
    },

    zoomClose: {
      position: 'absolute',
      top: 48,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    zoomCloseText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },

    zoomTip: {
      position: 'absolute',
      bottom: 40,
      alignSelf: 'center',
      color: '#CBD5E1',
      fontSize: 12,
    },

    zoomHint: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(15,42,67,0.75)',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 12,
    },

    zoomHintText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },

    // ---------- Referral ----------
    referralCodeBox: {
      alignSelf: 'flex-start',
      backgroundColor: c.tint,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 10,
      paddingHorizontal: 18,
      marginVertical: 10,
    },

    referralCodeText: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 3,
      color: c.accent,
    },

    // ---------- Hero ----------
    hero: {
      backgroundColor: c.hero,
      padding: 24,
      paddingTop: 28,
      paddingBottom: 62,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      overflow: 'hidden',
    },

    heroDecor1: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(255,255,255,0.07)',
      top: -70,
      right: -60,
    },

    heroDecor2: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.06)',
      bottom: -40,
      left: -30,
    },

    heroEyebrow: {
      color: '#9ED8F5',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
    },

    heroTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '800',
      marginTop: 10,
    },

    heroDescription: {
      color: '#D3EEFB',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
      marginBottom: 20,
    },

    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 14,
      paddingHorizontal: 14,
    },

    searchIcon: {
      fontSize: 15,
      marginRight: 8,
    },

    searchInput: {
      flex: 1,
      color: c.text,
      paddingVertical: 14,
      fontSize: 14,
    },

    // ---------- Quick actions ----------
    quickCard: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: c.card,
      borderRadius: 18,
      marginHorizontal: 18,
      marginTop: -36,
      paddingVertical: 16,
      ...shadow,
    },

    quickItem: {
      alignItems: 'center',
      width: '25%',
    },

    quickIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: c.tint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 7,
    },

    quickEmoji: {
      fontSize: 22,
    },

    quickLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.text,
    },

    // ---------- Sections ----------
    section: {
      paddingHorizontal: 18,
      paddingTop: 24,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: c.text,
      marginBottom: 14,
    },

    productCount: {
      fontSize: 12,
      color: c.muted,
    },

    // ---------- Categories ----------
    categoryScroll: {
      gap: 10,
      paddingRight: 18,
    },

    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },

    categoryPillActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },

    categoryEmoji: {
      fontSize: 16,
    },

    categoryPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: c.body,
    },

    categoryPillTextActive: {
      color: '#FFFFFF',
    },

    // ---------- Product grid ----------
    productGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },

    gridCardWrap: {
      width: '48.5%',
      marginBottom: 14,
    },

    gridCard: {
      width: '100%',
      backgroundColor: c.card,
      borderRadius: 18,
      overflow: 'hidden',
      ...shadow,
    },

    gridImage: {
      height: 150,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
    },

    gridBody: {
      padding: 12,
    },

    gridName: {
      fontSize: 14,
      fontWeight: '800',
      color: c.text,
      minHeight: 38,
    },

    gridType: {
      fontSize: 11,
      color: c.muted,
      marginTop: 2,
      marginBottom: 8,
    },

    gridPriceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 10,
    },

    gridPrice: {
      fontSize: 17,
      fontWeight: '800',
      color: c.accent,
    },

    gridOldPrice: {
      fontSize: 12,
      color: '#94A3B8',
      textDecorationLine: 'line-through',
    },

    gridButton: {
      backgroundColor: c.primary,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },

    dealerBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.greenTint,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      marginBottom: 8,
    },

    dealerBadgeFloat: {
      position: 'absolute',
      top: 10,
      left: 10,
      zIndex: 2,
      marginBottom: 0,
    },

    dealerBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: c.green,
      letterSpacing: 0.5,
    },

    productEmoji: {
      fontSize: 56,
    },

    productPhoto: {
      width: '100%',
      height: '100%',
    },

    // ---------- Used by Order History cards ----------
    productCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      ...shadow,
    },

    productImage: {
      width: 100,
      height: 125,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    productDetails: {
      flex: 1,
      alignItems: 'flex-start',
    },

    productName: {
      fontSize: 16,
      fontWeight: '800',
      color: c.text,
      marginBottom: 5,
    },

    productType: {
      fontSize: 12,
      color: c.muted,
      marginBottom: 8,
    },

    productPrice: {
      fontSize: 18,
      fontWeight: '800',
      color: c.accent,
      marginBottom: 10,
    },

    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },

    wideButton: {
      backgroundColor: c.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 20,
      ...shadow,
    },

    // ---------- Service banner + trust ----------
    serviceBanner: {
      backgroundColor: '#0F2A43',
      borderRadius: 20,
      padding: 22,
      marginHorizontal: 18,
      marginTop: 10,
      marginBottom: 18,
    },

    serviceTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 7,
    },

    serviceDescription: {
      fontSize: 13,
      color: '#B6C7D8',
      marginBottom: 12,
    },

    serviceLink: {
      fontSize: 14,
      fontWeight: '800',
      color: '#7DD3FC',
    },

    trustRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 18,
      marginBottom: 24,
      gap: 10,
    },

    trustItem: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },

    trustEmoji: {
      fontSize: 20,
      marginBottom: 6,
    },

    trustText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.body,
      textAlign: 'center',
    },

    // ---------- Back button ----------
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      marginBottom: 12,
    },

    backButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.accent,
    },

    // ---------- Product detail ----------
    detailImage: {
      height: 280,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      padding: 12,
    },

    detailEmoji: {
      fontSize: 100,
    },

    detailPhoto: {
      width: '100%',
      height: '100%',
    },

    detailCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
      ...shadow,
    },

    detailName: {
      fontSize: 24,
      fontWeight: '800',
      color: c.text,
      marginBottom: 6,
    },

    detailPrice: {
      fontSize: 28,
      fontWeight: '800',
      color: c.accent,
    },

    detailLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: c.text,
      marginTop: 6,
      marginBottom: 8,
    },

    detailDescription: {
      fontSize: 14,
      lineHeight: 23,
      color: c.body,
    },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },

    infoEmoji: {
      fontSize: 18,
    },

    infoText: {
      flex: 1,
      fontSize: 13,
      color: c.body,
    },

    noteText: {
      fontSize: 12,
      color: c.green,
      fontWeight: '700',
      marginBottom: 12,
    },

    // ---------- Cart ----------
    cartTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: c.text,
      marginBottom: 18,
    },

    cartItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      padding: 12,
      borderRadius: 16,
      marginBottom: 12,
      gap: 12,
      ...shadow,
    },

    cartImageBox: {
      width: 72,
      height: 80,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },

    cartEmoji: {
      fontSize: 32,
    },

    cartPhoto: {
      width: '100%',
      height: '100%',
    },

    cartItemDetails: {
      flex: 1,
    },

    cartName: {
      fontSize: 14,
      fontWeight: '800',
      color: c.text,
      marginBottom: 3,
    },

    cartPrice: {
      fontSize: 16,
      fontWeight: '800',
      color: c.accent,
    },

    removeButton: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: c.redTint,
    },

    removeText: {
      color: c.red,
      fontSize: 12,
      fontWeight: '700',
    },

    summaryCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 18,
      marginTop: 6,
      ...shadow,
    },

    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },

    summaryLabel: {
      fontSize: 14,
      color: c.muted,
    },

    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 14,
      marginTop: 14,
    },

    totalLabel: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
    },

    totalPrice: {
      fontSize: 21,
      fontWeight: '800',
      color: c.accent,
    },

    // ---------- Address / forms ----------
    addressBox: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 14,
      borderWidth: 1,
      borderColor: c.border,
    },

    addressTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: c.text,
      marginBottom: 6,
    },

    addressText: {
      fontSize: 13,
      color: c.body,
      marginBottom: 4,
    },

    addressEdit: {
      fontSize: 13,
      fontWeight: '800',
      color: c.accent,
      marginTop: 6,
    },

    formLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
      marginTop: 12,
    },

    formInput: {
      backgroundColor: c.card,
      color: c.text,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
    },

    formInputMultiline: {
      minHeight: 90,
      textAlignVertical: 'top',
    },

    // ---------- Chips / tabs / admin ----------
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
      marginBottom: 6,
    },

    chip: {
      paddingVertical: 8,
      paddingHorizontal: 13,
      borderRadius: 18,
      backgroundColor: c.chipBg,
    },

    chipActive: {
      backgroundColor: c.primary,
    },

    chipText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.body,
    },

    chipTextActive: {
      color: '#FFFFFF',
    },

    tabRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },

    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.chipBg,
      alignItems: 'center',
    },

    tabActive: {
      backgroundColor: c.primary,
    },

    tabText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.body,
    },

    tabTextActive: {
      color: '#FFFFFF',
    },

    adminCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      ...shadow,
    },

    // ---------- Confirmation ----------
    confirmationBox: {
      backgroundColor: c.card,
      borderRadius: 22,
      padding: 28,
      marginHorizontal: 18,
      marginTop: 30,
      marginBottom: 30,
      alignItems: 'center',
      ...shadow,
    },
    confirmationIcon: {
      width: 64,
      height: 64,
      lineHeight: 64,
      textAlign: 'center',
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: c.greenTint,
      color: c.green,
      fontSize: 38,
      fontWeight: '800',
      marginBottom: 16,
    },
    confirmationTitle: {
      fontSize: 25,
      fontWeight: '800',
      color: c.text,
      marginBottom: 8,
    },
    confirmationSubtitle: {
      fontSize: 15,
      color: c.body,
      marginBottom: 18,
    },
    confirmationText: {
      fontSize: 15,
      color: c.body,
      marginBottom: 8,
    },
    confirmationTotal: {
      fontSize: 20,
      fontWeight: '800',
      color: c.accent,
      marginBottom: 18,
    },
    confirmationNote: {
      fontSize: 12,
      lineHeight: 18,
      color: c.muted,
      textAlign: 'center',
      marginBottom: 20,
    },

    emptyBox: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 20,
      gap: 10,
    },

    emptyEmoji: {
      fontSize: 38,
      marginBottom: 12,
    },

    // ---------- Footer ----------
    footer: {
      alignItems: 'center',
      padding: 28,
      marginTop: 16,
      backgroundColor: '#0F2A43',
    },

    footerLogo: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
    },

    footerText: {
      fontSize: 12,
      color: '#9FB3C8',
      marginTop: 6,
    },

    footerAdmin: {
      fontSize: 11,
      color: '#5B7189',
      marginTop: 14,
    },
  });