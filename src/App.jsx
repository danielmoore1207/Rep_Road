import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import CreateRoutine from './components/CreateRoutine';
import LogWorkout from './components/LogWorkout';
import History from './components/History';
import Profile from './components/Profile';
import { storage } from './utils/storage';
import { supabase, isSupabaseConfigured } from './utils/supabase';

function Navigation({ theme }) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Home', icon: '📊' },
    { path: '/routines', label: 'Routines', icon: '🏋️' },
    { path: '/history', label: 'History', icon: '📅' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  const navBg = theme === 'dark' ? 'bg-black' : 'bg-black';
  const navText = 'text-white';

  return (
    <nav
      className={`${navBg} ${navText} shadow-lg fixed bottom-0 left-0 right-0 z-50`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-2 rounded-lg transition-colors text-sm flex flex-col items-center ${
                location.pathname === item.path
                  ? 'border border-red-600 text-white'
                  : 'text-gray-300 hover:border hover:border-red-700'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[11px] leading-none mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function FloatingActionButton({ onClick, label = '+' }) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-24 right-6 ${label === '+' ? 'w-14 h-14 text-2xl' : 'px-4 py-3 text-sm'} bg-black text-red-500 border border-red-600 rounded-full shadow-lg hover:bg-red-900/20 transition-colors flex items-center justify-center z-50`}
      aria-label={label === '+' ? 'Log Workout' : label}
    >
      {label}
    </button>
  );
}

function App() {
  const [exercises, setExercises] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('system');
  const [rpeEnabled, setRpeEnabled] = useState(true);
  const [growthSettings, setGrowthSettings] = useState(storage.getGrowthSettings());
  const [oneRmUnit, setOneRmUnit] = useState(storage.getOneRmUnit());
  const [activeWorkout, setActiveWorkout] = useState(storage.getActiveWorkout());
  const [supabaseConfigured, setSupabaseConfigured] = useState(isSupabaseConfigured);
  const [supabaseError, setSupabaseError] = useState('');

  useEffect(() => {
    // Load local data
    const localExercises = storage.getExercises();
    setExercises(localExercises);
    setSessions(storage.getSessions());
    setRoutines(storage.getRoutines());
    setUser(storage.getUser());
    setTheme(storage.getTheme());
    setRpeEnabled(storage.getRpeEnabled());
    setGrowthSettings(storage.getGrowthSettings());
    setOneRmUnit(storage.getOneRmUnit());
    setActiveWorkout(storage.getActiveWorkout());

    // Load public exercises from Supabase and merge
    const loadPublicExercises = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id,name,muscle_group,description,created_at,is_public')
          .eq('is_public', true);

        if (error) {
          setSupabaseError(error.message || 'Supabase error');
          return;
        }
        if (!data) return;

        const publicExercises = data.map((ex) => ({
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscle_group,
          description: ex.description || '',
          createdAt: ex.created_at,
        }));

        // Merge by name + muscle group to avoid duplicates
        const merged = [...publicExercises, ...localExercises];
        const deduped = [];
        const seen = new Set();
        merged.forEach((ex) => {
          const key = `${ex.name}`.toLowerCase() + '|' + `${ex.muscleGroup}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(ex);
          }
        });

        setExercises(deduped);
      } catch (err) {
        setSupabaseError('Failed to load Supabase exercises.');
      }
    };

    loadPublicExercises();
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleExerciseUpdate = (updatedExercises) => {
    setExercises(updatedExercises);
  };

  const handleRoutineUpdate = (updatedRoutines) => {
    setRoutines(updatedRoutines);
  };

  const handleSessionAdd = (newSession) => {
    const updatedSessions = storage.addSession(newSession);
    setSessions(updatedSessions);
  };

  const handleSessionsUpdate = (updatedSessions) => {
    storage.saveSessions(updatedSessions);
    setSessions(updatedSessions);
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  const handleRpeEnabledChange = (enabled) => {
    setRpeEnabled(enabled);
  };

  const handleGrowthSettingsChange = (settings) => {
    setGrowthSettings(settings);
    storage.saveGrowthSettings(settings);
  };

  const handleOneRmUnitChange = (unit) => {
    setOneRmUnit(unit);
    storage.saveOneRmUnit(unit);
  };

  const handleActiveWorkoutChange = (workout) => {
    setActiveWorkout(workout);
    storage.saveActiveWorkout(workout);
  };

  const handleActiveWorkoutClear = () => {
    setActiveWorkout(null);
    storage.clearActiveWorkout();
  };

  return (
    <Router>
      <AppContent
        exercises={exercises}
        sessions={sessions}
        routines={routines}
        user={user}
        theme={theme}
        rpeEnabled={rpeEnabled}
        supabaseConfigured={supabaseConfigured}
        supabaseError={supabaseError}
        growthSettings={growthSettings}
        oneRmUnit={oneRmUnit}
        activeWorkout={activeWorkout}
        onExerciseUpdate={handleExerciseUpdate}
        onRoutineUpdate={handleRoutineUpdate}
        onSessionAdd={handleSessionAdd}
        onSessionsUpdate={handleSessionsUpdate}
        onUserUpdate={handleUserUpdate}
        onThemeChange={handleThemeChange}
        onRpeEnabledChange={handleRpeEnabledChange}
        onGrowthSettingsChange={handleGrowthSettingsChange}
        onOneRmUnitChange={handleOneRmUnitChange}
        onActiveWorkoutChange={handleActiveWorkoutChange}
        onActiveWorkoutClear={handleActiveWorkoutClear}
      />
    </Router>
  );
}

function AppContent({
  exercises,
  sessions,
  routines,
  user,
  theme,
  rpeEnabled,
  supabaseConfigured,
  supabaseError,
  growthSettings,
  oneRmUnit,
  activeWorkout,
  onExerciseUpdate,
  onRoutineUpdate,
  onSessionAdd,
  onSessionsUpdate,
  onUserUpdate,
  onThemeChange,
  onRpeEnabledChange,
  onGrowthSettingsChange,
  onOneRmUnitChange,
  onActiveWorkoutChange,
  onActiveWorkoutClear,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePanelOpen, setActivePanelOpen] = useState(false);
  const [activeElapsedSeconds, setActiveElapsedSeconds] = useState(0);

  const formatActiveTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  useEffect(() => {
    if (!activeWorkout?.startedAt) {
      setActiveElapsedSeconds(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - activeWorkout.startedAt) / 1000));
      setActiveElapsedSeconds(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout?.startedAt]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <Navigation theme={theme} />
      <main className="container mx-auto px-4 py-8 pb-28">
        {supabaseError && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
            Supabase: {supabaseError}
          </div>
        )}
        <Routes>
          <Route 
            path="/" 
            element={
              <Dashboard 
                exercises={exercises} 
                sessions={sessions}
                routines={routines}
                growthSettings={growthSettings}
                oneRmUnit={oneRmUnit}
              />
            } 
          />
          <Route 
            path="/routines" 
            element={
              <CreateRoutine 
                exercises={exercises}
                routines={routines}
                onUpdate={onRoutineUpdate}
                onExerciseUpdate={onExerciseUpdate}
                supabaseConfigured={supabaseConfigured}
              />
            } 
          />
          <Route 
            path="/log-workout" 
            element={
              <LogWorkout 
                exercises={exercises}
                routines={routines}
                onSessionAdd={onSessionAdd}
                onExerciseUpdate={onExerciseUpdate}
                rpeEnabled={rpeEnabled}
                onActiveWorkoutChange={onActiveWorkoutChange}
                onActiveWorkoutClear={onActiveWorkoutClear}
              />
            } 
          />
          <Route 
            path="/history" 
            element={
              <History 
                exercises={exercises} 
                sessions={sessions}
                onSessionsUpdate={onSessionsUpdate}
                rpeEnabled={rpeEnabled}
              />
            } 
          />
          <Route 
            path="/profile" 
            element={
              <Profile 
                user={user}
                onUserUpdate={onUserUpdate}
                theme={theme}
                onThemeChange={onThemeChange}
                rpeEnabled={rpeEnabled}
                onRpeEnabledChange={onRpeEnabledChange}
                growthSettings={growthSettings}
                onGrowthSettingsChange={onGrowthSettingsChange}
                oneRmUnit={oneRmUnit}
                onOneRmUnitChange={onOneRmUnitChange}
              />
            } 
          />
        </Routes>
      </main>
      {activeWorkout && location.pathname !== '/log-workout' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
          <div
            className={`transition-all duration-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg ${
              activePanelOpen ? 'h-32' : 'h-14'
            }`}
          >
            <button
              type="button"
              onClick={() => setActivePanelOpen((prev) => !prev)}
              className="w-full h-full text-left px-4 py-3 flex items-center justify-between"
              aria-label="Active workout"
            >
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {activeWorkout.routineName || 'Active Workout'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatActiveTime(activeElapsedSeconds)}
                </div>
                {activePanelOpen && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Tap to resume logging
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activePanelOpen && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate('/log-workout');
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg"
                  >
                    Resume
                  </button>
                )}
                <span className="text-gray-400">
                  {activePanelOpen ? '▾' : '▴'}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}
      {location.pathname !== '/log-workout' && (
        <FloatingActionButton
          onClick={() => navigate('/log-workout')}
          label={activeWorkout ? 'Resume Workout' : '+'}
        />
      )}
    </div>
  );
}

export default App;
