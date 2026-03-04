import { useState } from 'react';
import { storage } from '../utils/storage';

function Profile({ user, onUserUpdate, theme, onThemeChange, rpeEnabled, onRpeEnabledChange, growthSettings, onGrowthSettingsChange, oneRmUnit, onOneRmUnitChange }) {
  const [isSignedIn, setIsSignedIn] = useState(!!user);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [showSignIn, setShowSignIn] = useState(!user);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localGrowthSettings, setLocalGrowthSettings] = useState(growthSettings);

  const handleSignIn = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter your name');
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email || '',
      signedInAt: new Date().toISOString(),
    };

    storage.saveUser(newUser);
    onUserUpdate(newUser);
    setIsSignedIn(true);
    setShowSignIn(false);
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      storage.clearUser();
      onUserUpdate(null);
      setIsSignedIn(false);
      setShowSignIn(true);
      setFormData({ name: '', email: '' });
    }
  };

  const handleThemeChange = (newTheme) => {
    onThemeChange(newTheme);
    storage.saveTheme(newTheme);
  };

  const handleRpeToggle = () => {
    const nextValue = !rpeEnabled;
    onRpeEnabledChange(nextValue);
    storage.saveRpeEnabled(nextValue);
  };

  const handleGrowthSettingUpdate = (patch) => {
    const next = { ...localGrowthSettings, ...patch };
    setLocalGrowthSettings(next);
    onGrowthSettingsChange(next);
  };

  const handleBenchmarkChange = (index, field, value) => {
    const benchmarks = [...(localGrowthSettings?.benchmarks || [])];
    benchmarks[index] = { ...benchmarks[index], [field]: value };
    handleGrowthSettingUpdate({ benchmarks });
  };

  const handleResetAllData = () => {
    const confirmed = window.confirm(
      'This will permanently delete all workouts, routines, exercises, and profile data. Continue?'
    );
    if (!confirmed) return;

    storage.clearAll();
    onUserUpdate(null);
    onThemeChange('system');
    setIsSignedIn(false);
    setShowSignIn(true);
    setFormData({ name: '', email: '' });
    window.location.reload();
  };

  return (
    <div className="profile-page space-y-6 max-w-2xl mx-auto text-gray-900 dark:text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">👤 Profile</h2>
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      {settingsOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
          <h3 className="text-xl font-bold">Settings</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              RPE
            </label>
            <button
              type="button"
              onClick={handleRpeToggle}
              className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
                rpeEnabled
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {rpeEnabled ? 'RPE On' : 'RPE Off'}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                ☀️ Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  theme === 'dark'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                🌙 Dark
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  theme === 'system'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                ⚙️ System
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              1RM Units
            </label>
            <select
              value={oneRmUnit || 'kg'}
              onChange={(e) => onOneRmUnitChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold mb-3">Growth Settings</h4>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Baseline Window
                </label>
                <select
                  value={localGrowthSettings?.baselineDays ?? 7}
                  onChange={(e) => handleGrowthSettingUpdate({ baselineDays: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={7}>First 7 days</option>
                  <option value={14}>First 14 days</option>
                  <option value={21}>First 21 days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Averaging
                </label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => handleGrowthSettingUpdate({ weightedAverage: true })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      localGrowthSettings?.weightedAverage
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    Weighted
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrowthSettingUpdate({ weightedAverage: false })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      localGrowthSettings?.weightedAverage === false
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    Simple Avg
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Include Accessories
                </label>
                <button
                  type="button"
                  onClick={() => handleGrowthSettingUpdate({ includeAccessories: !localGrowthSettings?.includeAccessories })}
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
                    localGrowthSettings?.includeAccessories
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  {localGrowthSettings?.includeAccessories ? 'On' : 'Off'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  e1RM Formula
                </label>
                <select
                  value={localGrowthSettings?.formula || 'epley'}
                  onChange={(e) => handleGrowthSettingUpdate({ formula: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="epley">Epley (default)</option>
                  <option value="brzycki">Brzycki</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Benchmark Weights
                </label>
                <div className="space-y-2">
                  {(localGrowthSettings?.benchmarks || []).map((b, idx) => (
                    <div key={`${b.name}-${idx}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={b.name}
                        onChange={(e) => handleBenchmarkChange(idx, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={b.weight}
                        onChange={(e) => handleBenchmarkChange(idx, 'weight', parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isSignedIn && (
            <button
              onClick={handleSignOut}
              className="w-full text-red-600 border border-red-500 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Log Out
            </button>
          )}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleResetAllData}
              className="w-full px-4 py-3 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Reset All Data
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This will delete all workouts, routines, exercises, and profile data.
            </p>
          </div>
        </div>
      )}

      {!isSignedIn ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Sign In</h3>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter your email"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{user.name}</h3>
                {user.email && <p className="text-gray-600 dark:text-gray-400">{user.email}</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Profile;
