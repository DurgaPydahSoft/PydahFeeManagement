
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Documentation from './pages/Documentation';

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
  </div>
);

const Dashboard = lazy(() => import('./pages/Dashboard'));
const FeeConfiguration = lazy(() => import('./pages/FeeConfiguration'));
const Students = lazy(() => import('./pages/Students'));
const FeeCollection = lazy(() => import('./pages/FeeCollection'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const TransportConfiguration = lazy(() => import('./pages/TransportConfiguration'));
const HostelConfiguration = lazy(() => import('./pages/HostelConfiguration'));
const PaymentConfiguration = lazy(() => import('./pages/PaymentConfiguration'));
const ReminderConfiguration = lazy(() => import('./pages/ReminderConfiguration'));
const AcademicCalendar = lazy(() => import('./pages/AcademicCalendar'));
const BulkFeeUpload = lazy(() => import('./pages/BulkFeeUpload'));
const ConcessionManagement = lazy(() => import('./pages/ConcessionManagement'));
const OverallConcession = lazy(() => import('./pages/OverallConcession'));
const Permissions = lazy(() => import('./pages/Permissions'));
const Settings = lazy(() => import('./pages/Settings'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Proceedings = lazy(() => import('./pages/Proceedings'));
const Reports = lazy(() => import('./pages/Reports'));
const DueReports = lazy(() => import('./pages/DueReports'));

function App() {
  return (
    <Router>
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
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
