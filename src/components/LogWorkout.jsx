import { useState, useEffect, useRef } from 'react';
import { predictNextSession, suggestWeightIncrease } from '../utils/predictions';
import { storage } from '../utils/storage';

function LogWorkout({ routines, exercises, growthSettings, onSessionAdd, onExerciseUpdate, rpeEnabled, onActiveWorkoutChange, onActiveWorkoutClear }) {
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
  const draggingKeyRef = useRef(null);
  const pointerIdRef = useRef(null);
  const [openMenuSlotKey, setOpenMenuSlotKey] = useState(null);
  const [replacingSlotKey, setReplacingSlotKey] = useState(null);
  const [showShuffleForm, setShowShuffleForm] = useState(false);
  const [infoSlotKey, setInfoSlotKey] = useState(null);
  const [quickMuscleGroup, setQuickMuscleGroup] = useState('');
  const [quickExerciseId, setQuickExerciseId] = useState('');
  const [quickNewExerciseName, setQuickNewExerciseName] = useState('');
  const [quickCreateMode, setQuickCreateMode] = useState(false);
  const hasRestoredDraft = useRef(false);
  const restoredRoutineRef = useRef('');
  const restoredDraftPendingRef = useRef(false);
  const restoredDraftHasDataRef = useRef(false);
  const previousRoutineRef = useRef('');
  const isRestoringDraftRef = useRef(false);

  const isActiveWorkout = logMode === 'quick' || !!selectedRoutine;

  const persistDraft = ({
    logMode: nextLogMode,
    selectedRoutine: nextSelectedRoutine,
    workoutDate: nextWorkoutDate,
    workoutData: nextWorkoutData,
    workoutOrder: nextWorkoutOrder,
    startTime: nextStartTime,
  } = {}) => {
    const draftLogMode = nextLogMode ?? logMode;
    const draftSelectedRoutine = nextSelectedRoutine ?? selectedRoutine;
    const draftIsActive = draftLogMode === 'quick' || !!draftSelectedRoutine;
    if (!draftIsActive) return;
    storage.saveActiveWorkoutDraft({
      logMode: draftLogMode,
      selectedRoutine: draftSelectedRoutine,
      workoutDate: nextWorkoutDate ?? workoutDate,
      workoutData: nextWorkoutData ?? workoutData,
      workoutOrder: nextWorkoutOrder ?? workoutOrder,
      startTime: nextStartTime ?? startTime,
    });
  };

  const rebuildPredictions = (data) => {
    const next = {};
    Object.keys(data || {}).forEach((slotKey) => {
      const slot = data[slotKey];
      if (!slot?.exerciseId) return;
      const repRange = slot.repRange || { min: 8, max: 12 };
      const sessions = storage.getSessions().filter(s => s.exerciseId === slot.exerciseId);
      const pred = predictNextSession(sessions, 'weight');
      const suggestion = suggestWeightIncrease(sessions, repRange, growthSettings?.progressionMode || 'moderate');
      const avgRpe = getRecentAvgRpe(sessions);
      next[slotKey] = { prediction: pred, suggestion, avgRpe };
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

  const getRecentAvgRpe = (sessions) => {
    if (!sessions || sessions.length === 0) return null;
    const last = sessions[sessions.length - 1];
    const rpes = (last.sets || [])
      .map((set) => (typeof set.rpe === 'number' ? set.rpe : null))
      .filter((value) => value != null);
    if (rpes.length === 0) return null;
    const avg = rpes.reduce((sum, value) => sum + value, 0) / rpes.length;
    return Math.round(avg * 100) / 100;
  };

  const getExerciseInfo = (slotKey) => {
    const slot = workoutData[slotKey];
    if (!slot) return null;
    const exercise = exercises.find((ex) => ex.id === slot.exerciseId);
    if (!exercise) return null;

    const repRange = slot.repRange || { min: 8, max: 12 };
    const sessions = storage
      .getSessions()
      .filter((session) => session.exerciseId === slot.exerciseId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const lastSession = sessions[0] || null;
    let topSet = null;

    sessions.forEach((session) => {
      (session.sets || []).forEach((set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        const inRange = reps >= repRange.min && reps <= repRange.max;
        if (!inRange || weight <= 0) return;
        if (!topSet || weight > topSet.weight || (weight === topSet.weight && reps > topSet.reps)) {
          topSet = {
            weight,
            reps,
            date: session.date,
          };
        }
      });
    });

    const pred = predictions[slotKey];
    const suggestedWeight = pred?.suggestion?.suggestedWeight ?? null;

    let reasoning = pred?.suggestion?.reason || 'No recommendation reason available yet.';
    if (suggestedWeight != null && topSet) {
      if (suggestedWeight > topSet.weight) {
        reasoning += ` The suggested weight is above your top set (${topSet.weight} x ${topSet.reps}) because your recent trend indicates progression potential.`;
      } else if (suggestedWeight < topSet.weight) {
        reasoning += ` The suggested weight is below your top set (${topSet.weight} x ${topSet.reps}) to prioritize consistency in your target rep range.`;
      } else {
        reasoning += ` The suggested weight matches your current top set (${topSet.weight} x ${topSet.reps}), indicating consolidation before the next increase.`;
      }
    }

    return {
      exercise,
      repRange,
      lastSession,
      topSet,
      suggestedWeight,
      reasoning,
    };
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
      isRestoringDraftRef.current = true;
      setLogMode(draft.logMode || 'routine');
      setSelectedRoutine(draft.selectedRoutine || '');
      setWorkoutDate(draft.workoutDate || getTodayDateString());
      setWorkoutData(draft.workoutData || {});
      setWorkoutOrder(draft.workoutOrder || Object.keys(draft.workoutData || {}));
      restoredRoutineRef.current = draft.selectedRoutine || '';
      restoredDraftHasDataRef.current = Object.keys(draft.workoutData || {}).length > 0;
      restoredDraftPendingRef.current = restoredDraftHasDataRef.current;
      if (draft.startTime) {
        setStartTime(draft.startTime);
        const baseElapsed = Math.max(0, Math.floor((Date.now() - draft.startTime) / 1000));
        setElapsedSeconds(baseElapsed);
      }
      rebuildPredictions(draft.workoutData || {});
      previousRoutineRef.current = draft.selectedRoutine || '';
    }
    hasRestoredDraft.current = true;
  }, [exercises]);

  useEffect(() => {
    if (!isRestoringDraftRef.current) return;
    if (logMode === 'routine' && !selectedRoutine) return;
    isRestoringDraftRef.current = false;
  }, [logMode, selectedRoutine, workoutData]);

  useEffect(() => {
    if (restoredDraftPendingRef.current && Object.keys(workoutData).length > 0) {
      restoredDraftPendingRef.current = false;
    }
  }, [workoutData]);

  useEffect(() => {
    if (workoutOrder.length === 0 && Object.keys(workoutData).length > 0) {
      const nextOrder = Object.keys(workoutData);
      setWorkoutOrder(nextOrder);
      persistDraft({ workoutOrder: nextOrder });
    }
  }, [workoutData, workoutOrder.length]);

  useEffect(() => {
    if (isRestoringDraftRef.current) return;
    if (logMode === 'routine' && selectedRoutine) {
      if (restoredRoutineRef.current && restoredRoutineRef.current !== selectedRoutine) {
        restoredDraftPendingRef.current = false;
        restoredDraftHasDataRef.current = false;
      }
      const hasDraftForRoutine =
        restoredDraftPendingRef.current &&
        restoredDraftHasDataRef.current &&
        restoredRoutineRef.current === selectedRoutine;

      if (hasDraftForRoutine) {
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
          const suggestion = suggestWeightIncrease(sessions, { min: re.repRangeMin, max: re.repRangeMax }, growthSettings?.progressionMode || 'moderate');
          const avgRpe = getRecentAvgRpe(sessions);
          preds[slotKey] = { prediction: pred, suggestion, avgRpe };
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
    if (!isActiveWorkout || isRestoringDraftRef.current) return;
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
      const existingDraft = storage.getActiveWorkoutDraft();
      if (!existingDraft && onActiveWorkoutClear) onActiveWorkoutClear();
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
    const nextWorkoutData = {
      ...workoutData,
      [slotKey]: {
        ...workoutData[slotKey],
        sets: [
          ...workoutData[slotKey].sets,
          { weight: '', reps: '', minutes: '', seconds: '', rpe: 8.0 },
        ],
      },
    };
    setWorkoutData(nextWorkoutData);
    persistDraft({ workoutData: nextWorkoutData });
  };

  const handleRemoveSet = (slotKey, index) => {
    if (workoutData[slotKey].sets.length > 1) {
      const nextWorkoutData = {
        ...workoutData,
        [slotKey]: {
          ...workoutData[slotKey],
          sets: workoutData[slotKey].sets.filter((_, i) => i !== index),
        },
      };
      setWorkoutData(nextWorkoutData);
      persistDraft({ workoutData: nextWorkoutData });
    }
  };

  const handleSetChange = (slotKey, index, field, value) => {
    const updatedSets = [...workoutData[slotKey].sets];
    if (field === 'rpe') {
      updatedSets[index][field] = parseFloat(value);
    } else {
      updatedSets[index][field] = value;
    }
    const nextWorkoutData = {
      ...workoutData,
      [slotKey]: {
        ...workoutData[slotKey],
        sets: updatedSets,
      },
    };
    setWorkoutData(nextWorkoutData);
    persistDraft({ workoutData: nextWorkoutData });
  };

  const handleRemoveExerciseSlot = (slotKey) => {
    setWorkoutData((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      persistDraft({ workoutData: next });
      return next;
    });
    setPredictions((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setWorkoutOrder((prev) => {
      const next = prev.filter((key) => key !== slotKey);
      persistDraft({ workoutOrder: next });
      return next;
    });
  };

  const handleAddExerciseSlot = (exerciseId, repRange = { min: 8, max: 12 }) => {
    const slotKey = `${exerciseId}-${Date.now()}`;
    setWorkoutData((prev) => {
      const next = {
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
      };
      persistDraft({ workoutData: next });
      return next;
    });
    setWorkoutOrder((prev) => {
      const next = [...prev, slotKey];
      persistDraft({ workoutOrder: next });
      return next;
    });

    const sessions = storage.getSessions().filter(s => s.exerciseId === exerciseId);
    const pred = predictNextSession(sessions, 'weight');
    const suggestion = suggestWeightIncrease(sessions, repRange, growthSettings?.progressionMode || 'moderate');
    setPredictions((prev) => ({
      ...prev,
      [slotKey]: { prediction: pred, suggestion, avgRpe: getRecentAvgRpe(sessions) },
    }));
  };

  const handleDragStart = (slotKey) => {
    setDraggingKey(slotKey);
    draggingKeyRef.current = slotKey;
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const reorderWorkoutOrder = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setWorkoutOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(fromKey);
      const toIndex = next.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromKey);
      persistDraft({ workoutOrder: next });
      return next;
    });
  };

  const handleDrop = (targetKey) => {
    reorderWorkoutOrder(draggingKey, targetKey);
    setDraggingKey(null);
    draggingKeyRef.current = null;
  };

  const handlePointerDown = (slotKey, event) => {
    setDraggingKey(slotKey);
    draggingKeyRef.current = slotKey;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (pointerIdRef.current !== event.pointerId) return;
    if (!draggingKeyRef.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target?.closest?.('[data-shuffle-key]');
    if (row?.dataset?.shuffleKey) {
      reorderWorkoutOrder(draggingKeyRef.current, row.dataset.shuffleKey);
    }
    event.preventDefault();
  };

  const handlePointerUp = (event) => {
    if (pointerIdRef.current !== event.pointerId) return;
    setDraggingKey(null);
    draggingKeyRef.current = null;
    pointerIdRef.current = null;
  };

  const handleToggleReplace = (slotKey) => {
    setReplacingSlotKey((prev) => (prev === slotKey ? null : slotKey));
    setOpenMenuSlotKey(null);
  };

  const handleOpenShuffle = () => {
    setShowShuffleForm(true);
    setOpenMenuSlotKey(null);
  };


  const handleReplaceExercise = (slotKey, newExerciseId) => {
    const currentRange = workoutData[slotKey]?.repRange || { min: 8, max: 12 };
    const nextRange = getRepRangeForExercise(newExerciseId, currentRange);
    setWorkoutData((prev) => {
      const current = prev[slotKey];
      if (!current) return prev;
      const next = {
        ...prev,
        [slotKey]: {
          ...current,
          exerciseId: newExerciseId,
          repRange: { ...nextRange },
        },
      };
      persistDraft({ workoutData: next });
      return next;
    });

    const sessions = storage.getSessions().filter(s => s.exerciseId === newExerciseId);
    const pred = predictNextSession(sessions, 'weight');
    const suggestion = suggestWeightIncrease(sessions, nextRange, growthSettings?.progressionMode || 'moderate');
    setPredictions((prev) => ({
      ...prev,
      [slotKey]: { prediction: pred, suggestion, avgRpe: getRecentAvgRpe(sessions) },
    }));

    // Close replace UI after one selection; user can reopen from menu.
    setReplacingSlotKey(null);
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
    setReplacingSlotKey(null);
    setOpenMenuSlotKey(null);
    setShowShuffleForm(false);
    storage.clearActiveWorkoutDraft();
    if (onActiveWorkoutClear) onActiveWorkoutClear();
    
    alert(`Workout completed! Duration: ${formatTime(elapsedSeconds)}`);
  };

  const selectedRoutineData = routines.find(r => r.id === selectedRoutine);
  const filteredQuickExercises = quickMuscleGroup
    ? exercises.filter((ex) => ex.muscleGroup === quickMuscleGroup)
    : exercises;
  const infoData = infoSlotKey ? getExerciseInfo(infoSlotKey) : null;

  return (
    <>
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
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setWorkoutDate(nextDate);
                  persistDraft({ workoutDate: nextDate });
                }}
                max={getTodayDateString()}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white box-border"
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
              {showShuffleForm && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold dark:text-white">Shuffle Exercises</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowShuffleForm(false);
                        setDraggingKey(null);
                        draggingKeyRef.current = null;
                        pointerIdRef.current = null;
                      }}
                      className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
                    >
                      Done
                    </button>
                  </div>
                  <div className="space-y-2">
                    {workoutOrder.map((slotKey) => {
                      const slot = workoutData[slotKey];
                      if (!slot) return null;
                      const slotExercise = exercises.find((ex) => ex.id === slot.exerciseId);
                      if (!slotExercise) return null;
                      return (
                        <div
                          key={`shuffle-${slotKey}`}
                          data-shuffle-key={slotKey}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(slotKey)}
                          className="flex items-center gap-3 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={() => handleDragStart(slotKey)}
                            onPointerDown={(event) => handlePointerDown(slotKey, event)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            className="text-gray-500 dark:text-gray-300 cursor-move touch-none"
                            aria-label={`Reorder ${slotExercise.name}`}
                          >
                            ☰
                          </button>
                          <div className="text-sm dark:text-white">{slotExercise.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  >
                    <div className="flex justify-between items-start mb-4 gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold dark:text-white">{exercise.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Target: {targetRepRange.min}-{targetRepRange.max} reps
                        </p>
                        {replacingSlotKey === slotKey && (
                          <div className="mt-2">
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Replace Exercise</label>
                            <select
                              value={data.exerciseId}
                              onChange={(e) => handleReplaceExercise(slotKey, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            >
                              {(exercises.filter((ex) => ex.muscleGroup === exercise.muscleGroup).length
                                ? exercises.filter((ex) => ex.muscleGroup === exercise.muscleGroup)
                                : exercises
                              ).map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name} ({ex.muscleGroup})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuSlotKey((prev) => (prev === slotKey ? null : slotKey))}
                              className="w-10 h-10 rounded-full bg-white text-black border border-gray-300 flex items-center justify-center text-xl leading-none dark:bg-white/10 dark:border-white/70 dark:text-white"
                              aria-label="Exercise options"
                            >
                              ⋯
                            </button>
                            {openMenuSlotKey === slotKey && (
                              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRemoveExerciseSlot(slotKey);
                                    setOpenMenuSlotKey(null);
                                    if (replacingSlotKey === slotKey) setReplacingSlotKey(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Remove Exercise
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleReplace(slotKey)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Replace Exercise
                                </button>
                                <button
                                  type="button"
                                  onClick={handleOpenShuffle}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Shuffle Exercise
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="w-10 h-10 rounded-full bg-white text-black border border-gray-300 flex items-center justify-center font-semibold dark:bg-white/10 dark:border-white/70 dark:text-white"
                            aria-label="Exercise info"
                            onClick={() => setInfoSlotKey(slotKey)}
                          >
                            i
                          </button>
                        </div>
                        {pred && (
                        <div className="text-right min-w-[140px]">
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-sm">
                            <div className="text-xs text-gray-600 dark:text-gray-400">Suggested Weight</div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {(pred.suggestion?.suggestedWeight ?? 0).toFixed(2)} kg
                            </div>
                            {pred.suggestion.shouldIncrease &&
                              (!rpeEnabled || pred.avgRpe == null || pred.avgRpe <= 8.5) && (
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
                  setReplacingSlotKey(null);
                  setOpenMenuSlotKey(null);
                  setShowShuffleForm(false);
                  storage.clearActiveWorkoutDraft();
                  if (onActiveWorkoutClear) onActiveWorkoutClear();
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-white/10 dark:border-white/70 dark:text-white dark:hover:bg-white/20"
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

      {infoSlotKey && infoData && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setInfoSlotKey(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 border border-gray-200 dark:border-gray-600"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold dark:text-white">{infoData.exercise.name}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Target rep range: {infoData.repRange.min}-{infoData.repRange.max}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white"
                onClick={() => setInfoSlotKey(null)}
                aria-label="Close info"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold dark:text-white mb-1">Last workout</div>
                {infoData.lastSession ? (
                  <>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {new Date(infoData.lastSession.date).toLocaleString()}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(infoData.lastSession.sets || []).map((set, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 dark:text-white"
                        >
                          {(Number(set.weight) || 0).toFixed(1)}kg x {Number(set.reps) || 0}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-600 dark:text-gray-400">No previous workout data.</div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold dark:text-white mb-1">Top set (in range)</div>
                {infoData.topSet ? (
                  <div className="text-sm dark:text-white">
                    {infoData.topSet.weight.toFixed(1)}kg x {infoData.topSet.reps} reps
                    <span className="block text-xs text-gray-600 dark:text-gray-400">
                      {new Date(infoData.topSet.date).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    No in-range top set found yet.
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold dark:text-white mb-1">Why this suggestion</div>
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  {infoData.suggestedWeight != null
                    ? `Suggested weight: ${infoData.suggestedWeight.toFixed(1)}kg. `
                    : ''}
                  {infoData.reasoning}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default LogWorkout;
