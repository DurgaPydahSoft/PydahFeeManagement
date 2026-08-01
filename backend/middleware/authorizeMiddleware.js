/**
 * Maps API paths to the frontend permission paths / feature flags required for access.
 * Superadmin bypasses all checks. Rules are matched longest-prefix-first.
 */
const API_ACCESS_RULES = [
  {
    prefix: '/api/reports/dashboard-stats',
    permissions: ['/dashboard'],
  },
  {
    prefix: '/api/reports/transactions',
    permissions: ['/reports', 'reports_daily_collection', 'reports_cashier_summary', 'reports_fee_head_summary', 'reports_account_wise'],
  },
  {
    prefix: '/api/reports/dues',
    permissions: ['/due-reports'],
  },
  {
    prefix: '/api/users',
    permissions: ['/user-management'],
  },
  {
    prefix: '/api/employees',
    permissions: ['/user-management'],
  },
  {
    prefix: '/api/fee-heads',
    permissions: ['/fee-config', '/fee-collection'],
  },
  {
    prefix: '/api/fee-groups',
    permissions: ['/fee-config', '/reports', 'reports_fee_head_summary'],
  },
  {
    prefix: '/api/fee-structures',
    permissions: ['/fee-config', '/fee-collection', '/bulk-fee-upload', '/hostel-config'],
  },
  {
    prefix: '/api/late-fees',
    permissions: ['/fee-config'],
  },
  {
    prefix: '/api/bulk-fee',
    permissions: ['/bulk-fee-upload'],
  },
  {
    prefix: '/api/payment-config',
    permissions: ['/payment-config', '/fee-collection'],
  },
  {
    prefix: '/api/academic-calendar',
    permissions: ['/academic-calendar', '/fee-config', '/reminders'],
  },
  {
    prefix: '/api/concession-approvers',
    permissions: ['/fee-collection', '/concessions', '/user-management'],
  },
  {
    prefix: '/api/transactions',
    permissions: ['/fee-collection', '/bulk-fee-upload'],
  },
  {
    prefix: '/api/permissions',
    permissions: ['/permissions'],
  },
  {
    prefix: '/api/proceedings',
    permissions: ['proceedings_view', '/proceedings', '/fee-collection'],
  },
  {
    prefix: '/api/concessions',
    permissions: ['/concessions', '/fee-collection'],
  },
  {
    prefix: '/api/overall-concessions',
    permissions: ['/overall-concessions'],
  },
  {
    prefix: '/api/reminders',
    permissions: ['/reminders'],
  },
  {
    prefix: '/api/students',
    permissions: [
      '/students',
      '/fee-collection',
      '/fee-config',
      '/hostel-config',
      '/bulk-fee-upload',
      '/permissions',
      '/due-reports',
      '/concessions',
      '/overall-concessions',
      '/proceedings',
      '/reminders',
      '/transport-config',
    ],
  },
  {
    prefix: '/api/settings',
    permissions: ['/settings', '/fee-collection'],
  },
  {
    prefix: '/api/hostels',
    permissions: ['/hostel-config', '/fee-config'],
  },
  {
    prefix: '/api/transport',
    permissions: ['/transport-config', '/fee-collection'],
  },
].sort((a, b) => b.prefix.length - a.prefix.length);

const findRule = (path) => API_ACCESS_RULES.find((rule) => path.startsWith(rule.prefix));

const hasPermission = (user, permissionList = []) => {
  const userPerms = user?.permissions || [];
  return permissionList.some((p) => userPerms.includes(p));
};

const checkTransactionAccess = (req, user) => {
  if (req.method === 'PUT') {
    return hasPermission(user, ['fee_collection_edit']);
  }

  if (req.method !== 'POST') {
    return hasPermission(user, ['/fee-collection', '/bulk-fee-upload']);
  }

  const body = req.body || {};
  const firstTx = Array.isArray(body.transactions) ? body.transactions[0] : body;
  const txType = firstTx?.transactionType || 'DEBIT';

  if (txType === 'CREDIT') {
    return (
      hasPermission(user, ['fee_collection_concession']) ||
      hasPermission(user, ['/fee-collection', '/bulk-fee-upload'])
    );
  }

  return (
    hasPermission(user, ['fee_collection_pay']) ||
    hasPermission(user, ['/fee-collection', '/bulk-fee-upload'])
  );
};

const authorize = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const path = req.originalUrl.split('?')[0];

  // Restrict User Management changes (POST/PUT/DELETE) strictly to superadmin
  if (path.startsWith('/api/users')) {
    // Allow any authenticated user to retrieve their own profile details
    if (path === '/api/users/me' && req.method === 'GET') {
      return next();
    }

    if (req.method === 'GET') {
      if (user.role === 'superadmin' || user.role === 'admin' || hasPermission(user, ['/user-management'])) {
        return next();
      }
    } else {
      if (user.role === 'superadmin') {
        return next();
      }
    }
    return res.status(403).json({ message: 'Forbidden: User Management changes require superadmin privileges' });
  }


  if (user.role === 'superadmin' || user.role === 'admin') {
    return next();
  }

  // Restrict proceeding approve to proceedings_approve (controller also enforces)
  if (path.match(/^\/api\/proceedings\/[^/]+\/approve$/) && req.method === 'PUT') {
    if (hasPermission(user, ['proceedings_approve'])) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: proceedings approve permission required' });
  }

  // Restrict proceeding changes (POST/PUT/DELETE) to proceedings_edit
  if (path.startsWith('/api/proceedings') && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')) {
    if (hasPermission(user, ['proceedings_edit'])) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: proceedings edit/create permission required' });
  }

  // Restrict Concession process/bulk-process/modify-approved (PUT requests) strictly to /concessions permission
  if (path.startsWith('/api/concessions') && req.method === 'PUT') {
    if (hasPermission(user, ['/concessions'])) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: concession approvals require concessions permission' });
  }

  // Restrict Concession Approver modifications/management strictly to /concessions or /user-management
  if (path.startsWith('/api/concession-approvers')) {
    const isBasicGet = req.method === 'GET' && path === '/api/concession-approvers';
    if (!isBasicGet) {
      if (hasPermission(user, ['/concessions', '/user-management'])) {
        return next();
      }
      return res.status(403).json({ message: 'Forbidden: concession approver management requires concessions or user management permissions' });
    }
  }

  // Dashboard overview is the default landing page for all authenticated staff
  if (path.startsWith('/api/reports/dashboard-stats')) {
    return next();
  }

  if (path.startsWith('/api/campuses')) {
    return next();
  }

  if (path.startsWith('/api/transactions')) {
    if (checkTransactionAccess(req, user)) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: insufficient permissions for this transaction' });
  }

  const rule = findRule(path);
  if (!rule) {
    return res.status(403).json({ message: 'Forbidden: endpoint not configured for access control' });
  }

  if (rule.superadminOnly) {
    return res.status(403).json({ message: 'Forbidden: superadmin access required' });
  }

  if (hasPermission(user, rule.permissions)) {
    return next();
  }

  return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
};

module.exports = { authorize, API_ACCESS_RULES };
