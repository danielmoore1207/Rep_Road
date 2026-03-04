// Local storage utilities for persisting data
const STORAGE_KEYS = {
  EXERCISES: 'gym_app_exercises',
  WORKOUTS: 'gym_app_workouts',
  SESSIONS: 'gym_app_sessions',
  ROUTINES: 'gym_app_routines',
  USER: 'gym_app_user',
  THEME: 'gym_app_theme',
  RPE_ENABLED: 'gym_app_rpe_enabled',
  GROWTH_SETTINGS: 'gym_app_growth_settings',
  ONE_RM_UNIT: 'gym_app_one_rm_unit',
  ACTIVE_WORKOUT: 'gym_app_active_workout',
  ACTIVE_WORKOUT_DRAFT: 'gym_app_active_workout_draft',
};

export const storage = {
  // Exercises
  getExercises: () => {
    const data = localStorage.getItem(STORAGE_KEYS.EXERCISES);
    return data ? JSON.parse(data) : [];
  },
  
  saveExercises: (exercises) => {
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
  },
  
  // Workouts
  getWorkouts: () => {
    const data = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    return data ? JSON.parse(data) : [];
  },
  
  saveWorkouts: (workouts) => {
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
  },
  
  // Sessions
  getSessions: () => {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },
  
  saveSessions: (sessions) => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },
  
  // Add a new session
  addSession: (session) => {
    const sessions = storage.getSessions();
    sessions.push({
      ...session,
      id: Date.now().toString(),
      date: session.date || new Date().toISOString(),
    });
    storage.saveSessions(sessions);
    return sessions;
  },
  
  // Routines
  getRoutines: () => {
    const data = localStorage.getItem(STORAGE_KEYS.ROUTINES);
    return data ? JSON.parse(data) : [];
  },
  
  saveRoutines: (routines) => {
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
  },
  
  // User
  getUser: () => {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },
  
  saveUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  
  clearUser: () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
  
  // Theme
  getTheme: () => {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'system';
  },
  
  saveTheme: (theme) => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  // RPE setting
  getRpeEnabled: () => {
    const value = localStorage.getItem(STORAGE_KEYS.RPE_ENABLED);
    return value === null ? true : value === 'true';
  },

  saveRpeEnabled: (enabled) => {
    localStorage.setItem(STORAGE_KEYS.RPE_ENABLED, String(enabled));
  },

  // Growth settings
  getGrowthSettings: () => {
    const data = localStorage.getItem(STORAGE_KEYS.GROWTH_SETTINGS);
    return data
      ? JSON.parse(data)
      : {
          baselineDays: 7,
          weightedAverage: true,
          includeAccessories: true,
          formula: 'epley',
          benchmarks: [
            { name: 'Squat', weight: 0.4 },
            { name: 'Bench', weight: 0.3 },
            { name: 'Deadlift', weight: 0.3 },
          ],
        };
  },

  saveGrowthSettings: (settings) => {
    localStorage.setItem(STORAGE_KEYS.GROWTH_SETTINGS, JSON.stringify(settings));
  },

  // 1RM unit
  getOneRmUnit: () => {
    return localStorage.getItem(STORAGE_KEYS.ONE_RM_UNIT) || 'kg';
  },

  saveOneRmUnit: (unit) => {
    localStorage.setItem(STORAGE_KEYS.ONE_RM_UNIT, unit);
  },

  // Active workout banner
  getActiveWorkout: () => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKOUT);
    return data ? JSON.parse(data) : null;
  },

  saveActiveWorkout: (workout) => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKOUT, JSON.stringify(workout));
  },

  clearActiveWorkout: () => {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKOUT);
  },

  // Active workout draft (log workout state)
  getActiveWorkoutDraft: () => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKOUT_DRAFT);
    return data ? JSON.parse(data) : null;
  },

  saveActiveWorkoutDraft: (draft) => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKOUT_DRAFT, JSON.stringify(draft));
  },

  clearActiveWorkoutDraft: () => {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKOUT_DRAFT);
  },

  // Clear all app data
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },
};
