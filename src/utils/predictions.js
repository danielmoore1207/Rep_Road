// Prediction utilities using linear regression and moving average

/**
 * Simple linear regression to predict next value
 * @param {Array} dataPoints - Array of {x: number, y: number} points
 * @returns {Object} - {slope, intercept, nextValue}
 */
export function linearRegression(dataPoints) {
  if (dataPoints.length < 2) {
    return { slope: 0, intercept: dataPoints[0]?.y || 0, nextValue: dataPoints[0]?.y || 0 };
  }

  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  dataPoints.forEach((point, index) => {
    const x = index + 1; // Use index as x (session number)
    const y = point.y;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const nextX = n + 1;
  const nextValue = slope * nextX + intercept;

  return { slope, intercept, nextValue: Math.max(0, nextValue) }; // Ensure non-negative
}

/**
 * Moving average prediction
 * @param {Array} values - Array of numbers
 * @param {number} window - Window size for moving average
 * @returns {number} - Predicted next value
 */
export function movingAverage(values, window = 3) {
  if (values.length === 0) return 0;
  if (values.length < window) {
    // Use all available data if not enough for window
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg;
  }
  
  const recent = values.slice(-window);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  // Calculate trend from last few points
  if (values.length >= 2) {
    const trend = (values[values.length - 1] - values[values.length - window]) / (window - 1);
    return avg + trend;
  }
  
  return avg;
}

/**
 * Predict next session values for an exercise
 * @param {Array} sessions - Array of workout sessions for this exercise
 * @param {string} metric - 'weight' or 'reps'
 * @returns {Object} - Prediction data
 */
export function predictNextSession(sessions, metric = 'weight') {
  if (!sessions || sessions.length === 0) {
    return {
      predictedValue: 0,
      method: 'none',
      confidence: 0,
    };
  }

  // Extract values from sessions (use best set or average)
  const dataPoints = sessions.map((session, index) => {
    let value = 0;
    if (metric === 'weight') {
      // Use max weight from all sets
      value = Math.max(...session.sets.map(s => s.weight || 0));
    } else {
      // Use average reps
      const totalReps = session.sets.reduce((sum, s) => sum + (s.reps || 0), 0);
      value = totalReps / session.sets.length;
    }
    return { x: index + 1, y: value };
  });

  // Use linear regression for prediction
  const lrResult = linearRegression(dataPoints);
  
  // Also calculate moving average
  const values = dataPoints.map(p => p.y);
  const maResult = movingAverage(values, Math.min(3, values.length));

  // Combine predictions (weighted average: 70% LR, 30% MA)
  const predictedValue = lrResult.nextValue * 0.7 + maResult * 0.3;
  
  // Calculate confidence based on data points and variance
  const variance = calculateVariance(values);
  const confidence = Math.max(0, Math.min(1, 1 - (variance / (values[values.length - 1] || 1))));

  return {
    predictedValue: Math.round(predictedValue * 100) / 100,
    method: 'hybrid',
    confidence: Math.round(confidence * 100) / 100,
    linearRegression: lrResult,
    movingAverage: maResult,
  };
}

/**
 * Calculate variance of values
 */
function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Suggest weight increase based on historical data and desired rep range
 * @param {Array} sessions - Array of workout sessions
 * @param {Object} desiredRepRange - {min: number, max: number} from routine
 * @returns {Object} - Suggestion data
 */
export function suggestWeightIncrease(sessions, desiredRepRange = null, progressionMode = 'moderate') {
  if (!sessions || sessions.length === 0) {
    return {
      shouldIncrease: false,
      suggestedWeight: null,
      reason: 'Not enough data',
    };
  }

  const modeConfig = getProgressionModeConfig(progressionMode);
  const orderedSessions = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recentSessions = orderedSessions.slice(-modeConfig.smoothingWindow);

  const targetRepRange = desiredRepRange || { min: 8, max: 12 };
  const targetReps = (targetRepRange.min + targetRepRange.max) / 2;
  const targetRpe = modeConfig.targetRpe;

  const sessionBestE1Rms = recentSessions
    .map((session) => {
      const best = (session.sets || []).reduce((acc, set) => {
        const value = calculateSetE1RM(set);
        return value > acc ? value : acc;
      }, 0);
      return best > 0 ? best : null;
    })
    .filter((value) => value != null);

  if (sessionBestE1Rms.length === 0) {
    return {
      shouldIncrease: false,
      suggestedWeight: null,
      reason: 'No valid sets found to estimate e1RM.',
    };
  }

  const smoothedE1RM = weightedMovingAverage(sessionBestE1Rms);
  const targetPercent = getBrzyckiPercentForRepsAndRpe(targetReps, targetRpe);
  const rawSuggestedWeight = smoothedE1RM * targetPercent;
  const suggestedWeight = roundToNearest(rawSuggestedWeight, 1.25);

  const lastSession = orderedSessions[orderedSessions.length - 1];
  const currentWeight = Math.max(...(lastSession?.sets || []).map((set) => set.weight || 0), 0);
  const shouldIncrease = suggestedWeight > currentWeight;
  const reason = `Using ${modeConfig.label} mode (RPE ${targetRpe.toFixed(1)}, ${modeConfig.smoothingWindow}-session smoothing), your recent weighted e1RM is ${smoothedE1RM.toFixed(1)}kg. Targeting ${targetReps.toFixed(1)} reps gives ${(targetPercent * 100).toFixed(1)}% intensity, which suggests ${suggestedWeight.toFixed(2)}kg (rounded to nearest 1.25kg).`;

  return {
    shouldIncrease,
    suggestedWeight,
    currentWeight,
    currentReps: Math.round((lastSession?.sets?.reduce((sum, set) => sum + (set.reps || 0), 0) / Math.max(1, lastSession?.sets?.length || 1)) * 100) / 100,
    reason,
    targetRepRange,
    progressionMode: modeConfig.mode,
    smoothedE1RM: Math.round(smoothedE1RM * 100) / 100,
    targetRpe,
    targetPercent: Math.round(targetPercent * 1000) / 1000,
  };
}

function getProgressionModeConfig(mode) {
  switch (mode) {
    case 'conservative':
      return { mode: 'conservative', label: 'Conservative', targetRpe: 8.0, smoothingWindow: 5 };
    case 'aggressive':
      return { mode: 'aggressive', label: 'Aggressive', targetRpe: 9.0, smoothingWindow: 3 };
    case 'moderate':
    default:
      return { mode: 'moderate', label: 'Moderate', targetRpe: 8.5, smoothingWindow: 4 };
  }
}

function roundToNearest(value, increment) {
  if (!Number.isFinite(value) || increment <= 0) return 0;
  return Math.round(value / increment) * increment;
}

function weightedMovingAverage(values) {
  if (!values.length) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  values.forEach((value, index) => {
    const weight = index + 1; // More recent sessions have higher weight
    weightedSum += value * weight;
    totalWeight += weight;
  });
  return weightedSum / totalWeight;
}

function calculateSetE1RM(set) {
  const weight = Number(set?.weight) || 0;
  const reps = Number(set?.reps) || 0;
  if (weight <= 0 || reps <= 0) return 0;
  const percent = getBrzyckiPercentForRepsAndRpe(reps, set?.rpe);
  if (percent <= 0) return 0;
  return weight / percent;
}

function getBrzyckiPercentForRepsAndRpe(reps, rpe) {
  const repsNum = Math.max(1, Number(reps) || 1);
  const rpeNum = Number.isFinite(Number(rpe)) ? Number(rpe) : 8.5;
  const rir = Math.max(0, Math.min(5, 10 - rpeNum));
  const repsAtFailure = Math.max(1, Math.min(36, repsNum + rir));
  return Math.max(0.01, (37 - repsAtFailure) / 36);
}

/**
 * Track expected vs actual growth
 * @param {Array} sessions - Historical sessions
 * @param {Object} prediction - Previous prediction
 * @returns {Object} - Growth tracking data
 */
export function trackGrowth(sessions, previousPrediction) {
  if (!sessions || sessions.length < 2) {
    return {
      expectedGrowth: 0,
      actualGrowth: 0,
      growthDifference: 0,
      onTrack: true,
    };
  }

  const currentSession = sessions[sessions.length - 1];
  const previousSession = sessions[sessions.length - 2];
  
  const currentWeight = Math.max(...currentSession.sets.map(s => s.weight || 0));
  const previousWeight = Math.max(...previousSession.sets.map(s => s.weight || 0));
  
  const actualGrowth = currentWeight - previousWeight;
  const expectedGrowth = previousPrediction?.predictedValue 
    ? previousPrediction.predictedValue - previousWeight 
    : 0;
  
  const growthDifference = actualGrowth - expectedGrowth;
  const onTrack = Math.abs(growthDifference) <= 2.5; // Within 2.5kg of prediction

  return {
    expectedGrowth: Math.round(expectedGrowth * 100) / 100,
    actualGrowth: Math.round(actualGrowth * 100) / 100,
    growthDifference: Math.round(growthDifference * 100) / 100,
    onTrack,
    percentageDifference: expectedGrowth !== 0 
      ? Math.round((growthDifference / expectedGrowth) * 100) 
      : 0,
  };
}
