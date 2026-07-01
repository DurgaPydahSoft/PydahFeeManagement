
import { useState } from 'react';
import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
  </div>
);

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
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/fee-config" element={<FeeConfiguration />} />
          <Route path="/students" element={<Students />} />
          <Route path="/fee-collection" element={<FeeCollection />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/due-reports" element={<DueReports />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/transport-config" element={<TransportConfiguration />} />
          <Route path="/hostel-config" element={<HostelConfiguration />} />
          <Route path="/payment-config" element={<PaymentConfiguration />} />
          <Route path="/reminders" element={<ReminderConfiguration />} />
          <Route path="/academic-calendar" element={<AcademicCalendar />} />
          <Route path="/bulk-fee-upload" element={<BulkFeeUpload />} />
          <Route path="/concessions" element={<ConcessionManagement />} />
          <Route path="/overall-concessions" element={<OverallConcession />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/user-profile" element={<UserProfile />} />
          <Route path="/proceedings" element={<Proceedings />} />
          <Route path="/public/verify-receipt/:receiptNumber" element={<VerifyReceipt />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
