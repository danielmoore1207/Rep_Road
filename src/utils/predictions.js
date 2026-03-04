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
export function suggestWeightIncrease(sessions, desiredRepRange = null) {
  if (!sessions || sessions.length < 2) {
    return {
      shouldIncrease: false,
      suggestedWeight: null,
      reason: 'Not enough data',
    };
  }

  const recentSessions = sessions.slice(-3); // Last 3 sessions
  const weights = recentSessions.map(s => Math.max(...s.sets.map(set => set.weight || 0)));
  const reps = recentSessions.map(s => {
    const avgReps = s.sets.reduce((sum, set) => sum + (set.reps || 0), 0) / s.sets.length;
    return avgReps;
  });

  const currentWeight = weights[weights.length - 1];
  const currentReps = reps[reps.length - 1];
  const avgReps = reps.reduce((a, b) => a + b, 0) / reps.length;

  // Use desired rep range from routine if available, otherwise default to 8
  const targetRepsMin = desiredRepRange?.min || 8;
  const targetRepsMax = desiredRepRange?.max || 12;
  const targetReps = (targetRepsMin + targetRepsMax) / 2; // Use midpoint as target
  
  // Check if user is consistently hitting target reps (within range or at upper end)
  const isConsistent = reps.every(r => r >= targetRepsMin * 0.9); // Within 10% of min target
  const isHittingUpperRange = avgReps >= targetRepsMax * 0.95; // Hitting upper end of range
  
  // Check if reps are increasing
  const repsIncreasing = reps.length >= 2 && reps[reps.length - 1] > reps[reps.length - 2];

  let shouldIncrease = false;
  let suggestedWeight = currentWeight;
  let reason = '';

  // If hitting upper end of desired range consistently, suggest increase
  if (isHittingUpperRange && isConsistent) {
    shouldIncrease = true;
    suggestedWeight = currentWeight + 2.5; // Suggest 2.5kg increase (or 5lbs)
    reason = `Consistently hitting upper range (${Math.round(avgReps)} reps). Ready to progress!`;
  } else if (isConsistent && avgReps >= targetReps) {
    shouldIncrease = true;
    suggestedWeight = currentWeight + 2.5;
    reason = `Consistently hitting target (${Math.round(avgReps)} reps). Ready to progress!`;
  } else if (repsIncreasing && currentReps >= targetRepsMax) {
    shouldIncrease = true;
    suggestedWeight = currentWeight + 2.5;
    reason = `Reps are increasing and hitting upper range (${Math.round(currentReps)} reps). Time to increase weight.`;
  } else if (avgReps < targetRepsMin * 0.8) {
    shouldIncrease = false;
    suggestedWeight = currentWeight;
    reason = `Reps are low (${Math.round(avgReps)} avg). Maintain current weight. Aim for ${targetRepsMin}-${targetRepsMax} reps.`;
  } else {
    shouldIncrease = false;
    suggestedWeight = currentWeight;
    reason = `Keep working at current weight. Aim for ${targetRepsMin}-${targetRepsMax} reps consistently.`;
  }

  return {
    shouldIncrease,
    suggestedWeight: Math.round(suggestedWeight * 100) / 100,
    currentWeight,
    currentReps: Math.round(currentReps * 100) / 100,
    reason,
    targetRepRange: desiredRepRange || { min: 8, max: 12 },
  };
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
