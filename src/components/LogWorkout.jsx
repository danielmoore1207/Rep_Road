import { useState, useEffect, useRef } from 'react';
import { predictNextSession, suggestWeightIncrease } from '../utils/predictions';
import { storage } from '../utils/storage';

function LogWorkout({ routines, exercises, onSessionAdd, onExerciseUpdate, rpeEnabled, onActiveWorkoutChange, onActiveWorkoutClear }) {
  const getTodayDateString = () => new Date().toISOString().slice(0, 10);

  const [selectedRoutine, setSelectedRoutine] = useState('');
  const [logMode, setLogMode] = useState('routine');
  const [workoutData, setWorkoutData] = useState({});
  const [predictions, setPredictions] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [workoutDate, setWorkoutDate] = useState(getTodayDateString());
  const [workoutOrder, setWorkoutOrder] = useState([]);
  const [draggingKey, setDraggingKey] = useState(null);
  const [quickMuscleGroup, setQuickMuscleGroup] = useState('');
  const [quickExerciseId, setQuickExerciseId] = useState('');
  const [quickNewExerciseName, setQuickNewExerciseName] = useState('');
  const [quickCreateMode, setQuickCreateMode] = useState(false);
  const hasRestoredDraft = useRef(false);
  const restoredRoutineRef = useRef('');
  const restoredDraftPendingRef = useRef(false);
  const previousRoutineRef = useRef('');

  const isActiveWorkout = logMode === 'quick' || !!selectedRoutine;

  const rebuildPredictions = (data) => {
    const next = {};
    Object.keys(data || {}).forEach((slotKey) => {
      const slot = data[slotKey];
      if (!slot?.exerciseId) return;
      const repRange = slot.repRange || { min: 8, max: 12 };
      const sessions = storage.getSessions().filter(s => s.exerciseId === slot.exerciseId);
      const pred = predictNextSession(sessions, 'weight');
      const suggestion = suggestWeightIncrease(sessions, repRange);
      next[slotKey] = { prediction: pred, suggestion };
    });
    setPredictions(next);
  };

  const getActiveWorkoutName = () => {
    if (logMode === 'quick') return 'Quick Log';
    const routine = routines.find(r => r.id === selectedRoutine);
    return routine?.name || 'Active Workout';
  };

  const getRepRangeForExercise = (exerciseId, fallbackRange) => {
    for (const routine of routines || []) {
      const match = routine.exercises?.find((re) => re.exerciseId === exerciseId);
      if (match) {
        return { min: match.repRangeMin, max: match.repRangeMax };
      }
    }
    return fallbackRange;
  };

  const getRpeLabel = (rpeValue) => {
    const rpe = Number(rpeValue);
    const repsLeftMap = {
      10: 'Max Effort',
      9.5: '0-1 reps left',
      9: '1 rep left',
      8.5: '1-2 reps left',
      8: '2 reps left',
      7.5: '2-3 reps left',
      7: '3 reps left',
      6.5: '3-4 reps left',
      6: '4 reps left',
      5.5: '4-5 reps left',
      5: '5+ reps left',
    };

    const descriptor = repsLeftMap[rpe] || 'Effort';
    return `RPE ${rpe.toFixed(1)} (${descriptor})`;
  };

  // Start timer when routine is selected or quick mode starts
  useEffect(() => {
    if (!isActiveWorkout) {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setStartTime(null);
      setElapsedSeconds(0);
      setWorkoutDate(getTodayDateString());
      return;
    }

    const effectiveStart = startTime || Date.now();
    if (!startTime) {
      setStartTime(effectiveStart);
    }

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - effectiveStart) / 1000)));
    };
    tick();

    const interval = setInterval(tick, 1000);
    setTimerInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [isActiveWorkout, startTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  useEffect(() => {
    if (hasRestoredDraft.current) return;
    const draft = storage.getActiveWorkoutDraft();
    if (draft) {
      setLogMode(draft.logMode || 'routine');
      setSelectedRoutine(draft.selectedRoutine || '');
      setWorkoutDate(draft.workoutDate || getTodayDateString());
      setWorkoutData(draft.workoutData || {});
      setWorkoutOrder(draft.workoutOrder || Object.keys(draft.workoutData || {}));
      restoredRoutineRef.current = draft.selectedRoutine || '';
      restoredDraftPendingRef.current = true;
      if (draft.startTime) {
        setStartTime(draft.startTime);
        const baseElapsed = Math.max(0, Math.floor((Date.now() - draft.startTime) / 1000));
        setElapsedSeconds(baseElapsed);
      }
      rebuildPredictions(draft.workoutData || {});
    }
    hasRestoredDraft.current = true;
  }, [exercises]);

  useEffect(() => {
    if (logMode === 'routine' && selectedRoutine) {
      const hasDraftForRoutine =
        restoredDraftPendingRef.current &&
        restoredRoutineRef.current === selectedRoutine &&
        Object.keys(workoutData).length > 0;

      if (hasDraftForRoutine) {
        restoredDraftPendingRef.current = false;
        previousRoutineRef.current = selectedRoutine;
        return;
      }

      const shouldInitialize =
        Object.keys(workoutData).length === 0 ||
        previousRoutineRef.current !== selectedRoutine;

      if (!shouldInitialize) {
        return;
      }

      const routine = routines.find(r => r.id === selectedRoutine);
      if (routine) {
        // Initialize workout data for each exercise in routine
        const initialData = {};
        routine.exercises.forEach((re, idx) => {
          const setsCount = Math.max(1, parseInt(re.setsCount, 10) || 3);
          const slotKey = `${re.exerciseId}-${idx}`;
          initialData[slotKey] = {
            exerciseId: re.exerciseId,
            sets: Array.from({ length: setsCount }, () => ({
              weight: '',
              reps: '',
              minutes: '',
              seconds: '',
              rpe: 8.0,
            })),
            repRange: { min: re.repRangeMin, max: re.repRangeMax },
          };
        });
        setWorkoutData(initialData);
        setWorkoutOrder(Object.keys(initialData));

        // Calculate predictions for each exercise
        const preds = {};
        routine.exercises.forEach((re, idx) => {
          const slotKey = `${re.exerciseId}-${idx}`;
          const sessions = storage.getSessions().filter(s => s.exerciseId === re.exerciseId);
          const pred = predictNextSession(sessions, 'weight');
          const suggestion = suggestWeightIncrease(sessions, { min: re.repRangeMin, max: re.repRangeMax });
          preds[slotKey] = { prediction: pred, suggestion };
        });
        setPredictions(preds);
      }
    } else if (logMode === 'routine') {
      setWorkoutData({});
      setPredictions({});
      setWorkoutOrder([]);
    }
    previousRoutineRef.current = selectedRoutine;
  }, [selectedRoutine, routines, logMode]);

  useEffect(() => {
    if (!isActiveWorkout) {
      if (hasRestoredDraft.current) {
        storage.clearActiveWorkoutDraft();
      }
      return;
    }
    const draft = {
      logMode,
      selectedRoutine,
      workoutDate,
      workoutData,
      workoutOrder,
      startTime,
    };
    storage.saveActiveWorkoutDraft(draft);
  }, [isActiveWorkout, logMode, selectedRoutine, workoutDate, workoutData, workoutOrder, startTime]);

  useEffect(() => {
    if (!isActiveWorkout) {
      if (onActiveWorkoutClear) onActiveWorkoutClear();
      return;
    }
    if (!onActiveWorkoutChange) return;
    const routineId = logMode === 'quick' ? 'quick-log' : selectedRoutine || null;
    onActiveWorkoutChange({
      routineId,
      routineName: getActiveWorkoutName(),
      mode: logMode,
      startedAt: startTime || Date.now(),
    });
  }, [isActiveWorkout, logMode, selectedRoutine, startTime, routines]);

  // Format time display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const handleAddSet = (slotKey) => {
    setWorkoutData({
      ...workoutData,
      [slotKey]: {
        ...workoutData[slotKey],
        sets: [
          ...workoutData[slotKey].sets,
          { weight: '', reps: '', minutes: '', seconds: '', rpe: 8.0 },
        ],
      },
    });
  };

  const handleRemoveSet = (slotKey, index) => {
    if (workoutData[slotKey].sets.length > 1) {
      setWorkoutData({
        ...workoutData,
        [slotKey]: {
          ...workoutData[slotKey],
          sets: workoutData[slotKey].sets.filter((_, i) => i !== index),
        },
      });
    }
  };

  const handleSetChange = (slotKey, index, field, value) => {
    const updatedSets = [...workoutData[slotKey].sets];
    if (field === 'rpe') {
      updatedSets[index][field] = parseFloat(value);
    } else {
      updatedSets[index][field] = value;
    }
    setWorkoutData({
      ...workoutData,
      [slotKey]: {
        ...workoutData[slotKey],
        sets: updatedSets,
      },
    });
  };

  const handleRemoveExerciseSlot = (slotKey) => {
    setWorkoutData((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setPredictions((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setWorkoutOrder((prev) => prev.filter((key) => key !== slotKey));
  };

  const handleAddExerciseSlot = (exerciseId, repRange = { min: 8, max: 12 }) => {
    const slotKey = `${exerciseId}-${Date.now()}`;
    setWorkoutData((prev) => ({
      ...prev,
      [slotKey]: {
        exerciseId,
        sets: Array.from({ length: 3 }, () => ({
          weight: '',
          reps: '',
          minutes: '',
          seconds: '',
          rpe: 8.0,
        })),
        repRange,
      },
    }));
    setWorkoutOrder((prev) => [...prev, slotKey]);

    const sessions = storage.getSessions().filter(s => s.exerciseId === exerciseId);
    const pred = predictNextSession(sessions, 'weight');
    const suggestion = suggestWeightIncrease(sessions, repRange);
    setPredictions((prev) => ({
      ...prev,
      [slotKey]: { prediction: pred, suggestion },
    }));
  };

  const handleDragStart = (slotKey) => {
    setDraggingKey(slotKey);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (targetKey) => {
    if (!draggingKey || draggingKey === targetKey) return;
    setWorkoutOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(draggingKey);
      const toIndex = next.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggingKey);
      return next;
    });
    setDraggingKey(null);
  };

  const moveExerciseSlot = (slotKey, direction) => {
    setWorkoutOrder((prev) => {
      const next = [...prev];
      const index = next.indexOf(slotKey);
      if (index === -1) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const handleReplaceExercise = (slotKey, newExerciseId) => {
    const currentRange = workoutData[slotKey]?.repRange || { min: 8, max: 12 };
    const nextRange = getRepRangeForExercise(newExerciseId, currentRange);
    setWorkoutData((prev) => {
      const current = prev[slotKey];
      if (!current) return prev;
      return {
        ...prev,
        [slotKey]: {
          ...current,
          exerciseId: newExerciseId,
          repRange: { ...nextRange },
        },
      };
    });

    const sessions = storage.getSessions().filter(s => s.exerciseId === newExerciseId);
    const pred = predictNextSession(sessions, 'weight');
    const suggestion = suggestWeightIncrease(sessions, nextRange);
    setPredictions((prev) => ({
      ...prev,
      [slotKey]: { prediction: pred, suggestion },
    }));
  };

  const handleFinishWorkout = (e) => {
    e.preventDefault();
    if (!isActiveWorkout) return;

    // Stop the timer
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    const routine = logMode === 'routine'
      ? routines.find(r => r.id === selectedRoutine)
      : { id: 'quick-log', name: 'Quick Log' };
    if (!routine) return;

    // Validate all exercises have at least one set with data
    if (Object.keys(workoutData).length === 0) {
      alert('Please add at least one exercise.');
      return;
    }
    const hasInvalidData = Object.keys(workoutData).some(slotKey => {
      const data = workoutData[slotKey];
      const exercise = exercises.find(ex => ex.id === data.exerciseId);
      if (exercise?.muscleGroup === 'Cardio') {
        return !data.sets.some(set => set.minutes !== '' && set.minutes != null);
      }
      return !data.sets.some(set => set.weight && set.reps);
    });

    if (hasInvalidData) {
      alert('Please fill in at least one set for each exercise.');
      // Restart timer if validation fails
      if (startTime) {
        const interval = setInterval(() => {
          setElapsedSeconds(prev => prev + 1);
        }, 1000);
        setTimerInterval(interval);
      }
      return;
    }

    // Calculate duration in minutes (round up, minimum 1 minute)
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    const todayDate = getTodayDateString();
    const sessionDate = workoutDate === todayDate
      ? new Date().toISOString()
      : new Date(`${workoutDate}T12:00:00`).toISOString();

    // Create sessions for each exercise with duration
    // All exercises in the same workout get the same duration
    Object.keys(workoutData).forEach(slotKey => {
      const data = workoutData[slotKey];
      const exercise = exercises.find(ex => ex.id === data.exerciseId);
      const session = {
        exerciseId: data.exerciseId,
        routineId: routine.id,
        routineName: routine.name,
        durationMinutes, // Same duration for all exercises in this workout
        date: sessionDate,
        sets: data.sets
          .filter(set => {
            if (exercise?.muscleGroup === 'Cardio') {
              return set.minutes !== '' && set.minutes != null;
            }
            return set.weight && set.reps;
          })
          .map(set => {
            if (exercise?.muscleGroup === 'Cardio') {
              const minutes = parseInt(set.minutes, 10) || 0;
              const seconds = parseInt(set.seconds, 10) || 0;
              const totalSeconds = minutes * 60 + seconds;
              return {
                weight: 0,
                reps: totalSeconds,
                rpe: typeof set.rpe === 'number' ? set.rpe : 8.0,
              };
            }
            return {
              weight: parseFloat(set.weight) || 0,
              reps: parseInt(set.reps, 10) || 0,
              rpe: typeof set.rpe === 'number' ? set.rpe : 8.0,
            };
          }),
      };

      if (session.sets.length > 0) {
        onSessionAdd(session);
      }
    });

    // Reset form and timer
    setLogMode('routine');
    setSelectedRoutine('');
    setWorkoutData({});
    setPredictions({});
    setStartTime(null);
    setElapsedSeconds(0);
    setWorkoutDate(getTodayDateString());
    setWorkoutOrder([]);
    setQuickMuscleGroup('');
    setQuickExerciseId('');
    setQuickNewExerciseName('');
    setQuickCreateMode(false);
    storage.clearActiveWorkoutDraft();
    if (onActiveWorkoutClear) onActiveWorkoutClear();
    
    alert(`Workout completed! Duration: ${formatTime(elapsedSeconds)}`);
  };

  const selectedRoutineData = routines.find(r => r.id === selectedRoutine);
  const filteredQuickExercises = quickMuscleGroup
    ? exercises.filter((ex) => ex.muscleGroup === quickMuscleGroup)
    : exercises;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 dark:text-white">📝 Log Workout</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <form onSubmit={handleFinishWorkout} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Log Mode
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => {
                  setLogMode('routine');
                  setQuickCreateMode(false);
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  logMode === 'routine'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-white'
                }`}
              >
                Use Routine
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogMode('quick');
                  setSelectedRoutine('');
                  setWorkoutData({});
                  setPredictions({});
                  setWorkoutOrder([]);
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  logMode === 'quick'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-white'
                }`}
              >
                Quick Log
              </button>
            </div>
          </div>

          {logMode === 'routine' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Routine *
              </label>
              <select
                value={selectedRoutine}
                onChange={(e) => setSelectedRoutine(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="">Choose a routine...</option>
                {routines.map(routine => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name} ({routine.exercises.length} exercises)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Workout Date */}
          {isActiveWorkout && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Workout Date
              </label>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={getTodayDateString()}
                className="w-full max-w-full min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Timer Display */}
          {isActiveWorkout && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Workout Duration</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatTime(elapsedSeconds)}
                  </div>
                </div>
                <div className="text-4xl">⏱️</div>
              </div>
            </div>
          )}

          {logMode === 'quick' && (
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Muscle Group
                  </label>
                  <select
                    value={quickMuscleGroup}
                    onChange={(e) => setQuickMuscleGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select muscle group...</option>
                    {[...new Set(exercises.map((ex) => ex.muscleGroup))].map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Exercise
                  </label>
                  <select
                    value={quickExerciseId}
                    onChange={(e) => setQuickExerciseId(e.target.value)}
                    disabled={!quickMuscleGroup}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="">Select exercise...</option>
                    {filteredQuickExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.muscleGroup})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!quickExerciseId) return;
                      handleAddExerciseSlot(quickExerciseId);
                      setQuickExerciseId('');
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Exercise
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCreateMode((prev) => !prev)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    New
                  </button>
                </div>
              </div>

              {quickCreateMode && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Exercise Name
                    </label>
                    <input
                      type="text"
                      value={quickNewExerciseName}
                      onChange={(e) => setQuickNewExerciseName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g. Incline Bench Press"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const name = quickNewExerciseName.trim();
                        const group = quickMuscleGroup || 'Chest';
                        if (!name) return;
                        const newExercise = {
                          id: Date.now().toString(),
                          name,
                          muscleGroup: group,
                          description: '',
                          createdAt: new Date().toISOString(),
                        };
                        const updatedExercises = [...exercises, newExercise];
                        storage.saveExercises(updatedExercises);
                        if (onExerciseUpdate) {
                          onExerciseUpdate(updatedExercises);
                        }
                        setQuickNewExerciseName('');
                        setQuickExerciseId(newExercise.id);
                        setQuickCreateMode(false);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCreateMode(false);
                        setQuickNewExerciseName('');
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(selectedRoutineData || logMode === 'quick') && (
            <div className="space-y-6">
              {workoutOrder.map((slotKey) => {
                const data = workoutData[slotKey];
                if (!data) return null;
                const exercise = exercises.find(ex => ex.id === data.exerciseId);
                if (!exercise) return null;
                const pred = predictions[slotKey];
                const targetRepRange = data.repRange || { min: 8, max: 12 };
                const isCardio = exercise.muscleGroup === 'Cardio';

                return (
                  <div
                    key={slotKey}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(slotKey)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            type="button"
                            className="cursor-move text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            aria-label="Drag to reorder"
                            draggable
                            onDragStart={() => handleDragStart(slotKey)}
                          >
                            ☰
                          </button>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveExerciseSlot(slotKey, 'up')}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs leading-none"
                              aria-label="Move up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExerciseSlot(slotKey, 'down')}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs leading-none"
                              aria-label="Move down"
                            >
                              ▼
                            </button>
                          </div>
                          <h3 className="text-lg font-bold dark:text-white">{exercise.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Target: {targetRepRange.min}-{targetRepRange.max} reps
                        </p>
                        <div className="mt-2">
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Replace Exercise</label>
                          <select
                            value={data.exerciseId}
                            onChange={(e) => handleReplaceExercise(slotKey, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          >
                            {exercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name} ({ex.muscleGroup})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveExerciseSlot(slotKey)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                        {pred && (
                        <div className="text-right">
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-sm">
                            <div className="text-xs text-gray-600 dark:text-gray-400">Suggested Weight</div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {pred.prediction.predictedValue.toFixed(1)} kg
                            </div>
                            {pred.suggestion.shouldIncrease && (
                              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                ↑ Increase to {pred.suggestion.suggestedWeight} kg
                              </div>
                            )}
                          </div>
                        </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Sets *
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddSet(slotKey)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          + Add Set
                        </button>
                      </div>

                      <div className="space-y-3">
                        {data.sets.map((set, index) => (
                          <div key={index} className="bg-white dark:bg-gray-600 p-3 rounded space-y-3">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 flex space-x-2">
                                {isCardio ? (
                                  <>
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={set.minutes ?? ''}
                                        onChange={(e) => handleSetChange(slotKey, index, 'minutes', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Minutes"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={set.seconds ?? ''}
                                        onChange={(e) => handleSetChange(slotKey, index, 'seconds', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Seconds"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*[.,]?[0-9]*"
                                        value={set.weight}
                                        onChange={(e) => handleSetChange(slotKey, index, 'weight', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Weight (kg)"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={set.reps}
                                        onChange={(e) => handleSetChange(slotKey, index, 'reps', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Reps"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                              {data.sets.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSet(slotKey, index)}
                                  className="text-red-500 hover:text-red-700 text-xl px-2"
                                >
                                  ×
                                </button>
                              )}
                            </div>

                            {rpeEnabled && (
                              <div>
                                <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                                  {getRpeLabel(set.rpe ?? 8.0)}
                                </div>
                                <input
                                  type="range"
                                  min="5"
                                  max="10"
                                  step="0.5"
                                  value={set.rpe ?? 8.0}
                                  onChange={(e) => handleSetChange(slotKey, index, 'rpe', e.target.value)}
                                  className="w-full accent-blue-600"
                                />
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  <span>5.0</span>
                                  <span>10.0</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isActiveWorkout && (
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setLogMode('routine');
                  setSelectedRoutine('');
                  setWorkoutData({});
                  setWorkoutDate(getTodayDateString());
                  setWorkoutOrder([]);
                  setQuickMuscleGroup('');
                  setQuickExerciseId('');
                  setQuickNewExerciseName('');
                  setQuickCreateMode(false);
                  storage.clearActiveWorkoutDraft();
                  if (onActiveWorkoutClear) onActiveWorkoutClear();
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Finish Workout
              </button>
            </div>
          )}

          {routines.length === 0 && logMode === 'routine' && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No routines available. Please create a routine first.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default LogWorkout;
