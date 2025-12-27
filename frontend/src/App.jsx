
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeeConfiguration from './pages/FeeConfiguration';
import Students from './pages/Students';
import FeeCollection from './pages/FeeCollection';
import UserManagement from './pages/UserManagement';
import TransportConfiguration from './pages/TransportConfiguration';
import PaymentConfiguration from './pages/PaymentConfiguration';

import Reports from './pages/Reports';
import DueReports from './pages/DueReports';
import Documentation from './pages/Documentation';

function App() {
  return (
    <Router>
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
        <Route path="/payment-config" element={<PaymentConfiguration />} />
      </Routes>
    </Router>
  );
}

export default App;
