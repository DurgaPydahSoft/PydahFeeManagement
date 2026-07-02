
import { useState, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Documentation from './pages/Documentation';
import Dashboard from './pages/Dashboard';
import FeeConfiguration from './pages/FeeConfiguration';
import Students from './pages/Students';
import FeeCollection from './pages/FeeCollection';
import UserManagement from './pages/UserManagement';
import TransportConfiguration from './pages/TransportConfiguration';
import HostelConfiguration from './pages/HostelConfiguration';
import PaymentConfiguration from './pages/PaymentConfiguration';
import ReminderConfiguration from './pages/ReminderConfiguration';
import AcademicCalendar from './pages/AcademicCalendar';
import BulkFeeUpload from './pages/BulkFeeUpload';
import ConcessionManagement from './pages/ConcessionManagement';
import OverallConcession from './pages/OverallConcession';
import Permissions from './pages/Permissions';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import Proceedings from './pages/Proceedings';
import Reports from './pages/Reports';
import DueReports from './pages/DueReports';
import VerifyReceipt from './pages/VerifyReceipt';
import useSessionGuard from './lib/useSessionGuard';
import SessionDisplacedModal from './components/SessionDisplacedModal';
import { isAuthenticated, getStoredUser } from './lib/auth';

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  const user = getStoredUser();
  const role = user?.role;
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  
  // Super admin and Admin bypass permission checks
  if (role === 'superadmin' || role === 'admin') {
    return children;
  }
  
  // User Profile is always allowed
  if (location.pathname === '/user-profile') {
    return children;
  }
  
  // Check if user has permission for the current path
  const hasPermission = permissions.includes(location.pathname);
  if (!hasPermission) {
    // Redirect to the first permitted route, or user profile, or dashboard
    const defaultRoute = permissions.length > 0 ? permissions[0] : '/user-profile';
    return <Navigate to={defaultRoute} replace />;
  }
  
  return children;
};

function App() {
  // Show the security modal if we were displaced from another device login
  const [showDisplaced, setShowDisplaced] = useState(
    () => sessionStorage.getItem('session_displaced') === '1'
  );

  const handleCloseDisplaced = () => {
    sessionStorage.removeItem('session_displaced');
    setShowDisplaced(false);
  };

  // Establish SSE connection for real-time single-device enforcement
  useSessionGuard();

  return (
    <Router>
      {/* Security modal — shown when this session was displaced by another device */}
      {showDisplaced && <SessionDisplacedModal onClose={handleCloseDisplaced} />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/public/verify-receipt/:receiptNumber" element={<VerifyReceipt />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/fee-config" element={<ProtectedRoute><FeeConfiguration /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
          <Route path="/fee-collection" element={<ProtectedRoute><FeeCollection /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/due-reports" element={<ProtectedRoute><DueReports /></ProtectedRoute>} />
          <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/transport-config" element={<ProtectedRoute><TransportConfiguration /></ProtectedRoute>} />
          <Route path="/hostel-config" element={<ProtectedRoute><HostelConfiguration /></ProtectedRoute>} />
          <Route path="/payment-config" element={<ProtectedRoute><PaymentConfiguration /></ProtectedRoute>} />
          <Route path="/reminders" element={<ProtectedRoute><ReminderConfiguration /></ProtectedRoute>} />
          <Route path="/academic-calendar" element={<ProtectedRoute><AcademicCalendar /></ProtectedRoute>} />
          <Route path="/bulk-fee-upload" element={<ProtectedRoute><BulkFeeUpload /></ProtectedRoute>} />
          <Route path="/concessions" element={<ProtectedRoute><ConcessionManagement /></ProtectedRoute>} />
          <Route path="/overall-concessions" element={<ProtectedRoute><OverallConcession /></ProtectedRoute>} />
          <Route path="/permissions" element={<ProtectedRoute><Permissions /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/user-profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/proceedings" element={<ProtectedRoute><Proceedings /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
