import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Filter, Upload, Download, Plus, Trash2, Pencil, FileText, BarChart3, ChevronLeft, ChevronRight, MapPin, Cpu, Link2, CheckCircle, AlertCircle, XCircle, AlertTriangle, Calendar, Clock, History, ChevronDown, X, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ECUDatabase } from './components/ECUDatabase';
import { ecuData } from './components/ecuData';
import { getECUs, bulkDeleteECUs, loginUser, getCurrentUser, getBookingRequests } from './services/api';
import { TestBenchModal } from './components/TestBenchModal';
import { BookingModal } from './components/BookingModal';
import { BookingRequestsModal } from './components/BookingRequestsModal';
import { CategorySelection } from './components/CategorySelection';
import { AddCategoryModal } from './components/AddCategoryModal';
import { ProjectSelection } from './components/ProjectSelection';
import { Login } from './components/Login';
import { AddTestBenchModal } from './components/AddTestBenchModal';
import { EditTestBenchModal } from './components/EditTestBenchModal';
import { MaintenanceModal } from './components/MaintenanceModal';
import { TbFilterDropdown } from './components/TbFilterDropdown';
import { ChatBot } from './components/ChatBot';

// Import test bench images
import testBench1 from "../assets/39af4afd049a1bdebf7cbd103a3c0bb1cf3130d0.png";
import testBench2 from "../assets/85142e9871d017033f1d5307adbfb10a712d6173.png";
import testBench3 from "../assets/ac1f51809c938dd3ddd551496c9909cdecb04146.png";
import testBench4 from "../assets/4ab506119eb5454aed6e2866369635f765838f08.png";
import testBench5 from "../assets/0d69094d1f8c2abfc2033a3949508af2706443ad.png";
import testBench6 from "../assets/b05a17dedbe8f04ed9e379c28959c69702edf08c.png";
import circuitBg from "../assets/c68bf504f1a17dc009c97bed72b81fde825cc8bc.png";
import productTestBench from "../assets/39af4afd049a1bdebf7cbd103a3c0bb1cf3130d0.png";

// Test bench data for carousel
const testBenches = [
  { id: 1, name: "Testbench 1", location: "Detroit",     type: "MTS", ecuCount: 6, year: 2025, status: "available",    image: testBench1 },
  { id: 2, name: "Testbench 2", location: "Tokyo",       type: "BTS", ecuCount: 6, year: 2024, status: "in-use",       image: testBench2 },
  { id: 3, name: "Testbench 3", location: "Stuttgart",   type: "MTS", ecuCount: 6, year: 2023, status: "faulty",       image: testBench3 },
  { id: 4, name: "Testbench 4", location: "Los Angeles", type: "BTS", ecuCount: 6, year: 2022, status: "maintenance",  image: testBench4 },
  { id: 5, name: "Testbench 5", location: "Munich",      type: "MTS", ecuCount: 8, year: 2025, status: "available",    image: testBench5 },
  { id: 6, name: "Testbench 6", location: "Berlin",      type: "BTS", ecuCount: 4, year: 2024, status: "in-use",       image: testBench6 },
];

// Catalog data
const catalogItems = [
  { id: 1, badge: "TEST BENCH 1", serialId: "#21365874", image: testBench1, location: "LOCATED IN LAB1", protocol: "CAN PROTOCOL", ecuCount: 28, status: "available" },
  { id: 2, badge: "TEST BENCH 2", serialId: "#21365875", image: testBench2, location: "LOCATED IN TESTING LAB", protocol: "FLEXRAY PROTOCOL", ecuCount: 17, status: "faulty" },
  { id: 3, badge: "TEST BENCH 3", serialId: "#21365876", image: testBench3, location: "LOCATED IN TESTING ROOM", protocol: "LIN PROTOCOL", ecuCount: 5, status: "in-use" },
  { id: 4, badge: "TEST BENCH 4", serialId: "#21365877", image: testBench4, location: "LOCATED IN LAB3", protocol: "VECTOR BOX PROTOCOL", ecuCount: 6, status: "available" },
  { id: 5, badge: "TEST BENCH 5", serialId: "#21365878", image: testBench5, location: "LOCATED IN TESTING LAB", protocol: "FLEXRAY PROTOCOL", ecuCount: 17, status: "maintenance" },
  { id: 6, badge: "TEST BENCH 6", serialId: "#21365879", image: testBench6, location: "LOCATED IN TESTING ROOM", protocol: "LIN PROTOCOL", ecuCount: 5, status: "in-use" },
];

interface TbFilterState {
  project: string[];
  status: string[];
  location: string[];
  room: string[];
  type: string[];
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddTestBenchModalOpen, setIsAddTestBenchModalOpen] = useState(false);
  const [isEditTestBenchModalOpen, setIsEditTestBenchModalOpen] = useState(false);
  const [editingTestBench, setEditingTestBench] = useState<any | null>(null);
  const [dbTestBenches, setDbTestBenches] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [currentPage, setCurrentPage] = useState<'inventory' | 'ecu'>('inventory');
  const [ecuView, setEcuView] = useState<'projects' | 'category' | 'table'>('projects');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('bmw');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isBookingRequestsModalOpen, setIsBookingRequestsModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedTestBench, setSelectedTestBench] = useState<any>(null);
  const [bookingRequestsCount, setBookingRequestsCount] = useState(0);
  const [notificationCount] = useState(5);
  const [tableData, setTableData] = useState(ecuData);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [loadingECUs, setLoadingECUs] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projects, setProjects] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookingRequestsSeen, setBookingRequestsSeen] = useState(false);
  const [refreshBookingSlots, setRefreshBookingSlots] = useState(false);

  // Maintenance Modal State
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [selectedBenchForMaintenance, setSelectedBenchForMaintenance] = useState<any>(null);

  // TB Inventory Filter State
  const [isTbFilterPanelOpen, setIsTbFilterPanelOpen] = useState(false);
  const [tbFilters, setTbFilters] = useState<TbFilterState>({
    project: [],
    status: [],
    location: [],
    room: [],
    type: [],
  });
  const [tbExpandedSections, setTbExpandedSections] = useState({
    project: false,
    status: false,
    location: false,
    room: false,
    type: false,
  });

  const tbFilterButtonRef = useRef<HTMLButtonElement>(null);
  const tbFilterPanelRef = useRef<HTMLDivElement>(null);

  // Function to fetch testbenches
  const fetchTestBenches = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8001/api/testbenches/', { credentials: 'include' });
      const data = await response.json();
      console.log('Test benches refreshed:', data);
      setDbTestBenches(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to refresh test benches:', err);
    }
  }, []);

  // Function to fetch booking requests count
  const fetchBookingRequestsCount = useCallback(async () => {
    try {
      const response = await getBookingRequests();
      const requests = response.data.results || response.data;
      
      let relevantRequests = [];
      if (currentUser?.role === 'admin') {
        relevantRequests = requests.filter((r: any) => r.status === 'pending');
      } else {
        relevantRequests = requests.filter((r: any) => 
          r.user === currentUser?.id && 
          r.status !== 'pending' &&
          !r.seen_by_user
        );
      }
      setBookingRequestsCount(relevantRequests.length);
    } catch (error) {
      console.error('Failed to fetch booking requests count:', error);
    }
  }, [currentUser]);

  // Load user from localStorage on app start
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const isAuth = localStorage.getItem('isAuthenticated');
    
    if (isAuth === 'true' && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setCurrentUser(userData);
        setIsLoggedIn(true);
        console.log('User loaded from localStorage:', userData);
      } catch (error) {
        console.error('Failed to parse user from localStorage:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
      }
    }
  }, []);

  // Fetch testbenches on mount and set up auto-refresh every 30 seconds
  useEffect(() => {
    if (isLoggedIn && currentPage === 'inventory') {
      fetchTestBenches();
      
      // Set up interval to refresh testbenches every 30 seconds
      const interval = setInterval(() => {
        fetchTestBenches();
        console.log('Auto-refreshing testbenches...');
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentPage, fetchTestBenches]);

  // Fetch booking requests count when user changes
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      setBookingRequestsSeen(false);
      fetchBookingRequestsCount();
    }
  }, [isLoggedIn, currentUser?.id, fetchBookingRequestsCount]);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      fetchBookingRequestsCount();
    }
  }, [isLoggedIn, currentUser?.role, fetchBookingRequestsCount]);

  const handleBookingRequestsModalOpen = () => {
    setIsBookingRequestsModalOpen(true);
    setBookingRequestsSeen(true);
    setBookingRequestsCount(0);
  };

  const handleBookingStatusChange = () => {
    setRefreshBookingSlots(prev => !prev);
    fetchBookingRequestsCount();
    fetchTestBenches();
  };

  // Fetch projects for filter
  useEffect(() => {
    fetch('http://localhost:8001/api/projects/', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const rows = (data.results ?? data) as { name: string }[];
        const names = rows.map(p => p.name).filter(Boolean);
        setProjects(names);
      })
      .catch(() => setProjects(['2021', '2018', '2025']));
  }, []);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isTbFilterPanelOpen &&
        tbFilterPanelRef.current &&
        tbFilterButtonRef.current &&
        !tbFilterPanelRef.current.contains(event.target as Node) &&
        !tbFilterButtonRef.current.contains(event.target as Node)
      ) {
        setIsTbFilterPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTbFilterPanelOpen]);

  const toggleTbSection = (section: keyof typeof tbExpandedSections) => {
    setTbExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleTbFilter = (category: keyof TbFilterState, value: string) => {
    setTbFilters(prev => {
      const currentValues = prev[category];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [category]: newValues };
    });
  };

  const removeTbFilter = (category: keyof TbFilterState, value: string) => {
    setTbFilters(prev => ({
      ...prev,
      [category]: prev[category].filter(v => v !== value)
    }));
  };

  const clearAllTbFilters = () => {
    setTbFilters({
      project: [],
      status: [],
      location: [],
      room: [],
      type: [],
    });
  };

  const hasActiveTbFilters = useMemo(() => {
    return Object.values(tbFilters).some(arr => arr.length > 0);
  }, [tbFilters]);

  // Filter TB data based on search and filters
  const filteredTestBenches = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return dbTestBenches.filter(bench => {
      if (term && !bench.name?.toLowerCase().includes(term) && !bench.location?.toLowerCase().includes(term) && !bench.bench_type?.toLowerCase().includes(term)) {
        return false;
      }
      if (tbFilters.project.length > 0 && !tbFilters.project.includes(bench.project)) return false;
      if (tbFilters.status.length > 0 && !tbFilters.status.includes(bench.status)) return false;
      if (tbFilters.location.length > 0 && !tbFilters.location.includes(bench.location)) return false;
      if (tbFilters.room.length > 0 && !tbFilters.room.includes(bench.room)) return false;
      if (tbFilters.type.length > 0 && !tbFilters.type.includes(bench.bench_type)) return false;
      return true;
    });
  }, [dbTestBenches, searchQuery, tbFilters]);

  // Load ECUs from backend
  useEffect(() => {
    if (!selectedProject || !selectedCategory) {
      setTableData([]);
      return;
    }
    
    const fetchECUs = async () => {
      setLoadingECUs(true);
      try {
        const res = await getECUs({ project: selectedProject, category: selectedCategory });
        const rows = res.data.results ?? res.data;
        setTableData(rows.map((e: Record<string, unknown>) => ({
          id: String(e.id),
          inventoryNumber: String(e.inventory_number || ''),
          ssMan: String(e.serial_number || ''),
          category: String((e as Record<string, string>).category_name || ''),
          subCategory: String(e.sub_category || ''),
          status: e.status === 'active' ? 'Active' : 'Not Active',
          location: String(e.location || ''),
          connection: String((e as Record<string, string>).connection_name || ''),
          healthStatus: String(e.health_status || 'working').charAt(0).toUpperCase() + String(e.health_status || 'working').slice(1),
          powerSupplyVolt: String(e.power_volts || ''),
          powerSupplyAmp: String(e.power_amps || ''),
          lastUpdated: String(e.updated_at || '').slice(0, 10),
          dateAdded: String(e.created_at || '').slice(0, 10),
          defectReason: String(e.defect_reason || ''),
          hopeTicketId: String(e.defect_ticket_id || ''),
          qrCode: String(e.qr_code_path || ''),
          description: String(e.description || ''),
          invoiceId: String((e as Record<string, string>).invoice_id || ''),
          invoicePdf: String((e as Record<string, string>).invoice_pdf || ''),
        })));
      } catch (error) {
        console.warn('Backend unreachable:', error);
      } finally {
        setLoadingECUs(false);
      }
    };

    fetchECUs();
  }, [selectedProject, selectedCategory, refreshKey]);

  // Fetch testbenches from DB on mount
  useEffect(() => {
    fetchTestBenches();
  }, [fetchTestBenches]);

  const refreshECUs = () => {
    setRefreshKey(prev => prev + 1);
  };

  const nextSlide = () => {
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % testBenches.length);
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + testBenches.length) % testBenches.length);
  };

  const openModal = (bench: any) => {
    const mappedBench = {
      id: bench.id,
      badge: bench.name || bench.badge || "Test Bench",
      serialId: bench.serial_number || bench.serialId || `#${bench.id}`,
      title: bench.name || bench.title || "Test Bench",
      location: bench.location || "Unknown",
      protocol: bench.protocol || "CAN Protocol",
      ecuCount: bench.ecus_count || bench.ecuCount || 0,
      availableSlots: bench.available_slots || bench.availableSlots || 5,
      model: bench.model || "Standard Model",
      ipAddress: bench.ip_address || bench.ipAddress || "192.168.1.100",
      description: bench.description || "No description available",
      status: bench.status || "available",
      image: bench.photo || bench.image || productTestBench,
      project: bench.project,
    };
    setSelectedTestBench(mappedBench);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTestBench(null);
  };

  const openBookingModal = (bench: any) => {
    const mappedBench = {
      id: bench.id,
      name: bench.name || bench.badge || "Test Bench",
      badge: bench.name || bench.badge || "Test Bench",
      serialId: bench.serial_number || bench.serialId || `#${bench.id}`,
      title: bench.name || bench.title || "Test Bench",
      location: bench.location || "Unknown",
      protocol: bench.protocol || "CAN Protocol",
      ecuCount: bench.ecus_count || bench.ecuCount || 0,
      availableSlots: bench.available_slots || bench.availableSlots || 5,
      model: bench.model || "Standard Model",
      ipAddress: bench.ip_address || bench.ipAddress || "192.168.1.100",
      description: bench.description || "No description available",
      status: bench.status || "available",
      image: bench.photo || bench.image || productTestBench,
      project: bench.project,
    };
    setSelectedTestBench(mappedBench);
    setIsBookingModalOpen(true);
  };

  const closeBookingModal = () => {
    setIsBookingModalOpen(false);
    setSelectedTestBench(null);
  };

  const handleSelectCategory = (category: string) => {
    console.log('Selected category:', category);
    setSelectedCategory(category);
    setEcuView('table');
  };

  const handleEcuDatabaseClick = () => {
    setCurrentPage('ecu');
    setEcuView('projects');
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedCategory('bmw');
    setTableData([]);
    setSelectedRowIds(new Set());
    setEcuView('category');
    setRefreshKey(0);
  };

  const handleAddCategory = () => {
    setIsAddCategoryModalOpen(true);
  };

  const handleSaveCategory = (data: { name: string; icon: string | null; subcategories: string[] }) => {
    console.log('New category added:', data);
    alert(`Category "${data.name}" created successfully!`);
  };

  const handleReturnToEcuView = () => {
    if (selectedProject && selectedCategory) {
      refreshECUs();
    }
  };

  const handleUpdateTestBench = (updatedBench: any) => {
    setDbTestBenches(prev => prev.map(b => b.id === updatedBench.id ? updatedBench : b));
  };

  const handleDeleteTestBench = async (id: number) => {
    if (!confirm('Delete this test bench?')) return;
    try {
      await fetch(`http://localhost:8001/api/testbenches/${id}/`, {
        method: 'DELETE', credentials: 'include',
      });
      setDbTestBenches(prev => prev.filter(b => b.id !== id));
    } catch {
      alert('Failed to delete test bench.');
    }
  };

  const handleSaveTestBench = (newBench: any) => {
    setDbTestBenches(prev => [newBench, ...prev]);
  };

  // Maintenance Handlers
  const handleOpenMaintenanceModal = (bench: any) => {
    setSelectedBenchForMaintenance(bench);
    setIsMaintenanceModalOpen(true);
  };

  const handleScheduleMaintenance = async (start: Date, end: Date, reason: string) => {
    try {
      const csrfToken = localStorage.getItem('csrfToken');
      const response = await fetch(`http://localhost:8001/api/testbenches/${selectedBenchForMaintenance.id}/maintenance/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
          reason: reason,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule maintenance');
      }
      
      alert(`✅ Maintenance scheduled successfully for ${selectedBenchForMaintenance.name}`);
      fetchTestBenches();
    } catch (error) {
      console.error('Failed to schedule maintenance:', error);
      throw error;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-green-600 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 fill-green-100" />
            <span className="font-bold text-green-600 uppercase text-sm">Available</span>
          </div>
        );
      case 'in-use':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-[#557486] rounded-lg">
            <AlertCircle className="w-5 h-5 text-[#557486] fill-blue-100" />
            <span className="font-bold text-[#557486] uppercase text-sm">In Use</span>
          </div>
        );
      case 'faulty':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-[#936363] rounded-lg">
            <XCircle className="w-5 h-5 text-[#936363] fill-red-100" />
            <span className="font-bold text-[#936363] uppercase text-sm">Faulty</span>
          </div>
        );
      case 'maintenance':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-orange-500 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-500 fill-orange-100" />
            <span className="font-bold text-orange-500 uppercase text-sm">Under Maintenance</span>
          </div>
        );
      default:
        return null;
    }
  };

  const currentBench = testBenches[currentSlide];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await loginUser(username, password);
      console.log('Login response:', response.data);
      
      setLoginError('');
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setCurrentUser(userData);
        console.log('Current user set from localStorage:', userData);
      } else if (response.data?.user) {
        setCurrentUser(response.data.user);
        console.log('Current user set from response:', response.data.user);
      }
      
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Invalid username or password.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedProject(null);
    setSelectedCategory('bmw');
    setCurrentPage('inventory');
    console.log('User logged out');
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} loginError={loginError} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F5F0E8]">
      {/* Sidebar */}
      <aside 
        className="w-48 min-h-screen relative overflow-hidden"
        style={{
          backgroundImage: `url(${circuitBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-[#0a2540]/80"></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="p-6 border-b border-cyan-500/30">
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">
              BTS SCHEDULER
            </h1>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button 
              onClick={() => {
                setCurrentPage('inventory');
                handleReturnToEcuView();
              }}
              className={`w-full px-4 py-3 text-left text-white uppercase font-bold tracking-wide rounded transition-all ${
                currentPage === 'inventory' 
                  ? 'bg-cyan-500/30 border border-cyan-500/80 shadow-lg shadow-cyan-500/50' 
                  : 'border border-transparent hover:bg-cyan-500/20 hover:border-cyan-500/50'
              }`}
            >
              TB Inventory
            </button>
            <button 
              onClick={handleEcuDatabaseClick}
              className={`w-full px-4 py-3 text-left text-white uppercase font-bold tracking-wide rounded transition-all ${
                currentPage === 'ecu' 
                  ? 'bg-cyan-500/30 border border-cyan-500/80 shadow-lg shadow-cyan-500/50' 
                  : 'border border-transparent hover:bg-cyan-500/20 hover:border-cyan-500/50'
              }`}
            >
              ECU Database
            </button>
            <button 
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-white uppercase font-bold tracking-wide rounded transition-all border border-transparent hover:bg-cyan-500/20 hover:border-cyan-500/50 mt-8"
            >
              Logout
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'ecu' ? (
          ecuView === 'projects' ? (
            <ProjectSelection onSelectProject={handleSelectProject} />
          ) : (
            <ECUDatabase
              key={`${selectedProject}-${selectedCategory}`}
              view={ecuView}
              onSelectCategory={handleSelectCategory}
              onAddCategory={handleAddCategory}
              selectedCategory={selectedCategory}
              selectedProject={selectedProject || ''}
              tableData={tableData}
              setTableData={setTableData}
              selectedRowIds={selectedRowIds}
              setSelectedRowIds={setSelectedRowIds}
              loading={loadingECUs}
              onBackToProjects={() => {
                setEcuView('projects');
                setSelectedProject(null);
                setSelectedCategory('bmw');
                setTableData([]);
                setSelectedRowIds(new Set());
                setRefreshKey(0);
              }}
              onBackToCategorySelection={() => {
                setEcuView('category');
                setTableData([]);
                setSelectedRowIds(new Set());
                setRefreshKey(prev => prev + 1);
              }}
            />
          )
        ) : (
          <div className="p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#354D6F] uppercase tracking-wider mb-6">
                TEST BENCH INVENTORY
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by Test Bench Name, Location or Type..."
                    className="w-full pl-10 pr-4 py-2 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="relative">
                  <button
                    ref={tbFilterButtonRef}
                    onClick={() => setIsTbFilterPanelOpen(!isTbFilterPanelOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all"
                  >
                    <Filter className="w-5 h-5" />
                    FILTER BY
                    <ChevronDown className={`w-4 h-4 transition-transform ${isTbFilterPanelOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <TbFilterDropdown
                    isOpen={isTbFilterPanelOpen}
                    filters={tbFilters}
                    expandedSections={tbExpandedSections}
                    onToggleSection={toggleTbSection}
                    onToggleFilter={toggleTbFilter}
                    onApply={() => setIsTbFilterPanelOpen(false)}
                    onClear={clearAllTbFilters}
                    dropdownRef={tbFilterPanelRef}
                    testBenches={dbTestBenches}
                    projects={projects}
                  />
                </div>
                
                <div className="relative">
                  <button
                    onClick={handleBookingRequestsModalOpen}
                    className="flex items-center gap-2 px-4 py-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all"
                  >
                    <Calendar className="w-5 h-5" />
                    BOOKING REQUESTS
                  </button>
                  {bookingRequestsCount > 0 && (
                    <div className="absolute -top-2 -right-2 min-w-[24px] h-6 bg-[#B54747] text-white rounded-full flex items-center justify-center px-1.5 shadow-md">
                      <span className="text-xs font-bold">{bookingRequestsCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Chips Display */}
            {hasActiveTbFilters && (
              <div className="mb-4 bg-[#F5F0E8] rounded-lg p-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#354D6F] uppercase">Active Filters:</span>
                {tbFilters.project.map(value => (
                  <div key={`project-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
                    <span className="text-[#354D6F] font-medium">Project: {value}</span>
                    <button onClick={() => removeTbFilter('project', value)}>
                      <X className="w-3 h-3 text-[#936363]" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={clearAllTbFilters}
                  className="ml-auto px-3 py-1 bg-[#936363] text-white rounded-full text-xs font-bold hover:bg-[#7a5252] transition-all"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              {filteredTestBenches.map((bench) => (
                <div
                  key={bench.id}
                  className="bg-[#F5F0E8] overflow-hidden transition-all duration-300 cursor-pointer hover:-translate-y-1"
                  style={{ position: 'relative' }}
                  onMouseEnter={e => {
                    (e.currentTarget.querySelector('.tb-delete-badge') as HTMLElement).style.opacity = '1';
                    (e.currentTarget.querySelector('.tb-edit-badge') as HTMLElement).style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget.querySelector('.tb-delete-badge') as HTMLElement).style.opacity = '0';
                    (e.currentTarget.querySelector('.tb-edit-badge') as HTMLElement).style.opacity = '0';
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTestBench(bench.id); }}
                    className="tb-delete-badge absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center opacity-0 transition-opacity z-10 hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTestBench(bench); setIsEditTestBenchModalOpen(true); }}
                    className="tb-edit-badge absolute top-12 right-2 w-8 h-8 rounded-full bg-[#7BB3CC] flex items-center justify-center opacity-0 transition-opacity z-10 hover:bg-[#5A9ABA]"
                  >
                    <Pencil className="w-4 h-4 text-white" />
                  </button>
                  <div className="h-64 overflow-hidden">
                    <img
                      src={bench.photo || productTestBench}
                      alt={bench.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        bench.status === "available" ? "bg-green-400" :
                        bench.status === "in-use" ? "bg-blue-400" :
                        bench.status === "faulty" ? "bg-red-400" : "bg-orange-400"
                      }`} />
                      <span className="text-xs uppercase tracking-wider text-gray-500">
                        {bench.status === "available" ? "Available Now" :
                         bench.status === "in-use" ? "In Use" :
                         bench.status === "faulty" ? "Faulty" : "Maintenance"}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-[#354D6F] mb-1">{bench.name}</h3>
                    <p className="text-gray-500 text-sm mb-1">
                      {bench.bench_type || "Unknown Type"} · {bench.location || "Unknown Location"} {bench.room || ""}
                      {bench.project && ` · Project ${bench.project}`}
                    </p>
                    <p className="text-sm text-[#354D6F] font-medium mb-4">{bench.ecus_count ?? 0} Connected ECUs</p>
                    <div className="flex gap-2">
                      <button onClick={() => openModal(bench)} className="flex-1 py-2 bg-[#E8E4DD] text-[#354D6F] font-semibold text-sm rounded-lg hover:bg-[#D8D4CD] transition-all">
                        Details
                      </button>
                      <button
                        onClick={() => {
                          if (bench.status === 'faulty') {
                            alert('⚠️ This test bench is faulty and cannot be booked. Please contact maintenance.');
                            return;
                          }
                          openBookingModal(bench);
                        }}
                        className={`flex-1 py-2 font-semibold text-sm rounded-lg transition-all ${
                          bench.status === 'faulty'
                            ? 'bg-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-[#C9B2AA] text-white hover:bg-[#B9A29A]'
                        }`}
                        disabled={bench.status === 'faulty'}
                      >
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Ghost Card */}
              <div
                onClick={() => setIsAddTestBenchModalOpen(true)}
                className="bg-white rounded-2xl border-2 border-dashed border-gray-300 shadow-sm overflow-hidden hover:border-[#C9B2AA] transition-all duration-300 cursor-pointer flex items-center justify-center p-12 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#F5F0E8]">
                    <Plus className="w-10 h-10 text-[#354D6F]" />
                  </div>
                  <h3 className="text-2xl text-[#354D6F] tracking-wide" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    Add Testbench
                  </h3>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedTestBench && (
        <TestBenchModal
          isOpen={isModalOpen}
          onClose={closeModal}
          testBench={selectedTestBench}
          allECUs={tableData}
          onOpenBooking={(bench) => {
            if (bench.status === 'faulty') {
              alert('⚠️ This test bench is faulty and cannot be booked.');
              return;
            }
            openBookingModal(bench);
          }}
        />
      )}

      {selectedTestBench && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={closeBookingModal}
          onSuccess={() => {
            console.log('Booking created successfully');
            handleBookingStatusChange();
          }}
          testBench={selectedTestBench}
          currentUserId={currentUser?.id}
          refreshTrigger={refreshBookingSlots}
        />
      )}

      <BookingRequestsModal
        isOpen={isBookingRequestsModalOpen}
        onClose={() => {
          setIsBookingRequestsModalOpen(false);
          handleBookingStatusChange();
        }}
        currentUserId={currentUser?.id}
        currentUserRole={currentUser?.role}
      />

      <EditTestBenchModal
        isOpen={isEditTestBenchModalOpen}
        onClose={() => { setIsEditTestBenchModalOpen(false); setEditingTestBench(null); }}
        onSave={handleUpdateTestBench}
        onOpenMaintenance={handleOpenMaintenanceModal}
        bench={editingTestBench}
      />

      <AddTestBenchModal
        isOpen={isAddTestBenchModalOpen}
        onClose={() => setIsAddTestBenchModalOpen(false)}
        onSave={handleSaveTestBench}
      />

      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        onSave={handleSaveCategory}
      />

      {selectedBenchForMaintenance && (
        <MaintenanceModal
          isOpen={isMaintenanceModalOpen}
          onClose={() => {
            setIsMaintenanceModalOpen(false);
            setSelectedBenchForMaintenance(null);
          }}
          testBench={selectedBenchForMaintenance}
          onSave={handleScheduleMaintenance}
        />
      )}

      <ChatBot />
    </div>
  );
}

export default App;