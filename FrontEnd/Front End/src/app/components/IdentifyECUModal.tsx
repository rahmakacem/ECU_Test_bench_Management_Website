// IdentifyECUModal.tsx
import { X, Camera, QrCode, ArrowLeft, CheckCircle, AlertCircle, RefreshCw, Upload, Loader2, Download, Scan } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface ECUData {
  id: string;
  ssMan: string;
  subCategory: string;
  location: string;
  connection: string;
  description: string;
  status: string;
  healthStatus: string;
}

interface IdentifyECUModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableData: ECUData[];
}

interface Prediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
  points?: Array<{ x: number; y: number }>;
  cleanedClass?: string;
  originalClass?: string;
  matchingECU?: ECUData | null;
}

type Step = 'choose' | 'qr-scan' | 'capture' | 'processing' | 'result' | 'notfound';

// Roboflow API configuration
const ROBOFLOW_API_KEY = '5nS4ZVdVtwITI0u7IJsB';
const ROBOFLOW_MODEL_ID = 'rahma-qfg7m/1';
const ROBOFLOW_API_URL = `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}`;

// Clean class name by removing project/year suffixes like "PROJECT 2021", "2021", etc.
const cleanClassName = (className: string): string => {
  // Convert to uppercase for consistent matching
  let cleaned = className.toUpperCase();
  
  // Remove common project/year suffixes
  cleaned = cleaned.replace(/\s*PROJECT\s*\d{4}\s*$/i, '');
  cleaned = cleaned.replace(/\s*PROJECT\s*$/i, '');
  cleaned = cleaned.replace(/\s*\d{4}\s*$/i, '');
  cleaned = cleaned.replace(/\s*202[0-9]\s*$/i, '');
  cleaned = cleaned.replace(/\s*20[0-9][0-9]\s*$/i, '');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  console.log(`Cleaning class name: "${className}" -> "${cleaned}"`);
  
  return cleaned;
};

// Map Roboflow class names to database subcategory names (after cleaning)
const classToSubcategoryMap: Record<string, string> = {
  'BEL': 'BEL',
  'EXM': 'EXM',
  'SZT': 'SZT',
  'ZBE': 'ZBE',
  'TAGE': 'TAGE',
  'DOOR LOCK': 'DOOR LOCK',
  'HEAD UNIT': 'HEAD UNIT',
  'HEIGHT SENSOR': 'HEIGHT SENSOR',
  'ANTENNA': 'ANTENNA',
  'AUC SENSOR': 'AUC SENSOR',
  'START-STOP BUTTON': 'START/STOP BUTTON',
  'ELSV': 'ELSV',
  'POWER WINDOW': 'POWER WINDOW',
  'INTERIOR LIGHT FRONT': 'INTERIOR LIGHT FRONT',
  'INTERIOR LIGHT REAR': 'INTERIOR LIGHT REAR',
  'INTERIOR LIGHT': 'INTERIOR LIGHT',
  'INTERIOR MIRROR': 'INTERIOR MIRROR',
  'TIT': 'TIT',
  'MEDIA GATEWAY': 'MEDIA GATEWAY',
  'BREAKOUT BOX': 'BREAKOUT BOX',
  'WIPER': 'REAR WIPER',
  'TAIL LIGHT': 'TAIL LIGHT',
  'HEADLIGHT': 'HEADLIGHT',
  'STEERING WHEEL': 'STEERING WHEEL',
  'MFL': 'MFL',
  'WARNING LIGHT BUTTON': 'WARNING LIGHT BUTTON',
  'RADIO BUTTONS': 'RADIO BUTTONS',
  'WINDOW LOCAL BUTTON': 'WINDOW LOCAL BUTTON',
};

// Get the database subcategory name from a cleaned class name
const getDatabaseSubcategory = (cleanedClassName: string): string | null => {
  // Direct match
  if (classToSubcategoryMap[cleanedClassName]) {
    return classToSubcategoryMap[cleanedClassName];
  }
  
  // Try partial match (for cases like "INTERIOR LIGHT" matching "INTERIOR LIGHT FRONT" or "INTERIOR LIGHT REAR")
  for (const [key, value] of Object.entries(classToSubcategoryMap)) {
    if (cleanedClassName.includes(key) || key.includes(cleanedClassName)) {
      return value;
    }
  }
  
  return null;
};

// Format subcategory name for display
const formatSubcategoryName = (name: string): string => {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

// Convert base64 to blob for API request
const base64ToBlob = (base64: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

export function IdentifyECUModal({ isOpen, onClose, tableData }: IdentifyECUModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [foundEcus, setFoundEcus] = useState<Map<string, ECUData | null>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageNaturalDimensions, setImageNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // QR Code scan refs
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrAnimationRef = useRef<number | null>(null);
  
  // Photo capture refs
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const jsQRRef = useRef<any>(null);

  // Load jsQR dynamically
  useEffect(() => {
    import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js').catch(() => {
      if (!(window as any).jsQR) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        document.head.appendChild(script);
      }
    });
  }, []);

  // QR Code scanning frame capture
  const qrScanFrame = useCallback(() => {
    const video = qrVideoRef.current;
    const canvas = qrCanvasRef.current;
    const jsQR = (window as any).jsQR;

    if (!video || !canvas || !jsQR || video.readyState !== video.HAVE_ENOUGH_DATA) {
      qrAnimationRef.current = requestAnimationFrame(qrScanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code?.data) {
      stopQRScanner();
      const ecuId = code.data.trim();
      const ecu = tableData.find(e => e.id === ecuId);
      if (ecu) {
        // For QR code, we'll create a special entry
        const qrPrediction = {
          detection_id: 'qr-code',
          class: 'QR Code',
          cleanedClass: 'QR Code',
          confidence: 100,
          matchingECU: ecu
        } as Prediction;
        setPredictions([qrPrediction]);
        setSelectedPrediction(qrPrediction);
        const map = new Map();
        map.set('qr-code', ecu);
        setFoundEcus(map);
        setStep('result');
      } else {
        setStep('notfound');
      }
      return;
    }

    qrAnimationRef.current = requestAnimationFrame(qrScanFrame);
  }, [tableData]);

  // Start QR code scanner
  const startQRScanner = async () => {
    setStep('qr-scan');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
        qrAnimationRef.current = requestAnimationFrame(qrScanFrame);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check permissions.');
      setStep('choose');
    }
  };

  // Stop QR scanner
  const stopQRScanner = useCallback(() => {
    if (qrAnimationRef.current) {
      cancelAnimationFrame(qrAnimationRef.current);
      qrAnimationRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(track => track.stop());
      qrStreamRef.current = null;
    }
  }, []);

  // Stop photo camera
  const stopPhotoCamera = useCallback(() => {
    if (photoStreamRef.current) {
      photoStreamRef.current.getTracks().forEach(track => track.stop());
      photoStreamRef.current = null;
    }
  }, []);

  // Cleanup on modal close
  const handleClose = useCallback(() => {
    stopQRScanner();
    stopPhotoCamera();
    setStep('choose');
    setCapturedImage(null);
    setPredictions([]);
    setSelectedPrediction(null);
    setFoundEcus(new Map());
    setError(null);
    setImageNaturalDimensions(null);
    onClose();
  }, [stopQRScanner, stopPhotoCamera, onClose]);

  // Start photo capture mode
  const startPhotoCapture = async () => {
    setStep('capture');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      photoStreamRef.current = stream;
      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;
        await photoVideoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check permissions.');
      setStep('choose');
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!photoVideoRef.current || !photoCanvasRef.current) return;
    
    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      stopPhotoCamera();
      setStep('processing');
      sendToRoboflow(imageData);
    }
  };

  // Handle file upload from gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);
      setStep('processing');
      sendToRoboflow(imageData);
    };
    reader.readAsDataURL(file);
  };

  // Find matching ECU in database by subcategory
  const findMatchingECU = (className: string): ECUData | null => {
    // First, clean the class name (remove project/year suffixes)
    const cleanedClassName = cleanClassName(className);
    
    // Get the database subcategory name
    const dbSubcategory = getDatabaseSubcategory(cleanedClassName);
    
    if (!dbSubcategory) {
      console.log(`No mapping found for: ${cleanedClassName}`);
      return null;
    }
    
    // Find ECU with matching subcategory (case-insensitive)
    const matchingECU = tableData.find(ecu => 
      ecu.subCategory?.toUpperCase() === dbSubcategory.toUpperCase()
    );
    
    if (matchingECU) {
      console.log(`Found ECU for ${dbSubcategory}:`, matchingECU);
    } else {
      console.log(`No ECU found for subcategory: ${dbSubcategory}`);
    }
    
    return matchingECU || null;
  };

  // Send image to Roboflow for inference
  const sendToRoboflow = async (imageData: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const blob = base64ToBlob(imageData);
      const formData = new FormData();
      formData.append('file', blob, 'image.jpg');
      const url = `${ROBOFLOW_API_URL}?api_key=${ROBOFLOW_API_KEY}`;
      
      console.log('Sending to Roboflow:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Roboflow error response:', errorText);
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Roboflow response:', result);
      
      if (result.predictions && result.predictions.length > 0) {
        // Process all predictions
        const processedPredictions: Prediction[] = [];
        const ecuMap = new Map<string, ECUData | null>();
        
        for (const pred of result.predictions) {
          const cleanedClass = cleanClassName(pred.class);
          const matchingECU = findMatchingECU(pred.class);
          
          const processedPred = {
            ...pred,
            cleanedClass,
            originalClass: pred.class,
            matchingECU,
          };
          
          processedPredictions.push(processedPred);
          ecuMap.set(pred.detection_id, matchingECU);
        }
        
        // Sort predictions by confidence (highest first)
        processedPredictions.sort((a, b) => b.confidence - a.confidence);
        
        setPredictions(processedPredictions);
        setFoundEcus(ecuMap);
        
        // Auto-select the prediction with highest confidence
        setSelectedPrediction(processedPredictions[0]);
        setStep('result');
      } else {
        setStep('notfound');
      }
    } catch (err) {
      console.error('Roboflow API error:', err);
      setError('Failed to process image. Please try again.');
      setStep('choose');
    } finally {
      setIsProcessing(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setPredictions([]);
    setSelectedPrediction(null);
    setFoundEcus(new Map());
    setError(null);
    setImageNaturalDimensions(null);
    startPhotoCapture();
  };

  // Try again from result/notfound
  const handleTryAgain = () => {
    setCapturedImage(null);
    setPredictions([]);
    setSelectedPrediction(null);
    setFoundEcus(new Map());
    setError(null);
    setImageNaturalDimensions(null);
    setStep('choose');
  };

  // Get bounding box styles with proper scaling (rectangle)
  const getBoundingBoxStyle = (pred: Prediction) => {
    if (!imageRef.current || !imageNaturalDimensions) return {};
    
    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    
    const scaleX = rect.width / imageNaturalDimensions.width;
    const scaleY = rect.height / imageNaturalDimensions.height;
    
    const left = (pred.x - pred.width / 2) * scaleX;
    const top = (pred.y - pred.height / 2) * scaleY;
    const width = pred.width * scaleX;
    const height = pred.height * scaleY;
    
    const isSelected = selectedPrediction?.detection_id === pred.detection_id;
    const color = isSelected ? '#10b981' : '#3b82f6';
    const borderWidth = isSelected ? 3 : 2;
    
    return {
      position: 'absolute' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: `${borderWidth}px solid ${color}`,
      borderRadius: '4px',
      cursor: 'pointer',
      boxShadow: isSelected ? `0 0 0 2px ${color}40` : 'none',
      transition: 'all 0.2s ease',
    };
  };

  // Get display name for prediction (show cleaned version)
  const getDisplayClassName = (pred: Prediction): string => {
    return pred.cleanedClass || cleanClassName(pred.class);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#F5F0E8] rounded-2xl shadow-2xl z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-[#354D6F] rounded-t-2xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {step !== 'choose' && (
                  <button 
                    onClick={handleTryAgain} 
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-white" />
                  </button>
                )}
                <h2 className="text-base font-bold text-white">
                  {step === 'choose' && 'Identify ECU'}
                  {step === 'qr-scan' && 'Scan QR Code'}
                  {step === 'capture' && 'Capture ECU Photo'}
                  {step === 'processing' && 'Processing...'}
                  {step === 'result' && 'ECU Identified'}
                  {step === 'notfound' && 'ECU Not Found'}
                </h2>
              </div>
              <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* CHOOSE STEP */}
              {step === 'choose' && (
                <>
                  <p className="text-center text-[#354D6F] mb-5 text-sm">
                    Choose identification method
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={startQRScanner}
                      className="flex flex-col items-center gap-3 p-5 bg-[#557486] hover:bg-[#354D6F] rounded-xl shadow-md transition-all hover:shadow-lg"
                    >
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-[#557486]" />
                      </div>
                      <span className="text-white font-bold text-sm">Scan QR Code</span>
                    </button>

                    <button
                      onClick={startPhotoCapture}
                      className="flex flex-col items-center gap-3 p-5 bg-[#7594A4] hover:bg-[#557486] rounded-xl shadow-md transition-all hover:shadow-lg"
                    >
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-[#7594A4]" />
                      </div>
                      <span className="text-white font-bold text-sm">Capture ECU</span>
                    </button>
                  </div>
                </>
              )}

              {/* QR SCAN STEP */}
              {step === 'qr-scan' && (
                <div className="space-y-3">
                  <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <video
                      ref={qrVideoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={qrCanvasRef} className="hidden" />
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-64 h-64">
                        <div className="absolute inset-0 border-2 border-white/40 rounded-lg" />
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{borderWidth: '3px'}} />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" />
                        <motion.div
                          className="absolute left-2 right-2 h-0.5 bg-green-400"
                          animate={{ top: ['10%', '90%', '10%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
                        Position QR code in the frame
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        stopQRScanner();
                        handleTryAgain();
                      }}
                      className="flex-1 py-2.5 bg-[#354D6F] hover:bg-[#1A365B] text-white rounded-xl font-bold text-sm transition-all"
                    >
                      Cancel Scan
                    </button>
                  </div>
                </div>
              )}

              {/* PHOTO CAPTURE STEP */}
              {step === 'capture' && (
                <div className="space-y-3">
                  <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <video
                      ref={photoVideoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={photoCanvasRef} className="hidden" />
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-64 h-64">
                        <div className="absolute inset-0 border-2 border-white/40 rounded-lg" />
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{borderWidth: '3px'}} />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" />
                        <motion.div
                          className="absolute left-2 right-2 h-0.5 bg-green-400"
                          animate={{ top: ['10%', '90%', '10%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
                        Position the ECU component in the frame
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        stopPhotoCamera();
                        handleTryAgain();
                      }}
                      className="flex-1 py-2.5 bg-[#95A4AE] hover:bg-[#7594A4] text-white rounded-xl font-bold text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="flex-1 py-2.5 bg-[#354D6F] hover:bg-[#1A365B] text-white rounded-xl font-bold text-sm transition-all"
                    >
                      Capture Photo
                    </button>
                  </div>
                  
                  <div className="mt-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 border-2 border-dashed border-[#BAC8D1] text-[#557486] rounded-xl font-bold text-sm hover:bg-white transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Or Upload from Gallery
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* PROCESSING STEP */}
              {step === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-[#557486] animate-spin mb-4" />
                  <p className="text-[#354D6F] font-bold text-sm">Analyzing image with AI...</p>
                  <p className="text-xs text-[#64748B] mt-1">This may take a few seconds</p>
                  {capturedImage && (
                    <img 
                      src={capturedImage} 
                      alt="Processing" 
                      className="mt-4 max-h-40 rounded-lg shadow-md opacity-50"
                    />
                  )}
                </div>
              )}

              {/* RESULT STEP - Shows ALL detected items with their descriptions */}
              {step === 'result' && (
                <div className="space-y-4">
                  {/* Image with bounding boxes - only shown for photo capture, not QR */}
                  {capturedImage && (
                  <div className="relative flex justify-center">
                    <div className="relative inline-block">
                      <img 
                        ref={imageRef}
                        src={capturedImage} 
                        alt="Captured with detections" 
                        className="max-w-full max-h-[400px] object-contain rounded-lg shadow-lg"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setImageNaturalDimensions({
                            width: img.naturalWidth,
                            height: img.naturalHeight
                          });
                        }}
                      />
                      {/* Rectangle bounding boxes overlay - only for predictions with coords */}
                      {predictions.filter(p => p.x != null).map((pred: Prediction) => {
                        const style = getBoundingBoxStyle(pred);
                        if (!style || Object.keys(style).length === 0) return null;
                        const isSelected = selectedPrediction?.detection_id === pred.detection_id;
                        const color = isSelected ? '#10b981' : '#3b82f6';
                        const displayName = getDisplayClassName(pred);
                        
                        return (
                          <div
                            key={pred.detection_id}
                            style={style}
                            onClick={() => {
                              setSelectedPrediction(pred);
                            }}
                          >
                            <div
                              className="absolute -top-6 left-0 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap shadow-sm"
                              style={{ backgroundColor: color, color: 'white' }}
                            >
                              {displayName} ({Math.round(pred.confidence * 100)}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                  
                  {/* QR scan success banner */}
                  {predictions[0]?.detection_id === 'qr-code' && (
                    <div className="flex items-center gap-3 bg-[#E8F6F0] border border-[#2F8F6B] rounded-xl p-3">
                      <CheckCircle className="w-5 h-5 text-[#2F8F6B] flex-shrink-0" />
                      <p className="text-sm font-bold text-[#2F8F6B]">QR Code scanned successfully</p>
                    </div>
                  )}

                  {/* Show ALL detected items with their descriptions */}
                  <div className="bg-white rounded-xl border border-[#BAC8D1] p-4">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: '#10b981' }}
                      />
                      <span className="font-bold text-[#354D6F] text-sm uppercase tracking-wide">
                        Detected Components ({predictions.length})
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      {predictions.map((pred, index) => {
                        const matchingECU = foundEcus.get(pred.detection_id);
                        const displayName = getDisplayClassName(pred);
                        const isSelected = selectedPrediction?.detection_id === pred.detection_id;
                        
                        return (
                          <div 
                            key={pred.detection_id}
                            className={`p-3 rounded-lg transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-[#EFF6FF] border-l-4 border-[#10b981]' 
                                : 'bg-[#F8FAFC] hover:bg-[#F1F5F9]'
                            }`}
                            onClick={() => setSelectedPrediction(pred)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: isSelected ? '#10b981' : '#3b82f6' }}
                                />
                                <span className="font-bold text-[#354D6F] text-sm">
                                  {index + 1}. {matchingECU?.subCategory ? formatSubcategoryName(matchingECU.subCategory) : formatSubcategoryName(displayName)}
                                </span>
                              </div>
                              <span className="text-xs bg-[#E8F6F0] text-[#2F8F6B] px-2 py-1 rounded-full font-bold">
                                {Math.round(pred.confidence * 100)}% confidence
                              </span>
                            </div>
                            
                            {matchingECU ? (
                              <div className="mt-2 space-y-2">
                                {matchingECU.description && (
                                  <p className="text-sm text-[#64748B] leading-relaxed ml-1 mb-3">
                                    {matchingECU.description}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  {matchingECU.id && (
                                    <div className="bg-[#F1F5F9] rounded-lg p-2">
                                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">ID</p>
                                      <p className="text-xs font-bold text-[#354D6F] mt-0.5">{matchingECU.id}</p>
                                    </div>
                                  )}
                                  {matchingECU.ssMan && (
                                    <div className="bg-[#F1F5F9] rounded-lg p-2">
                                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">Serial Number</p>
                                      <p className="text-xs font-bold text-[#354D6F] mt-0.5">{matchingECU.ssMan}</p>
                                    </div>
                                  )}
                                  {matchingECU.location && (
                                    <div className="bg-[#F1F5F9] rounded-lg p-2">
                                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">Location</p>
                                      <p className="text-xs font-bold text-[#354D6F] mt-0.5">{matchingECU.location}</p>
                                    </div>
                                  )}
                                  {matchingECU.connection && (
                                    <div className="bg-[#F1F5F9] rounded-lg p-2">
                                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">Connection</p>
                                      <p className="text-xs font-bold text-[#354D6F] mt-0.5">{matchingECU.connection}</p>
                                    </div>
                                  )}
                                  {matchingECU.status && (
                                    <div className="bg-[#F1F5F9] rounded-lg p-2">
                                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">Status</p>
                                      <p className="text-xs font-bold text-[#354D6F] mt-0.5">{matchingECU.status}</p>
                                    </div>
                                  )}
                                  {matchingECU.healthStatus && (
                                    <div className={`rounded-lg p-2 ${
                                      matchingECU.healthStatus.toLowerCase() === 'good' ? 'bg-[#E8F6F0]' :
                                      matchingECU.healthStatus.toLowerCase() === 'faulty' ? 'bg-[#FCEAEA]' : 'bg-[#FEF3C7]'
                                    }`}>
                                      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">Health</p>
                                      <p className={`text-xs font-bold mt-0.5 ${
                                        matchingECU.healthStatus.toLowerCase() === 'good' ? 'text-[#2F8F6B]' :
                                        matchingECU.healthStatus.toLowerCase() === 'faulty' ? 'text-[#B54747]' : 'text-[#D97706]'
                                      }`}>{matchingECU.healthStatus}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="ml-4 bg-[#FEF3C7] rounded-lg p-2">
                                <p className="text-xs text-[#D97706]">
                                  ⚠️ No ECU found in database with subcategory: {displayName}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleTryAgain}
                      className="flex-1 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-xl font-bold text-sm hover:bg-white transition-all"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-2.5 bg-[#354D6F] text-white rounded-xl font-bold text-sm hover:bg-[#243B53] transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* NOT FOUND STEP */}
              {step === 'notfound' && (
                <div className="space-y-4">
                  <div className="bg-[#FCEAEA] rounded-xl p-6 text-center">
                    <AlertCircle className="w-16 h-16 text-[#B54747] mx-auto mb-3" />
                    <p className="text-lg font-bold text-[#B54747]">No ECU Detected</p>
                    <p className="text-sm text-[#936363] mt-1">
                      The system couldn't identify any ECU component in this image.
                    </p>
                    <p className="text-xs text-[#64748B] mt-3">
                      Try taking a clearer photo with better lighting, or make sure the ECU component is visible.
                    </p>
                  </div>
                  
                  {capturedImage && (
                    <div className="flex justify-center">
                      <img src={capturedImage} alt="Captured" className="max-h-48 rounded-lg shadow-md" />
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleTryAgain}
                      className="flex-1 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-xl font-bold text-sm hover:bg-white transition-all"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-2.5 bg-[#354D6F] text-white rounded-xl font-bold text-sm hover:bg-[#243B53] transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}