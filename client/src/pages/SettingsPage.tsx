import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'taxstack_settings';

interface Settings {
  anthropicKey: string;
  tallyUrl: string;
  companyName: string;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...getDefaults(), ...JSON.parse(raw) };
  } catch {}
  return getDefaults();
}

function getDefaults(): Settings {
  return { anthropicKey: '', tallyUrl: 'http://localhost:9000', companyName: '' };
}

function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Export for use by other pages
export function getSettings(): Settings {
  return loadSettings();
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(getDefaults());
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const maskedKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 12) return '*'.repeat(key.length);
    return key.slice(0, 7) + '...' + key.slice(-4);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure API keys, Tally connection, and preferences</p>
      </div>

      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          </div>
          <p className="text-sm text-green-700 font-medium">Settings saved successfully</p>
        </div>
      )}

      <div className="space-y-5">
        {/* Anthropic API Key */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Anthropic API Key</h3>
              <p className="text-xs text-gray-400">Required for AI-powered Invoice OCR (Claude Vision). Get your key from console.anthropic.com</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.anthropicKey}
                onChange={e => setSettings(s => ({ ...s, anthropicKey: e.target.value }))}
                placeholder="sk-ant-api03-..."
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition pr-20"
              />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {settings.anthropicKey && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-600 font-medium">Key configured: {maskedKey(settings.anthropicKey)}</span>
            </div>
          )}
          {!settings.anthropicKey && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">Without an API key, OCR will use Tesseract (free, local) which works well for digital PDFs but is less accurate on photos and scans.</p>
            </div>
          )}
        </div>

        {/* Tally Configuration */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Tally Integration</h3>
              <p className="text-xs text-gray-400">Configure connection to Tally ERP 9 / Prime for auto-push</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1 font-medium">Tally XML Server URL</label>
              <input value={settings.tallyUrl} onChange={e => setSettings(s => ({ ...s, tallyUrl: e.target.value }))}
                placeholder="http://localhost:9000"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1 font-medium">Default Company Name</label>
              <input value={settings.companyName} onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))}
                placeholder="Your company name in Tally"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" />
            </div>
          </div>
          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-xs text-indigo-700">To enable Push to Tally: Open Tally &gt; F12 &gt; Advanced Configuration &gt; Set "Enable XML Server" to Yes (default port: 9000)</p>
          </div>
        </div>

        {/* About */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">About TaxStack</h3>
              <p className="text-xs text-gray-400">Version and system information</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg"><span className="text-gray-500 text-xs">Version</span><p className="font-semibold text-gray-800">2.0.0</p></div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="text-gray-500 text-xs">License</span><p className="font-semibold text-gray-800">Professional</p></div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="text-gray-500 text-xs">OCR Engine</span><p className="font-semibold text-gray-800">{settings.anthropicKey ? 'Claude Vision + Tesseract' : 'Tesseract (Local)'}</p></div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="text-gray-500 text-xs">Tally Push</span><p className="font-semibold text-gray-800">{settings.tallyUrl || 'Not configured'}</p></div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handleSave}
          className="btn-primary px-8 py-3 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Save Settings
        </button>
      </div>
    </div>
  );
}
