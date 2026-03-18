import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../firebaseAuthContext";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, LogOut, Plus, Edit2, Trash2 } from "lucide-react";
import type { FoodItem, Order, OrderItem } from "@/shared/types";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"menu" | "orders" | "orders-list" | "staff">("menu");
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [staffRegistrations, setStaffRegistrations] = useState<Array<{ id: number; name: string; email: string; status: string; created_at: string }>>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [showLocalList, setShowLocalList] = useState(false);
  const [localItemsList, setLocalItemsList] = useState<FoodItem[]>([]);

  const openLocalList = () => {
    setLocalItemsList(readLocalItems());
    setShowLocalList(true);
  };

  const importLocalItemsFromJSON = () => {
    // Stronger validation: parse JSON, ensure array of objects with required fields
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error('Provided JSON is not an array');
      const nowIso = new Date().toISOString();
      const existing = readLocalItems();
      const errors: string[] = [];
      const items: FoodItem[] = parsed.map((it: any, idx: number) => {
        const row = it || {};
        const name = typeof row.name === 'string' && row.name.trim() !== '' ? row.name.trim() : '';
        const price = typeof row.price === 'number' ? row.price : (row.price ? Number(row.price) : NaN);
        const description = typeof row.description === 'string' ? row.description : '';
        const image_url = typeof row.image_url === 'string' ? row.image_url : '';
        const is_available = row.is_available === 0 || row.is_available === 1 ? (row.is_available as number) : (row.is_available === false ? 0 : 1);

        if (!name) errors.push(`Item ${idx + 1}: missing or invalid 'name'`);
        if (!Number.isFinite(price) || price < 0) errors.push(`Item ${idx + 1}: missing or invalid 'price'`);

        const idVal = typeof row.id === 'number' && row.id > 0 ? row.id : -(Date.now() + idx);

        return {
          id: idVal,
          name: name || `Imported ${idx + 1}`,
          description: description || '',
          price: Number.isFinite(price) ? price : 0,
          image_url: image_url || '',
          is_available: is_available === 1 ? 1 : 1,
          created_at: row.created_at || nowIso,
          updated_at: row.updated_at || nowIso,
        } as FoodItem;
      });

      if (errors.length > 0) {
        showToast(`Import failed: ${errors.slice(0,3).join('; ')}${errors.length > 3 ? '…' : ''}`);
        return;
      }

      const merged = [...items, ...existing];
      writeLocalItems(merged);
      setFoodItems(merged);
      setPendingLocalCount(merged.length);
      showToast(`Imported ${items.length} items to local menu.`);
      setImportText("");
      setShowImportModal(false);
    } catch (e) {
      console.error('Import failed', e);
      showToast('Invalid JSON. Paste an array of items.');
    }
  };

  const deleteLocalItem = (id: number) => {
    const cur = readLocalItems();
    const updated = cur.filter((it) => it.id !== id);
    writeLocalItems(updated);
    setFoodItems(updated);
    setPendingLocalCount(updated.length);
    setLocalItemsList(updated);
    showToast('Local item removed');
  };

  const publishLocalItem = async (id: number) => {
    const local = readLocalItems();
    const item = local.find((it) => it.id === id);
    if (!item) {
      showToast('Local item not found');
      return;
    }

    try {
      if (item.id <= 0) {
        // temp item -> create on server
        const res = await fetch(`/api/admin/food-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: item.name,
            description: item.description || '',
            price: item.price,
            image_url: item.image_url || '',
            is_available: item.is_available === 1,
          }),
        });

        if (res.status === 401 || res.status === 403) {
          showToast('Not authorized to publish local item');
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText || 'error');
          showToast('Publish failed: ' + txt);
          return;
        }

        const serverItem = await res.json();
        const remaining = local.filter((it) => it.id !== id);
        writeLocalItems(remaining);
        setLocalItemsList(remaining);
        setPendingLocalCount(remaining.length);
        setFoodItems((prev) => [serverItem, ...prev.filter((p) => p.id !== serverItem.id)]);
        showToast('Published item to server');
      } else {
        // existing item edited locally -> PUT
        const res = await fetch(`/api/admin/food-items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: item.name,
            description: item.description || '',
            price: item.price,
            image_url: item.image_url || '',
            is_available: item.is_available === 1,
          }),
        });

        if (res.status === 401 || res.status === 403) {
          showToast('Not authorized to publish local item');
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText || 'error');
          showToast('Publish failed: ' + txt);
          return;
        }

        const updated = await res.json();
        const remaining = local.filter((it) => it.id !== id);
        writeLocalItems(remaining);
        setLocalItemsList(remaining);
        setPendingLocalCount(remaining.length);
        setFoodItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast('Published changes to server');
      }
    } catch (err) {
      console.error('publishLocalItem failed', err);
      showToast('Network error publishing item');
    }
  };

  // Time state for countdowns
  const [now, setNow] = useState<number>(Date.now());


  const getRemainingMs = (order: Order) => {
    const created = new Date(order.created_at).getTime();
    const target = created + 10 * 60 * 1000; // 10 minutes
    return Math.max(0, target - now);
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };


  // Tick the clock every second to update timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Server-provided config for windows
  const [serverConfig, setServerConfig] = useState<null | { ordering: { start: string; end: string; open: boolean }; delivery: { start: string; end: string; open: boolean }; timezone: string }>(null);

  // Local fallback delivery window
  const isInDeliveryWindowLocal = (nowMs: number) => {
    const now = new Date(nowMs);
    const start = new Date(now);
    start.setHours(13, 0, 0, 0);
    const end = new Date(now);
    end.setHours(13, 30, 0, 0);
    return now >= start && now < end;
  };

  const isDeliveryOpen = (nowMs: number) => {
    if (serverConfig) return serverConfig.delivery.open;
    return isInDeliveryWindowLocal(nowMs);
  };

  useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config', { credentials: 'include' });
        if (!res.ok) return;
        const cfg = await res.json();
        if (!mounted) return;
        setServerConfig(cfg);
      } catch (e) {
        // ignore
      }
    };

    void fetchConfig();
    const id = setInterval(fetchConfig, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    is_available: true,
  });

  // Dropdown menu states
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<{ name: string; description: string; price: number } | null>(null);
  const [quantityInput, setQuantityInput] = useState("");

  const predefinedMenuItems = [
    { name: "Samosa", description: "A crispy, triangular pastry filled with spiced potatoes", price: 12 },
    { name: "Noodles", description: "Stir-fried noodles with vegetables", price: 50 },
    { name: "Veg Biryani", description: "Fragrant rice cooked with mixed vegetables", price: 80 },
    { name: "Chicken Biryani", description: "Fragrant rice cooked with tender chicken", price: 120 },
    { name: "Veg Fried Rice", description: "Fried rice with assorted vegetables", price: 70 },
    { name: "Chicken Fried Rice", description: "Fried rice with chicken pieces", price: 100 },
    { name: "Mocktails", description: "Refreshing non-alcoholic fruit drinks", price: 40 },
    { name: "Drinks", description: "Cold beverages and soft drinks", price: 30 },
  ];

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    // If the client-side user object is an admin (dev local admin), trust it and load data
    if ((user as any).role === "admin") {
      loadData();
      return;
    }

    // Otherwise verify with backend; if unauthorized or non-admin, redirect to menu
    fetch("/api/users/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          navigate("/menu");
          return null;
        }
        return res.json();
      })
      .then((userData) => {
        if (userData && userData.role !== "admin") {
          navigate("/menu");
        } else {
          // backend verified admin
          loadData();
        }
      })
      .catch((err) => {
        console.error("Failed to verify user role:", err);
        navigate("/menu");
      });
  }, [user, navigate]);

  useEffect(() => {
    // initialize pending count and try sync when admin opens dashboard
    setPendingLocalCount(readLocalItems().length);
    if ((user as any)?.role === "admin") {
      void syncLocalToServer();
    }

    // load staff registrations for admin management
    if ((user as any)?.role === "admin") {
      void fetchStaffRegistrations();
    }

    const onOnline = () => {
      if ((user as any)?.role === "admin") void syncLocalToServer();
    };

    window.addEventListener("online", onOnline);
    const interval = setInterval(() => {
      if ((user as any)?.role === "admin") void syncLocalToServer();
    }, 1000 * 30); // try every 30s

    // Expose a helper to allow publishing pending local items from the browser console
    try {
      (window as any).publishLocalItems = async () => {
        return await syncLocalToServer();
      };
    } catch (e) {}

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
      try { delete (window as any).publishLocalItems; } catch (e) {}
    };
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [foodRes, ordersRes] = await Promise.all([
        fetch("/api/admin/food-items", { credentials: "include" }),
        fetch("/api/admin/orders", { credentials: "include" }),
      ]);

      if (foodRes.status === 401 || foodRes.status === 403) {
        // fallback to local items
        const local = readLocalItems();
        setFoodItems(local);
        setOrders([]);
        return;
      }

      const foodData = foodRes.ok ? await foodRes.json() : [];
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];

      if (!Array.isArray(foodData)) {
        // Unexpected response — fallback and warn for debugging
        console.warn("Unexpected food items response; expected array:", foodData);
      }
      if (!Array.isArray(ordersData)) {
        console.warn("Unexpected orders response; expected array:", ordersData);
      }

      setFoodItems(Array.isArray(foodData) ? foodData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffRegistrations = async () => {
    try {
      const res = await fetch("/api/admin/staff-registrations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStaffRegistrations(data);
      }
    } catch (e) {
      console.error("Failed to fetch staff registrations:", e);
    }
  };

  const handleApproveStaff = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/staff-registrations/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
      showToast('Staff account approved.');
      fetchStaffRegistrations();
    } catch (e) {
      showToast('Failed to approve staff account.');
    }
  };

  const handleRejectStaff = async (id: number) => {
    if (!confirm('Reject this staff registration?')) return;
    try {
      const res = await fetch(`/api/admin/staff-registrations/${id}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reject");
      showToast('Staff registration rejected.');
      fetchStaffRegistrations();
    } catch (e) {
      showToast('Failed to reject staff registration.');
    }
  };

  const handleDeleteStaff = async (id: number) => {
    if (!confirm('Permanently delete this staff record? This will revoke their access.')) return;
    try {
      const res = await fetch(`/api/admin/staff-registrations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      showToast('Staff record deleted.');
      setStaffRegistrations(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      showToast('Failed to delete staff record.');
    }
  };

  // Helper to get customer display name
  const getCustomerName = (userId: string, userEmail: string, userName?: string) => {
    // stored name (migrated/unified from backend) wins first
    if (userName) {
      return userName;
    }
    // fallback: prefer the id (e.g. dev-user/dev-staff or real UID), it's more
    // meaningful than the auto-generated email address
    return userId || userEmail;
  };

  // LocalStorage fallback for dev-only admin edits. Stored under `localFoodItems`.
  const LOCAL_KEY = "localFoodItems";
  const readLocalItems = (): FoodItem[] => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as FoodItem[];
    } catch (e) {
      return [];
    }
  };
  const writeLocalItems = (items: FoodItem[]) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    } catch (e) {}
  };

  const [pendingLocalCount, setPendingLocalCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync local items (temporary or edited) to server when possible.
  const syncLocalToServer = async () => {
    const local = readLocalItems();
    if (!local || local.length === 0) {
      setPendingLocalCount(0);
      return;
    }

    setIsSyncing(true);
    let remaining: FoodItem[] = [...local];

    for (const item of local) {
      try {
        if (item.id <= 0) {
          // temp item -> create on server
          const res = await fetch(`/api/admin/food-items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: item.name,
              description: item.description,
              price: item.price,
              image_url: item.image_url,
              is_available: item.is_available === 1,
            }),
          });

          if (res.ok) {
            const serverItem = await res.json();
            // Replace local temp item with server item
            remaining = remaining.filter((it) => it.id !== item.id);
            // merge server item into current UI
            setFoodItems((prev) => [serverItem, ...prev.filter((p) => p.id !== serverItem.id)]);
          } else if (res.status === 401 || res.status === 403) {
            // not authorized: keep local
            continue;
          } else {
            // other error: keep local
            continue;
          }
        } else {
          // existing id possibly edited locally -> attempt to PUT
          const res = await fetch(`/api/admin/food-items/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: item.name,
              description: item.description,
              price: item.price,
              image_url: item.image_url,
              is_available: item.is_available === 1,
            }),
          });

          if (res.ok) {
            const updated = await res.json();
            remaining = remaining.filter((it) => it.id !== item.id);
            setFoodItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (res.status === 401 || res.status === 403) {
            continue;
          } else {
            continue;
          }
        }
      } catch (err) {
        // network error -> stop trying and keep remaining as-is
        console.error("syncLocalToServer error for item", item, err);
        break;
      }
    }

    writeLocalItems(remaining);
    setPendingLocalCount(remaining.length);
    setIsSyncing(false);
    if (remaining.length === 0) {
      // refresh from server to show true state
      loadData();
    }
  };

  const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      price: parseFloat(formData.price),
      // treat empty string as undefined so we can preserve existing image when editing
      image_url: formData.image_url && String(formData.image_url).trim() !== '' ? formData.image_url : undefined,
      is_available: formData.is_available,
    };

    try {
      let res: Response | null = null;
      if (editingItem) {
        res = await fetch(`/api/admin/food-items/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch("/api/admin/food-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
      }

      if (res && (res.status === 401 || res.status === 403)) {
        // Not authorized to call backend — persist locally for dev/demo
        const local = readLocalItems();
        if (editingItem) {
          const updated = local.map((it) => (it.id === editingItem.id ? { ...it, ...data } as any : it));
          writeLocalItems(updated);
          setFoodItems(updated);
          setPendingLocalCount(updated.length);
          // Try syncing immediately when admin creates local items
          void syncLocalToServer();
        } else {
          // assign a temporary negative id
          const tempId = -(Date.now());
          const newLocalItem = { id: tempId, name: data.name, description: data.description || "", price: data.price, image_url: data.image_url || "", is_available: data.is_available ? 1 : 0 } as FoodItem;
          const updated = [newLocalItem, ...local];
          writeLocalItems(updated);
          setFoodItems(updated);
        }
      } else if (res && !res.ok) {
        // Backend returned an error (server down, CORS, 500, etc). Persist locally so admin can continue working offline.
        try {
          const local = readLocalItems();
          if (editingItem) {
            const updated = local.map((it) => {
              if (it.id === editingItem.id) {
                // preserve existing image_url if data.image_url is undefined
                const image_url = data.image_url !== undefined ? data.image_url : (it.image_url || editingItem.image_url || "");
                return { ...it, ...data, image_url } as any;
              }
              return it;
            });
            writeLocalItems(updated);
            setFoodItems(updated);
            setPendingLocalCount(updated.length);
            void syncLocalToServer();
            showToast('Saved locally (will sync when server is available).');
          } else {
            const tempId = -(Date.now());
            const newLocalItem = { id: tempId, name: data.name, description: data.description || "", price: data.price, image_url: data.image_url || "", is_available: data.is_available ? 1 : 0 } as FoodItem;
            const updated = [newLocalItem, ...local];
            writeLocalItems(updated);
            setFoodItems(updated);
            setPendingLocalCount(updated.length);
            void syncLocalToServer();
            showToast('Saved locally (will sync when server is available).');
          }
        } catch (err) {
          console.error('Failed to persist locally after server error', err);
          const txt = await res.text().catch(() => '');
          throw new Error(txt || 'Failed to save item');
        }
      } else {
        // success against backend
        setShowAddModal(false);
        setEditingItem(null);
        setFormData({ name: "", description: "", price: "", image_url: "", is_available: true });
        loadData();
      }
    } catch (err) {
      console.error("Failed to save item:", err);
      alert("Failed to save item");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const res = await fetch(`/api/admin/food-items/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        const local = readLocalItems().filter((it) => it.id !== id);
        writeLocalItems(local);
        setFoodItems(local);
        setPendingLocalCount(local.length);
        void syncLocalToServer();
      } else if (!res.ok) {
        throw new Error("Failed to delete");
      } else {
        loadData();
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
      alert("Failed to delete item");
    }
  };

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      image_url: item.image_url || "",
      is_available: item.is_available === 1,
    });
    setShowAddModal(true);
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/items`, {
        credentials: "include",
      });
      const items = await res.json();
      setOrderItems(items);
    } catch (err) {
      console.error("Failed to load order items:", err);
    }
  };

  const handleMarkReady = async (order: Order) => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

    } catch (e) {
      console.error("Failed to update order status", e);
      alert("Failed to mark order ready");
    }
  };

  const getPendingOrdersCount = () => {
    if (!Array.isArray(orders)) return 0;
    return getTodaysOrders().filter((o) => o.status === "pending").length;
  };

  const isToday = (dateString: string) => {
    const orderDate = new Date(dateString);
    const today = new Date();
    return (
      orderDate.getFullYear() === today.getFullYear() &&
      orderDate.getMonth() === today.getMonth() &&
      orderDate.getDate() === today.getDate()
    );
  };

  const getTodaysOrders = () => {
    return Array.isArray(orders) ? orders.filter((order) => isToday(order.created_at)) : [];
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (e) {
      console.error("Logout failed", e);
    }
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

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">QuickBite Admin</h1>
              <p className="text-xs text-slate-400">Canteen Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {pendingLocalCount > 0 && (
              <div className="flex items-center gap-3 mr-3">
                <span className="text-sm text-orange-400">Local changes: {pendingLocalCount}</span>
                <button
                  onClick={() => void syncLocalToServer()}
                  disabled={isSyncing}
                  className={`px-3 py-1 rounded-md font-medium ${isSyncing ? 'bg-gray-200 text-slate-300' : 'bg-orange-500/100 text-white'}`}
                >
                  {isSyncing ? 'Syncing…' : 'Sync now'}
                </button>
              </div>
            )}

            <span className="text-sm text-slate-300">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-300 hover:text-orange-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("menu")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === "menu"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                : "bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-slate-300 hover:bg-black/40 border border-white/5 shadow-inner"
            }`}
          >
            Menu Items
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 relative ${
              activeTab === "orders"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                : "bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-slate-300 hover:bg-black/40 border border-white/5 shadow-inner"
            }`}
          >
            Orders
            {getPendingOrdersCount() > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {getPendingOrdersCount()}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("orders-list")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === "orders-list"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                : "bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-slate-300 hover:bg-black/40 border border-white/5 shadow-inner"
            }`}
          >
            Orders List
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 relative ${
              activeTab === "staff"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                : "bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-slate-300 hover:bg-black/40 border border-white/5 shadow-inner"
            }`}
          >
            Staff
          </button>
        </div>

        {/* Menu Items Tab */}
        {activeTab === "menu" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Food Items</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setFormData({ name: "", description: "", price: "", image_url: "", is_available: true });
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>

                {/* Quick Menu Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-white border-2 border-orange-500 rounded-lg font-medium hover:bg-orange-500/10 transition-all duration-200"
                  >
                    Menu ▼
                  </button>
                  
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl border border-white/10 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                      {predefinedMenuItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 hover:bg-orange-500/10 border-b border-white/10 last:border-b-0">
                          <div className="flex-1">
                            <p className="font-semibold text-white">{item.name}</p>
                            <p className="text-sm text-slate-300">{item.description}</p>
                            <p className="text-sm font-medium text-orange-400">₹{item.price}</p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedMenuItem(item);
                              setQuantityInput("");
                              setShowQuantityModal(true);
                              setShowDropdown(false);
                            }}
                            className="ml-2 p-2 bg-orange-500/100 text-white rounded hover:bg-orange-600 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {Array.isArray(foodItems) && foodItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-400 text-lg">No menu items yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Array.isArray(foodItems) ? foodItems : []).map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-200"
                  >
                    <div className="h-48 bg-gradient-to-br from-orange-200 to-amber-200 flex items-center justify-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-6xl">🍽️</span>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-semibold text-white">{item.name}</h3>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const localSet = new Set(readLocalItems().map((i) => i.id));
                            if (localSet.has(item.id)) {
                              return (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Local
                                </span>
                              );
                            }
                            return null;
                          })()}

                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.is_available
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.is_available ? "Available" : "Unavailable"}
                          </span>
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-slate-300 text-sm mb-4">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-orange-400">₹{item.price}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          {/* Show Publish for local/pending items */}
                          {(() => {
                            const localSet = new Set(readLocalItems().map((i) => i.id));
                            const isLocal = localSet.has(item.id) || item.id <= 0;
                            if (isLocal) {
                              return (
                                <button
                                  onClick={() => publishLocalItem(item.id)}
                                  className="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                                  title="Publish this local item to the server"
                                >
                                  Publish
                                </button>
                              );
                            }
                            return null;
                          })()}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Today's Orders</h2>

            {(() => {
              const todaysOrders = getTodaysOrders();
              return todaysOrders.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-400 text-lg">No orders for today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todaysOrders.map((order, index) => (
                    <div
                      key={order.id}
                      className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                              #{index + 1}
                            </span>
                            <span className="text-lg font-bold text-white">
                              Order #{order.id}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                order.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : order.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-slate-200"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300">
                            Customer: {getCustomerName(order.user_id, order.user_email, order.user_name)}
                          </p>
                          <p className="text-sm text-slate-400">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-400">₹{order.total_price}</p>
                          <div className="mt-2 flex gap-2 justify-end">
                            <button
                              onClick={() => handleViewOrder(order)}
                              className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                            >
                              View Details
                            </button>
                            <button
                                onClick={() => handleMarkReady(order)}
                                className="px-3 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                Mark Ready
                              </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Orders List Tab - Grouped by Date */}
        {activeTab === "orders-list" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Order History</h2>

            {Array.isArray(orders) && orders.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-400 text-lg">No orders yet</p>
              </div>
            ) : (
              (() => {
                // Group orders by date
                const groupedOrders: Record<string, Order[]> = {};
                (Array.isArray(orders) ? orders : []).forEach((order) => {
                  const dateKey = new Date(order.created_at).toDateString();
                  if (!groupedOrders[dateKey]) {
                    groupedOrders[dateKey] = [];
                  }
                  groupedOrders[dateKey].push(order);
                });

                // Sort dates in descending order (newest first)
                const sortedDates = Object.keys(groupedOrders).sort(
                  (a, b) => new Date(b).getTime() - new Date(a).getTime()
                );

                return (
                  <div className="space-y-6">
                    {sortedDates.map((dateKey) => {
                      const dateOrders = groupedOrders[dateKey];
                      const dateObj = new Date(dateKey);
                      const formattedDate = dateObj.toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });

                      return (
                        <div key={dateKey} className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-xl shadow-md overflow-hidden">
                          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                            <h3 className="text-lg font-bold text-white">{formattedDate}</h3>
                            <p className="text-sm text-orange-100">
                              {dateOrders.length} order{dateOrders.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="divide-y divide-gray-200">
                            {dateOrders.map((order, index) => (
                              <div
                                key={order.id}
                                className="p-6 hover:bg-black/40 border border-white/5 shadow-inner transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                                        #{index + 1}
                                      </span>
                                      <span className="text-lg font-bold text-white">
                                        Order #{order.id}
                                      </span>
                                      <span
                                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                          order.status === "pending"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : order.status === "completed"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-slate-200"
                                        }`}
                                      >
                                        {order.status}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-300">
                                      Customer: {getCustomerName(order.user_id, order.user_email, order.user_name)}
                                    </p>
                                    <p className="text-sm text-slate-400">
                                      {new Date(order.created_at).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-orange-400">₹{order.total_price}</p>
                                    <button
                                      onClick={() => handleViewOrder(order)}
                                      className="mt-2 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                                    >
                                      View Details
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === "staff" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-xl p-6 shadow md:col-span-2">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                 Staff Registrations
                 <button onClick={fetchStaffRegistrations} className="ml-4 text-sm font-normal text-orange-400 hover:underline">Refresh</button>
              </h3>
              {staffRegistrations.length === 0 ? (
                <div className="text-slate-400 py-8 text-center border-2 border-dashed border-white/10 rounded-xl">No pending or approved staff registrations.</div>
              ) : (
                <div className="space-y-4">
                  {staffRegistrations.map((s) => (
                    <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-black/40 border border-white/5 shadow-inner border border-white/10 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="mb-4 sm:mb-0">
                        <div className="font-bold text-lg text-white">{s.name}</div>
                        <div className="text-sm text-slate-300 mb-2">{s.email}</div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase ${
                              s.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              s.status === 'approved' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {s.status}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                        {s.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleApproveStaff(s.id)} 
                              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl shadow-sm hover:from-green-600 hover:to-emerald-600 transition-all"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectStaff(s.id)} 
                              className="flex-1 sm:flex-none px-4 py-2 bg-white/5 border border-red-400/50 text-red-400 font-bold rounded-xl shadow-sm hover:bg-red-500/20 transition-all"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleDeleteStaff(s.id)} 
                          className="flex-1 sm:flex-none px-4 py-2 bg-red-600/20 border border-red-600/40 text-red-400 font-bold rounded-xl hover:bg-red-600/40 transition-all"
                          title="Permanently delete this staff"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-2xl font-bold text-white">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h3>
            </div>
            <form onSubmit={handleAddOrEdit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-black/40 text-white placeholder-slate-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-black/40 text-white placeholder-slate-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2 bg-black/40 text-white placeholder-slate-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-4 py-2 bg-black/40 text-white placeholder-slate-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_available"
                    checked={formData.is_available}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    className="w-4 h-4 text-orange-400 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="is_available" className="text-sm font-medium text-slate-200">
                    Available for order
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 px-4 py-2 border border-white/20 text-slate-200 rounded-lg font-medium hover:bg-black/40 border border-white/5 shadow-inner transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
                >
                  {editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quantity Modal for Quick Menu */}
      {showQuantityModal && selectedMenuItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">Add {selectedMenuItem.name}</h3>
            <p className="text-slate-300 mb-4">{selectedMenuItem.description}</p>
            <p className="text-lg font-semibold text-orange-400 mb-4">₹{selectedMenuItem.price}</p>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Number of Items Available
              </label>
              <input
                type="number"
                min="1"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="Enter quantity"
                className="w-full px-4 py-2 bg-black/40 text-white placeholder-slate-400 border-2 border-white/20 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setSelectedMenuItem(null);
                  setQuantityInput("");
                }}
                className="flex-1 px-4 py-2 border border-white/20 text-slate-200 rounded-lg font-medium hover:bg-black/40 border border-white/5 shadow-inner transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const qty = parseInt(quantityInput);
                  if (!selectedMenuItem || !quantityInput || isNaN(qty) || qty < 1) {
                    alert("Please enter a valid quantity");
                    return;
                  }

                  try {
                    const res = await fetch(`/api/admin/food-items`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        name: selectedMenuItem.name,
                        description: selectedMenuItem.description,
                        price: selectedMenuItem.price,
                        image_url: "",
                        is_available: true,
                      }),
                    });

                    if (!res.ok) {
                      const txt = await res.text();
                      alert('Failed to add item: ' + txt);
                      return;
                    }

                    const newItem = await res.json();
                    setFoodItems([newItem, ...foodItems]);
                    showToast(`Added ${selectedMenuItem.name} with ${qty} items available`);
                    setShowQuantityModal(false);
                    setSelectedMenuItem(null);
                    setQuantityInput("");
                  } catch (e) {
                    console.error('Error adding item:', e);
                    alert('Error adding item');
                  }
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-2xl font-bold text-white">Order #{selectedOrder.id}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <p className="text-sm text-slate-300">Customer</p>
                <p className="font-medium text-white">{getCustomerName(selectedOrder.user_id, selectedOrder.user_email, selectedOrder.user_name)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-300">Order Time</p>
                <p className="font-medium text-white">
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-300 mb-3">Items</p>
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between mb-2 p-3 bg-black/40 border border-white/5 shadow-inner rounded-lg">
                    <div>
                      <p className="font-medium text-white">{item.food_item_name}</p>
                      <p className="text-sm text-slate-300">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-white">
                      ₹{(item.price_at_time * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-orange-400">
                    ₹{selectedOrder.total_price}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/10">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Import JSON Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl w-full max-w-2xl p-6">
            <h3 className="text-xl font-semibold mb-3">Import menu JSON</h3>
            <p className="text-sm text-slate-400 mb-3">Paste an array of menu items (name, price, description, image_url, optional id). Imported items will be saved to local changes.</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} className="w-full h-48 p-3 bg-black/40 text-white placeholder-slate-400 border border-white/20 rounded mb-3" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
              <button onClick={importLocalItemsFromJSON} className="px-4 py-2 bg-orange-500/100 text-white rounded">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Local items modal */}
      {showLocalList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Pending local items ({localItemsList.length})</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowLocalList(false); }} className="px-3 py-1 bg-gray-100 rounded">Close</button>
                <button onClick={() => { void syncLocalToServer(); setShowLocalList(false); }} className="px-3 py-1 bg-orange-500/100 text-white rounded">Sync now</button>
              </div>
            </div>
            {localItemsList.length === 0 ? (
              <div className="text-sm text-slate-400">No local items</div>
            ) : (
              <div className="space-y-3">
                {localItemsList.map((it) => (
                  <div key={it.id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-sm text-slate-400">₹{it.price} • {it.description?.slice(0,80)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { publishLocalItem(it.id); }} className="px-3 py-1 bg-orange-100 text-orange-700 rounded">Publish</button>
                      <button onClick={() => { deleteLocalItem(it.id); }} className="px-3 py-1 bg-red-100 text-red-700 rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Small toast for actions */}
      {toastMsg && (
        <div className="fixed right-4 bottom-6 z-50">
          <div className="bg-black text-white px-4 py-2 rounded-lg shadow-lg">{toastMsg}</div>
        </div>
      )}
    </div>
  );
}
