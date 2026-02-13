import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { formatCurrency } from '../utils/format';

interface Client {
  id: string;
  name: string;
  tradeName: string;
  gstin: string | null;
  email: string;
  phone: string;
  contactPerson: string;
  gstType: string;
  filingFrequency: string;
  periodCount?: number;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [form, setForm] = useState({ name: '', tradeName: '', gstin: '', email: '', phone: '', contactPerson: '', gstType: 'regular', filingFrequency: 'monthly', address: '' });
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleSave = async () => {
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, form);
      } else {
        await api.createClient(form);
      }
      setShowForm(false);
      setEditingClient(null);
      setForm({ name: '', tradeName: '', gstin: '', email: '', phone: '', contactPerson: '', gstType: 'regular', filingFrequency: 'monthly', address: '' });
      loadClients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this client? All data will be lost.')) return;
    await api.deleteClient(id);
    loadClients();
    if (selectedClient?.client?.id === id) setSelectedClient(null);
  };

  const handleViewDashboard = async (client: Client) => {
    try {
      const dashboard = await api.getClientDashboard(client.id);
      setSelectedClient(dashboard);
    } catch (err: any) { alert(err.message); }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm({ name: client.name, tradeName: client.tradeName || '', gstin: client.gstin || '', email: client.email || '', phone: client.phone || '', contactPerson: client.contactPerson || '', gstType: client.gstType || 'regular', filingFrequency: client.filingFrequency || 'monthly', address: '' });
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Client Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage multiple clients and their GST filing data</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingClient(null); setForm({ name: '', tradeName: '', gstin: '', email: '', phone: '', contactPerson: '', gstType: 'regular', filingFrequency: 'monthly', address: '' }); }}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Client
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : clients.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <p className="text-gray-700 font-semibold text-lg">No clients yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first client to start managing their GST data</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client, i) => (
            <div key={client.id} className="card p-6 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    {client.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{client.name}</h3>
                    {client.tradeName && client.tradeName !== client.name && (
                      <p className="text-xs text-gray-400">{client.tradeName}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${client.gstType === 'regular' ? 'badge-info' : client.gstType === 'composition' ? 'badge-missing' : 'bg-gray-100 text-gray-600'}`}>
                  {client.gstType}
                </span>
              </div>
              {client.gstin && <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 mb-3">GSTIN: {client.gstin}</p>}
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 flex-wrap">
                {client.email && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>{client.email}</span>}
                {client.phone && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>{client.phone}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4 border-t border-gray-100 pt-3">
                <span>{client.periodCount || 0} periods</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span>{client.filingFrequency} filing</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleViewDashboard(client)} className="flex-1 btn-primary text-xs py-2">Dashboard</button>
                <button onClick={() => handleEdit(client)} className="btn-secondary text-xs px-3 py-2">Edit</button>
                <button onClick={() => handleDelete(client.id)} className="text-xs px-3 py-2 text-red-500 border border-red-200 rounded-[10px] hover:bg-red-50 transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedClient && (
        <div className="mt-8 card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedClient.client.name}</h3>
              <p className="text-sm text-gray-400">Client Dashboard</p>
            </div>
            <button onClick={() => setSelectedClient(null)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">&times;</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card card-gradient-blue"><p className="text-xs text-indigo-600 font-medium">Total Periods</p><p className="text-3xl font-extrabold text-indigo-700 mt-1">{selectedClient.totalPeriods}</p></div>
            <div className="stat-card card-gradient-green"><p className="text-xs text-emerald-600 font-medium">Filed</p><p className="text-3xl font-extrabold text-emerald-700 mt-1">{selectedClient.completedFiling}</p></div>
            <div className="stat-card card-gradient-amber"><p className="text-xs text-amber-600 font-medium">Pending</p><p className="text-3xl font-extrabold text-amber-700 mt-1">{selectedClient.pendingFiling}</p></div>
            <div className="stat-card card-gradient-purple"><p className="text-xs text-purple-600 font-medium">Total Tax</p><p className="text-2xl font-extrabold text-purple-700 mt-1">{formatCurrency(selectedClient.totalTaxLiability)}</p></div>
          </div>
          {selectedClient.periods && selectedClient.periods.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">Recent Periods</h4>
              <div className="space-y-2">
                {selectedClient.periods.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition">
                    <span className="font-semibold text-gray-700">{p.period}</span>
                    <div className="flex gap-2">
                      {p.hasReconciliation && <span className="badge-matched text-xs px-2.5 py-1 rounded-full">Reconciled</span>}
                      {p.hasGstr3b && <span className="badge-info text-xs px-2.5 py-1 rounded-full">3B Done</span>}
                      {!p.hasReconciliation && !p.hasGstr3b && <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full">Data Saved</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
              <p className="text-sm text-gray-400 mt-0.5">Fill in the client details below</p>
            </div>
            <div className="p-6 space-y-3">
              {[
                { key: 'name', label: 'Company Name *', placeholder: 'ABC Pvt Ltd' },
                { key: 'tradeName', label: 'Trade Name', placeholder: 'ABC Trading' },
                { key: 'gstin', label: 'GSTIN', placeholder: '27AABCU9603R1ZM' },
                { key: 'contactPerson', label: 'Contact Person', placeholder: 'Rajesh Kumar' },
                { key: 'email', label: 'Email', placeholder: 'abc@example.com' },
                { key: 'phone', label: 'Phone', placeholder: '9876543210' },
                { key: 'address', label: 'Address', placeholder: 'Mumbai, Maharashtra' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm text-gray-600 block mb-1 font-medium">{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 block mb-1 font-medium">GST Type</label>
                  <select value={form.gstType} onChange={e => setForm(f => ({ ...f, gstType: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                    <option value="regular">Regular</option>
                    <option value="composition">Composition</option>
                    <option value="unregistered">Unregistered</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1 font-medium">Filing Frequency</label>
                  <select value={form.filingFrequency} onChange={e => setForm(f => ({ ...f, filingFrequency: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (QRMP)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); setEditingClient(null); }} className="btn-secondary px-5 py-2.5 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={!form.name.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40">{editingClient ? 'Update' : 'Create'} Client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
