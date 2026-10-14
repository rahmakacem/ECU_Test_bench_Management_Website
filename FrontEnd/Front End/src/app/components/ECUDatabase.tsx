import { Search, Filter, Download, Upload, RefreshCw, Settings, Users, History, FileText, UserCheck, QrCode, Upload as UploadIcon, FolderPlus, FolderMinus, PlusCircle, MinusCircle, PlusSquare, Trash2, ArrowRightLeft, Clock, ChevronRight, Bell, Eye, Edit, Scan, Database, FolderOpen, ScanLine, FileDown, BarChart3, X, ChevronDown, ChevronUp, Truck, Home } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ecuHardware from '../../assets/afadb6d9c789a4abbbe0808be636a31a7ce22924.png';
import ecuCountIcon from '../../assets/9edf478d52f9a6aebe0327c2041c62a58d89c0e3.png';
import projectNavIcon from '../../assets/Projectnavigation.png';
import categoryNavIcon from '../../assets/Categorynavigation.png';
import { useState, useMemo, useRef, useEffect } from 'react';
import type React from 'react';
import { bulkDeleteECUs, deleteECU, importExcelRows, getECUs, getTransferRequests } from "../services/api";
import { CategorySelection } from './CategorySelection';
import { SubcategoryCards } from './SubcategoryCards';
import { ECUHistoryModal } from './ECUHistoryModal';
import { ECUGlobalHistoryModal } from './ECUGlobalHistoryModal';
import { EditECUModal } from './EditECUModal';
import { DefectDetailsModal } from './DefectDetailsModal';
import { QRCodePreviewModal } from './QRCodePreviewModal';
import { TransferRequestModal } from './TransferRequestModal';
import { TransferRequestsHistoryModal } from './TransferRequestsHistoryModal';
import { IdentifyECUModal } from './IdentifyECUModal';
import { GenerateQRCodeModal } from './GenerateQRCodeModal';
import { FilterDropdown } from './FilterDropdown';
import { ecuData } from './ecuData';
import { NotificationPanel } from './NotificationPanel';
import { ProjectSelection } from './ProjectSelection';
import { AnimatePresence } from 'motion/react';
import { ReturnToSupplierModal } from './ReturnToSupplierModal';
import { InvoiceModal } from './InvoiceModal';

interface ECUDatabaseProps {
  view: 'category' | 'table';
  onSelectCategory: (category: string) => void;
  onAddCategory: () => void;
  selectedCategory?: string;
  selectedProject?: string;
  tableData: typeof ecuData;
  setTableData: React.Dispatch<React.SetStateAction<typeof ecuData>>;
  selectedRowIds: Set<string>;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  loading?: boolean;
  onBackToProjects?: () => void;
  onBackToCategorySelection?: () => void;
}

interface FilterState {
  status: string[];
  healthStatus: string[];
  connection: string[];
  location: string[];
}

// ── Shape expected by EditECUModal ────────────────────────────────────────
interface EditECUData {
  id: string | number;
  inventory_number?: string;
  serial_number: string;
  category: number | string;
  sub_category: string;
  status: string;
  location: string;
  connection: number | null;
  connection_name?: string;
  health_status: string;
  power_volts?: string;
  power_amps?: string;
  description?: string;
  project?: string;
}

// Extended ECU data type with invoice fields
interface ECUDataItem {
  id: string;
  inventoryNumber: string;
  ssMan: string;
  category: string;
  subCategory: string;
  description: string;
  status: string;
  location: string;
  connection: string;
  healthStatus: string;
  powerSupplyVolt: string;
  powerSupplyAmp: string;
  lastUpdated: string;
  dateAdded: string;
  defectReason: string;
  hopeTicketId: string;
  qrCode: string;
  invoiceId?: string;
  invoicePdf?: string;
}

export function ECUDatabase({ 
  view, 
  onSelectCategory, 
  onAddCategory, 
  selectedCategory = 'bmw', 
  selectedProject = '', 
  tableData, 
  setTableData, 
  selectedRowIds, 
  setSelectedRowIds, 
  loading = false,
  onBackToProjects,
  onBackToCategorySelection
}: ECUDatabaseProps) {

  // ── Chart data computed from real tableData ──────────────────────────
  const statusData = useMemo(() => {
    const active = tableData.filter(e => e.status === 'Active').length;
    const notActive = tableData.filter(e => e.status === 'Not Active').length;
    return [
      { name: 'Active', value: active, color: '#6F8FA3' },
      { name: 'Not Active', value: notActive, color: '#8F5B58' },
    ];
  }, [tableData]);

  const healthData = useMemo(() => {
    const working = tableData.filter(e => e.healthStatus === 'Working').length;
    const defect = tableData.filter(e => e.healthStatus === 'Defect').length;
    const recovered = tableData.filter(e => e.healthStatus === 'Recovered').length;
    return [
      { name: 'Working', value: working, color: '#2F8F6B' },
      { name: 'Defect', value: defect, color: '#B54747' },
      { name: 'Recovered', value: recovered, color: '#2F7F7F' },
    ];
  }, [tableData]);

  const tspDistributionData = useMemo(() => {
    const tsp1 = tableData.filter(e => e.connection === 'BCP21-TSP1').length;
    const tsp2 = tableData.filter(e => e.connection === 'BCP21-TSP2').length;
    return [
      { name: 'BCP21-TSP1', value: tsp1, color: '#557486' },
      { name: 'BCP21-TSP2', value: tsp2, color: '#7594A4' },
    ];
  }, [tableData]);

  const subcategoryBarColors = ['#557486','#6F8FA3','#7594A4','#8F5B58','#95A4AE','#A8BAC3','#BAC8D1','#C9B2AA','#936363','#2F8F6B','#B54747','#2F7F7F','#354D6F','#1A365B','#4A6B82','#A67C7C','#8B9DAD','#B8A8A4','#D4C4B9','#D1BEB4','#7A5555','#3A7F6B','#9F4F4F','#407070','#2A4D6F','#234562','#6B8999','#8F7F6B','#5B7A8F'];

  const bmwSubcategories = useMemo(() => {
    const counts: Record<string, number> = {};
    tableData.forEach(e => {
      if (e.subCategory) {
        const key = e.subCategory.trim();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value], i) => ({ name, value, color: subcategoryBarColors[i % subcategoryBarColors.length] }))
      .sort((a, b) => b.value - a.value);
  }, [tableData]);
  // ─────────────────────────────────────────────────────────────────────

  const [selectedEcuId, setSelectedEcuId] = useState<string | null>(null);
  const [selectedEcuData, setSelectedEcuData] = useState<ECUDataItem | null>(null);
  // ── Correctly-shaped data for EditECUModal ──
  const [editEcuData, setEditEcuData] = useState<EditECUData | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isECUGlobalHistoryModalOpen, setIsECUGlobalHistoryModalOpen] = useState(false);
  const [isEditECUModalOpen, setIsEditECUModalOpen] = useState(false);
  const [isDefectDetailsModalOpen, setIsDefectDetailsModalOpen] = useState(false);
  const [isQRCodePreviewModalOpen, setIsQRCodePreviewModalOpen] = useState(false);
  const [isTransferRequestModalOpen, setIsTransferRequestModalOpen] = useState(false);
  const [isTransferRequestsHistoryModalOpen, setIsTransferRequestsHistoryModalOpen] = useState(false);
  const [isReturnToSupplierModalOpen, setIsReturnToSupplierModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedEcuForInvoice, setSelectedEcuForInvoice] = useState<{ id: string; invoiceId: string | null; invoicePdf: string | null; serialNumber: string } | null>(null);
  const [pendingTransferCount, setPendingTransferCount] = useState(0);

  // Fetch pending transfer count from API
  useEffect(() => {
    getTransferRequests()
      .then(res => {
        const rows = res.data.results ?? res.data;
        setPendingTransferCount(rows.filter((r: any) => r.status === 'pending').length);
      })
      .catch(() => setPendingTransferCount(0));
  }, []);
  const [isIdentifyECUModalOpen, setIsIdentifyECUModalOpen] = useState(false);
  const [isGenerateQRCodeModalOpen, setIsGenerateQRCodeModalOpen] = useState(false);
  const [isProjectSelectionOpen, setIsProjectSelectionOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  // ── Custom subcategory names coming from SubcategoryCards ──
  const [customSubcategories, setCustomSubcategories] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    status: [],
    healthStatus: [],
    connection: [],
    location: []
  });

  const [expandedSections, setExpandedSections] = useState({
    status: false,
    healthStatus: false,
    connection: false,
    location: false
  });

  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: '1', type: 'add', userName: 'John Walter', ecuSerial: 'BMW-177218209170', subCategory: 'Antenna', timestamp: '2 hours ago', read: false },
    { id: '2', type: 'transfer-request', userName: 'Susy', ecuSerial: 'FED-9999999', subCategory: 'FBD5', fromLocation: 'SFAX', toLocation: 'GAR', timestamp: '3 hours ago', read: false },
    { id: '3', type: 'transfer-approved', userName: 'Amin', ecuSerial: 'BMW-8888888', subCategory: 'SZT', fromLocation: 'GAR', toLocation: 'SFAX', timestamp: '5 hours ago', read: false },
    { id: '4', type: 'update', userName: 'Sarah Miller', ecuSerial: 'BMW-177261165019', subCategory: 'Steering Wheel', timestamp: '1 day ago', read: true },
    { id: '5', type: 'transfer-declined', userName: 'Michael Chen', ecuSerial: 'BMW-177261165020', subCategory: 'Door Lock', fromLocation: 'SFAX', toLocation: 'GAR', timestamp: '1 day ago', read: true },
    { id: '6', type: 'delete', userName: 'Emma Davis', ecuSerial: 'BMW-177261165024', subCategory: 'Headlight', timestamp: '2 days ago', read: true },
  ] as Array<{
    id: string;
    type: 'add' | 'transfer-request' | 'transfer-approved' | 'transfer-declined' | 'update' | 'delete';
    userName: string;
    ecuSerial: string;
    subCategory: string;
    fromLocation?: string;
    toLocation?: string;
    timestamp: string;
    read: boolean;
  }>);

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterPanelOpen &&
        filterPanelRef.current &&
        filterButtonRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterPanelOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotificationPanelOpen &&
        notificationPanelRef.current &&
        notificationButtonRef.current &&
        !notificationPanelRef.current.contains(event.target as Node) &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        setIsNotificationPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationPanelOpen]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleView = (ecuId: string) => {
    setSelectedEcuId(ecuId);
    setIsECUGlobalHistoryModalOpen(true);
  };

  const handleDelete = async (ecuId: string) => {
    if (!confirm(`Are you sure you want to delete ECU ${ecuId}?`)) return;
    try {
      await deleteECU(ecuId);
      setTableData(prev => prev.filter(e => e.id !== ecuId));
      setSelectedRowIds(prev => { const next = new Set(prev); next.delete(ecuId); return next; });
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete ECU. Please try again.');
    }
  };

  const handleEdit = (ecuId: string) => {
    const ecu = tableData.find(e => e.id === ecuId);
    if (!ecu) return;

    setSelectedEcuData(ecu);
    setEditEcuData({
      id: ecu.id,
      inventory_number: ecu.inventoryNumber,
      serial_number: ecu.ssMan,
      category: ecu.category,
      sub_category: ecu.subCategory,
      status: ecu.status === 'Active' ? 'active' : 'not-active',
      location: ecu.location,
      connection: null,
      connection_name: ecu.connection,
      health_status: ecu.healthStatus.toLowerCase(),
      description: ecu.description,
      project: selectedProject,
    });

    setIsEditECUModalOpen(true);
  };

  // ── Invoice handler ──
  const handleInvoiceUpdate = async (invoiceId: string, pdfBase64: string | null) => {
    if (!selectedEcuForInvoice) return;
    
    try {
      const csrfToken = localStorage.getItem('csrfToken');
      const response = await fetch(`http://localhost:8001/api/ecus/${selectedEcuForInvoice.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          invoice_id: invoiceId,
          invoice_pdf: pdfBase64,
          invoice_uploaded_at: new Date().toISOString(),
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update invoice');
      }
      
      const updatedEcu = await response.json();
      
      // Update the table data
      setTableData(prev => prev.map(ecu => 
        ecu.id === selectedEcuForInvoice.id 
          ? { 
              ...ecu, 
              invoiceId: updatedEcu.invoice_id, 
              invoicePdf: updatedEcu.invoice_pdf 
            }
          : ecu
      ) as typeof tableData);
      
      alert(`Invoice ${invoiceId} saved successfully`);
    } catch (error) {
      console.error('Failed to update invoice:', error);
      throw error;
    }
  };

  // ── Return to Supplier handler ──
  const handleReturnToSupplier = async (supplierName: string) => {
    const ids = [...selectedRowIds];
    
    try {
      const csrfToken = localStorage.getItem('csrfToken');
      const response = await fetch('http://localhost:8001/api/ecus/return-to-supplier/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          ecu_ids: ids.map(id => Number(id)),
          supplier_name: supplierName
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to return ECUs to supplier');
      }
      
      const data = await response.json();
      
      setTableData(prev => prev.filter(e => !selectedRowIds.has(e.id)));
      setSelectedRowIds(new Set());
      
      alert(`✅ Successfully returned ${data.returned_count} ECU(s) to ${supplierName}`);
      
      const ecuRes = await getECUs({ project: selectedProject, category: selectedCategory });
      const newData = ecuRes.data.results ?? ecuRes.data;
      setTableData(newData.map(mapEcu) as typeof tableData);
      
    } catch (error) {
      console.error('Return to supplier error:', error);
      alert('Failed to return ECUs to supplier. Please try again.');
      throw error;
    }
  };

  // ── Map backend ECU → frontend row shape ──
  const mapEcu = (e: Record<string, unknown>): ECUDataItem => {
    return {
      id: String(e.id),
      inventoryNumber: String(e.inventory_number || ''),
      ssMan: String(e.serial_number || ''),
      category: String((e as Record<string, string>).category_name || ''),
      subCategory: String(e.sub_category || ''),
      status: e.status === 'active' ? 'Active' : 'Not Active',
      location: String(e.location || ''),
      connection: String((e as Record<string, string>).connection_name || ''),
      healthStatus: (String(e.health_status || 'working').charAt(0).toUpperCase() + String(e.health_status || 'working').slice(1)),
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
    };
  };

  // Reload tableData from backend (used after edit)
  const reloadTableData = async () => {
    try {
      const ecuRes = await getECUs({ project: selectedProject, category: selectedCategory });
      const data = ecuRes.data.results ?? ecuRes.data;
      setTableData(data.map(mapEcu) as typeof tableData);
    } catch (err) {
      console.error('Failed to reload ECU data:', err);
    }
  };

  const handleRowCheckbox = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedRowIds.size} selected ECU(s)? This cannot be undone.`)) return;
    const ids = [...selectedRowIds];
    setTableData(prev => prev.filter(e => !selectedRowIds.has(e.id)));
    setSelectedRowIds(new Set());
    try { await bulkDeleteECUs(ids); } catch (err) { console.error('Bulk delete error:', err); }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
        if (!rows.length) { alert('No data found in file.'); return; }

        const res = await importExcelRows(rows, selectedProject, selectedCategory);
        const { created, errors } = res.data;

        const ecuRes = await getECUs({ project: selectedProject, category: selectedCategory });
        const data = ecuRes.data.results ?? ecuRes.data;
        setTableData(data.map(mapEcu) as typeof tableData);
        setCurrentPage(1);

        alert(`✅ Imported ${created} ECUs${errors?.length ? `\n⚠️ ${errors.length} errors` : ''}`);
      } catch (err) {
        console.error('Import error:', err);
        alert('Import failed. Make sure the backend is running on port 8001.');
      }
    };
    input.click();
  };

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = tableData.map(ecu => ({
        'INV.NUM': ecu.inventoryNumber || '',
        'ECU ID': ecu.id,
        'Serial Number': ecu.ssMan,
        'Category': ecu.category,
        'Sub Category': ecu.subCategory,
        'Description': ecu.description,
        'Status': ecu.status,
        'Health Status': ecu.healthStatus,
        'Location': ecu.location,
        'Connection': ecu.connection,
        'Defect Reason': ecu.defectReason,
        'Hope Ticket ID': ecu.hopeTicketId,
        'Invoice ID': ecu.invoiceId || '',
        'Date Added': ecu.dateAdded,
        'Last Updated': ecu.lastUpdated,
        'QR Code': ecu.qrCode,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ECUs');
      const filename = `ECU_${selectedProject}_${selectedCategory}_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed.');
    }
  };

  const getHealthStatusStyle = (healthStatus: string) => {
    switch (healthStatus) {
      case 'Working': return 'bg-[#E8F6F0] text-[#2F8F6B]';
      case 'Defect':  return 'bg-[#FCEAEA] text-[#B54747]';
      case 'Recovered': return 'bg-[#E7F4F4] text-[#2F7F7F]';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      const currentValues = prev[category];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [category]: newValues };
    });
  };

  const removeFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [category]: prev[category].filter(v => v !== value) }));
  };

  const clearAllFilters = () => {
    setFilters({ status: [], healthStatus: [], connection: [], location: [] });
  };

  const hasActiveFilters = useMemo(() => Object.values(filters).some(arr => arr.length > 0), [filters]);

  useEffect(() => { setSearchTerm(''); setCurrentPage(1); }, [selectedProject, selectedCategory]);
  useEffect(() => { setCustomSubcategories([]); }, [selectedProject, selectedCategory]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return tableData.filter(ecu => {
      if (term && !ecu.inventoryNumber.toLowerCase().includes(term) && !ecu.ssMan.toLowerCase().includes(term) && !ecu.id.toLowerCase().includes(term)) return false;
      if (filters.status.length > 0 && !filters.status.includes(ecu.status)) return false;
      if (filters.healthStatus.length > 0 && !filters.healthStatus.includes(ecu.healthStatus)) return false;
      if (filters.connection.length > 0 && !filters.connection.includes(ecu.connection)) return false;
      if (filters.location.length > 0 && !filters.location.includes(ecu.location)) return false;
      if (selectedSubcategories.length > 0 && !selectedSubcategories.some(s => s.toLowerCase() === ecu.subCategory.toLowerCase())) return false;
      return true;
    });
  }, [tableData, searchTerm, filters, selectedSubcategories]);

  const allFilteredIds = useMemo(() => filteredData.map(e => e.id), [filteredData]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedRowIds.has(id));
  const isIndeterminate = !isAllSelected && allFilteredIds.some(id => selectedRowIds.has(id));

  const handleSelectAll = () => {
    if (isAllSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(allFilteredIds));
  };

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const startIndex = filteredData.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, filteredData.length);
  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

  useEffect(() => { setCurrentPage(1); }, [filters]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  if (view === 'category') {
    return <CategorySelection onSelectCategory={onSelectCategory} onAddCategory={onAddCategory} project={selectedProject || ''} />;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 relative">
            <h1 className="text-[2.375rem] font-bold text-[#354D6F] uppercase tracking-wider leading-tight">
              ECU DATABASE
            </h1>
            
            {/* Project tag - CLICKABLE - Solid continuous border */}
            <button
              onClick={() => {
                if (onBackToProjects) {
                  onBackToProjects();
                }
              }}
              className="flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 cursor-pointer group"
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'rgba(26, 54, 91, 0.06)',
                border: '1px solid rgba(26, 54, 91, 0.25)',
                boxShadow: '0 1px 4px rgba(26, 54, 91, 0.08)',
                backdropFilter: 'blur(6px)',
              }}
              onMouseEnter={e => { 
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26, 54, 91, 0.14)'; 
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => { 
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26, 54, 91, 0.06)'; 
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
              title="Click to change project"
            >
              <img src={projectNavIcon} alt="Project" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A365B' }}>Project {selectedProject}</span>
            </button>
            
            {/* Category tag - CLICKABLE - Solid continuous border */}
            <button
              onClick={() => {
                if (onBackToCategorySelection) {
                  onBackToCategorySelection();
                }
              }}
              className="flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 cursor-pointer group"
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'rgba(26, 54, 91, 0.12)',
                border: '1px solid rgba(26, 54, 91, 0.25)',
                boxShadow: '0 1px 6px rgba(26, 54, 91, 0.12)',
                backdropFilter: 'blur(6px)',
              }}
              onMouseEnter={e => { 
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26, 54, 91, 0.2)'; 
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => { 
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26, 54, 91, 0.12)'; 
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
              title="Click to change category"
            >
              <img src={categoryNavIcon} alt="Category" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A365B' }}>{selectedCategory}</span>
            </button>
          </div>
          
          {/* ECU Image */}
          <img 
            src={ecuHardware} 
            alt="ECU Hardware" 
            className="w-36 h-36 object-contain"
          />
        </div>

        {/* Search and Actions */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by INV.NUM, Serial Number or ECU ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] bg-white"
            />
          </div>
          <div className="relative">
            <button
              ref={filterButtonRef}
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all"
            >
              <Filter className="w-5 h-5" />
              FILTER BY
              <ChevronDown className={`w-4 h-4 transition-transform ${isFilterPanelOpen ? 'rotate-180' : ''}`} />
            </button>

            <FilterDropdown
              isOpen={isFilterPanelOpen}
              filters={filters}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
              onToggleFilter={toggleFilter}
              onApply={() => setIsFilterPanelOpen(false)}
              onClear={() => { clearAllFilters(); setIsFilterPanelOpen(false); }}
              dropdownRef={filterPanelRef}
              tableData={tableData}
            />
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all">
            <Download className="w-5 h-5 rotate-180" />
            EXPORT
          </button>
          <button onClick={handleImportClick} className="flex items-center gap-2 px-4 py-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all">
            <Download className="w-5 h-5" />
            IMPORT
          </button>
          <button
            onClick={() => setIsIdentifyECUModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all"
          >
            <Scan className="w-5 h-5" />
            IDENTIFY ECU
          </button>
        </div>
      </div>

      {/* Filter Chips Display */}
      {hasActiveFilters && (
        <div className="mb-4 bg-[#F5F0E8] rounded-lg p-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#354D6F] uppercase">Active Filters:</span>

          {filters.status.map(value => (
            <div key={`status-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
              <span className="text-[#354D6F] font-medium">Status: {value}</span>
              <button onClick={() => removeFilter('status', value)} className="hover:bg-gray-100 rounded-full p-0.5">
                <X className="w-3 h-3 text-[#936363]" />
              </button>
            </div>
          ))}

          {filters.healthStatus.map(value => (
            <div key={`health-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
              <span className="text-[#354D6F] font-medium">Health: {value}</span>
              <button onClick={() => removeFilter('healthStatus', value)} className="hover:bg-gray-100 rounded-full p-0.5">
                <X className="w-3 h-3 text-[#936363]" />
              </button>
            </div>
          ))}

          {filters.connection.map(value => (
            <div key={`conn-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
              <span className="text-[#354D6F] font-medium">Connection: {value}</span>
              <button onClick={() => removeFilter('connection', value)} className="hover:bg-gray-100 rounded-full p-0.5">
                <X className="w-3 h-3 text-[#936363]" />
              </button>
            </div>
          ))}

          {filters.location.map(value => (
            <div key={`loc-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
              <span className="text-[#354D6F] font-medium">Location: {value}</span>
              <button onClick={() => removeFilter('location', value)} className="hover:bg-gray-100 rounded-full p-0.5">
                <X className="w-3 h-3 text-[#936363]" />
              </button>
            </div>
          ))}

          <button
            onClick={clearAllFilters}
            className="ml-auto px-3 py-1 bg-[#936363] text-white rounded-full text-xs font-bold hover:bg-[#7a5252] transition-all"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Action Cards - 4 cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#557486] rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setIsGenerateQRCodeModalOpen(true)}>
          <ScanLine className="w-10 h-10 text-white" />
          <div className="text-white">
            <div className="text-sm uppercase font-bold leading-tight">Generate QR Code</div>
          </div>
        </div>

        <div className="bg-[#95A4AE] rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setIsHistoryModalOpen(true)}>
          <History className="w-10 h-10 text-white" />
          <div className="text-white">
            <div className="text-sm uppercase font-bold leading-tight">Track ECU History</div>
          </div>
        </div>

        <div className="bg-[#936363] rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setIsTransferRequestModalOpen(true)}>
          <ArrowRightLeft className="w-10 h-10 text-white" />
          <div className="text-white">
            <div className="text-sm uppercase font-bold leading-tight">Transfer Request</div>
          </div>
        </div>

        <div className="relative bg-[#A8BAC3] rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setIsTransferRequestsHistoryModalOpen(true)}>
          {pendingTransferCount > 0 && (
            <div className="absolute -top-2 -right-2 min-w-[24px] h-6 bg-[#B54747] text-white rounded-full flex items-center justify-center px-1.5 shadow-md">
              <span className="text-xs font-bold">{pendingTransferCount}</span>
            </div>
          )}
          <Clock className="w-10 h-10 text-[#354D6F]" />
          <div className="text-[#354D6F]">
            <div className="text-sm uppercase font-bold leading-tight">Transfer Requests History</div>
          </div>
        </div>
      </div>

      {/* Subcategory Cards */}
      <SubcategoryCards
        category={selectedCategory}
        project={selectedProject}
        onAddSubcategory={() => {}}
        tableData={tableData}
        onFilterChange={(selected) => {
          setSelectedSubcategories(selected);
          if (selected.length > 0) setCurrentPage(1);
        }}
        onCustomSubcategoriesChange={setCustomSubcategories}
      />

      {/* Main Content - Table with horizontal scroll */}
      <div className="space-y-6">
        {/* ECU Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-[#BAC8D1] flex items-center gap-3">
            <div className="w-1 h-5 bg-[#557486]"></div>
            <span className="font-bold text-[#354D6F] uppercase">ECU Table</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2563EB] rounded-md">
              <img src={ecuCountIcon} alt="ECU Count" className="w-3.5 h-3.5" />
              <span className="text-white font-bold text-xs">{filteredData.length}</span>
            </div>
            {selectedRowIds.size > 0 && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs font-bold text-[#557486] uppercase tracking-wide">{selectedRowIds.size} selected</span>
                <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B54747] hover:bg-[#8F3838] text-white rounded-lg font-bold text-xs uppercase transition-all">
                  <Trash2 className="w-3.5 h-3.5" />Delete ({selectedRowIds.size})
                </button>
                <button
                  onClick={() => setIsTransferRequestModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#354D6F] hover:bg-[#1A365B] text-white rounded-lg font-bold text-xs uppercase transition-all"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />Transfer ({selectedRowIds.size})
                </button>
                <button
                  onClick={() => setIsReturnToSupplierModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-bold text-xs uppercase transition-all"
                >
                  <Truck className="w-3.5 h-3.5" />Return ({selectedRowIds.size})
                </button>
                <button onClick={() => setSelectedRowIds(new Set())} className="text-xs font-bold text-[#95A4AE] hover:text-[#354D6F] uppercase transition-colors">Cancel</button>
              </div>
            )}
          </div>

          {/* Horizontal scroll container */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px]">
              <thead>
                <tr className="bg-[#F5F0E8] border-b border-[#BAC8D1]">
                  <th className="p-3 text-left w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 cursor-pointer"
                      checked={isAllSelected}
                      ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-32">
                    INV.NUM
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-32">
                    SE.NUM
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-28">
                    S.C
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap min-w-[300px] w-[35%]">
                    DESCRIPTION
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-28">
                    STATUS
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-28">
                    LOCATION
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-36">
                    CONNECTION
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-36">
                    HEALTH STATUS
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-28">
                    INVOICE ID
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-20">
                    QR Code
                  </th>
                  <th className="p-3 text-left text-sm font-bold text-[#354D6F] uppercase whitespace-nowrap w-28">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-[#557486]">
                        <div className="w-10 h-10 border-4 border-[#BAC8D1] border-t-[#557486] rounded-full animate-spin" />
                        <span className="font-bold text-sm uppercase tracking-widest">Loading ECUs...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-[#95A4AE]">
                        <Database className="w-12 h-12 opacity-30" />
                        <span className="font-bold text-base uppercase tracking-widest">No ECUs found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((ecu) => (
                    <tr key={ecu.id} className={`border-b border-[#BAC8D1] transition-colors ${selectedRowIds.has(ecu.id) ? 'bg-[#EFF6FF]' : 'hover:bg-[#F5F0E8]/50'}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer"
                          checked={selectedRowIds.has(ecu.id)}
                          onChange={() => handleRowCheckbox(ecu.id)}
                        />
                      </td>
                      <td className="p-3 text-sm text-[#354D6F] break-words font-mono">
                        {ecu.inventoryNumber || <span className="text-[#95A4AE] italic">—</span>}
                      </td>
                      <td className="p-3 text-sm text-[#354D6F] break-words">{ecu.ssMan}</td>
                      <td className="p-3 text-sm text-[#354D6F] break-words">{ecu.subCategory}</td>
                      <td className="p-3 text-sm text-[#354D6F] break-words leading-relaxed min-w-[300px]">
                        {ecu.description || <span className="text-[#95A4AE] italic">No description</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap inline-block ${
                          ecu.status === 'Active' ? 'bg-[#7594A4]' : 'bg-[#936363]'
                        }`}>
                          {ecu.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-[#354D6F] break-words">{ecu.location}</td>
                      <td className="p-3 text-sm text-[#354D6F] break-words">{ecu.connection}</td>
                      <td className="p-3">
                        <span
                          onClick={() => {
                            if (ecu.healthStatus === 'Defect') {
                              setSelectedEcuData(ecu);
                              setIsDefectDetailsModalOpen(true);
                            }
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block ${getHealthStatusStyle(ecu.healthStatus)} ${ecu.healthStatus === 'Defect' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        >
                          {ecu.healthStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        {ecu.invoiceId ? (
                          <button
                            onClick={() => {
                              setSelectedEcuForInvoice({
                                id: ecu.id,
                                invoiceId: ecu.invoiceId || null,
                                invoicePdf: ecu.invoicePdf || null,
                                serialNumber: ecu.ssMan
                              });
                              setIsInvoiceModalOpen(true);
                            }}
                            className="text-[#2563EB] hover:text-[#1D4ED8] font-mono text-sm underline cursor-pointer whitespace-nowrap"
                          >
                            {ecu.invoiceId}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedEcuForInvoice({
                                id: ecu.id,
                                invoiceId: null,
                                invoicePdf: null,
                                serialNumber: ecu.ssMan
                              });
                              setIsInvoiceModalOpen(true);
                            }}
                            className="text-[#95A4AE] hover:text-[#557486] text-sm italic cursor-pointer whitespace-nowrap"
                          >
                            Add Invoice
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center">
                          <QrCode
                            onClick={() => {
                              setSelectedEcuData(ecu);
                              setIsQRCodePreviewModalOpen(true);
                            }}
                            className="w-6 h-6 text-[#354D6F] cursor-pointer hover:text-[#557486] transition-colors"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(ecu.id)}
                            className="p-1 hover:bg-[#BAC8D1] rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5 text-[#557486]" />
                          </button>
                          <button
                            onClick={() => handleEdit(ecu.id)}
                            className="p-1 hover:bg-[#BAC8D1] rounded transition-colors"
                            title="Edit ECU"
                          >
                            <Edit className="w-5 h-5 text-[#7594A4]" />
                          </button>
                          <button
                            onClick={() => handleDelete(ecu.id)}
                            className="p-1 hover:bg-[#BAC8D1] rounded transition-colors"
                            title="Delete ECU"
                          >
                            <Trash2 className="w-5 h-5 text-[#936363]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-[#BAC8D1] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[#354D6F]">
              <Download className="w-4 h-4 text-[#936363]" />
              <span className="font-bold">
                {filteredData.length === 0 ? '0-0 of 0' : `${startIndex}-${endIndex} of ${filteredData.length}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || filteredData.length === 0}
                className="px-4 py-2 bg-[#557486] text-white rounded font-bold uppercase text-sm hover:bg-[#354D6F] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-[#354D6F] font-bold">
                Page {filteredData.length === 0 ? 0 : currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages || filteredData.length === 0}
                className="px-4 py-2 bg-[#557486] text-white rounded font-bold uppercase text-sm hover:bg-[#354D6F] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <ChevronRight className="w-5 h-5 text-[#95A4AE]" />
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {/* ECU Status */}
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-[#557486]"></div>
                <span className="font-bold text-[#354D6F] uppercase">ECU Status</span>
              </div>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
                      {statusData.map((entry) => <Cell key={`status-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {statusData.map((item) => {
                  const total = statusData.reduce((sum, d) => sum + d.value, 0);
                  const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="text-[#354D6F] font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-[#354D6F]">{item.value} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ECU Health Status */}
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-[#557486]"></div>
                <span className="font-bold text-[#354D6F] uppercase">ECU Health Status</span>
              </div>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={healthData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
                      {healthData.map((entry) => <Cell key={`health-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {healthData.map((item) => {
                  const total = healthData.reduce((sum, d) => sum + d.value, 0);
                  const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="text-[#354D6F] font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-[#354D6F]">{item.value} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ECU TSP Distribution */}
            <div className="bg-white rounded-xl shadow-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-[#557486]"></div>
                <span className="font-bold text-[#354D6F] uppercase">ECU TSP Distribution</span>
              </div>
              <div className="flex items-center justify-center mb-4">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={tspDistributionData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={3} dataKey="value">
                      {tspDistributionData.map((entry) => <Cell key={`tsp-${entry.name}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {tspDistributionData.map((item) => {
                  const total = tspDistributionData.reduce((sum, d) => sum + d.value, 0);
                  const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="text-[#354D6F] font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-[#354D6F]">{item.value} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BMW Subcategories Bar Chart */}
          <div className="flex justify-center">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-5xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-5 bg-[#557486]"></div>
                <span className="font-bold text-[#354D6F] uppercase">BMW Subcategories</span>
              </div>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={bmwSubcategories} margin={{ top: 10, right: 30, left: 20, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={120} tick={{ fontSize: 10, fill: '#354D6F' }} axisLine={{ stroke: '#BAC8D1' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#354D6F' }} axisLine={{ stroke: '#BAC8D1' }} domain={[0, 'dataMax + 1']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #BAC8D1', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}
                    labelStyle={{ color: '#354D6F', fontWeight: 'bold', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value} ECUs`, 'Quantity']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={70}>
                    {bmwSubcategories.map((entry) => <Cell key={`bmw-${entry.name}`} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      <AnimatePresence>
        {isHistoryModalOpen && (
          <ECUHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isECUGlobalHistoryModalOpen && (
          <ECUGlobalHistoryModal
            isOpen={isECUGlobalHistoryModalOpen}
            onClose={() => { setIsECUGlobalHistoryModalOpen(false); setSelectedEcuId(null); }}
            ecuId={selectedEcuId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransferRequestModalOpen && (
          <TransferRequestModal
            isOpen={isTransferRequestModalOpen}
            onClose={() => setIsTransferRequestModalOpen(false)}
            selectedSerials={[...selectedRowIds].map(id => {
              const ecu = tableData.find(e => e.id === id);
              return ecu?.ssMan || id;
            })}
            selectedECUs={[...selectedRowIds].map(id => {
              const ecu = tableData.find(e => e.id === id);
              return { id, serialNumber: ecu?.ssMan || id, location: ecu?.location || '' };
            })}
            onSubmit={async (serials, toLocation, ecus) => {
              const { createTransferRequest } = await import('../services/api' as any);
              for (const ecu of ecus) {
                await createTransferRequest({
                  ecu: Number(ecu.id),
                  requested_to_location: toLocation,
                  old_location: ecu.location,
                });
              }
              setSelectedRowIds(new Set());
              setIsTransferRequestsHistoryModalOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransferRequestsHistoryModalOpen && (
          <TransferRequestsHistoryModal
            isOpen={isTransferRequestsHistoryModalOpen}
            onClose={() => setIsTransferRequestsHistoryModalOpen(false)}
            onApprove={async (id, reason) => {
              const { approveTransferRequest } = await import('../services/api' as any);
              await approveTransferRequest(Number(id), reason);
            }}
            onDecline={async (id, reason) => {
              const { declineTransferRequest } = await import('../services/api' as any);
              await declineTransferRequest(Number(id), reason);
            }}
            onConfirmArrival={async (id) => {
              try {
                const res = await getECUs({ project: selectedProject, category: selectedCategory });
                const rows = res.data.results ?? res.data;
                setTableData(rows.map((e: Record<string, unknown>) => ({
                  id: String(e.id),
                  inventoryNumber: String(e.inventory_number || ''),
                  ssMan: String(e.serial_number || ''),
                  category: String((e as any).category_name || ''),
                  subCategory: String(e.sub_category || ''),
                  status: e.status === 'active' ? 'Active' : 'Not Active',
                  location: String(e.location || ''),
                  connection: String((e as any).connection_name || ''),
                  healthStatus: String(e.health_status || 'working').charAt(0).toUpperCase() + String(e.health_status || 'working').slice(1),
                  powerSupplyVolt: String(e.power_volts || ''),
                  powerSupplyAmp: String(e.power_amps || ''),
                  lastUpdated: String(e.updated_at || '').slice(0, 10),
                  dateAdded: String(e.created_at || '').slice(0, 10),
                  defectReason: String(e.defect_reason || ''),
                  hopeTicketId: String(e.defect_ticket_id || ''),
                  qrCode: String(e.qr_code_path || ''),
                  description: String(e.description || ''),
                  invoiceId: String((e as any).invoice_id || ''),
                  invoicePdf: String((e as any).invoice_pdf || ''),
                })) as typeof tableData);
              } catch {
                console.error('Failed to refresh ECUs after confirm');
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReturnToSupplierModalOpen && (
          <ReturnToSupplierModal
            isOpen={isReturnToSupplierModalOpen}
            onClose={() => setIsReturnToSupplierModalOpen(false)}
            onConfirm={handleReturnToSupplier}
            selectedCount={selectedRowIds.size}
            selectedSerials={[...selectedRowIds].map(id => {
              const ecu = tableData.find(e => e.id === id);
              return ecu?.ssMan || id;
            })}
            currentProject={selectedProject}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInvoiceModalOpen && selectedEcuForInvoice && (
          <InvoiceModal
            isOpen={isInvoiceModalOpen}
            onClose={() => {
              setIsInvoiceModalOpen(false);
              setSelectedEcuForInvoice(null);
            }}
            invoiceId={selectedEcuForInvoice.invoiceId}
            invoicePdf={selectedEcuForInvoice.invoicePdf}
            ecuId={selectedEcuForInvoice.id}
            ecuSerial={selectedEcuForInvoice.serialNumber}
            onUpdate={handleInvoiceUpdate}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isIdentifyECUModalOpen && (
          <IdentifyECUModal isOpen={isIdentifyECUModalOpen} onClose={() => setIsIdentifyECUModalOpen(false)} tableData={tableData} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGenerateQRCodeModalOpen && (
          <GenerateQRCodeModal
            isOpen={isGenerateQRCodeModalOpen}
            onClose={() => setIsGenerateQRCodeModalOpen(false)}
            selectedProject={selectedProject}
            selectedCategory={selectedCategory}
            tableData={tableData}
            extraSubcategories={customSubcategories}
            onSuccess={(newEcu) => {
              setTableData(prev => [newEcu as typeof prev[0], ...prev]);
              setIsGenerateQRCodeModalOpen(false);

              if (newEcu && newEcu.qrCode) {
                setTimeout(() => {
                  try {
                    const subcategory = (newEcu.subCategory || 'ECU').replace(/[^a-zA-Z0-9]/g, '_');
                    const serialNumber = (newEcu.ssMan || newEcu.id).replace(/[^a-zA-Z0-9]/g, '_');
                    const connection = (newEcu.connection || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
                    const project = (selectedProject || 'project').replace(/[^a-zA-Z0-9]/g, '_');
                    let filename = `${subcategory}_${serialNumber}_${connection}_${project}.png`;
                    filename = filename.replace(/_+/g, '_');
                    const link = document.createElement('a');
                    link.href = newEcu.qrCode;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } catch (downloadError) {
                    console.error('Failed to auto-download QR code:', downloadError);
                  }
                }, 500);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditECUModalOpen && editEcuData && (
          <EditECUModal
            isOpen={isEditECUModalOpen}
            onClose={() => { setIsEditECUModalOpen(false); setEditEcuData(null); }}
            ecuData={editEcuData}
            extraSubcategories={customSubcategories}
            onSuccess={() => {
              setIsEditECUModalOpen(false);
              setEditEcuData(null);
              reloadTableData();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDefectDetailsModalOpen && (
          <DefectDetailsModal
            isOpen={isDefectDetailsModalOpen}
            onClose={() => setIsDefectDetailsModalOpen(false)}
            ecuData={selectedEcuData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQRCodePreviewModalOpen && (
          <QRCodePreviewModal
            isOpen={isQRCodePreviewModalOpen}
            onClose={() => setIsQRCodePreviewModalOpen(false)}
            ecuData={selectedEcuData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}