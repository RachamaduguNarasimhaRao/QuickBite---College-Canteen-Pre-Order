import { useState } from "react";
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, User, Lock } from "lucide-react";
import { useAuth } from "../firebaseAuthContext";

export default function Login() {
  const { loading, lastError } = useAuth();
  const navigate = useNavigate();
  const { adminLogin, staffLogin } = useAuth() as any;
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedTab, setSelectedTab] = useState<"staff" | "admin">("staff");

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    setIsSubmitting(true);
    try {
      await adminLogin(adminId, adminPassword);
      navigate("/admin");
    } catch (err: any) {
      setAdminError(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setStaffError(null);
    setIsSubmitting(true);
    try {
      await staffLogin(staffId, staffPassword);
      navigate("/");
    } catch (err: any) {
      setStaffError(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 relative z-10">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Menu
        </button>
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center transform rotate-12 shadow-lg shadow-orange-500/30">
            <span className="text-3xl font-black text-white transform -rotate-12">QB</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-4xl font-extrabold text-white tracking-tight">
          Welcome Back
        </h2>
        <p className="mt-2 text-center text-slate-400">Sign in to access your dashboard</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/5 backdrop-blur-2xl py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10 border border-white/10 relative overflow-hidden">
          {/* Subtle glow effect behind card content */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex bg-black/40 p-1.5 rounded-xl mb-8 border border-white/5 relative z-10">
            <button
              onClick={() => setSelectedTab('staff')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                selectedTab === 'staff' ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Staff Portal
            </button>
            <button
              onClick={() => setSelectedTab('admin')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                selectedTab === 'admin' ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Admin Portal
            </button>
          </div>

          {selectedTab === 'staff' && (
            <form onSubmit={handleStaffLogin} className="space-y-6 relative z-10">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Staff Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 bg-black/40 border border-white/10 rounded-xl text-white shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all sm:text-sm"
                    placeholder="staff@college.edu"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 bg-black/40 border border-white/10 rounded-xl text-white shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {staffError && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{staffError}</div>}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-[0_10px_20px_-10px_rgba(249,115,22,0.5)] hover:shadow-[0_10px_20px_-5px_rgba(249,115,22,0.6)] text-sm font-extrabold text-white bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-70 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </button>
              </div>
              <div className="mt-6 text-center text-sm">
                <span className="text-slate-400">Don't have a staff account? </span>
                <Link to="/staff-register" className="font-bold text-orange-400 hover:text-orange-300 transition-colors">
                  Register here
                </Link>
              </div>
            </form>
          )}

          {selectedTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-6 relative z-10">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Admin Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                  </div>
                  <input
                    required
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 bg-black/40 border border-white/10 rounded-xl text-white shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all sm:text-sm"
                    placeholder="admin123"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 bg-black/40 border border-white/10 rounded-xl text-white shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {adminError && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{adminError}</div>}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg hover:shadow-xl text-sm font-extrabold text-white bg-white/10 hover:bg-white/20 border border-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/20 disabled:opacity-70 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? "Authenticating..." : "Admin Access"}
                </button>
              </div>
            </form>
          )}

        </div>
        
        {lastError && (
          <div className="mt-6 text-center bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 shadow-lg backdrop-blur-md text-sm relative z-10">
            {lastError}
          </div>
        )}
      </div>
    </div>
  );
}
