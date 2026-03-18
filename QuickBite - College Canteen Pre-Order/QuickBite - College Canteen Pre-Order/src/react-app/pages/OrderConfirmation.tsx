import { useState, useEffect } from "react";
import { useAuth } from "../firebaseAuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Clock, UtensilsCrossed, ArrowLeft } from "lucide-react";
import type { Order, OrderItem } from "@/shared/types";

export default function OrderConfirmation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      navigate("/menu");
      return;
    }

    loadOrder();
  }, [orderId, navigate]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const loadOrder = async () => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        fetch(`/api/orders`, { credentials: "include" }),
        fetch(`/api/orders/${orderId}/items`, { credentials: "include" }),
      ]);

      const orders = await orderRes.json();
      const foundOrder = orders.find((o: Order) => o.id === parseInt(orderId!));
      
      if (!foundOrder) {
        navigate("/menu");
        return;
      }

      const items = await itemsRes.json();
      setOrder(foundOrder);
      setOrderItems(items);
    } catch (err) {
      console.error("Failed to load order:", err);
      navigate("/menu");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    return ((600 - timeRemaining) / 600) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="animate-spin">
          <UtensilsCrossed className="w-10 h-10 text-orange-400" />
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/menu")}
          className="flex items-center gap-2 text-slate-300 hover:text-orange-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Menu</span>
        </button>

        {/* Success Message */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-3xl shadow-xl p-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-6 animate-bounce">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Order Placed Successfully!</h1>
          <p className="text-slate-300 mb-4">
            Your order has been sent to the canteen
          </p>
          <div className="inline-block px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-semibold">
            Order #{order.id}
          </div>
        </div>

        {/* Timer Section */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl shadow-xl p-8 mb-6 text-white">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Preparation Time</h2>
          </div>
          <div className="text-center mb-6">
            <div className="text-7xl font-bold mb-2 tabular-nums">
              {formatTime(timeRemaining)}
            </div>
            <p className="text-white/90 text-lg">
              {timeRemaining > 0 ? "Your order will be ready soon" : "Your order is ready!"}
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl/20 rounded-full h-3 overflow-hidden">
            <div
              className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Order Details</h2>
          
          <div className="space-y-4 mb-6">
            {orderItems.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-4 bg-black/40 border border-white/5 shadow-inner rounded-xl"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{item.food_item_name}</h3>
                  <p className="text-sm text-slate-300">Quantity: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    ₹{(item.price_at_time * item.quantity).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-300">
                    ₹{item.price_at_time} each
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-slate-200">Order Time</span>
              <span className="text-white">
                {new Date(order.created_at).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-slate-200">Status</span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                {order.status}
              </span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-white/10">
              <span className="text-xl font-bold text-white">Total Amount</span>
              <span className="text-3xl font-bold text-orange-400">₹{order.total_price}</span>
            </div>
          </div>
        </div>

        {timeRemaining === 0 && (
          <div className="mt-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl shadow-xl p-6 text-white text-center">
            <h3 className="text-2xl font-bold mb-2">🎉 Order Ready!</h3>
            <p className="text-white/90">
              Please collect your order from the canteen counter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
