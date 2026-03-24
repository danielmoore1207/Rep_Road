import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { subDays, format, parseISO, isWithinInterval } from 'date-fns';
import { predictNextSession, suggestWeightIncrease, trackGrowth, linearRegression } from '../utils/predictions';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 
  'Core', 'Cardio', 'Full Body', 'Other'
];

function Dashboard({ exercises, sessions, routines, growthSettings, oneRmUnit }) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('All');
  const [selectedInsightsGroup, setSelectedInsightsGroup] = useState('');
  const [oneRmLift, setOneRmLift] = useState('Bench Press');
  const [oneRmWeight, setOneRmWeight] = useState('');
  const [oneRmReps, setOneRmReps] = useState('');

  const calculateE1RM = (weight, reps) => {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (growthSettings?.formula === 'brzycki') {
      return r >= 37 ? 0 : w * (36 / (37 - r));
    }
    return w * (1 + r / 30);
  };

  const calculateOneRm = () => {
    const weight = parseFloat(oneRmWeight);
    const reps = parseInt(oneRmReps, 10);
    if (!weight || !reps) return null;
    return calculateE1RM(weight, reps);
  };

  const getExerciseWeight = (exerciseName) => {
    const name = (exerciseName || '').toLowerCase();
    const benchmarks = growthSettings?.benchmarks || [];
    const match = benchmarks.find((b) => name.includes(b.name.toLowerCase()));
    if (match) return match.weight;
    return growthSettings?.includeAccessories === false ? 0 : 1;
  };

  // Get available muscle groups from exercises
  const growthMuscleGroups = useMemo(() => {
    const groups = new Set(
      exercises
        .map(ex => ex.muscleGroup)
        .filter(group => group && group !== 'Cardio')
    );
    return ['All', ...Array.from(groups).sort()];
  }, [exercises]);

  const insightsMuscleGroups = useMemo(() => {
    const groups = new Set(
      exercises
        .map(ex => ex.muscleGroup)
        .filter(group => group && group !== 'Cardio')
    );
    return Array.from(groups).sort();
  }, [exercises]);

  // Calculate e1RM-based growth data for the selected muscle group for the last 30 days
  const chartData = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const today = new Date();
    const baselineDays = Math.max(1, growthSettings?.baselineDays || 7);
    const baselineEnd = subDays(today, 30 - baselineDays);

    // Filter exercises by selected muscle group
    const relevantExercises = selectedMuscleGroup === 'All' 
      ? exercises.filter(ex => ex.muscleGroup !== 'Cardio')
      : exercises.filter(ex => ex.muscleGroup === selectedMuscleGroup);

    if (relevantExercises.length === 0) {
      return [];
    }

    const relevantExerciseIds = new Set(relevantExercises.map(ex => ex.id));

    // Use only sessions in the last 30 days for growth window
    const allSessions = sessions.filter(s => relevantExerciseIds.has(s.exerciseId));
    
    // Filter sessions to last 30 days for display
    const recentSessions = allSessions.filter(session => {
      const sessionDate = parseISO(session.date);
      return isWithinInterval(sessionDate, { start: thirtyDaysAgo, end: today });
    });

    if (recentSessions.length === 0) {
      return [];
    }

    // Build per-exercise e1RM series by date
    const exerciseSeries = new Map();
    recentSessions.forEach((session) => {
      const dateKey = format(parseISO(session.date), 'yyyy-MM-dd');
      const sets = session.sets || [];
      const maxE1RM = sets.reduce((max, set) => {
        const e1rm = calculateE1RM(set.weight, set.reps);
        return Math.max(max, e1rm);
      }, 0);
      if (!exerciseSeries.has(session.exerciseId)) {
        exerciseSeries.set(session.exerciseId, new Map());
      }
      const dateMap = exerciseSeries.get(session.exerciseId);
      const prev = dateMap.get(dateKey) || 0;
      dateMap.set(dateKey, Math.max(prev, maxE1RM));
    });

    // Build baseline and growth maps per exercise
    const exerciseGrowthByDate = new Map();
    const exercisePredGrowthByDate = new Map();
    const exerciseWeights = new Map();
    const allDatesSet = new Set();

    exerciseSeries.forEach((dateMap, exerciseId) => {
      const exercise = relevantExercises.find((ex) => ex.id === exerciseId);
      if (!exercise) return;
      const weight = getExerciseWeight(exercise.name);
      if (weight === 0) return;
      exerciseWeights.set(exerciseId, weight);

      const dates = Array.from(dateMap.keys()).sort();
      dates.forEach((d) => allDatesSet.add(d));

      const baselineValues = dates
        .filter((d) => {
          const dt = parseISO(d);
          return dt >= thirtyDaysAgo && dt <= baselineEnd;
        })
        .map((d) => dateMap.get(d))
        .filter((v) => v > 0);

      if (baselineValues.length === 0) return;
      const baseline = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
      if (!baseline) return;

      const values = dates.map((d) => dateMap.get(d));
      const lr = linearRegression(values.map((v, idx) => ({ x: idx + 1, y: v })));

      const growthMap = new Map();
      const predGrowthMap = new Map();
      values.forEach((value, idx) => {
        const predicted = lr.slope * (idx + 1) + lr.intercept;
        const growth = ((value - baseline) / baseline) * 100;
        const predGrowth = ((predicted - baseline) / baseline) * 100;
        growthMap.set(dates[idx], growth);
        predGrowthMap.set(dates[idx], predGrowth);
      });

      exerciseGrowthByDate.set(exerciseId, growthMap);
      exercisePredGrowthByDate.set(exerciseId, predGrowthMap);
    });

    const allDates = Array.from(allDatesSet).sort();
    const dataPoints = [];

    allDates.forEach((dateKey) => {
      let actualSum = 0;
      let predictedSum = 0;
      let weightSum = 0;

      exerciseGrowthByDate.forEach((growthMap, exerciseId) => {
        const predMap = exercisePredGrowthByDate.get(exerciseId);
        const weight = growthSettings?.weightedAverage === false ? 1 : (exerciseWeights.get(exerciseId) || 1);

        // Use latest available value up to this date
        const dates = Array.from(growthMap.keys()).sort();
        const latestDate = dates.filter((d) => d <= dateKey).pop();
        if (!latestDate) return;
        const growth = growthMap.get(latestDate);
        const predGrowth = predMap?.get(latestDate) ?? growth;
        if (typeof growth !== 'number') return;

        actualSum += growth * weight;
        predictedSum += predGrowth * weight;
        weightSum += weight;
      });

      if (weightSum === 0) return;
      dataPoints.push({
        date: format(parseISO(dateKey), 'MMM dd'),
        actualGrowthPct: Math.round((actualSum / weightSum) * 10) / 10,
        predictedGrowthPct: Math.round((predictedSum / weightSum) * 10) / 10,
      });
    });

    return dataPoints;
  }, [exercises, sessions, selectedMuscleGroup]);

  const exerciseStats = useMemo(() => {
    return exercises.map(exercise => {
      const exerciseSessions = sessions.filter(s => s.exerciseId === exercise.id);
      const prediction = predictNextSession(exerciseSessions, 'weight');
      
      // Find rep range from routines for this exercise
      let repRange = null;
      for (const routine of routines || []) {
        const routineExercise = routine.exercises?.find(re => re.exerciseId === exercise.id);
        if (routineExercise) {
          repRange = { min: routineExercise.repRangeMin, max: routineExercise.repRangeMax };
          break; // Use first found
        }
      }
      
      const suggestion = suggestWeightIncrease(exerciseSessions, repRange, growthSettings?.progressionMode || 'moderate');
      const growth = exerciseSessions.length >= 2 
        ? trackGrowth(exerciseSessions, prediction) 
        : null;

      return {
        exercise,
        sessionCount: exerciseSessions.length,
        prediction,
        suggestion,
        growth,
        repRange,
        lastSession: exerciseSessions[exerciseSessions.length - 1],
      };
    });
  }, [exercises, sessions, routines]);

  return (
    <div className="space-y-6">
      {/* Growth Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold dark:text-white">📈 Growth Analysis (Last 30 Days)</h2>
          <select
            value={selectedMuscleGroup}
            onChange={(e) => setSelectedMuscleGroup(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {growthMuscleGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>No workout data available for the last 30 days. Start logging workouts to see your growth!</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-700" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                className="dark:stroke-gray-400"
              />
              <YAxis 
                stroke="#666"
                className="dark:stroke-gray-400"
                label={{ value: 'Growth (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
                className="dark:bg-gray-700 dark:border-gray-600"
                formatter={(value, name) => [`${value}%`, name]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
              />
              <Line 
                type="monotone" 
                dataKey="actualGrowthPct" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Actual Growth %"
                dot={{ r: 4, fill: '#10b981' }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="predictedGrowthPct" 
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Predicted Growth %"
                dot={{ r: 4, fill: '#3b82f6' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 1RM Calculator */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold dark:text-white mb-4">1RM Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lift
            </label>
            <select
              value={oneRmLift}
              onChange={(e) => setOneRmLift(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="Bench Press">Bench Press</option>
              <option value="Deadlift">Deadlift</option>
              <option value="Squat">Squat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Weight
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={oneRmWeight}
              onChange={(e) => setOneRmWeight(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={oneRmUnit || 'kg'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reps
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={oneRmReps}
              onChange={(e) => setOneRmReps(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="reps"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xs text-gray-600 dark:text-gray-400">Estimated 1RM</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {calculateOneRm() ? `${calculateOneRm().toFixed(1)} ${oneRmUnit || 'kg'}` : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Insights */}
      {exerciseStats.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No exercises yet. Create your first routine to get started!</p>
          <Link 
            to="/routines" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Routine
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold dark:text-white">Exercise Insights</h2>
            <select
              value={selectedInsightsGroup}
              onChange={(e) => setSelectedInsightsGroup(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select muscle group...</option>
              {insightsMuscleGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>

          {selectedInsightsGroup && exerciseStats
            .filter(({ exercise }) => exercise.muscleGroup === selectedInsightsGroup && exercise.muscleGroup !== 'Cardio')
            .map(({ exercise, sessionCount, prediction, suggestion, growth, repRange, lastSession }) => (
              <div key={exercise.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold dark:text-white">{exercise.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {exercise.muscleGroup} • {sessionCount} sessions
                      {repRange && ` • Target: ${repRange.min}-${repRange.max} reps`}
                    </p>
                  </div>
                </div>

              {sessionCount > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {/* Prediction Card */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Predicted Next Session</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {prediction.predictedValue.toFixed(1)} kg
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Confidence: {Math.round(prediction.confidence * 100)}%
                    </div>
                  </div>

                  {/* Suggestion Card */}
                  <div className={`p-4 rounded-lg ${
                    suggestion.shouldIncrease ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'
                  }`}>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Weight Suggestion</div>
                    {suggestion.shouldIncrease ? (
                      <>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ↑ {suggestion.suggestedWeight} kg
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{suggestion.reason}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {suggestion.suggestedWeight} kg
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{suggestion.reason}</div>
                      </>
                    )}
                  </div>

                  {/* Growth Tracking Card */}
                  {growth && (
                    <div className={`p-4 rounded-lg ${
                      growth.onTrack ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'
                    }`}>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Growth Tracking</div>
                      <div className="text-lg font-bold">
                        <span className={growth.actualGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {growth.actualGrowth > 0 ? '+' : ''}{growth.actualGrowth} kg
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-sm ml-2">
                          (expected: {growth.expectedGrowth > 0 ? '+' : ''}{growth.expectedGrowth})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {growth.onTrack ? '✓ On track' : '⚠ Off track'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No workouts logged yet. Start tracking to see predictions!
                </div>
              )}

              {lastSession && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Last Session:</div>
                  <div className="flex flex-wrap gap-2">
                    {lastSession.sets.map((set, idx) => (
                      <span key={idx} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded text-sm dark:text-white">
                        {set.weight}kg × {set.reps} reps
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
