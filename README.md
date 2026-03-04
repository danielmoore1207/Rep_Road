# Gym Workout Tracker

A comprehensive gym app for creating and tracking custom-made workouts with AI-powered predictions and suggestions.

## Features

- **Custom Exercises**: Create and manage your own exercises with muscle group categorization
- **Custom Routines**: Create workout routines (e.g., "Push Day", "Pull Day") consisting of multiple exercises
- **Desired Rep Ranges**: Set target rep ranges for each exercise within a routine to guide AI predictions
- **Workout Logging**: Log workouts by selecting a routine and recording weight and reps for each exercise
- **AI Predictions**: Uses linear regression and moving average algorithms to predict next session values
- **Weight Suggestions**: AI suggests when to increase weight based on desired rep ranges and previous workout performance
- **Growth Tracking**: Tracks expected growth vs actual growth to monitor progress
- **Workout History**: View detailed history of all your workouts with progress tracking

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Create Exercises**: Go to the "Exercises" page and create custom exercises with name, muscle group, and optional description.

2. **Create Routines**: Navigate to "Routines" to create custom workout routines. Add exercises to each routine and set desired rep ranges (e.g., 8-12 reps) for each exercise. This helps the AI make better predictions about when to increase weight.

3. **Log Workouts**: Navigate to "Log Workout" and select a routine. The app will show all exercises in that routine with AI-predicted weights based on your historical data and desired rep ranges.

4. **View Dashboard**: The dashboard provides an overview of all exercises with:
   - Predicted next session values
   - Weight increase suggestions (based on desired rep ranges)
   - Growth tracking (expected vs actual)

5. **Check History**: View detailed workout history with progress tracking for each exercise.

## AI Features

### Prediction Algorithm
- Uses a hybrid approach combining linear regression (70%) and moving average (30%)
- Predicts next session weight based on historical trends
- Provides confidence scores for predictions

### Weight Increase Suggestions
- Uses desired rep ranges from routines to determine optimal weight progression
- Analyzes last 3 sessions for consistency
- Suggests weight increases when:
  - Consistently hitting the upper end of desired rep range
  - Reps are increasing and hitting target range
  - Performance indicates readiness for progression
- Provides reasoning for suggestions based on rep range targets

### Growth Tracking
- Compares expected growth (from predictions) vs actual growth
- Identifies if you're on track or off track
- Shows percentage differences and trends

## Tech Stack

- React 18
- Vite
- React Router
- Tailwind CSS
- LocalStorage for data persistence
- date-fns for date formatting

## Project Structure

```
src/
  ├── components/
  │   ├── Dashboard.jsx       # Main dashboard with insights
  │   ├── Exercises.jsx      # Exercise creation and management
  │   ├── CreateRoutine.jsx  # Routine creation and management
  │   ├── LogWorkout.jsx     # Workout logging interface (routine-based)
  │   └── History.jsx        # Workout history and progress
  ├── utils/
  │   ├── storage.js         # LocalStorage utilities
  │   └── predictions.js     # AI prediction algorithms
  ├── App.jsx                # Main app component with routing
  └── main.jsx               # Entry point
```

## Data Storage

All data is stored locally in the browser using LocalStorage. No data is sent to external servers.

## Future Enhancements

- Export/import workout data
- Charts and graphs for progress visualization
- Rest timer
- More advanced AI models for predictions
- Routine templates and sharing
