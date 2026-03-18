import { useState, useEffect } from "react";
import { useAuth } from "../firebaseAuthContext";
import { useNavigate, Link } from "react-router-dom";
import { ShoppingCart, LogOut, UtensilsCrossed, Plus, Minus, User, Phone, Hash, Clock } from "lucide-react";
import type { FoodItem } from "@/shared/types";

export default function Menu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ [id: number]: { item: FoodItem; quantity: number } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'select' | 'qr' | 'confirming'>('select');
  const [pendingOrderPayload, setPendingOrderPayload] = useState<any>(null);

  // Guest details state
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestRollNumber, setGuestRollNumber] = useState("");

  const isStaff = user && ((user as any).role === 'staff' || (user as any).role === 'admin');

  // Check if current IST time is within ordering window 11:10 - 11:20 AM
  const isOrderingWindowOpen = () => {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset - now.getTimezoneOffset() * 60000);
    // Use local time hours and minutes
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMinutes = h * 60 + m;
    const windowStart = 11 * 60 + 10; // 11:10 AM
    const windowEnd = 11 * 60 + 20;   // 11:20 AM
    return totalMinutes >= windowStart && totalMinutes < windowEnd;
  };

  const getTimeUntilWindow = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMinutes = h * 60 + m;
    const windowStart = 11 * 60 + 10;
    if (totalMinutes < windowStart) {
      const diff = windowStart - totalMinutes;
      return `Ordering opens in ${Math.floor(diff/60)}h ${diff%60}m`;
    }
    return "Ordering window has passed for today";
  };

  // Refresh clock every second
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadData();
  }, [user]); // user dependency so it refetches/uses right context if auth state settles

  const loadData = async () => {
    setLoading(true);
    try {
      // If student/guest, credentials may not matter, but keeping include for staff support
      const res = await fetch("/api/food-items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch menu");
      const data = await res.json();
      setFoodItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateCart = (item: FoodItem, delta: number) => {
    setCart((prev) => {
      const current = prev[item.id]?.quantity || 0;
      const nextQuantity = current + delta;
      if (nextQuantity <= 0) {
        const newCart = { ...prev };
        delete newCart[item.id];
        return newCart;
      }
      return {
        ...prev,
        [item.id]: { item, quantity: nextQuantity },
      };
    });
  };

  const calculateTotal = () => {
    return Object.values(cart).reduce((total, { item, quantity }) => total + item.price * quantity, 0);
  };

  // Step 1: Validate and build payload, then show payment modal
  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const items = Object.values(cart).map(({ item, quantity }) => ({
      food_item_id: item.id,
      quantity,
    }));
    if (items.length === 0) return;

    const orderPayload: any = { items };
    if (!user) {
      if (!guestName || !guestPhone || !guestRollNumber) {
        alert("Please fill in all your details to place the order.");
        return;
      }
      orderPayload.studentDetails = { name: guestName, phone: guestPhone, rollNumber: guestRollNumber };
    }

    // Store payload and show payment options
    setPendingOrderPayload(orderPayload);
    setPaymentStep('select');
    setShowPaymentModal(true);
  };

  // Step 2: Actually place the order after payment confirmation
  const placeOrder = async (paymentMethod: 'qr' | 'cash') => {
    if (!pendingOrderPayload) return;
    setIsSubmitting(true);
    try {
      const payload = { ...pendingOrderPayload, paymentMethod };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to place order");
      }
      const order = await res.json();
      setShowPaymentModal(false);
      setCart({});
      navigate(`/order-confirmation/${order.id}`);
    } catch (err: any) {
      alert(err.message || "Checkout failed");
      setShowPaymentModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <UtensilsCrossed className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900/40 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-40 shadow-2xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-200">QuickBite Menu</h1>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            {user ? (
              <>
                <span className="text-sm font-medium text-slate-300 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                  Staff: {user.email}
                </span>
                <button onClick={() => { logout(); navigate("/"); }} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link 
                to="/login" 
                className="text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-rose-500 hover:shadow-lg hover:shadow-orange-500/30 px-6 py-2.5 rounded-full transition-all border border-orange-400/20"
              >
                Staff / Admin Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">

          {/* Ordering window banner - only for students/guests */}
          {!isStaff && (
            <div className={`rounded-2xl p-4 border flex items-start gap-4 ${
              isOrderingWindowOpen()
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
            }`}>
              <Clock className="w-6 h-6 mt-0.5 flex-shrink-0" />
              <div>
                {isOrderingWindowOpen() ? (
                  <>
                    <p className="font-bold text-green-300">🟢 Ordering is OPEN!</p>
                    <p className="text-sm mt-0.5">You can place your order right now. The window closes at <strong>11:20 AM</strong>. Orders can be picked up between <strong>1:00 PM – 1:30 PM</strong>.</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold">⏰ Pre-Order Window: 11:10 AM – 11:20 AM</p>
                    <p className="text-sm mt-0.5">{getTimeUntilWindow()}. Orders can be picked up between <strong>1:00 PM – 1:30 PM</strong>.</p>
                  </>
                )}
              </div>
            </div>
          )}

          <h2 className="text-3xl font-extrabold text-white tracking-tight">Menu Highlights</h2>
          {foodItems.length === 0 && (
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 text-center border border-dashed border-white/20">
              <UtensilsCrossed className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 font-medium text-lg">No items available at the moment.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {foodItems.map((item) => (
              <div key={item.id} className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 flex flex-col justify-between border border-white/10 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-15px_rgba(249,115,22,0.3)] transition-all duration-300 group">
                <div>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded-2xl mb-5 shadow-inner" />
                  ) : (
                    <div className="w-full h-48 bg-white/5 rounded-2xl mb-5 flex items-center justify-center border border-white/5">
                      <UtensilsCrossed className="w-10 h-10 text-white/20" />
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-white mb-2">{item.name}</h3>
                  {item.description && <p className="text-slate-400 text-sm mb-4 line-clamp-2 leading-relaxed">{item.description}</p>}
                </div>
                <div className="flex items-center justify-between mt-4 border-t border-white/10 pt-5">
                  <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-500">₹{item.price}</span>
                  <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-full border border-white/5">
                    <button 
                      onClick={() => updateCart(item, -1)} 
                      className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold text-white">{cart[item.id]?.quantity || 0}</span>
                    <button 
                      onClick={() => updateCart(item, 1)} 
                      className="p-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg hover:shadow-orange-500/50 transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-7 sticky top-20 border border-white/10 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <h2 className="text-2xl font-extrabold text-white mb-6 flex items-center gap-3 pb-5 border-b border-white/10">
              <div className="p-2.5 bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-xl shadow-lg shadow-orange-500/30">
                <ShoppingCart className="w-5 h-5" />
              </div>
              Your Order
            </h2>
            
            {Object.keys(cart).length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                  <ShoppingCart className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-300 font-medium text-lg">Your cart is empty</p>
                <p className="text-slate-500 text-sm mt-2">Add some delicious items from the menu!</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.values(cart).map(({ item, quantity }) => (
                    <div key={item.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                      <div>
                        <p className="font-bold text-white text-lg">{item.name}</p>
                        <p className="text-sm font-medium text-slate-400">₹{item.price} × {quantity}</p>
                      </div>
                      <p className="font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 text-xl">₹{item.price * quantity}</p>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-white/10 pt-5 mt-2">
                  <div className="flex justify-between items-center text-2xl font-black">
                    <span className="text-white">Total Amount</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400">₹{calculateTotal()}</span>
                  </div>
                </div>

                {!user && (
                  <form id="checkout-form" onSubmit={handleCheckout} className="space-y-5 pt-5 border-t border-white/10 mt-5">
                    <h3 className="font-bold text-white text-lg mb-3">Student Details</h3>
                    
                    <div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-slate-400 group-focus-within:text-orange-400 transition-colors" />
                        </div>
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:outline-none transition-all shadow-inner"
                          placeholder="Full Name"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-orange-400 transition-colors" />
                        </div>
                        <input
                          type="tel"
                          required
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:outline-none transition-all shadow-inner"
                          placeholder="Phone Number"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Hash className="h-5 w-5 text-slate-400 group-focus-within:text-orange-400 transition-colors" />
                        </div>
                        <input
                          type="text"
                          required
                          value={guestRollNumber}
                          onChange={(e) => setGuestRollNumber(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:outline-none transition-all shadow-inner"
                          placeholder="Roll Number"
                        />
                      </div>
                    </div>
                  </form>
                )}

                <button
                  onClick={user ? () => handleCheckout() : undefined}
                  type={!user ? "submit" : "button"}
                  form={!user ? "checkout-form" : undefined}
                  disabled={isSubmitting || (!user && (!guestName || !guestPhone || !guestRollNumber))}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-xl font-extrabold text-lg shadow-[0_10px_20px_-10px_rgba(249,115,22,0.5)] hover:shadow-[0_10px_20px_-5px_rgba(249,115,22,0.6)] hover:from-orange-400 hover:to-rose-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                >
                  {isSubmitting ? "Placing Order..." : "Place Order Now"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-rose-500 p-5 text-center">
              <p className="text-white/70 text-sm font-medium">Total Amount</p>
              <p className="text-4xl font-black text-white">₹{calculateTotal()}</p>
            </div>

            <div className="p-6">
              {paymentStep === 'select' && (
                <>
                  <h3 className="text-xl font-bold text-white text-center mb-6">Choose Payment Method</h3>
                  <div className="space-y-4">

                    {/* QR Code Option */}
                    <button
                      onClick={() => setPaymentStep('qr')}
                      className="w-full flex items-center gap-4 p-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl hover:border-violet-500/60 hover:bg-violet-500/20 transition-all group text-left"
                    >
                      <div className="w-14 h-14 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-600/30">
                        <img src="/phonepe-icon.png" alt="PhonePe" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <span className="text-white text-2xl font-black" id="pe-icon">₱</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">Pay via UPI / QR</p>
                        <p className="text-slate-400 text-sm">Scan PhonePe QR code to pay</p>
                      </div>
                      <span className="ml-auto text-slate-400 group-hover:text-white text-2xl">›</span>
                    </button>

                    {/* Cash Option */}
                    <button
                      onClick={() => placeOrder('cash')}
                      disabled={isSubmitting}
                      className="w-full flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl hover:border-green-500/60 hover:bg-green-500/20 transition-all group text-left disabled:opacity-50"
                    >
                      <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-600/30">
                        <span className="text-white text-3xl">💵</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">Pay at Counter (Cash)</p>
                        <p className="text-slate-400 text-sm">Pay when you receive your order</p>
                      </div>
                      <span className="ml-auto text-slate-400 group-hover:text-white text-2xl">›</span>
                    </button>

                  </div>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full mt-4 py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}

              {paymentStep === 'qr' && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-white mb-1">Scan & Pay</h3>
                    <p className="text-slate-400 text-sm">Scan this QR with PhonePe, Google Pay, or any UPI app</p>
                  </div>

                  {/* QR Code Image */}
                  <div className="bg-white rounded-2xl p-4 mx-auto w-fit mb-4">
                    <img
                      src="/phonepe-qr.png"
                      alt="PhonePe QR Code"
                      className="w-56 h-56 object-contain"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) parent.innerHTML = '<div class="w-56 h-56 flex flex-col items-center justify-center text-slate-700"><span class="text-5xl mb-2">📱</span><p class="text-sm font-medium text-center px-4">Save your PhonePe QR image as<br/><strong>public/phonepe-qr.png</strong></p></div>';
                      }}
                    />
                  </div>

                  <div className="text-center mb-1">
                    <p className="text-white font-bold text-lg">Rachamadugu Narasimha Rao</p>
                    <p className="text-violet-400 text-sm">PhonePe UPI</p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center mb-4">
                    <p className="text-amber-300 text-sm font-medium">
                      ⚠️ After payment, click "I've Paid" to confirm your order
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentStep('select')}
                      className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl font-semibold hover:bg-white/10 transition-all"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => placeOrder('qr')}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-extrabold hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/30"
                    >
                      {isSubmitting ? 'Confirming...' : "✅ I've Paid"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
