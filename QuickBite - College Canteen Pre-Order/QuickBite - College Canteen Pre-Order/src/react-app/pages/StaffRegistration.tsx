import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, UserPlus, ArrowLeft, Mail, Lock, User } from "lucide-react";

export default function StaffRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/staff-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit registration");
      }

      setSuccess(true);
      setFormData({ name: "", email: "", password: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen  flex flex-col justify-center items-center p-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted!</h2>
          <p className="text-slate-300 mb-6">
            Your staff account request has been sent to the administrators. You will be able to log in once they approve it.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-md hover:from-orange-600 hover:to-amber-600 transition-all"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  flex flex-col justify-center p-4">
      <div className="max-w-md w-full mx-auto">
        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 text-slate-300 hover:text-orange-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Login
        </button>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-3xl shadow-2xl p-8 border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center transform rotate-12 shadow-inner mb-6">
              <UtensilsCrossed className="w-8 h-8 text-white transform -rotate-12" />
            </div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
              Staff Registration
            </h1>
            <p className="text-slate-400 mt-2 text-center">
              Apply for a staff account to place pre-orders. Requires admin approval.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5 ml-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/5 shadow-inner border border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/5 shadow-inner border border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  placeholder="staff@college.edu"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/5 shadow-inner border border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 ml-1">
                You will use this password to log in after your request is approved.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-md hover:from-orange-600 hover:to-amber-600 focus:ring-4 focus:ring-orange-200 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              {isSubmitting ? "Submitting..." : "Submit Registration Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
