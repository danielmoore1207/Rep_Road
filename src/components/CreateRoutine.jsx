import { useState } from 'react';
import { storage } from '../utils/storage';

const MUSCLE_GROUPS = [
  'Abs',
  'Back',
  'Biceps',
  'Cardio',
  'Chest',
  'Legs',
  'Shoulders',
  'Triceps',
];

function CreateRoutine({ exercises, routines, onUpdate, onExerciseUpdate, supabaseConfigured }) {
  const [showForm, setShowForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    exercises: [],
  });
  const [creatingExercise, setCreatingExercise] = useState(null); // { index, muscleGroup }

  const handleAddExercise = () => {
    setFormData({
      ...formData,
      exercises: [...formData.exercises, { 
        exerciseId: '', 
        repRangeMin: 8, 
        repRangeMax: 12,
        setsCount: 3,
        muscleGroup: '',
        creatingNew: false,
      }],
    });
  };

  const handleRemoveExercise = (index) => {
    setFormData({
      ...formData,
      exercises: formData.exercises.filter((_, i) => i !== index),
    });
    setCreatingExercise(null);
  };

  const handleMuscleGroupChange = (index, muscleGroup) => {
    const updatedExercises = [...formData.exercises];
    updatedExercises[index].muscleGroup = muscleGroup;
    updatedExercises[index].exerciseId = ''; // Reset exercise selection
    updatedExercises[index].creatingNew = false;
    setFormData({ ...formData, exercises: updatedExercises });
    setCreatingExercise(null);
  };

  const handleExerciseChange = (index, field, value) => {
    const updatedExercises = [...formData.exercises];
    if (field === 'exerciseId') {
      updatedExercises[index].exerciseId = value;
      updatedExercises[index].creatingNew = value === 'NEW';
    } else {
      if (value === '') {
        updatedExercises[index][field] = '';
      } else {
        updatedExercises[index][field] = parseInt(value, 10);
      }
    }
    setFormData({ ...formData, exercises: updatedExercises });
  };

  const handleCreateNewExercise = (index, exerciseData) => {
    const newExercise = {
      id: Date.now().toString(),
      name: exerciseData.name,
      muscleGroup: formData.exercises[index].muscleGroup,
      description: exerciseData.description || '',
      createdAt: new Date().toISOString(),
    };

    const updatedExercises = [...exercises, newExercise];
    storage.saveExercises(updatedExercises);
    onExerciseUpdate(updatedExercises);

    // Update form to use the new exercise - use functional update to ensure we have latest state
    // Also ensure the exercise is properly linked
    setFormData(prevFormData => {
      const updatedFormExercises = [...prevFormData.exercises];
      updatedFormExercises[index] = {
        ...updatedFormExercises[index],
        exerciseId: newExercise.id,
        creatingNew: false,
      };
      return { ...prevFormData, exercises: updatedFormExercises };
    });
    setCreatingExercise(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.exercises.length === 0) {
      alert('Please provide a routine name and at least one exercise.');
      return;
    }

    // Validate all exercises are selected or created
    if (formData.exercises.some(ex => !ex.exerciseId || !ex.muscleGroup)) {
      alert('Please complete all exercise selections.');
      return;
    }

    // Validate numeric fields (rep range + sets count)
    if (formData.exercises.some(ex => ex.repRangeMin === '' || ex.repRangeMax === '' || ex.setsCount === '')) {
      alert('Please complete rep range and sets count for all exercises.');
      return;
    }

    const normalizedExercises = formData.exercises.map(ex => ({
      ...ex,
      repRangeMin: parseInt(ex.repRangeMin, 10),
      repRangeMax: parseInt(ex.repRangeMax, 10),
      setsCount: parseInt(ex.setsCount, 10),
    }));

    const updatedRoutines = editingRoutine
      ? routines.map(r => r.id === editingRoutine.id 
          ? { ...formData, exercises: normalizedExercises, id: editingRoutine.id, updatedAt: new Date().toISOString() }
          : r)
      : [...routines, { ...formData, exercises: normalizedExercises, id: Date.now().toString(), createdAt: new Date().toISOString() }];

    storage.saveRoutines(updatedRoutines);
    onUpdate(updatedRoutines);
    
    setFormData({ name: '', exercises: [] });
    setShowForm(false);
    setEditingRoutine(null);
    setCreatingExercise(null);
  };

  const handleEdit = (routine) => {
    setFormData({
      name: routine.name,
      exercises: routine.exercises.map(ex => {
        const exercise = exercises.find(e => e.id === ex.exerciseId);
        return {
          exerciseId: ex.exerciseId,
          repRangeMin: ex.repRangeMin || 8,
          repRangeMax: ex.repRangeMax || 12,
          setsCount: ex.setsCount || 3,
          muscleGroup: exercise?.muscleGroup || '',
          creatingNew: false,
        };
      }),
    });
    setEditingRoutine(routine);
    setShowForm(true);
    setExpandedRoutineId(routine.id);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this routine?')) {
      const updatedRoutines = routines.filter(r => r.id !== id);
      storage.saveRoutines(updatedRoutines);
      onUpdate(updatedRoutines);
      if (expandedRoutineId === id) {
        setExpandedRoutineId(null);
      }
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', exercises: [] });
    setShowForm(false);
    setEditingRoutine(null);
    setCreatingExercise(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold dark:text-white">🏋️ My Routines</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) handleCancel();
          }}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Create Routine'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4 dark:text-white">
            {editingRoutine ? 'Edit Routine' : 'Create New Routine'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Routine Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Push Day, Pull Day, Leg Day"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Exercises *
                </label>
              </div>

              {formData.exercises.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <p>No exercises added. Click "Add Exercise" to get started.</p>
                  </div>
                  {!supabaseConfigured && (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                      Default exercises load from Supabase. Add your Supabase env vars and restart to see them.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleAddExercise}
                    className="w-full py-2 border border-dashed border-blue-400 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-sm font-medium"
                  >
                    + Add Exercise
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.exercises.map((exercise, index) => {
                    // Use a more reliable way to get the selected exercise
                    // First check if we just created it (it might not be in exercises prop yet)
                    let selectedExercise = exercises.find(ex => ex.id === exercise.exerciseId);
                    
                    // If not found but we have an exerciseId, it might be newly created
                    // In that case, we'll still show the rep range since exerciseId is set
                    const muscleGroupExercises = exercise.muscleGroup 
                      ? exercises.filter(ex => ex.muscleGroup === exercise.muscleGroup)
                      : [];
                    // Check if we're currently creating a new exercise for this index
                    const isCreatingNew = exercise.exerciseId === 'NEW' || 
                                         exercise.creatingNew || 
                                         (creatingExercise?.index === index);

                    return (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Exercise {index + 1}</span>
                          {formData.exercises.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveExercise(index)}
                              className="text-red-500 hover:text-red-700 text-xl"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          {/* Muscle Group Selection */}
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Muscle Group *</label>
                            <select
                              value={exercise.muscleGroup}
                              onChange={(e) => handleMuscleGroupChange(index, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                              required
                            >
                              <option value="">Select muscle group...</option>
                              {MUSCLE_GROUPS.map(group => (
                                <option key={group} value={group}>{group}</option>
                              ))}
                            </select>
                          </div>

                          {/* Exercise Selection or Creation */}
                          {exercise.muscleGroup && (
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Exercise *</label>
                              <select
                                value={exercise.exerciseId === 'NEW' ? 'NEW' : exercise.exerciseId}
                                onChange={(e) => {
                                  if (e.target.value === 'NEW') {
                                    setCreatingExercise({ index, muscleGroup: exercise.muscleGroup });
                                  }
                                  handleExerciseChange(index, 'exerciseId', e.target.value);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                                required
                              >
                                <option value="">Select exercise...</option>
                                {muscleGroupExercises.map(ex => (
                                  <option key={ex.id} value={ex.id}>
                                    {ex.name}
                                  </option>
                                ))}
                                <option value="NEW">+ Create New Exercise</option>
                              </select>
                            </div>
                          )}

                          {/* Inline Exercise Creation */}
                          {isCreatingNew && exercise.muscleGroup && (
                            <div 
                              className="bg-white dark:bg-gray-600 p-3 rounded border border-blue-200 dark:border-blue-800"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  e.stopPropagation();
                                }
                              }}
                            >
                              <ExerciseCreator
                                muscleGroup={exercise.muscleGroup}
                                onSave={(exerciseData) => {
                                  handleCreateNewExercise(index, exerciseData);
                                }}
                                onCancel={() => {
                                  setFormData(prevFormData => {
                                    const updated = [...prevFormData.exercises];
                                    updated[index].creatingNew = false;
                                    updated[index].exerciseId = '';
                                    return { ...prevFormData, exercises: updated };
                                  });
                                  setCreatingExercise(null);
                                }}
                              />
                            </div>
                          )}

                          {/* Rep Range */}
                          {exercise.exerciseId && !isCreatingNew && (
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Desired Rep Range *</label>
                              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={exercise.repRangeMin}
                                  onChange={(e) => handleExerciseChange(index, 'repRangeMin', e.target.value)}
                                  className={`w-full min-w-0 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-600 text-gray-900 dark:text-white ${
                                    exercise.repRangeMin === '' ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                  placeholder="Min"
                                  required
                                />
                                <span className="text-gray-500 dark:text-gray-400 sm:px-1">-</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={exercise.repRangeMax}
                                  onChange={(e) => handleExerciseChange(index, 'repRangeMax', e.target.value)}
                                  className={`w-full min-w-0 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-600 text-gray-900 dark:text-white ${
                                    exercise.repRangeMax === '' ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                  placeholder="Max"
                                  required
                                />
                                <span className="text-gray-500 dark:text-gray-400 text-sm sm:whitespace-nowrap">reps</span>
                              </div>
                              {selectedExercise && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Target: {exercise.repRangeMin}-{exercise.repRangeMax} reps for {selectedExercise.name}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Sets Count */}
                          {exercise.exerciseId && !isCreatingNew && (
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Number of Sets *</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={exercise.setsCount}
                                onChange={(e) => handleExerciseChange(index, 'setsCount', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-600 text-gray-900 dark:text-white ${
                                  exercise.setsCount === '' ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                }`}
                                required
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddExercise}
                    className="w-full py-2 border border-dashed border-blue-400 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-sm font-medium"
                  >
                    + Add Exercise
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingRoutine ? 'Update Routine' : 'Create Routine'}
              </button>
            </div>
          </form>
        </div>
      )}

      {routines.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">No routines created yet. Create your first routine!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routines.map(routine => {
            const routineExercises = routine.exercises.map(re => {
              const exercise = exercises.find(ex => ex.id === re.exerciseId);
              return { ...re, exercise };
            }).filter(re => re.exercise);
            const isExpanded = expandedRoutineId === routine.id;

            return (
              <div key={routine.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <button
                  type="button"
                  onClick={() => setExpandedRoutineId(isExpanded ? null : routine.id)}
                  className="w-full text-left"
                  aria-expanded={isExpanded}
                  aria-controls={`routine-${routine.id}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold dark:text-white">{routine.name}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {routineExercises.length} exercise{routineExercises.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-gray-400 text-lg">
                      {isExpanded ? '▾' : '▸'}
                    </div>
                  </div>
                </button>

                <div id={`routine-${routine.id}`} className="space-y-2">
                  {isExpanded && routineExercises.map((re, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                      <div className="font-medium dark:text-white">{re.exercise.name}</div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs">
                        Target: {re.repRangeMin}-{re.repRangeMax} reps • {re.setsCount || 3} sets
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => handleEdit(routine)}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                    title="Edit routine"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(routine.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="Delete routine"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline Exercise Creator Component
function ExerciseCreator({ muscleGroup, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent any form submission
    if (!name.trim()) {
      alert('Please enter an exercise name');
      return;
    }
    onSave({ name: name.trim(), description: description.trim() });
    setName('');
    setDescription('');
  };

  const handleCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      e.stopPropagation();
      if (name.trim()) {
        handleSave(e);
      }
    }
  };

  return (
    <div className="space-y-2" onKeyDown={handleKeyPress}>
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Exercise Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (name.trim()) {
                handleSave(e);
              }
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          placeholder="e.g., Bench Press"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (name.trim()) {
                handleSave(e);
              }
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          placeholder="Add notes..."
        />
      </div>
      <div className="flex space-x-2 pt-2">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create
        </button>
      </div>
    </div>
  );
}

export default CreateRoutine;
