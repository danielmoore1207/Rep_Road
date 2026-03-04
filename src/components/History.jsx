import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';

function History({ exercises, sessions, onSessionsUpdate, rpeEnabled }) {
  const [editingWorkoutKey, setEditingWorkoutKey] = useState(null);
  const [editSetsBySessionId, setEditSetsBySessionId] = useState({});
  const [workoutFilterRange, setWorkoutFilterRange] = useState('this_week');

  const buildWorkoutKey = (workout) => `${workout.routineId || 'quick-log'}-${workout.date}`;
  const formatDuration = (totalSeconds) => {
    const secs = Number(totalSeconds) || 0;
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}m ${seconds}s`;
  };

  const startEditWorkout = (workout) => {
    const nextEditSets = {};
    workout.exercises.forEach((session) => {
      nextEditSets[session.id] = session.sets.map((set) => ({
        weight: set.weight?.toString() ?? '',
        reps: set.reps?.toString() ?? '',
        rpe: typeof set.rpe === 'number' ? set.rpe : 8.0,
      }));
    });
    setEditSetsBySessionId(nextEditSets);
    setEditingWorkoutKey(buildWorkoutKey(workout));
  };

  const deleteWorkout = (workout) => {
    const confirmed = window.confirm(
      'Delete this workout? This will remove all exercises logged for this session.'
    );
    if (!confirmed) return;

    const workoutKey = buildWorkoutKey(workout);
    const updatedSessions = sessions.filter((session) => {
      const sessionKey = `${session.routineId}-${session.date}`;
      return sessionKey !== workoutKey;
    });

    onSessionsUpdate(updatedSessions);
    if (editingWorkoutKey === workoutKey) {
      cancelEditWorkout();
    }
  };

  const cancelEditWorkout = () => {
    setEditSetsBySessionId({});
    setEditingWorkoutKey(null);
  };

  const handleEditSetChange = (sessionId, setIndex, field, value) => {
    setEditSetsBySessionId((prev) => {
      const sessionSets = prev[sessionId] || [];
      const nextSets = sessionSets.map((set, idx) => {
        if (idx !== setIndex) return set;
        if (field === 'rpe') {
          return { ...set, rpe: parseFloat(value) };
        }
        return { ...set, [field]: value };
      });
      return { ...prev, [sessionId]: nextSets };
    });
  };

  const saveEditedWorkout = () => {
    const hasEmptyFields = Object.values(editSetsBySessionId).some((sets) =>
      sets.some((set) => set.weight === '' || set.reps === '')
    );
    if (hasEmptyFields) {
      alert('Please fill out weight and reps for all sets before saving.');
      return;
    }

    const updatedSessions = sessions.map((session) => {
      if (!editSetsBySessionId[session.id]) return session;
      const updatedSets = editSetsBySessionId[session.id].map((set) => ({
        weight: parseFloat(set.weight) || 0,
        reps: parseInt(set.reps, 10) || 0,
        rpe: typeof set.rpe === 'number' ? set.rpe : 8.0,
      }));
      return { ...session, sets: updatedSets };
    });

    onSessionsUpdate(updatedSessions);
    cancelEditWorkout();
  };
  // Group sessions by routine workout (routineId + date)
  const routineWorkouts = useMemo(() => {
    const workoutMap = new Map();
    
    sessions.forEach(session => {
      if (!session.routineName && !session.routineId) return;
      const routineId = session.routineId || 'quick-log';
      const routineName = session.routineName || 'Quick Log';
      // Group by routineId and date (same routine logged at same time = same workout)
      const workoutKey = `${routineId}-${session.date}`;
      
      if (!workoutMap.has(workoutKey)) {
        workoutMap.set(workoutKey, {
          routineId,
          routineName,
          date: session.date,
          exercises: [],
        });
      }
      
      const exercise = exercises.find(ex => ex.id === session.exerciseId);
      if (exercise) {
        workoutMap.get(workoutKey).exercises.push({
          ...session,
          routineId,
          routineName,
          exercise,
        });
      }
    });
    
    return Array.from(workoutMap.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [exercises, sessions]);

  // Exercise-specific history for progress tracking
  const exerciseHistory = useMemo(() => {
    return exercises.map(exercise => {
      const exerciseSessions = sessions
        .filter(s => s.exerciseId === exercise.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      return {
        exercise,
        sessions: exerciseSessions,
      };
    }).filter(item => item.sessions.length > 0);
  }, [exercises, sessions]);

  const filteredRoutineWorkouts = useMemo(() => {
    const now = new Date();
    const startDate = (() => {
      switch (workoutFilterRange) {
        case 'this_week':
          return subDays(now, 7);
        case 'last_week':
          return subDays(now, 14);
        case 'last_month':
          return subDays(now, 30);
        case 'last_year':
          return subDays(now, 365);
        default:
          return subDays(now, 7);
      }
    })();

    return routineWorkouts.filter((workout) => {
      const workoutDate = new Date(workout.date);
      return workoutDate >= startDate && workoutDate <= now;
    });
  }, [routineWorkouts, workoutFilterRange]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">📅 Workout History</h2>

      {routineWorkouts.length === 0 && sessions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">No workout history yet. Start logging workouts to see your progress!</p>
        </div>
      ) : (
        <>
          {/* Routine Workouts */}
          {routineWorkouts.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">Workouts</h3>
                <select
                  value={workoutFilterRange}
                  onChange={(e) => setWorkoutFilterRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="this_week">This Week</option>
                  <option value="last_week">Last Week</option>
                  <option value="last_month">Last Month</option>
                  <option value="last_year">Last Year</option>
                </select>
              </div>

              {filteredRoutineWorkouts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">No workouts in this range.</p>
                </div>
              ) : (
                filteredRoutineWorkouts.map((workout, workoutIdx) => {
                const workoutKey = buildWorkoutKey(workout);
                const isEditing = editingWorkoutKey === workoutKey;

                return (
                <div key={`${workout.routineId}-${workout.date}`} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-bold dark:text-white">{workout.routineName}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(workout.date), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {workout.exercises[0]?.durationMinutes 
                          ? `${workout.exercises[0].durationMinutes} min`
                          : 'N/A'}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEditWorkout(workout)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWorkout(workout)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {workout.exercises.map((session, idx) => (
                      <div key={session.id} className="border-l-4 border-blue-500 dark:border-blue-400 pl-4">
                        <div className="font-semibold dark:text-white mb-2">{session.exercise.name}</div>
                        {isEditing ? (
                          <div className="space-y-2">
                            {(editSetsBySessionId[session.id] || []).map((set, setIdx) => (
                              <div key={setIdx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  value={set.weight}
                                  onChange={(e) => handleEditSetChange(session.id, setIdx, 'weight', e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  placeholder="Weight"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={set.reps}
                                  onChange={(e) => handleEditSetChange(session.id, setIdx, 'reps', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  placeholder="Reps"
                                />
                                {rpeEnabled && (
                                  <input
                                    type="range"
                                    min="5"
                                    max="10"
                                    step="0.5"
                                    value={set.rpe}
                                    onChange={(e) => handleEditSetChange(session.id, setIdx, 'rpe', e.target.value)}
                                    className="flex-1 accent-blue-600"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {session.sets.map((set, setIdx) => (
                              <span key={setIdx} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded text-sm dark:text-white">
                                {session.exercise.muscleGroup === 'Cardio'
                                  ? formatDuration(set.reps)
                                  : `${set.weight}kg × ${set.reps} reps`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {isEditing && (
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        type="button"
                        onClick={cancelEditWorkout}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEditedWorkout}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                      >
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
                );
              }))
              }
            </div>
          )}

        </>
      )}
    </div>
  );
}

export default History;
