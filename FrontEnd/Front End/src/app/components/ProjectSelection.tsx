import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, AlertCircle, Trash2 } from 'lucide-react';
import project2025Icon from '../../assets/a096e717cb74ff896071eec78bb53371bd28dd76.png';
import project2021Icon from '../../assets/d9355daa83f6768c0e03cc4a9ca8b76d82680c03.png';
import project2018Icon from '../../assets/d5dd8d39462682b56e786b951644909abfaaaa47.png';

interface ProjectSelectionProps {
  onSelectProject: (projectId: string) => void;
}

// ── ORIGINAL STYLE MAPPING ──
const BLUE_YEARS  = new Set([2015,2020,2024,2026,2029,2032,2035,2038,2041,2044,2047,2050,2053,2055,2056,2059,2062,2065,2068]);
const GRAY_YEARS  = new Set([2016,2019,2022,2027,2030,2033,2036,2039,2042,2045,2048,2051,2054,2057,2060,2063,2066,2069]);
const RED_YEARS   = new Set([2017,2023,2028,2031,2034,2037,2040,2043,2046,2049,2052,2058,2061,2064,2067,2070]);

const BLUE_STYLE  = { bgColor: '#557486', buttonColor: '#354D6F' };
const GRAY_STYLE  = { bgColor: '#95A4AE', buttonColor: '#7594A4' };
const RED_STYLE   = { bgColor: '#936363', buttonColor: '#7A4F4F' };

function getStyleForYear(year: number) {
  if (BLUE_YEARS.has(year)) return BLUE_STYLE;
  if (GRAY_YEARS.has(year)) return GRAY_STYLE;
  if (RED_YEARS.has(year))  return RED_STYLE;
  return BLUE_STYLE;
}

// ── Hardcoded known projects (always shown, not deletable) ──
const HARDCODED_PROJECTS: Record<string, { name: string; title: string; icon: string; style: { bgColor: string; buttonColor: string } }> = {
  // keyed by API `name` field value AND by year string for safety
  'IPB-25': { name: 'IPB-25', title: 'Project IPB-25', icon: project2025Icon, style: BLUE_STYLE },
  'BCP-21': { name: 'BCP-21', title: 'Project BCP-21', icon: project2021Icon, style: GRAY_STYLE },
  'BDC-18': { name: 'BDC-18', title: 'Project BDC-18', icon: project2018Icon, style: RED_STYLE },
  // also keep year-string keys as fallback
  '2025':   { name: 'IPB-25', title: 'Project IPB-25', icon: project2025Icon, style: BLUE_STYLE },
  '2021':   { name: 'BCP-21', title: 'Project BCP-21', icon: project2021Icon, style: GRAY_STYLE },
  '2018':   { name: 'BDC-18', title: 'Project BDC-18', icon: project2018Icon, style: RED_STYLE },
};

// ── Available years (2015–2070 minus hardcoded) ──
const ALL_YEARS = Array.from({ length: 2070 - 2015 + 1 }, (_, i) => 2015 + i)
  .filter(y => !['2025', '2021', '2018'].includes(String(y)));

// ── Eagerly import every assets/<year>.png via Vite glob ──
// Keys look like "../../assets/2026.png", values are the resolved URL strings.
const YEAR_ICON_MODULES = import.meta.glob<{ default: string }>(
  '../../assets/*.png',
  { eager: true }
);

// Build a map: year number → resolved image URL
const YEAR_ICON_MAP: Record<number, string> = {};
for (const [path, mod] of Object.entries(YEAR_ICON_MODULES)) {
  const stem = path.replace(/^.*\//, '').replace(/\.png$/, '');
  const yr = parseInt(stem, 10);
  if (!isNaN(yr)) {
    YEAR_ICON_MAP[yr] = mod.default;
  }
}

// ── Icon selector: year string → correct asset URL ──
function getIconForYear(year: string): string {
  // Named hardcoded projects resolved by their year
  if (year === '2025') return project2025Icon;
  if (year === '2021') return project2021Icon;
  if (year === '2018') return project2018Icon;

  const yearNum = parseInt(year, 10);

  // Use the per-year PNG if it was found in assets (e.g. assets/2026.png)
  if (!isNaN(yearNum) && YEAR_ICON_MAP[yearNum]) {
    return YEAR_ICON_MAP[yearNum];
  }

  // Fallback: pick the style-category icon
  if (!isNaN(yearNum)) {
    if (BLUE_YEARS.has(yearNum)) return project2025Icon;
    if (GRAY_YEARS.has(yearNum)) return project2021Icon;
    if (RED_YEARS.has(yearNum))  return project2018Icon;
  }

  return project2025Icon;
}

interface Project {
  id: string;
  title: string;
  bgColor: string;
  buttonColor: string;
  icon: string;
  isCustom: boolean;
  year: number;
  customName?: string;
}

// ── Toast confirm component ──
interface ToastConfirmProps {
  projectTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function ToastConfirm({ projectTitle, onConfirm, onCancel, isDeleting }: ToastConfirmProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2"
      style={{ minWidth: 380 }}
    >
      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl border border-red-200"
        style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)' }}
      >
        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#354D6F] leading-snug">
            Delete "{projectTitle}"?
          </p>
          <p className="text-xs text-[#64748B] mt-0.5 leading-snug">
            This will permanently remove the project from the database.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-60"
              style={{ background: isDeleting ? '#94a3b8' : 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
            >
              {isDeleting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-3 h-3" />
                  Yes, Delete
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-all disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="flex-shrink-0 p-1 hover:bg-red-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-[#94A3B8]" />
        </button>
      </div>
    </motion.div>
  );
}

export function ProjectSelection({ onSelectProject }: ProjectSelectionProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [nameError, setNameError] = useState('');

  const existingYears = new Set(projects.map(p => p.year));
  const availableYears = ALL_YEARS.filter(y => !existingYears.has(y));

  const fetchProjects = () => {
    setLoading(true);
    fetch('http://localhost:8001/api/projects/', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const rows = (data.results ?? data) as { name: string; bg_color?: string; button_color?: string; year?: number; description?: string }[];
        const mapped: Project[] = rows.map(p => {
          const yearNum = p.year || parseInt(p.name);
          const isHardcoded = HARDCODED_PROJECTS[p.name];
          let style;
          let icon;
          let title;
          
          if (isHardcoded) {
            // Hardcoded projects (2025, 2021, 2018)
            style = isHardcoded.style;
            icon = isHardcoded.icon;
            title = isHardcoded.title;
          } else {
            // Other years - use mapping
            style = getStyleForYear(yearNum);
            icon = getIconForYear(p.name);
            title = `Project ${p.name}`;
          }
          
          // Check for custom name in description
          let customName = '';
          if (p.description && p.description.startsWith('Custom:')) {
            customName = p.description.replace('Custom:', '');
            title = customName;
          }
          
          const isHardcodedProject = !!HARDCODED_PROJECTS[p.name] || !!HARDCODED_PROJECTS[String(yearNum)];
          return {
            id: p.name,
            title: title,
            bgColor: p.bg_color || style.bgColor,
            buttonColor: p.button_color || style.buttonColor,
            icon: icon,
            isCustom: !isHardcodedProject,
            year: yearNum,
            customName: customName || undefined,
          };
        });
        setProjects(mapped);
      })
      .catch(() => {
        // Fallback to hardcoded projects
        setProjects([
          { id: '2025', title: 'Project IPB-25', bgColor: '#557486', buttonColor: '#354D6F', icon: project2025Icon, isCustom: false, year: 2025 },
          { id: '2021', title: 'Project BCP-21', bgColor: '#95A4AE', buttonColor: '#7594A4', icon: project2021Icon, isCustom: false, year: 2021 },
          { id: '2018', title: 'Project BDC-18', bgColor: '#936363', buttonColor: '#7A4F4F', icon: project2018Icon, isCustom: false, year: 2018 },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAddProject = async () => {
    if (!selectedYear) {
      alert('Please select a year');
      return;
    }
    
    if (!projectName.trim()) {
      setNameError('Project name is required');
      return;
    }
    
    if (projects.some(p => p.year === selectedYear)) {
      setNameError('A project with this year already exists');
      return;
    }
    
    setIsSaving(true);
    const style = getStyleForYear(selectedYear);
    try {
      const csrfToken = localStorage.getItem('csrfToken') || '';
      const res = await fetch('http://localhost:8001/api/projects/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          name: String(selectedYear),
          year: selectedYear,
          description: `Custom:${projectName.trim()}`,
          bg_color: style.bgColor,
          button_color: style.buttonColor,
        }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const saved = await res.json();
      const newProject: Project = {
        id: saved.name,
        title: projectName.trim(),
        bgColor: saved.bg_color || style.bgColor,
        buttonColor: saved.button_color || style.buttonColor,
        icon: getIconForYear(String(selectedYear)),
        isCustom: true,
        year: selectedYear,
        customName: projectName.trim(),
      };
      setProjects(prev => [...prev, newProject]);
      setIsAddModalOpen(false);
      setSelectedYear(null);
      setProjectName('');
      setNameError('');
    } catch (err) {
      alert('Failed to add project. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const csrfToken = localStorage.getItem('csrfToken') || '';

      const ecuRes = await fetch(`http://localhost:8001/api/ecus/?project=${pendingDelete.id}&page_size=1000`, { credentials: 'include' });
      const ecuData = await ecuRes.json();
      const ecus = (ecuData.results ?? ecuData) as { id: number }[];
      if (ecus.length > 0) {
        await fetch('http://localhost:8001/api/ecus/bulk-delete/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
          credentials: 'include',
          body: JSON.stringify({ ecu_ids: ecus.map(e => e.id) }),
        });
      }

      const subcatRes = await fetch(`http://localhost:8001/api/subcategories/?project=${pendingDelete.id}&page_size=1000`, { credentials: 'include' });
      const subcatData = await subcatRes.json();
      const subcats = (subcatData.results ?? subcatData) as { id: number }[];
      for (const s of subcats) {
        await fetch(`http://localhost:8001/api/subcategories/${s.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': csrfToken },
          credentials: 'include',
        });
      }

      const listRes = await fetch('http://localhost:8001/api/projects/', { credentials: 'include' });
      const listData = await listRes.json();
      const rows = (listData.results ?? listData) as { id: number; name: string }[];
      const found = rows.find(p => p.name === pendingDelete.id);
      if (!found) throw new Error('Project not found');

      const delRes = await fetch(`http://localhost:8001/api/projects/${found.id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include',
      });
      if (!delRes.ok) throw new Error('Failed to delete');

      setProjects(prev => prev.filter(p => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      alert('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-12 flex items-center justify-center">
      <div className="max-w-6xl w-full">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-[#354D6F] text-center mb-12 uppercase tracking-wider"
        >
          Select Project
        </motion.h1>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-[#557486] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                onClick={() => onSelectProject(project.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (project.isCustom) setPendingDelete(project);
                }}
                className="cursor-pointer group"
                title={project.isCustom ? 'Double-click to delete' : ''}
              >
                <div
                  className="rounded-2xl p-8 flex flex-col items-center text-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-[380px] relative"
                  style={{ backgroundColor: project.bgColor }}
                >
                  {project.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(project);
                      }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg z-10"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}

                  <div className="mb-6 flex items-center justify-center h-32">
                    <img
                      src={project.icon}
                      alt={project.title}
                      className="w-32 h-32 object-contain"
                      onError={(e) => { 
                        (e.target as HTMLImageElement).src = project2021Icon;
                      }}
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">{project.title}</h3>
                  <p className="text-base text-white/90 mb-6 flex-grow leading-relaxed">
                    {`Learn more about the details of ${project.title}.`}
                  </p>
                  <button
                    className="w-full py-3 px-6 rounded-lg font-bold text-white uppercase transition-all hover:shadow-lg text-sm mt-auto"
                    style={{ backgroundColor: project.buttonColor }}
                    onClick={(e) => { e.stopPropagation(); onSelectProject(project.id); }}
                  >
                    View Project
                  </button>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: projects.length * 0.1, duration: 0.4 }}
              onClick={() => setIsAddModalOpen(true)}
              className="cursor-pointer"
            >
              <div className="rounded-2xl p-8 flex flex-col items-center text-center border-2 border-dashed border-[#BAC8D1] bg-[#E8E4DD] hover:bg-[#DEDAD3] hover:border-[#557486] transition-all duration-300 hover:-translate-y-2 h-[380px]">
                <div className="mb-6 flex items-center justify-center h-32">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-md">
                    <Plus className="w-12 h-12 text-[#354D6F]" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#354D6F] mb-4">Add Project</h3>
                <p className="text-base text-gray-500 mb-6 flex-grow leading-relaxed">
                  Create a new project by entering a name and selecting a year.
                </p>
                <button
                  className="w-full py-3 px-6 rounded-lg font-bold text-white bg-[#557486] uppercase transition-all hover:shadow-lg hover:bg-[#354D6F] text-sm mt-auto"
                  onClick={(e) => { e.stopPropagation(); setIsAddModalOpen(true); }}
                >
                  Create New
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddModalOpen(false); setSelectedYear(null); setProjectName(''); setNameError(''); }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-full max-w-md overflow-hidden"
            >
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #354D6F, #1A365B)' }}
              >
                <div>
                  <h2 className="text-base font-bold text-white uppercase tracking-wide">Add New Project</h2>
                  <p className="text-xs text-white/70 mt-0.5">Enter a name and select a year</p>
                </div>
                <button
                  onClick={() => { setIsAddModalOpen(false); setSelectedYear(null); setProjectName(''); setNameError(''); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      setNameError('');
                    }}
                    placeholder="e.g. Project Rahma, My Project"
                    className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none focus:border-[#557486] text-sm transition-all ${
                      nameError ? 'border-red-500 bg-red-50' : 'border-[#BAC8D1] bg-white'
                    }`}
                  />
                  {nameError && <p className="text-xs text-red-500 mt-1.5">{nameError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#354D6F] mb-3 uppercase tracking-wide">
                    Select Year <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableYears.map(year => {
                      const style = getStyleForYear(year);
                      const isSelected = selectedYear === year;
                      return (
                        <button
                          key={year}
                          onClick={() => setSelectedYear(year)}
                          className="py-2 rounded-lg text-xs font-bold transition-all hover:scale-105"
                          style={{
                            backgroundColor: isSelected ? style.bgColor : '#F1F5F9',
                            color: isSelected ? '#fff' : '#475569',
                            border: isSelected ? `2px solid ${style.buttonColor}` : '2px solid transparent',
                            boxShadow: isSelected ? `0 0 0 3px ${style.bgColor}30` : 'none',
                          }}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedYear && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl border-2 flex items-center gap-3"
                    style={{
                      borderColor: getStyleForYear(selectedYear).bgColor,
                      backgroundColor: `${getStyleForYear(selectedYear).bgColor}15`,
                    }}
                  >
                    <img
                      src={getIconForYear(String(selectedYear))}
                      alt={String(selectedYear)}
                      className="w-10 h-10 object-contain"
                      onError={(e) => { 
                        (e.target as HTMLImageElement).src = project2021Icon;
                      }}
                    />
                    <div>
                      <p className="text-sm font-bold text-[#354D6F]">
                        {projectName.trim() || 'Project Name'} ({selectedYear})
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {BLUE_YEARS.has(selectedYear) ? '🔵 Blue style' : GRAY_YEARS.has(selectedYear) ? '⚪ Gray style' : '🔴 Red style'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                <button
                  onClick={() => { setIsAddModalOpen(false); setSelectedYear(null); setProjectName(''); setNameError(''); }}
                  disabled={isSaving}
                  className="px-5 py-2 border-2 border-[#E2E8F0] text-[#475569] rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProject}
                  disabled={!selectedYear || !projectName.trim() || isSaving}
                  className="px-5 py-2 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{
                    background: (!selectedYear || !projectName.trim() || isSaving) ? '#94a3b8' : 'linear-gradient(135deg, #354D6F, #1A365B)',
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <ToastConfirm
            projectTitle={pendingDelete.title}
            onConfirm={handleConfirmDelete}
            onCancel={() => { if (!isDeleting) setPendingDelete(null); }}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}