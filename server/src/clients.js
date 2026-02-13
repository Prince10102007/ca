/**
 * Multi-Client Management Module
 * JSON-file based storage for managing multiple clients/companies
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const clientsDir = path.join(__dirname, '..', 'data', 'clients');

// Ensure data directory exists
if (!fs.existsSync(clientsDir)) {
  fs.mkdirSync(clientsDir, { recursive: true });
}

/**
 * Create a new client
 */
function createClient(clientData) {
  const id = uuidv4();
  const client = {
    id,
    name: clientData.name,
    tradeName: clientData.tradeName || clientData.name,
    gstin: clientData.gstin || null,
    pan: clientData.pan || (clientData.gstin ? clientData.gstin.substring(2, 12) : null),
    stateCode: clientData.stateCode || (clientData.gstin ? clientData.gstin.substring(0, 2) : null),
    address: clientData.address || '',
    email: clientData.email || '',
    phone: clientData.phone || '',
    contactPerson: clientData.contactPerson || '',
    gstType: clientData.gstType || 'regular', // regular, composition, unregistered
    filingFrequency: clientData.filingFrequency || 'monthly', // monthly, quarterly
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const clientDir = path.join(clientsDir, id);
  fs.mkdirSync(clientDir, { recursive: true });
  fs.mkdirSync(path.join(clientDir, 'periods'), { recursive: true });
  fs.mkdirSync(path.join(clientDir, 'invoices'), { recursive: true });
  fs.writeFileSync(path.join(clientDir, 'info.json'), JSON.stringify(client, null, 2));

  return client;
}

/**
 * Get all clients
 */
function listClients() {
  if (!fs.existsSync(clientsDir)) return [];

  const dirs = fs.readdirSync(clientsDir).filter(d =>
    fs.statSync(path.join(clientsDir, d)).isDirectory()
  );

  return dirs.map(d => {
    const infoPath = path.join(clientsDir, d, 'info.json');
    if (fs.existsSync(infoPath)) {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      // Add period count
      const periodsDir = path.join(clientsDir, d, 'periods');
      info.periodCount = fs.existsSync(periodsDir)
        ? fs.readdirSync(periodsDir).filter(f => f.endsWith('.json')).length
        : 0;
      return info;
    }
    return null;
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a single client by ID
 */
function getClient(clientId) {
  const infoPath = path.join(clientsDir, clientId, 'info.json');
  if (!fs.existsSync(infoPath)) return null;
  return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
}

/**
 * Update a client
 */
function updateClient(clientId, updates) {
  const client = getClient(clientId);
  if (!client) return null;

  const updatable = ['name', 'tradeName', 'gstin', 'pan', 'stateCode', 'address',
    'email', 'phone', 'contactPerson', 'gstType', 'filingFrequency'];

  for (const key of updatable) {
    if (updates[key] !== undefined) client[key] = updates[key];
  }
  client.updatedAt = new Date().toISOString();

  fs.writeFileSync(path.join(clientsDir, clientId, 'info.json'), JSON.stringify(client, null, 2));
  return client;
}

/**
 * Delete a client
 */
function deleteClient(clientId) {
  const clientDir = path.join(clientsDir, clientId);
  if (!fs.existsSync(clientDir)) return false;
  fs.rmSync(clientDir, { recursive: true, force: true });
  return true;
}

/**
 * Save period data for a client (e.g., Jan-2024 reconciliation)
 */
function savePeriodData(clientId, period, data) {
  const periodsDir = path.join(clientsDir, clientId, 'periods');
  if (!fs.existsSync(periodsDir)) fs.mkdirSync(periodsDir, { recursive: true });

  const periodKey = period.replace(/[^a-zA-Z0-9-]/g, '_');
  const periodData = {
    period,
    periodKey,
    savedAt: new Date().toISOString(),
    ...data
  };

  fs.writeFileSync(path.join(periodsDir, `${periodKey}.json`), JSON.stringify(periodData));
  return periodData;
}

/**
 * Get period data for a client
 */
function getPeriodData(clientId, periodKey) {
  const filePath = path.join(clientsDir, clientId, 'periods', `${periodKey}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * List all periods for a client
 */
function listPeriods(clientId) {
  const periodsDir = path.join(clientsDir, clientId, 'periods');
  if (!fs.existsSync(periodsDir)) return [];

  return fs.readdirSync(periodsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(periodsDir, f), 'utf8'));
      return {
        period: data.period,
        periodKey: data.periodKey,
        savedAt: data.savedAt,
        hasReconciliation: !!data.reconciliationResult,
        hasSalesData: !!data.salesData,
        hasGstr1Data: !!data.gstr1Data,
        hasGstr2aData: !!data.gstr2aData,
        hasGstr3b: !!data.gstr3bData
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period));
}

/**
 * Get client dashboard summary
 */
function getClientDashboard(clientId) {
  const client = getClient(clientId);
  if (!client) return null;

  const periods = listPeriods(clientId);
  const recentPeriods = periods.slice(0, 12);

  // Calculate filing status
  const dashboard = {
    client,
    periods: recentPeriods,
    totalPeriods: periods.length,
    pendingFiling: 0,
    completedFiling: 0,
    totalTaxLiability: 0,
    totalITC: 0
  };

  for (const p of recentPeriods) {
    if (p.hasGstr3b) {
      dashboard.completedFiling++;
      const periodData = getPeriodData(clientId, p.periodKey);
      if (periodData && periodData.gstr3bData) {
        dashboard.totalTaxLiability += periodData.gstr3bData.totalLiability || 0;
        dashboard.totalITC += periodData.gstr3bData.totalITC || 0;
      }
    } else {
      dashboard.pendingFiling++;
    }
  }

  return dashboard;
}

module.exports = {
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  savePeriodData,
  getPeriodData,
  listPeriods,
  getClientDashboard
};
