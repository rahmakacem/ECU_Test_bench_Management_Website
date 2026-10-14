import { useState, useRef, useEffect } from 'react';
import { X, ImagePlus, Plus, Loader2 } from 'lucide-react';
import { BeautifulSelect } from './BeautifulSelect';
import { getRooms, createRoom, deleteRoom } from '../services/api';

interface AddTestBenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newBench: any) => void;
}

export function AddTestBenchModal({ isOpen, onClose, onSave }: AddTestBenchModalProps) {
  const [name, setName] = useState('');
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [location, setLocation] = useState('Sfax');
  const [room, setRoom] = useState('');
  const [benchType, setBenchType] = useState('MTS');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dynamic rooms
  const [rooms, setRooms] = useState<{ id: number; name: string }[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);

  // Fetch rooms from API
  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const response = await getRooms();
      const data = response.data;
      const list: { id: number; name: string }[] = Array.isArray(data) ? data : data.results || [];
      setRooms(list);
      if (!room && list.length > 0) setRoom(list[0].name);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  // Fetch projects from DB
  useEffect(() => {
    if (!isOpen) return;
    fetch('http://localhost:8001/api/projects/', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const rows = (data.results ?? data) as { name: string }[];
        const names = rows.map(p => p.name).filter(Boolean);
        if (names.length) {
          setProjects(names);
          setProject(names[0]);
        }
      })
      .catch(() => {
        setProjects(['2021', '2018', '2025']);
        setProject('2021');
      });
  }, [isOpen]);

  const handleAddRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    if (rooms.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('A room with this name already exists.');
      return;
    }
    setIsAddingRoom(true);
    try {
      await createRoom({ name: trimmed });
      await fetchRooms();
      setRoom(trimmed);
      setShowAddRoom(false);
      setNewRoomName('');
    } catch (error: any) {
      console.error('Failed to add room:', error);
      alert(error.response?.data?.name?.[0] || 'Failed to add room. It may already exist.');
    } finally {
      setIsAddingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomObj: { id: number; name: string }) => {
    if (!confirm(`Delete room "${roomObj.name}"? This may affect existing test benches.`)) return;
    setDeletingRoomId(roomObj.id);
    try {
      await deleteRoom(roomObj.id);
      const remaining = rooms.filter(r => r.id !== roomObj.id);
      setRooms(remaining);
      if (room === roomObj.name) setRoom(remaining[0]?.name || '');
    } catch (error) {
      console.error('Failed to delete room:', error);
      alert('Failed to delete room.');
    } finally {
      setDeletingRoomId(null);
    }
  };

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotoBase64(base64);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      const csrfToken = localStorage.getItem('csrfToken');
      const payload = {
        name: name.trim(),
        project,
        location,
        room,
        bench_type: benchType,
        status: 'available',
        photo: photoBase64 || null,
      };
      const res = await fetch('http://localhost:8001/api/testbenches/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save');
      }
      const saved = await res.json();
      onSave(saved);
      handleClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save test bench. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(''); 
    setProject(projects[0] || '2021');
    setLocation('Sfax');
    setRoom(rooms[0]?.name || '');
    setBenchType('MTS');
    setPhotoBase64(null); 
    setPhotoPreview(null); 
    setError('');
    setShowAddRoom(false);
    setNewRoomName('');
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #334E68, #243B53)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
            Add New Test Bench
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {/* Photo Upload */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Photo</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                height: '180px',
                border: '2px dashed #E2E8F0',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                background: '#F8FAFC',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563EB'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                  <ImagePlus style={{ width: 36, height: 36, margin: '0 auto 8px', strokeWidth: 1.5 }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Click to upload photo</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>PNG, JPG up to 5MB</div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>
              Test Bench Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#334155',
                background: '#F8FAFC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., BCP21-TSP3"
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563EB'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
            />
          </div>

          {/* Project */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Project</label>
            <BeautifulSelect
              value={project}
              options={projects}
              onChange={setProject}
            />
          </div>

          {/* Location */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Location</label>
            <BeautifulSelect
              value={location}
              options={['Sfax', 'GAR']}
              onChange={setLocation}
            />
          </div>

          {/* Room Field — pill picker */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={labelStyle}>Room</label>
              <button
                onClick={() => { setShowAddRoom(!showAddRoom); setNewRoomName(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: '#557486', background: 'none',
                  border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                <Plus className="w-3 h-3" /> Add New
              </button>
            </div>

            {/* Inline add form */}
            {showAddRoom && (
              <div style={{
                marginBottom: '10px', padding: '10px 12px',
                background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0',
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                    placeholder="Room name…"
                    autoFocus
                    style={{
                      flex: 1, padding: '7px 11px', border: '1px solid #E2E8F0',
                      borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff',
                    }}
                  />
                  <button
                    onClick={handleAddRoom}
                    disabled={isAddingRoom || !newRoomName.trim()}
                    style={{
                      padding: '7px 14px', background: isAddingRoom || !newRoomName.trim() ? '#94A3B8' : '#334E68',
                      color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px',
                      fontWeight: 600, cursor: isAddingRoom || !newRoomName.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}
                  >
                    {isAddingRoom ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : 'Add'}
                  </button>
                  <button
                    onClick={() => setShowAddRoom(false)}
                    style={{
                      padding: '7px 12px', background: '#fff', border: '1px solid #E2E8F0',
                      borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#64748B',
                    }}
                  >Cancel</button>
                </div>
              </div>
            )}

            {/* Pills */}
            {loadingRooms ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 13 }}>
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Loading rooms…
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {rooms.map((r) => {
                  const isSelected = room === r.name;
                  const isDeleting = deletingRoomId === r.id;
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 500, userSelect: 'none',
                        transition: 'all 0.15s',
                        border: isSelected ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                        background: isSelected ? '#EFF6FF' : '#F8FAFC',
                        color: isSelected ? '#2563EB' : '#475569',
                      }}
                      onClick={() => setRoom(r.name)}
                    >
                      <span>{r.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRoom(r); }}
                        disabled={isDeleting}
                        title={`Delete ${r.name}`}
                        style={{
                          width: 16, height: 16, borderRadius: '50%', border: 'none',
                          background: isSelected ? '#BFDBFE' : '#E2E8F0',
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, flexShrink: 0, transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isDeleting) e.currentTarget.style.background = '#FECACA'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? '#BFDBFE' : '#E2E8F0'; }}
                      >
                        {isDeleting
                          ? <Loader2 style={{ width: 9, height: 9, stroke: '#94A3B8', animation: 'spin 1s linear infinite' }} />
                          : <X style={{ width: 9, height: 9, stroke: '#94A3B8', strokeWidth: 2.5 }} />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Type */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Type</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['MTS', 'BTS'].map(t => (
                <button
                  key={t}
                  onClick={() => setBenchType(t)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: benchType === t ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    background: benchType === t ? '#EFF6FF' : '#F8FAFC',
                    color: benchType === t ? '#2563EB' : '#64748B',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Status note */}
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>✓</span>
            Status will be set to <strong>Available</strong> by default
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                border: '1px solid #E2E8F0',
                background: '#fff',
                color: '#64748B',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#94A3B8';
                e.currentTarget.style.background = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.background = '#fff';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                background: loading ? '#94A3B8' : 'linear-gradient(135deg, #2563EB, #3B82F6)',
                color: '#fff',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loading ? 'Saving...' : 'Add Test Bench'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}