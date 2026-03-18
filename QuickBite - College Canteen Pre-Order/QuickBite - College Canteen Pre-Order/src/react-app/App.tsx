import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./firebaseAuthContext";

import LoginPage from "./pages/Login";
import AdminDashboardPage from "./pages/AdminDashboard";
import MenuPage from "./pages/Menu";
import OrderConfirmationPage from "./pages/OrderConfirmation";
import StaffRegistrationPage from "./pages/StaffRegistration";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/staff-register" element={<StaffRegistrationPage />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
