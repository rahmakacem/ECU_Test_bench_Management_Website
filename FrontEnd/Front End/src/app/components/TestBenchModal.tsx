// TestBenchModal.tsx
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getECUs, getECUHistory, getBookingRequests, getTransferRequests } from '../services/api';

import overviewIcon from '../../assets/overview.png';
import ecusIcon from '../../assets/ecus.png';
import historyIcon from '../../assets/history.png';
import abcIcon from '../../assets/abc.png';
import testbenchImage from '../../assets/testbench.png';

interface TestBenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  testBench: {
    id: number;
    badge: string;
    serialId: string;
    title: string;
    location: string;
    protocol: string;
    ecuCount: number;
    availableSlots: number;
    model: string;
    ipAddress: string;
    description: string;
    status: string;
    image: string;
    project?: string;
  };
  allECUs?: any[];
  onOpenBooking?: (testBench: any) => void;
}

type TabType = 'overview' | 'connected-ecus' | 'history';

interface HistoryEntry {
  id: string | number;
  date: string;
  time: string;
  action: string;
  action_type: string;
  type: string;
  description: string;
  performedBy: string;
  timestamp: string;
  ecu_snapshot?: any;
  additional_data?: any;
  status?: string;
}

// ============ ACTION TYPE STYLES ============
const getActionTypeStyle = (actionType: string): string => {
  const styles: Record<string, string> = {
    'booking-approved': 'bg-green-600 text-white',
    'booking-pending': 'bg-orange-400 text-white',
    'booking-declined': 'bg-[#936363] text-white',
    'testbench-update': 'bg-[#557486] text-white',
    'update': 'bg-[#7594A4] text-white',
    'add': 'bg-[#52443d] text-white',
    'delete': 'bg-[#FCEAEA] text-[#B54747]',
    'transfer-confirmed': 'bg-[#1A365B] text-white',
    'transfer-declined': 'bg-[#C9B2AA] text-white',
    'transfer-pending': 'bg-[#F3E8FF] text-[#7C3AED]',
    'transfer-approved': 'bg-[#506326] text-white',
    'return-to-supplier': 'bg-purple-600 text-white',
  };
  return styles[actionType] || 'bg-gray-500 text-white';
};

const formatActionTitle = (actionType: string, action?: string): string => {
  switch (actionType) {
    case 'add': return 'ECU Added';
    case 'update': return 'ECU Updated';
    case 'delete': return 'ECU Removed';
    case 'transfer-pending': return 'Transfer Requested';
    case 'transfer-approved': return 'Transfer Approved';
    case 'transfer-declined': return 'Transfer Declined';
    case 'transfer-confirmed': return 'Transfer Confirmed';
    case 'booking-pending': return 'Booking Requested';
    case 'booking-approved': return 'Booking Approved';
    case 'booking-declined': return 'Booking Declined';
    case 'testbench-update': return 'Test Bench Updated';
    case 'return-to-supplier': return 'Returned to Supplier';
    default: return action || 'Action';
  }
};

const formatDateTime = (isoString: string) => {
  const d = new Date(isoString);
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { date: datePart, time: timePart };
};

// ============ ANNOTATION DATA ============
const ANNOTATION_COLORS: Record<string, string> = {
  'EXM': '#f59e0b',
  'TAGE': '#10b981',
  'DOOR LOCK': '#ef4444',
  'HEAD UNIT': '#8b5cf6',
  'HEIGHT SENSOR': '#06b6d4',
  'ANTENNA': '#3b82f6',
  'AUC SENSOR': '#ec4899',
  'SZT': '#f97316',
  'WARNING LIGHT BUTTON': '#dc2626',
  'RADIO BUTTONS': '#6366f1',
  'START-STOP BUTTON': '#14b8a6',
  'ELSV': '#a855f7',
  'POWER WINDOW': '#84cc16',
  'INTERIOR LIGHT FRONT': '#fb923c',
  'INTERIOR LIGHT REAR': '#fbbf24',
  'BEL': '#22d3ee',
  'ZBE': '#f43f5e',
  'INTERIOR MIRROR': '#a3e635',
  'TIT': '#7c3aed',
  'WINDOW LOCAL BUTTON': '#0ea5e9',
  'MEDIA GATEWAY': '#d97706',
  'BREAKOUT BOX': '#16a34a',
  'WIPER': '#0284c7',
  'TAIL LIGHT': '#be185d',
  'HEADLIGHT': '#b45309',
  'STEERING WHEEL': '#ec4899',
  'MFL': '#8b5cf6',
};

const annotationToDBKey: Record<string, string> = {
  'WARNING LIGHT BUTTON': 'WARNING LIGHT BUTTON',
  'RADIO BUTTONS': 'RADIO BUTTONS',
  'WINDOW LOCAL BUTTON': 'WINDOW LOCAL BUTTON',
  'HEAD UNIT': 'HEAD UNIT',
  'STEERING WHEEL': 'STEERING WHEEL',
  'MFL': 'MFL',
  'EXM': 'EXM',
  'BEL': 'BEL',
  'SZT': 'SZT',
  'ZBE': 'ZBE',
  'TAGE': 'TAGE',
  'DOOR LOCK': 'DOOR LOCK',
  'HEIGHT SENSOR': 'HEIGHT SENSOR',
  'ANTENNA': 'ANTENNA',
  'AUC SENSOR': 'AUC SENSOR',
  'START-STOP BUTTON': 'START/STOP BUTTON',
  'ELSV': 'ELSV',
  'POWER WINDOW': 'POWER WINDOW',
  'INTERIOR LIGHT FRONT': 'INTERIOR LIGHT',
  'INTERIOR LIGHT REAR': 'INTERIOR LIGHT REAR',
  'INTERIOR MIRROR': 'INTERIOR MIRROR',
  'TIT': 'TIT',
  'MEDIA GATEWAY': 'MEDIA GATEWAY',
  'BREAKOUT BOX': 'BREAKOUT BOX',
  'WIPER': 'REAR WIPER',
  'TAIL LIGHT': 'TAIL LIGHT',
  'HEADLIGHT': 'HEADLIGHT',
};

const annotations = [
  { name: "EXM", points: [[78.98,8.44],[78.91,10.21],[78.28,12.08],[78.83,12.5],[85.39,11.98],[86.09,11.25],[87.27,8.54],[86.95,7.5],[86.02,6.67],[81.72,5.62],[80.0,6.46]], cx: 82.77, cy: 8.5 },
  { name: "EXM", points: [[68.05,9.06],[68.05,11.56],[68.83,12.92],[72.73,12.6],[73.59,11.15],[73.59,6.88],[73.05,6.04],[72.19,6.25],[69.3,7.71]], cx: 70.82, cy: 9.0 },
  { name: "TAGE", points: [[23.12,23.65],[22.97,24.38],[21.95,25.52],[21.95,26.25],[22.34,26.67],[25.08,26.88],[25.47,28.02],[25.7,27.5],[26.64,27.92],[26.95,27.4],[31.72,27.4],[32.03,25.42],[32.42,25.21],[31.09,22.71],[29.38,21.46],[24.53,22.71]], cx: 27.0, cy: 25.0 },
  { name: "TAGE", points: [[33.75,25.21],[33.67,26.15],[34.06,26.77],[34.53,26.77],[34.84,28.44],[37.73,27.81],[37.97,28.54],[38.44,28.65],[39.22,27.29],[39.84,28.02],[40.47,27.92],[40.62,26.25],[41.95,25.73],[42.42,24.79],[42.42,23.96],[42.11,23.02],[40.78,22.71],[40.39,23.02],[38.05,23.02],[36.56,22.5],[35.78,23.23],[34.61,23.54]], cx: 38.0, cy: 25.5 },
  { name: "TAGE", points: [[66.17,21.35],[66.8,24.48],[70.31,24.17],[71.64,23.65],[71.8,24.17],[72.27,24.27],[72.81,22.71],[75.0,22.5],[75.55,20.21],[75.16,19.27],[73.28,18.65],[70.62,19.27],[68.75,18.44],[66.72,20.21]], cx: 71.0, cy: 21.5 },
  { name: "TAGE", points: [[53.36,22.81],[53.36,24.69],[54.92,25.62],[59.53,25.94],[60.62,26.56],[61.72,26.46],[62.27,24.69],[63.05,24.38],[59.77,24.06],[58.91,22.19],[57.81,21.88],[54.45,21.67]], cx: 58.0, cy: 24.0 },
  { name: "DOOR LOCK", points: [[29.22,28.65],[28.98,30.21],[29.3,33.12],[31.09,35.62],[31.09,34.48],[31.8,32.29],[31.48,27.6],[30.39,26.46]], cx: 30.3, cy: 31.0 },
  { name: "DOOR LOCK", points: [[41.56,27.4],[41.02,28.12],[41.33,32.71],[42.19,33.02],[43.2,35.0],[43.75,32.71],[43.52,26.56],[42.89,26.15],[42.5,26.98]], cx: 42.4, cy: 30.5 },
  { name: "DOOR LOCK", points: [[55.55,27.29],[55.86,32.08],[56.56,32.08],[56.95,32.81],[57.5,33.02],[57.66,34.17],[58.36,34.17],[58.75,32.08],[58.44,25.73],[58.05,25.21]], cx: 57.2, cy: 30.0 },
  { name: "DOOR LOCK", points: [[67.5,24.9],[67.81,31.67],[68.52,33.65],[70.39,31.04],[70.23,27.19],[69.45,25.73],[68.52,25.52],[67.89,24.69]], cx: 69.0, cy: 28.5 },
  { name: "HEAD UNIT", points: [[59.06,38.75],[58.98,40.62],[59.84,41.98],[65.7,41.25],[77.19,41.25],[77.89,40.83],[78.28,39.38],[77.89,36.04],[77.66,35.52],[76.95,35.31],[67.73,35.52],[60.23,36.25],[59.45,36.77]], cx: 68.5, cy: 38.5 },
  { name: "HEIGHT SENSOR", points: [[23.98,36.46],[24.3,38.54],[24.77,38.85],[25.23,38.12],[25.31,36.88],[24.77,35.94]], cx: 24.7, cy: 37.4 },
  { name: "HEIGHT SENSOR", points: [[26.02,36.35],[26.33,38.54],[26.8,38.65],[27.19,38.02],[27.11,36.67],[26.64,35.94]], cx: 26.7, cy: 37.3 },
  { name: "ANTENNA", points: [[22.5,29.17],[22.58,32.81],[23.12,33.02],[23.12,29.69],[22.73,28.85]], cx: 22.85, cy: 31.0 },
  { name: "ANTENNA", points: [[75.08,24.69],[74.69,27.19],[74.92,27.6],[74.84,29.27],[75.16,29.58],[75.55,29.27],[75.94,27.19],[75.47,25.0]], cx: 75.3, cy: 27.1 },
  { name: "ANTENNA", points: [[60.16,63.54],[59.61,64.48],[59.77,65.0],[60.23,64.9],[61.25,63.44],[61.64,62.19],[61.17,62.19]], cx: 60.7, cy: 63.6 },
  { name: "ANTENNA", points: [[47.89,27.6],[48.05,28.33],[49.38,27.6],[50.23,25.42],[49.45,25.62]], cx: 49.1, cy: 26.9 },
  { name: "AUC SENSOR", points: [[24.84,40.94],[24.3,42.19],[25.23,42.71],[25.47,42.5],[25.31,41.15]], cx: 25.0, cy: 41.7 },
  { name: "SZT", points: [[49.84,36.98],[49.38,39.38],[49.45,41.04],[50.62,41.35],[50.94,40.21],[50.94,36.98],[50.62,36.35],[50.16,36.35]], cx: 50.2, cy: 38.8 },
  { name: "WARNING LIGHT BUTTON", points: [[54.06,37.6],[53.75,38.85],[54.3,39.58],[54.84,39.17],[55.55,37.5],[55.39,36.88],[55.0,36.77]], cx: 54.7, cy: 38.2 },
  { name: "RADIO BUTTONS", points: [[50.78,40.83],[50.7,41.46],[51.02,41.88],[52.81,42.29],[57.97,42.19],[58.59,41.77],[58.52,40.94],[52.34,40.83],[51.17,40.31]], cx: 54.7, cy: 41.5 },
  { name: "START-STOP BUTTON", points: [[64.61,41.98],[64.53,45.31],[65.16,47.4],[65.55,47.71],[66.33,46.77],[65.47,41.88],[65.0,41.56]], cx: 65.2, cy: 44.6 },
  { name: "START-STOP BUTTON", points: [[63.12,58.65],[63.2,60.73],[66.09,61.15],[66.72,60.62],[65.94,59.79],[64.06,55.31],[63.67,55.62]], cx: 64.8, cy: 58.8 },
  { name: "ELSV", points: [[75.08,66.25],[75.08,67.29],[75.62,67.92],[76.95,67.92],[77.97,67.29],[77.73,66.04],[77.34,65.73]], cx: 76.5, cy: 66.9 },
  { name: "POWER WINDOW", points: [[61.95,11.46],[61.48,17.6],[63.12,17.71],[63.52,17.4],[64.04,13.06],[64.69,11.88],[62.81,10.1],[62.11,10.31]], cx: 63.1, cy: 14.0 },
  { name: "POWER WINDOW", points: [[56.17,11.67],[56.02,12.4],[56.72,13.44],[56.41,18.12],[58.2,17.92],[59.14,16.35],[59.84,16.15],[60.0,13.75],[59.53,13.02],[58.67,12.71],[58.83,10.73],[58.59,10.52]], cx: 58.1, cy: 14.3 },
  { name: "POWER WINDOW", points: [[71.09,14.06],[71.25,16.88],[71.64,17.19],[73.05,16.88],[73.2,15.62],[72.81,14.37],[72.34,13.85]], cx: 72.1, cy: 15.5 },
  { name: "INTERIOR LIGHT FRONT", points: [[47.34,18.12],[47.34,18.85],[49.3,19.48],[50.55,19.58],[52.5,18.96],[51.8,17.5],[50.47,16.77],[48.75,17.08]], cx: 50.0, cy: 18.2 },
  { name: "INTERIOR LIGHT REAR", points: [[47.34,27.4],[47.34,28.54],[49.3,29.17],[50.55,29.27],[52.5,28.65],[51.8,27.19],[50.47,26.46],[48.75,26.77]], cx: 50.0, cy: 27.9 },
  { name: "BEL", points: [[61.88,49.17],[62.11,50.21],[63.28,50.52],[64.38,50.42],[64.84,49.48],[64.61,49.06]], cx: 63.4, cy: 49.8 },
  { name: "ZBE", points: [[58.13,51.98],[57.97,52.71],[58.75,58.13],[59.53,58.54],[61.56,57.6],[61.64,55.62],[60.55,51.25],[60.23,51.04],[59.69,51.67]], cx: 59.8, cy: 54.7 },
  { name: "INTERIOR MIRROR", points: [[59.3,22.29],[59.3,23.75],[59.84,24.17],[62.27,24.48],[66.09,24.27],[66.41,23.96],[66.25,22.4],[65.78,21.77],[61.95,21.46],[60.08,21.67]], cx: 62.9, cy: 23.1 },
  { name: "TIT", points: [[72.34,24.58],[72.27,26.46],[72.73,27.19],[73.05,26.88],[73.05,25.73]], cx: 72.7, cy: 25.9 },
  { name: "WINDOW LOCAL BUTTON", points: [[24.61,28.33],[24.77,29.58],[25.62,29.27],[25.39,28.23]], cx: 25.1, cy: 28.9 },
  { name: "MEDIA GATEWAY", points: [[26.56,45.0],[26.88,48.85],[32.11,47.92],[31.8,44.9]], cx: 29.3, cy: 46.7 },
  { name: "BREAKOUT BOX", points: [[36.09,41.77],[36.17,43.12],[35.08,44.27],[35.86,62.29],[37.19,62.92],[39.45,62.6],[43.28,62.81],[47.27,62.29],[46.88,60.62],[45.86,59.17],[46.02,58.13],[45.62,58.33],[45.16,56.46],[45.39,56.35],[44.61,55.62],[44.53,54.9],[45.08,53.96],[44.84,49.17],[47.11,48.85],[47.34,50.62],[48.05,51.25],[48.2,51.04],[47.81,41.35],[44.3,41.35],[42.73,40.94],[36.48,41.46]], cx: 41.6, cy: 51.8 },
  { name: "WIPER", points: [[23.12,46.98],[23.44,47.5],[22.97,49.27],[24.38,49.38],[24.61,47.08],[23.75,46.35]], cx: 23.8, cy: 47.9 },
  { name: "TAIL LIGHT", points: [[63.67,72.29],[63.44,74.06],[63.83,75.83],[64.45,76.77],[79.61,76.56],[80.39,75.83],[80.39,71.77],[79.92,71.15],[71.33,71.46],[70.47,70.94],[67.5,70.83],[63.98,71.67]], cx: 72.0, cy: 73.8 },
  { name: "TAIL LIGHT", points: [[47.11,72.29],[47.19,75.83],[48.05,76.98],[62.66,76.77],[62.97,76.56],[63.2,74.79],[62.97,72.29],[62.58,71.88],[48.12,71.67]], cx: 55.1, cy: 74.3 },
  { name: "HEADLIGHT", points: [[61.48,79.69],[61.33,80.21],[62.73,82.08],[64.61,83.75],[67.58,84.69],[70.0,84.9],[72.81,83.33],[75.39,81.04],[76.33,79.38],[76.33,78.65],[75.86,77.92],[74.92,77.6],[70.7,78.12],[69.22,77.92]], cx: 68.8, cy: 81.5 },
  { name: "HEADLIGHT", points: [[47.66,77.5],[47.73,79.27],[48.36,80.62],[50.39,83.02],[53.2,84.9],[58.13,84.58],[59.53,83.44],[62.5,82.08],[61.41,80.83],[58.59,79.58],[50.86,77.5],[48.12,77.19]], cx: 55.1, cy: 81.1 },
  { name: "STEERING WHEEL", points: [[76.5,28.0],[78.2,29.5],[79.8,31.0],[79.5,32.5],[77.8,33.2],[75.5,32.8],[74.2,31.0],[74.8,29.2]], cx: 77.0, cy: 30.5 },
  { name: "MFL", points: [[82.0,38.0],[83.5,39.2],[84.8,40.5],[84.5,42.0],[82.8,42.5],[80.5,41.8],[79.2,40.0],[80.0,38.5]], cx: 82.2, cy: 40.3 },
];

// ============ ANNOTATION TOOLTIP COMPONENT ============
const AnnotationTooltip = ({ visible, mouseX, mouseY, polygonRect, name, description, zoom }: any) => {
  if (!visible) return null;
  return (
    <div className="fixed z-[9999] pointer-events-none bg-white rounded-lg shadow-lg border border-gray-200 p-2">
      <p className="font-bold text-[#354D6F] text-xs">{name}</p>
      <p className="text-xs text-gray-600">{description || 'No description available'}</p>
    </div>
  );
};

// ============ ZOOMABLE ANNOTATED IMAGE COMPONENT ============
function ZoomableAnnotatedImage({ ecuData }: { ecuData: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredAnnotation, setHoveredAnnotation] = useState<any>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.4;

  const subcategoryDescriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    ecuData.forEach((ecu: any) => {
      const subCategory = ecu.subCategory?.toUpperCase();
      const description = ecu.description;
      if (subCategory && description && !map.has(subCategory)) {
        map.set(subCategory, description);
      }
    });
    return map;
  }, [ecuData]);

  const getDescriptionForAnnotation = (annotationName: string): string => {
    const dbKey = annotationToDBKey[annotationName] || annotationName.toUpperCase();
    return subcategoryDescriptionMap.get(dbKey) || '';
  };

  const clampPan = useCallback((newPan: { x: number; y: number }, currentZoom: number) => {
    const el = containerRef.current;
    if (!el) return newPan;
    const maxOffset = ((currentZoom - 1) / 2) * el.clientWidth;
    const maxOffsetY = ((currentZoom - 1) / 2) * el.clientHeight;
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, newPan.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newPan.y)),
    };
  }, []);

  const handleZoomIn = () => {
    setZoom(z => {
      const next = Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2));
      setPan(p => clampPan(p, next));
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom(z => {
      const next = Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2));
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      else setPan(p => clampPan(p, next));
      return next;
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const newPan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
    setPan(clampPan(newPan, zoom));
  };

  const onMouseUp = () => setIsPanning(false);

  const getPolygonBoundingRect = (points: number[][], svgElement: SVGSVGElement) => {
    const svgRect = svgElement.getBoundingClientRect();
    const xs = points.map(p => (p[0] / 100) * svgRect.width + svgRect.left);
    const ys = points.map(p => (p[1] / 100) * svgRect.height + svgRect.top);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
      centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
      centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  };

  const handleAnnotationHover = (e: React.MouseEvent, annotation: typeof annotations[0], svgElement: SVGSVGElement) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    const polygonRect = getPolygonBoundingRect(annotation.points, svgElement);
    const description = getDescriptionForAnnotation(annotation.name);
    setHoveredAnnotation({ name: annotation.name, polygonRect, mouseX: e.clientX, mouseY: e.clientY, description });
    setTooltipVisible(true);
  };

  const handleAnnotationLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(false);
      setHoveredAnnotation(null);
    }, 100);
  };

  useEffect(() => {
    return () => { if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 self-end pr-1">
        <span className="text-xs text-gray-400 font-medium mr-1">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-all disabled:opacity-40">
          <ZoomOut className="w-4 h-4 text-[#354D6F]" />
        </button>
        <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-all disabled:opacity-40">
          <ZoomIn className="w-4 h-4 text-[#354D6F]" />
        </button>
      </div>

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-gray-200 select-none" style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => { onMouseUp(); handleAnnotationLeave(); }}>
        <div style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 0.2s ease', willChange: 'transform' }}>
          <img src={testbenchImage} alt="Testbench ECU Components" className="w-full object-contain block" draggable={false} />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: zoom > 1 ? 'none' : 'all' }}>
            {annotations.map((ann, i) => {
              const color = ANNOTATION_COLORS[ann.name] ?? '#3b82f6';
              const isHovered = hoveredAnnotation?.name === ann.name;
              const pointsStr = ann.points.map(([x, y]) => `${x},${y}`).join(' ');
              return (
                <g key={i}>
                  <polygon points={pointsStr} fill={isHovered ? `${color}30` : 'transparent'} stroke={isHovered ? color : 'transparent'} strokeWidth={isHovered ? '0.35' : '0'} strokeLinejoin="round" style={{ pointerEvents: 'all', cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' }} onMouseEnter={(e) => { const svgElement = e.currentTarget.ownerSVGElement as SVGSVGElement; if (svgElement) handleAnnotationHover(e, ann, svgElement); }} onMouseLeave={handleAnnotationLeave} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {hoveredAnnotation && tooltipVisible && (
        <AnnotationTooltip visible={tooltipVisible} mouseX={hoveredAnnotation.mouseX} mouseY={hoveredAnnotation.mouseY} polygonRect={hoveredAnnotation.polygonRect} name={hoveredAnnotation.name} description={hoveredAnnotation.description} zoom={zoom} />
      )}

      <p className="text-xs text-gray-400 text-center">Hover a component to see its description · Use zoom to inspect details</p>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export function TestBenchModal({ isOpen, onClose, testBench, allECUs = [], onOpenBooking }: TestBenchModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [connectedECUs, setConnectedECUs] = useState<any[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loadingECUs, setLoadingECUs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;
  const [historyPage, setHistoryPage] = useState(1);
  const historyRowsPerPage = 10;

  // Fetch ECUs connected to this test bench
  useEffect(() => {
    if (!isOpen || !testBench?.badge) return;
    const fetchECUsForTestBench = async () => {
      setLoadingECUs(true);
      try {
        const res = await getECUs({ connection: testBench.badge });
        const rows = res.data.results ?? res.data;
        const mappedECUs = rows.map((e: Record<string, unknown>) => ({
          id: String(e.id),
          inventoryNumber: String(e.inventory_number || ''),
          ssMan: String(e.serial_number || ''),
          category: String((e as Record<string, string>).category_name || ''),
          subCategory: String(e.sub_category || ''),
          description: String(e.description || ''),
          status: e.status === 'active' ? 'Active' : 'Not Active',
          location: String(e.location || ''),
          connection: String((e as Record<string, string>).connection_name || ''),
          healthStatus: String(e.health_status || 'working').charAt(0).toUpperCase() + String(e.health_status || 'working').slice(1),
        }));
        setConnectedECUs(mappedECUs);
        setCurrentPage(1);
      } catch (error) {
        console.error('Failed to fetch ECUs for test bench:', error);
        setConnectedECUs([]);
      } finally {
        setLoadingECUs(false);
      }
    };
    fetchECUsForTestBench();
  }, [isOpen, testBench?.badge]);

  // Fetch history using the OPTIMIZED endpoint - SINGLE API CALL
  useEffect(() => {
    if (!isOpen || !testBench?.id) return;
    
    const fetchHistoryOptimized = async () => {
      setLoadingHistory(true);
      setHistoryEntries([]);
      
      try {
        const response = await fetch(`http://localhost:8001/api/testbenches/${testBench.id}/history/`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          const entries = data.history.map((h: any) => {
            let description = h.description;
            
            // Format return-to-supplier description
            if (h.action_type === 'return-to-supplier' && h.additional_data?.supplier_name) {
              const ecuSerial = h.additional_data?.ecu_serial || '';
              const subcategory = h.additional_data?.ecu_subcategory || '';
              const supplierName = h.additional_data.supplier_name;
              description = `${subcategory} #${ecuSerial} returned to supplier: ${supplierName}`;
            }
            
            return {
              id: h.id,
              date: h.date,
              time: h.time,
              action: h.action,
              action_type: h.action_type,
              type: h.action_type,
              description: description,
              performedBy: h.performed_by,
              timestamp: h.timestamp,
              additional_data: h.additional_data,
            };
          });
          setHistoryEntries(entries);
        } else {
          console.error('Failed to fetch history');
          setHistoryEntries([]);
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistoryEntries([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    fetchHistoryOptimized();
  }, [isOpen, testBench?.id]);

  // Reset pagination when tab changes
  useEffect(() => {
    if (activeTab === 'connected-ecus') setCurrentPage(1);
    if (activeTab === 'history') setHistoryPage(1);
  }, [activeTab]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(connectedECUs.length / rowsPerPage));
  const startIndex = connectedECUs.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, connectedECUs.length);
  const paginatedECUs = connectedECUs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const historyTotalPages = Math.max(1, Math.ceil(historyEntries.length / historyRowsPerPage));
  const historyStartIndex = historyEntries.length === 0 ? 0 : (historyPage - 1) * historyRowsPerPage + 1;
  const historyEndIndex = Math.min(historyPage * historyRowsPerPage, historyEntries.length);
  const paginatedHistory = historyEntries.slice((historyPage - 1) * historyRowsPerPage, historyPage * historyRowsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-green-600 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-green-600" /><span className="font-bold text-green-600 uppercase text-xs">Available</span>
        </div>
      );
      case 'in-use': return (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-[#557486] rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-[#557486]" /><span className="font-bold text-[#557486] uppercase text-xs">In Use</span>
        </div>
      );
      case 'faulty': return (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-[#936363] rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-[#936363]" /><span className="font-bold text-[#936363] uppercase text-xs">Faulty</span>
        </div>
      );
      case 'maintenance': return (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-orange-500 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /><span className="font-bold text-orange-500 uppercase text-xs">Under Maintenance</span>
        </div>
      );
      default: return null;
    }
  };

  const getHealthStatusStyle = (h: string) => {
    switch (h) {
      case 'Working': return 'bg-[#E8F6F0] text-[#2F8F6B]';
      case 'Defect':  return 'bg-[#FCEAEA] text-[#B54747]';
      case 'Recovered': return 'bg-[#E7F4F4] text-[#2F7F7F]';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: overviewIcon },
    { id: 'connected-ecus' as TabType, label: 'Connected ECUs', icon: ecusIcon },
    { id: 'history' as TabType, label: 'History', icon: historyIcon },
  ];

  const getIconFilter = (isActive: boolean) =>
    isActive
      ? 'brightness(0) saturate(100%) invert(27%) sepia(98%) saturate(1874%) hue-rotate(215deg) brightness(95%) contrast(101%)'
      : 'brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(85%)';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-4 m-auto bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col z-50"
          >
            {/* Header */}
            <div className="relative flex items-center justify-end min-h-[125px] px-6 border-b border-gray-200 bg-white">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <img src={abcIcon} alt="Test Bench" className="max-h-[90px] md:max-h-[105px] w-auto object-contain" />
              </div>
              <div className="relative z-10 flex items-center gap-3">
                {onOpenBooking && (
                  <button
                    onClick={() => {
                      if (testBench.status === 'faulty') {
                        alert('⚠️ This test bench is faulty and cannot be booked. Please contact maintenance.');
                        return;
                      }
                      onOpenBooking(testBench);
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      testBench.status === 'faulty'
                        ? 'bg-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-[#C9B2AA] text-white hover:bg-[#B9A29A]'
                    }`}
                    disabled={testBench.status === 'faulty'}
                  >
                    Book This Test Bench
                  </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-3 pb-0">
              <div className="flex items-center gap-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center gap-1.5 py-2 px-3 transition-all duration-200 border-b-2 -mb-px ${
                      activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <img src={tab.icon} alt={tab.label} className="w-6 h-6 object-contain" style={{ filter: getIconFilter(activeTab === tab.id), width: '24px', height: '24px' }} />
                    <span className={`text-xs font-medium ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'}`}>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'overview' && <ZoomableAnnotatedImage ecuData={connectedECUs} />}

              {activeTab === 'connected-ecus' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#557486]" />
                      <span className="font-bold text-[#354D6F] text-sm uppercase">ECU Table</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-[#2563EB] rounded-md">
                        <span className="text-white font-bold text-[10px]">{connectedECUs.length} ECUs</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                    {loadingECUs ? (
                      <div className="p-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-[#557486]">
                          <div className="w-8 h-8 border-3 border-[#BAC8D1] border-t-[#557486] rounded-full animate-spin" />
                          <span className="font-bold text-xs uppercase tracking-widest">Loading ECUs...</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-[#F5F0E8] border-b border-[#BAC8D1]">
                                {['INV.NUM','SE.NUM','CATEGORY','S.C','Description','STATUS','LOCATION','HEALTH'].map(h => (
                                  <th key={h} className="p-2 text-left text-xs font-bold text-[#354D6F] uppercase whitespace-nowrap">{h}</th>
                                ))}
                               </tr>
                            </thead>
                            <tbody>
                              {paginatedECUs.length === 0 ? (
                                <tr><td colSpan={8} className="p-12 text-center"><span className="font-bold text-sm uppercase tracking-widest text-[#95A4AE]">No ECUs connected</span></td></tr>
                              ) : (
                                paginatedECUs.map((ecu) => (
                                  <tr key={ecu.id} className="border-b border-[#BAC8D1] hover:bg-[#F5F0E8]/50">
                                    <td className="p-2 text-xs text-[#354D6F] font-mono">{ecu.inventoryNumber || '—'}</td>
                                    <td className="p-2 text-xs text-[#354D6F]">{ecu.ssMan}</td>
                                    <td className="p-2 text-xs text-[#354D6F]">{ecu.category}</td>
                                    <td className="p-2 text-xs text-[#354D6F]">{ecu.subCategory}</td>
                                    <td className="p-2 text-xs text-[#354D6F]">{ecu.description || '—'}</td>
                                    <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap inline-block ${ecu.status === 'Active' ? 'bg-[#7594A4]' : 'bg-[#936363]'}`}>{ecu.status}</span></td>
                                    <td className="p-2 text-xs text-[#354D6F]">{ecu.location}</td>
                                    <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap inline-block ${getHealthStatusStyle(ecu.healthStatus)}`}>{ecu.healthStatus}</span></td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {connectedECUs.length > 0 && (
                          <div className="p-3 border-t border-[#BAC8D1] flex items-center justify-between">
                            <div className="text-xs text-[#354D6F] font-bold">{connectedECUs.length === 0 ? '0-0 of 0' : `${startIndex}-${endIndex} of ${connectedECUs.length}`}</div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-[#557486] text-white rounded font-bold text-xs hover:bg-[#354D6F] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                              <span className="text-xs text-[#354D6F] font-bold">Page {currentPage} of {totalPages}</span>
                              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 bg-[#557486] text-white rounded font-bold text-xs hover:bg-[#354D6F] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#557486]" />
                      <span className="font-bold text-[#354D6F] text-sm uppercase">Action History</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-[#2563EB] rounded-md">
                        <span className="text-white font-bold text-[10px]">{historyEntries.length} events</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {loadingHistory ? (
                      <div className="p-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-[#557486]">
                          <div className="w-8 h-8 border-3 border-[#BAC8D1] border-t-[#557486] rounded-full animate-spin" />
                          <span className="font-bold text-xs uppercase tracking-widest">Loading history...</span>
                        </div>
                      </div>
                    ) : historyEntries.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-[#95A4AE]">
                          <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-bold text-sm uppercase tracking-widest">No history events found</span>
                          <span className="text-xs text-gray-400">History will appear when ECUs are added, transferred, or booked</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-[#F5F0E8] border-b border-[#BAC8D1]">
                                <th className="p-3 text-left text-xs font-bold text-[#354D6F]">DATE & TIME</th>
                                <th className="p-3 text-left text-xs font-bold text-[#354D6F]">ACTION TYPE</th>
                                <th className="p-3 text-left text-xs font-bold text-[#354D6F]">DESCRIPTION</th>
                                <th className="p-3 text-left text-xs font-bold text-[#354D6F]">PERFORMED BY</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedHistory.map((entry, index) => {
                                const actionTitle = formatActionTitle(entry.action_type, entry.action);
                                return (
                                  <tr key={`${entry.id}-${index}`} className="border-b border-[#BAC8D1] hover:bg-[#F5F0E8]/50 transition-colors">
                                    <td className="p-3">
                                      <div className="text-xs font-medium text-[#354D6F]">{entry.date}</div>
                                      <div className="text-[10px] text-gray-400 mt-0.5">{entry.time}</div>
                                    </td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getActionTypeStyle(entry.action_type)}`}>
                                        {actionTitle}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-xs text-[#475569] max-w-md break-words leading-relaxed">
                                        {entry.description}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-xs font-medium text-[#354D6F]">
                                        {entry.performedBy || 'System'}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {historyEntries.length > historyRowsPerPage && (
                          <div className="p-3 border-t border-[#BAC8D1] flex items-center justify-between">
                            <div className="text-xs text-[#354D6F] font-bold">
                              {historyStartIndex}-{historyEndIndex} of {historyEntries.length}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-3 py-1.5 bg-[#557486] text-white rounded-md font-bold text-xs hover:bg-[#354D6F] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                              <span className="text-xs text-[#354D6F] font-bold">Page {historyPage} of {historyTotalPages}</span>
                              <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage >= historyTotalPages} className="px-3 py-1.5 bg-[#557486] text-white rounded-md font-bold text-xs hover:bg-[#354D6F] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}