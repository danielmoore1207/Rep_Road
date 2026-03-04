import { useState } from 'react';
import { storage } from '../utils/storage';

function Exercises({ exercises, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    muscleGroup: '',
    description: '',
  });

  const muscleGroups = [
    'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 
    'Core', 'Cardio', 'Full Body', 'Other'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newExercise = {
      id: Date.now().toString(),
      ...formData,
      createdAt: new Date().toISOString(),
    };

    const updatedExercises = [...exercises, newExercise];
    storage.saveExercises(updatedExercises);
    onUpdate(updatedExercises);
    
    setFormData({ name: '', muscleGroup: '', description: '' });
    setShowForm(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this exercise?')) {
      const updatedExercises = exercises.filter(ex => ex.id !== id);
      storage.saveExercises(updatedExercises);
      onUpdate(updatedExercises);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">💪 My Exercises</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Create Exercise'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Create New Exercise</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exercise Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Bench Press"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Muscle Group *
              </label>
              <select
                value={formData.muscleGroup}
                onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select muscle group</option>
                {muscleGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Add notes or instructions..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Exercise
              </button>
            </div>
          </form>
        </div>
      )}

      {exercises.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600">No exercises created yet. Create your first exercise!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map(exercise => (
            <div key={exercise.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-xl font-bold">{exercise.name}</h3>
                  <p className="text-gray-600 text-sm">{exercise.muscleGroup}</p>
                </div>
                <button
                  onClick={() => handleDelete(exercise.id)}
                  className="text-red-500 hover:text-red-700 text-xl"
                  title="Delete exercise"
                >
                  ×
                </button>
              </div>
              {exercise.description && (
                <p className="text-gray-500 text-sm mt-2">{exercise.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Exercises;
