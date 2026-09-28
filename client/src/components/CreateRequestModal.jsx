import React, { useState, useEffect } from 'react';
import { createRequestApi, getDepartmentsApi } from '../services/api';
import { X, Send, AlertCircle } from 'lucide-react';

const CATEGORIES = ['IT', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'SECURITY', 'CLASSROOM', 'HOSTEL', 'TRANSPORT', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const CreateRequestModal = ({ isOpen, onClose, onRequestCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('IT');
  const [priority, setPriority] = useState('MEDIUM');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    try {
      const res = await getDepartmentsApi();
      if (res.success && res.data?.departments) {
        setDepartments(res.data.departments);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a request title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a detailed description.');
      return;
    }

    setLoading(true);
    try {
      const res = await createRequestApi({
        title,
        description,
        category,
        priority,
        departmentId: departmentId || undefined,
      });

      if (res.success) {
        // Reset form
        setTitle('');
        setDescription('');
        setCategory('IT');
        setPriority('MEDIUM');
        setDepartmentId('');
        onRequestCreated(res.data.request);
        onClose();
      } else {
        setError(res.message || 'Failed to create request.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="auth-card" style={{ maxWidth: '560px', width: '100%', position: 'relative', borderRadius: '16px' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Submit Service Request</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Describe the issue clearly for automated routing to facility teams.
        </p>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Issue Title *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Broken AC in Lab 302" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category *</label>
            <select 
              className="form-input" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select 
                className="form-input" 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITIES.map((pri) => (
                  <option key={pri} value={pri}>{pri}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department (Optional)</label>
              <select 
                className="form-input" 
                value={departmentId} 
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Auto-Assign Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description *</label>
            <textarea 
              className="form-input" 
              rows={4} 
              placeholder="Provide exact location, symptoms, and urgency..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              <Send size={16} /> {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRequestModal;
