import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { resolveUnit } from '../../utils/uom';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { Button } from '../../components/ui/Button';
import MasterSourceLink, { useMasterDataRefresh } from '../../components/common/MasterSourceLink';
import { fabricMasterSync } from '../../services/fabricMasterSync';
import {
  ChevronRight,
  ChevronDown,
  Save,
  ArrowLeft,
  UploadCloud,
  Sliders,
  Package,
  Layers,
  MapPin,
  CheckCircle2,
  Barcode,
  Scale,
  Plus,
  X,
  Boxes,
  Trash2,
  Search,
  Cpu,
  Info,
  AlertTriangle,
  QrCode,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Wand2,
  RefreshCw,
  Eye,
  Check,
  ShieldCheck,
  Shirt,
  Palette,
  Lock,
  Wrench,
} from 'lucide-react';

export const AddEditItemPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const fileInputRef = useRef(null);

  // Parse query param kind (e.g. /items/new?kind=Machine)
  const searchParams = new URLSearchParams(routerLocation.search);
  const queryKind = searchParams.get('kind');

  const {
    items,
    categories = [],
    vendors = [],
    units = [],
    locations = [],
    categoryParts = [],
    addUnit,
    addInventoryItem,
    updateInventoryItem,
    itemParts = [],
    addItemPart,
    removeItemPart,
    updateCategory,
    addCategory
  } = useERP();

  const isEditMode = Boolean(id);
  const existingItem = items.find((i) => i.id === id || i.sku === id);

  // Form state
  const [sku, setSku] = useState('');
  const [status, setStatus] = useState('Optimal');
  const [itemLifecycle, setItemLifecycle] = useState('Active');
  const [itemKind, setItemKind] = useState('Fabric');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Networking Hardware');
  const [vendor, setVendor] = useState('');

  // Dynamic Units & Conversions
  // Units come from the UOM master — no hardcoded defaults that may not exist there.
  const [purchaseUnit, setPurchaseUnit] = useState('');
  const [salesUnit, setSalesUnit] = useState('');
  const [unitConversionFactor, setUnitConversionFactor] = useState(1);
  const [uom, setUom] = useState('');
  const activeUnitList = useMemo(() => units.filter((u) => u.isActive !== false), [units]);
  // The master's Length base unit (e.g. "Meter"); fabric trades by length.
  const lengthUnitCode = useMemo(() => {
    const length = activeUnitList.filter((u) => u.uomType === 'Length');
    return (length.find((u) => u.isBaseUnit) || length[0])?.code || 'Meter';
  }, [activeUnitList]);

  // ── [PHASE-2A] Weight-based item (steel bought/sold by weight) ──
  // isWeightItem → item is weighed at intake (kg) instead of counted.
  // theoreticalWeight = expected kg per unit; tolerancePct = allowed ±% variance.
  const [isWeightItem, setIsWeightItem] = useState(false);
  const [theoreticalWeight, setTheoreticalWeight] = useState('');
  const [tolerancePct, setTolerancePct] = useState('2');

  // Fabric spec — shown when itemKind === 'Fabric'
  const [fabricQuality, setFabricQuality] = useState('');
  const [fabricDesign, setFabricDesign] = useState('');
  const [fabricColor, setFabricColor] = useState('');
  const [fabricWidth, setFabricWidth] = useState('');
  const [fabricGsm, setFabricGsm] = useState('');

  // Quality / Design / Colour options come from the Fabric Masters. Items store
  // the master's *name* (plain text on the item), so options are names.
  const [fabricMasters, setFabricMasters] = useState({ qualities: [], designs: [], shades: [], loaded: false });
  const loadFabricMasters = useCallback(async () => {
    const [qualities, designs, shades] = await Promise.all([
      fabricMasterSync.pull('fabricQualities'),
      fabricMasterSync.pull('designs'),
      fabricMasterSync.pull('shades'),
    ]);
    const activeNames = (rows) => [...new Set((rows || [])
      .filter((r) => r.isActive !== false && r.is_active !== false)
      .map((r) => String(r.name || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    setFabricMasters({
      qualities: activeNames(qualities),
      designs: activeNames(designs),
      shades: activeNames(shades),
      loaded: true,
    });
  }, []);
  useEffect(() => { loadFabricMasters(); }, [loadFabricMasters]);
  useMasterDataRefresh(loadFabricMasters, ['fabricQualities', 'designs', 'shades']);

  // Master names as <option>s. A saved value that is no longer in the master
  // (renamed, inactive, legacy) is still listed so editing never drops it.
  const renderMasterOptions = (list, current, emptyText) => {
    const options = current && !list.includes(current) ? [...list, current] : list;
    return (
      <>
        {list.length === 0 && (
          <option value="__none__" disabled>{fabricMasters.loaded ? emptyText : 'Loading…'}</option>
        )}
        {options.map((v) => (
          <option key={v} value={v}>{list.includes(v) ? v : `${v} (not in master)`}</option>
        ))}
      </>
    );
  };

  // Fabric trades by length — lock units of measure for Fabric items. An item
  // already in a length unit ("Mtr") keeps it; otherwise use the base length unit.
  useEffect(() => {
    if (itemKind === 'Fabric') {
      const current = existingItem?.uom;
      const unit = current && resolveUnit(units, current)?.uomType === 'Length' ? current : lengthUnitCode;
      setPurchaseUnit(unit);
      setSalesUnit(unit);
      setUom(unit);
      setUnitConversionFactor(1);
    }
  }, [itemKind, lengthUnitCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // New non-fabric items start on an active Piece unit (or the first active unit).
  useEffect(() => {
    if (isEditMode || itemKind === 'Fabric' || salesUnit || activeUnitList.length === 0) return;
    const pick = (activeUnitList.find((u) => u.uomType === 'Piece') || activeUnitList[0]).code;
    setSalesUnit(pick);
    setUom(pick);
    setPurchaseUnit((p) => p || pick);
  }, [activeUnitList, itemKind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking Mode & Serial / Batch numbers
  const [trackingMode, setTrackingMode] = useState('Quantity'); // 'Quantity' | 'Serial' | 'Batch'
  const [batchNumber, setBatchNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [taxRate, setTaxRate] = useState('5');
  // ── [PHASE-2E.1] GST compliance: HSN (goods) / SAC (services) per item ──
  const [hsnCode, setHsnCode] = useState('');
  const [sacCode, setSacCode] = useState('');
  const [serialNumbersText, setSerialNumbersText] = useState('');
  const [serialViewMode, setSerialViewMode] = useState('chips'); // 'chips' | 'raw'
  const [singleSerialInput, setSingleSerialInput] = useState('');
  const [serialSearchFilter, setSerialSearchFilter] = useState('');
  const [duplicateSerialNotice, setDuplicateSerialNotice] = useState('');

  // Warranty Policy & Default Configuration
  const [warrantyApplicable, setWarrantyApplicable] = useState(false);
  const [warrantyPeriod, setWarrantyPeriod] = useState(1);
  const [warrantyUnit, setWarrantyUnit] = useState('Years');
  const [warrantyStartEvent, setWarrantyStartEvent] = useState('Delivery');
  const [manufacturerWarrantyPeriod, setManufacturerWarrantyPeriod] = useState('');
  const [manufacturerWarrantyUnit, setManufacturerWarrantyUnit] = useState('Years');

  // Serial Batch Generator Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('');
  const [batchStartNum, setBatchStartNum] = useState(1);
  const [batchCount, setBatchCount] = useState(5);
  const [batchPadding, setBatchPadding] = useState(3);
  const [batchSuffix, setBatchSuffix] = useState('');

  // Product Image Upload
  const [imagePreview, setImagePreview] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [availableQty, setAvailableQty] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('');
  const [location, setLocation] = useState(locations[0]?.name || '');
  const [description, setDescription] = useState('');

  // Dynamic Custom Field Values
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [showCustomParameters, setShowCustomParameters] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);

  // Temporary Machine BOM state (configurable before machine save)
  const [machineBomParts, setMachineBomParts] = useState([]);
  const [isAddPartModalOpen, setIsAddPartModalOpen] = useState(false);
  const [partPickerSearch, setPartPickerSearch] = useState('');
  const [partPickerCategory, setPartPickerCategory] = useState('All');
  const [selectedPickerItem, setSelectedPickerItem] = useState(null);
  const [pickerRequiredQty, setPickerRequiredQty] = useState(1);

  // Inline Unit Creation Modal
  const [showNewUnitModal, setShowNewUnitModal] = useState(false);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitLabel, setNewUnitLabel] = useState('');

  // Inline Custom Field Modal
  const [showNewFieldModal, setShowNewFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Active category object and its schema
  const activeCategoryObj = categories.find((c) => c.name?.toLowerCase() === category?.toLowerCase() || c.id === category);
  const categoryCustomFields = activeCategoryObj?.customFields || [];

  // For Fabric items, custom parameters belong to the Fabric category (fallback: active category)
  const fabricCategoryObj = categories.find((c) => /fabric/i.test(c.name || ''));
  const activeFabricCategoryObj = itemKind === 'Fabric' ? (fabricCategoryObj || activeCategoryObj) : activeCategoryObj;
  const fabricCustomFields = activeFabricCategoryObj?.customFields || [];

  // Helper to get linked default parts template for a given category name or id
  const getPartsForCategory = (catNameOrId) => {
    if (!catNameOrId) return [];
    const targetCat = categories.find(
      (c) => c.id === catNameOrId || c.name?.toLowerCase() === catNameOrId?.toLowerCase()
    );
    if (!targetCat) return [];
    return categoryParts
      .filter((cp) => cp.categoryId === targetCat.id || cp.categoryId === targetCat.name)
      .map((cp) => ({
        id: `draft-cp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        partItemId: cp.partItemId || cp.itemId,
        requiredQty: cp.requiredQty || cp.defaultQty || 1,
      }));
  };

  const handleCategoryChange = (newCatName) => {
    setCategory(newCatName);
    // Auto-load BOM parts template if editing/creating a Machine
    if (itemKind === 'Machine') {
      const catBoms = getPartsForCategory(newCatName);
      if (catBoms.length > 0) {
        setMachineBomParts(catBoms);
      }
    }
  };

  const handleItemKindChange = (newKind) => {
    setItemKind(newKind);
    if (newKind === 'Machine' && machineBomParts.length === 0) {
      const catBoms = getPartsForCategory(category);
      if (catBoms.length > 0) {
        setMachineBomParts(catBoms);
      }
    }
  };

  useEffect(() => {
    if (isEditMode && existingItem) {
      setSku(existingItem.sku || existingItem.code || '');
      setName(existingItem.name);
      setItemKind('Fabric');
      setCategory(existingItem.category || categories[0]?.name || 'Fabric');
      setVendor(existingItem.vendor || '');
      setUom(existingItem.salesUnit || existingItem.uom || '');
      setPurchaseUnit(existingItem.purchaseUnit || existingItem.uom || '');
      setSalesUnit(existingItem.salesUnit || existingItem.uom || '');
      setUnitConversionFactor(existingItem.unitConversionFactor || 1);
      // [PHASE-2A] load weight-item config on edit
      setIsWeightItem(Boolean(existingItem.isWeightItem));
      setTheoreticalWeight(existingItem.theoreticalWeight !== undefined ? String(existingItem.theoreticalWeight) : '');
      setTolerancePct(existingItem.tolerancePct !== undefined ? String(existingItem.tolerancePct) : '2');
      setTrackingMode(existingItem.trackingMode || (existingItem.serialNumbers?.length ? 'Serial' : existingItem.batchNumber ? 'Batch' : 'Quantity'));
      setBatchNumber(existingItem.batchNumber || '');
      setLotNumber(existingItem.lotNumber || '');
      setManufactureDate(existingItem.manufactureDate || '');
      setExpiryDate(existingItem.expiryDate || '');
      setTaxRate(existingItem.taxRate !== undefined ? String(existingItem.taxRate) : (existingItem.taxPct !== undefined ? String(existingItem.taxPct) : '5'));
      // [PHASE-2E.1] load HSN/SAC on edit
      setHsnCode(existingItem.hsnCode || '');
      setSacCode(existingItem.sacCode || '');
      setSerialNumbersText((existingItem.serialNumbers || []).join('\n'));
      setImagePreview(existingItem.image || existingItem.imageUrl || '');
      setCostPrice(String(existingItem.costPrice ?? existingItem.unitCost ?? ''));
      setSellingPrice(String(existingItem.sellingPrice ?? ''));
      setAvailableQty(String(existingItem.availableQty ?? existingItem.stock ?? '0'));
      setReorderLevel(String(existingItem.reorderLevel ?? ''));
      setLocation(existingItem.location || locations[0]?.name || 'Main Central Hub');
      setDescription(existingItem.description || '');
      setItemLifecycle(existingItem.lifecycleStatus || 'Active');
      setStatus(existingItem.status || 'Optimal');
      setCustomFieldValues(existingItem.customFieldValues || {});
      setFabricQuality(existingItem.fabricQuality || '');
      setFabricDesign(existingItem.fabricDesign || '');
      setFabricColor(existingItem.fabricColor || '');
      setFabricWidth(existingItem.fabricWidth !== undefined && existingItem.fabricWidth !== '' && existingItem.fabricWidth !== null ? String(existingItem.fabricWidth) : '');
      setFabricGsm(existingItem.fabricGsm !== undefined && existingItem.fabricGsm !== '' && existingItem.fabricGsm !== null ? String(existingItem.fabricGsm) : '');
      setWarrantyApplicable(Boolean(existingItem.warrantyApplicable));
      setWarrantyPeriod(existingItem.warrantyPeriod !== undefined ? existingItem.warrantyPeriod : 1);
      setWarrantyUnit(existingItem.warrantyUnit || 'Years');
      setWarrantyStartEvent(existingItem.warrantyStartEvent || 'Delivery');
      setManufacturerWarrantyPeriod(existingItem.manufacturerWarrantyPeriod !== undefined ? String(existingItem.manufacturerWarrantyPeriod) : '');
      setManufacturerWarrantyUnit(existingItem.manufacturerWarrantyUnit || 'Years');
      if (existingItem.customFieldValues && Object.keys(existingItem.customFieldValues).length > 0) {
        setShowCustomParameters(true);
      }

      // Load existing BOM parts for this machine into local state
      const linkedParts = itemParts.filter((ip) => ip.parentItemId === existingItem.id);
      if (linkedParts.length > 0) {
        setMachineBomParts(linkedParts.map((p) => ({
          id: p.id,
          partItemId: p.partItemId,
          requiredQty: p.requiredQty,
        })));
      } else if (existingItem.itemKind === 'Machine') {
        const catBoms = getPartsForCategory(existingItem.category);
        if (catBoms.length > 0) {
          setMachineBomParts(catBoms);
        }
      }
    }
    else if (!isEditMode) {
      const prefix = queryKind === 'Machine' ? 'MACH' : queryKind === 'Part' ? 'PART' : queryKind === 'Fabric' ? 'FAB' : 'PRD';
      // The SKU is allocated by the server when left blank (ITM series).
      setSku('');
      setBatchPrefix(`SN-${prefix}-`);
      const targetKind = queryKind || itemKind;
      if (queryKind) {
        setItemKind(queryKind);
      }
      if ((queryKind || itemKind) === 'Fabric') {
        // Fabric trades by length, not by pieces.
        setUom(lengthUnitCode);
        setSalesUnit(lengthUnitCode);
        setPurchaseUnit(lengthUnitCode);
      }
      const defaultCat = (categories.length > 0 && !category) ? categories[0].name : category;
      if (categories.length > 0 && !category) {
        setCategory(categories[0].name);
      }
      if (vendors.length > 0 && !vendor) {
        setVendor(vendors[0].name);
      }
      if (locations.length > 0 && !location) {
        setLocation(locations[0].name);
      }
      if ((targetKind === 'Machine') && defaultCat && machineBomParts.length === 0) {
        const catBoms = getPartsForCategory(defaultCat);
        if (catBoms.length > 0) {
          setMachineBomParts(catBoms);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, existingItem, categories, vendors, locations, categoryParts, queryKind]);

  // Parse and deduplicate serial numbers list
  const parsedSerialNumbers = useMemo(() => {
    const list = serialNumbersText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [serialNumbersText]);

  // If trackingMode is Serial, dynamically synchronize availableQty with unique serial count
  useEffect(() => {
    if (trackingMode === 'Serial') {
      setAvailableQty(String(parsedSerialNumbers.length));
    }
  }, [trackingMode, parsedSerialNumbers]);

  // Compute smart prefix suggestion based on SKU and name
  const smartPrefix = useMemo(() => {
    if (sku) {
      return `SN-${sku.toUpperCase()}-`;
    }
    return 'SN-MACH-';
  }, [sku]);

  // Compute next suggested single serial number
  const nextSuggestedSerial = useMemo(() => {
    const prefix = smartPrefix;
    let nextNum = 1;
    parsedSerialNumbers.forEach((sn) => {
      const match = sn.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num >= nextNum) {
          nextNum = num + 1;
        }
      }
    });
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }, [smartPrefix, parsedSerialNumbers]);

  // Handler to quickly append generated serials
  const handleAppendSerials = (newSerials) => {
    const currentList = [...parsedSerialNumbers];
    newSerials.forEach((sn) => {
      if (!currentList.includes(sn)) {
        currentList.push(sn);
      }
    });
    setSerialNumbersText(currentList.join('\n'));
  };

  // Quick One-Click Suggestion Generators
  const handleQuickSuggestBatch = (count) => {
    const prefix = smartPrefix;
    let startIdx = 1;
    parsedSerialNumbers.forEach((sn) => {
      const match = sn.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num >= startIdx) {
          startIdx = num + 1;
        }
      }
    });

    const generated = [];
    for (let i = 0; i < count; i++) {
      generated.push(`${prefix}${String(startIdx + i).padStart(3, '0')}`);
    }
    handleAppendSerials(generated);
  };

  // Single Serial Add Handler
  const handleAddSingleSerial = (e) => {
    if (e) e.preventDefault();
    const val = (singleSerialInput.trim() || nextSuggestedSerial).trim();
    if (!val) return;

    if (parsedSerialNumbers.includes(val)) {
      setDuplicateSerialNotice(`Serial number "${val}" is already added.`);
      setTimeout(() => setDuplicateSerialNotice(''), 3000);
      return;
    }

    handleAppendSerials([val]);
    setSingleSerialInput('');
    setDuplicateSerialNotice('');
  };

  // Remove single serial
  const handleRemoveSerial = (serialToRemove) => {
    const updated = parsedSerialNumbers.filter((s) => s !== serialToRemove);
    setSerialNumbersText(updated.join('\n'));
  };

  // Execute Custom Batch Generator
  const handleExecuteBatchGenerator = (e) => {
    e.preventDefault();
    const p = batchPrefix.trim() || smartPrefix;
    const start = Math.max(1, Number(batchStartNum) || 1);
    const count = Math.max(1, Number(batchCount) || 1);
    const pad = Math.max(1, Math.min(6, Number(batchPadding) || 3));
    const s = batchSuffix.trim();

    const generated = [];
    for (let i = 0; i < count; i++) {
      const numStr = String(start + i).padStart(pad, '0');
      generated.push(`${p}${numStr}${s}`);
    }

    handleAppendSerials(generated);
    setShowBatchModal(false);
  };

  // Image Upload Handlers
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, JPEG, WEBP, or SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCustomFieldChange = (key, value) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCreateUnit = (e) => {
    e.preventDefault();
    if (!newUnitCode.trim() || !newUnitLabel.trim()) return;
    const created = addUnit({
      code: newUnitCode.trim(),
      label: newUnitLabel.trim(),
    });
    setSalesUnit(created.code);
    setShowNewUnitModal(false);
    setNewUnitCode('');
    setNewUnitLabel('');
  };

  const handleCreateCustomFieldInline = (e) => {
    e.preventDefault();
    let targetCategory = itemKind === 'Fabric' ? activeFabricCategoryObj : activeCategoryObj;
    if (!targetCategory && itemKind === 'Fabric' && addCategory) {
      // Auto-create a Fabric category on first custom field so the feature always works
      targetCategory = addCategory({ name: 'Fabric', code: 'FAB', description: 'Fabric catalog items' });
      setCategory(targetCategory.name);
    }
    if (!targetCategory) {
      alert('No item category is configured yet. Please create a category (e.g. Fabric) first, then add custom fields.');
      return;
    }
    if (!newFieldName.trim()) return;
    const currentFields = targetCategory.customFields || [];
    const optionsList = newFieldType === 'dropdown'
      ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const newField = {
      id: `cf-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      ...(optionsList ? { options: optionsList } : {}),
    };

    const updatedFields = [...currentFields, newField];
    updateCategory(targetCategory.id, { customFields: updatedFields });
    setShowNewFieldModal(false);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldOptions('');
  };

  // Filter available stock items for BOM Item Picker (Strictly non-machine items)
  const availableStockItemsForPicker = useMemo(() => {
    return items.filter((it) => {
      // Machine cannot select another machine as a BOM part
      if (it.itemKind === 'Machine') return false;
      if (isEditMode && it.id === existingItem?.id) return false;

      // Category filter
      if (partPickerCategory !== 'All' && it.category !== partPickerCategory) return false;

      // Search filter
      if (partPickerSearch.trim()) {
        const q = partPickerSearch.toLowerCase().trim();
        const matchName = it.name?.toLowerCase().includes(q);
        const matchSku = it.sku?.toLowerCase().includes(q);
        const matchCat = (it.category || '').toLowerCase().includes(q);
        return matchName || matchSku || matchCat;
      }
      return true;
    });
  }, [items, isEditMode, existingItem, partPickerCategory, partPickerSearch]);

  // Check if selected picker item is already in BOM
  const isSelectedAlreadyInBom = useMemo(() => {
    if (!selectedPickerItem) return false;
    return machineBomParts.some((p) => p.partItemId === selectedPickerItem.id);
  }, [selectedPickerItem, machineBomParts]);

  const handleAddPartToBom = (e) => {
    e.preventDefault();
    if (!selectedPickerItem) return;

    const qty = Math.max(1, Number(pickerRequiredQty) || 1);

    // Duplicate prevention: if already present, update requiredQty or preserve single row
    const existingIndex = machineBomParts.findIndex((p) => p.partItemId === selectedPickerItem.id);
    if (existingIndex >= 0) {
      setMachineBomParts((prev) =>
        prev.map((p, idx) => (idx === existingIndex ? { ...p, requiredQty: qty } : p))
      );
    } else {
      setMachineBomParts((prev) => [
        ...prev,
        {
          id: `draft-ip-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          partItemId: selectedPickerItem.id,
          requiredQty: qty,
        },
      ]);
    }

    setIsAddPartModalOpen(false);
    setSelectedPickerItem(null);
    setPickerRequiredQty(1);
    setPartPickerSearch('');
  };

  const handleRemoveBomPart = (partItemId) => {
    setMachineBomParts((prev) => prev.filter((p) => p.partItemId !== partItemId));
  };

  const handleUpdateBomPartQty = (partItemId, newQty) => {
    const q = Math.max(1, Number(newQty) || 1);
    setMachineBomParts((prev) =>
      prev.map((p) => (p.partItemId === partItemId ? { ...p, requiredQty: q } : p))
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isService = itemKind === 'Service';
    const parsedCost = parseFloat(costPrice) || 0;
    const parsedSelling = parseFloat(sellingPrice) || 0;
    const parsedQty = isService ? 0 : (trackingMode === 'Serial' ? parsedSerialNumbers.length : (parseInt(availableQty, 10) || 0));
    const parsedReorder = parseInt(reorderLevel, 10) || 0;
    const parsedConv = parseFloat(unitConversionFactor) || 1;

    let computedStatus = status;
    if (isService) {
      computedStatus = 'Optimal';
    } else if (parsedQty <= 0) {
      computedStatus = 'Critical';
    } else if (parsedQty <= parsedReorder) {
      computedStatus = 'Low Stock';
    } else {
      computedStatus = 'Optimal';
    }

    const payload = {
      sku,
      code: sku,
      name: name || (itemKind === 'Fabric'
        ? ([fabricQuality, fabricDesign, fabricColor, fabricWidth ? `${fabricWidth}"` : ''].filter(Boolean).join(' ') || 'Unnamed Fabric')
        : 'Unnamed Item'),
      itemKind,
      category,
      categoryId: activeCategoryObj?.id || undefined,
      vendor,
      description,
      lifecycleStatus: itemLifecycle,
      uom: salesUnit || uom,
      purchaseUnit,
      salesUnit,
      unitConversionFactor: parsedConv,
      // [PHASE-2A] persist weight-item configuration (Sweven steel)
      isWeightItem,
      theoreticalWeight: isWeightItem ? (parseFloat(theoreticalWeight) || 0) : undefined,
      tolerancePct: isWeightItem ? (parseFloat(tolerancePct) > 0 ? parseFloat(tolerancePct) : 2) : undefined,
      trackingMode: isService ? 'None' : trackingMode,
      serialNumbers: trackingMode === 'Serial' ? parsedSerialNumbers : [],
      batchNumber: trackingMode === 'Batch' ? batchNumber : undefined,
      lotNumber: trackingMode === 'Batch' ? lotNumber : undefined,
      manufactureDate: trackingMode === 'Batch' ? manufactureDate : undefined,
      expiryDate: trackingMode === 'Batch' ? expiryDate : undefined,
      taxRate: !isNaN(parseFloat(taxRate)) ? parseFloat(taxRate) : 5,
      tax_pct: !isNaN(parseFloat(taxRate)) ? parseFloat(taxRate) : 5,
      // [PHASE-2E.1] GST compliance codes — HSN for goods, SAC for services
      hsnCode: hsnCode.trim() || (itemKind === 'Service' ? '' : undefined),
      sacCode: sacCode.trim() || (itemKind === 'Service' ? undefined : ''),
      warrantyApplicable,
      warrantyPeriod: Number(warrantyPeriod) || 1,
      warrantyUnit,
      warrantyStartEvent,
      manufacturerWarrantyPeriod: manufacturerWarrantyPeriod ? Number(manufacturerWarrantyPeriod) : undefined,
      manufacturerWarrantyUnit: manufacturerWarrantyPeriod ? manufacturerWarrantyUnit : undefined,
      costPrice: parsedCost,
      unitCost: parsedCost,
      sellingPrice: parsedSelling,
      // availableQty / stock are never sent: stock is computed from the
      // movement ledger and changes only through documents.
      reorderLevel: parsedReorder,
      location,
      status: computedStatus,
      // Fabric spec — only persisted for Fabric items
      fabricQuality: itemKind === 'Fabric' ? fabricQuality : undefined,
      fabricDesign: itemKind === 'Fabric' ? fabricDesign : undefined,
      fabricColor: itemKind === 'Fabric' ? fabricColor : undefined,
      fabricWidth: itemKind === 'Fabric' && fabricWidth !== '' ? parseFloat(fabricWidth) : undefined,
      fabricGsm: itemKind === 'Fabric' && fabricGsm !== '' ? parseFloat(fabricGsm) : undefined,
      image: imagePreview,
      imageUrl: imagePreview,
      customFieldValues,
    };

    let targetMachineId = id;

    if (isEditMode && existingItem) {
      updateInventoryItem(existingItem.id, payload);
      targetMachineId = existingItem.id;
    }
    else {
      const created = addInventoryItem(payload);
      targetMachineId = created.id;
    }

    // If this is a machine, synchronize machine BOM relationships in ERPContext
    if (itemKind === 'Machine' && targetMachineId) {
      // Remove old stored BOM parts for this machine
      const oldParts = itemParts.filter((ip) => ip.parentItemId === targetMachineId);
      oldParts.forEach((op) => removeItemPart(op.id));

      // Save current draft parts with the permanent parentItemId
      machineBomParts.forEach((mbp) => {
        addItemPart({
          parentItemId: targetMachineId,
          partItemId: mbp.partItemId,
          requiredQty: mbp.requiredQty,
        });
      });
    }

    setSavedAlert(true);
    setTimeout(() => {
      navigate(itemKind === 'Fabric' ? '/inventory/items/fabric' : itemKind === 'Machine' ? '/inventory/items/machines' : '/inventory/items');
    }, 500);
  };

  const isConversionValid = Boolean(purchaseUnit && salesUnit && parseFloat(unitConversionFactor) > 0);

  // Filtered serial numbers for the chip list
  const filteredSerialList = useMemo(() => {
    if (!serialSearchFilter.trim()) return parsedSerialNumbers;
    const q = serialSearchFilter.toLowerCase().trim();
    return parsedSerialNumbers.filter((s) => s.toLowerCase().includes(q));
  }, [parsedSerialNumbers, serialSearchFilter]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Inventory</span>
            <ChevronRight size={14} className="text-slate-300" />
            <span>Items Master</span>
            <ChevronRight size={14} className="text-slate-300" />
            <Link
              to={itemKind === 'Fabric' ? '/inventory/items/fabric' : itemKind === 'Machine' ? '/inventory/items/machines' : '/inventory/items'}
              className="text-blue-600 hover:underline font-semibold"
            >
              {itemKind === 'Fabric' ? 'Fabric Items' : itemKind === 'Machine' ? 'Machine Master' : 'Items Master'}
            </Link>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="font-semibold text-slate-700">
              {isEditMode ? `Edit ${sku}` : `Add New ${itemKind}`}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            {itemKind === 'Machine' ? (
              <Cpu className="w-6 h-6 text-blue-600" />
            ) : itemKind === 'Fabric' ? (
              <Shirt className="w-6 h-6 text-blue-600" />
            ) : (
              <Package className="w-6 h-6 text-blue-600" />
            )}
            {isEditMode ? `Edit ${itemKind === 'Fabric' ? 'Fabric' : itemKind}: ${existingItem?.name || sku}` : itemKind === 'Fabric' ? 'Create New Fabric' : `Create New ${itemKind} SKU`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {itemKind === 'Fabric'
              ? 'Add fabric with specifications and default rate. All quantities and calculations are in Meter.'
              : 'Configure catalog item parameters, item kind, required BOM components, serial tracking, and conversion rules.'}
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <Link to={itemKind === 'Fabric' ? '/inventory/items/fabric' : itemKind === 'Machine' ? '/inventory/items/machines' : '/inventory/items'}>
            <Button variant="outline" icon={ArrowLeft}>
              Back to {itemKind === 'Fabric' ? 'Fabrics' : itemKind === 'Machine' ? 'Machines' : 'Items'}
            </Button>
          </Link>
        </div>
      </div>

      {savedAlert && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl flex items-center gap-2 text-xs font-semibold animate-pulse shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          Item, schematic image, and BOM configuration successfully saved! Redirecting...
        </div>
      )}

      {itemKind !== 'Fabric' && (
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-8">

          {/* Classification & Identity Bar */}
          <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Item Classification</span>
              <span className="text-[11px] text-slate-500">
                Textile inventory item category.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <label
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 flex items-center gap-1.5"
              >
                <input
                  type="radio"
                  name="itemKind"
                  value="Fabric"
                  checked={true}
                  readOnly
                  className="sr-only"
                />
                👕 Fabric
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Core Details */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                <Package size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">Core Specifications</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Code *
                  </label>
                  <input
                    required={isEditMode}
                    type="text"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      if (!batchPrefix || batchPrefix.startsWith('SN-')) {
                        setBatchPrefix(`SN-${e.target.value.toUpperCase()}-`);
                      }
                    }}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    placeholder={isEditMode ? '' : 'Leave blank to auto-assign'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lifecycle Status
                  </label>
                  <select
                    value={itemLifecycle}
                    onChange={(e) => setItemLifecycle(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product / Machine Name *
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  placeholder={
                    itemKind === 'Machine'
                      ? 'e.g. Endoscopy System X1 4K Master Console'
                      : 'e.g. Camera Sensor Head 4K'
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Category
                    </label>
                    <MasterSourceLink source="categories" />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.hasSubParts ? '(Machine Category)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Primary Vendor
                    </label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fabric Specifications — only for Fabric items */}
              {itemKind === 'Fabric' && (
                <div className="p-4 bg-cyan-50/60 border border-cyan-200/70 rounded-xl space-y-4 animate-in fade-in duration-150">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Shirt size={14} className="text-cyan-600" />
                    Fabric Specifications
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Fabric Quality *
                        </label>
                        <MasterSourceLink source="fabricQualities" />
                      </div>
                      <select
                        required
                        value={fabricQuality}
                        onChange={(e) => setFabricQuality(e.target.value)}
                        className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select quality…</option>
                        {renderMasterOptions(fabricMasters.qualities, fabricQuality, 'No fabric qualities yet — use + Add / Manage')}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Design
                        </label>
                        <MasterSourceLink source="designs" />
                      </div>
                      <select
                        value={fabricDesign}
                        onChange={(e) => setFabricDesign(e.target.value)}
                        className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select design…</option>
                        {renderMasterOptions(fabricMasters.designs, fabricDesign, 'No designs yet — use + Add / Manage')}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Color
                        </label>
                        <MasterSourceLink source="shades" />
                      </div>
                      <div className="relative">
                        <select
                          value={fabricColor}
                          onChange={(e) => setFabricColor(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl pl-3 pr-8 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select colour…</option>
                          {renderMasterOptions(fabricMasters.shades, fabricColor, 'No colours / shades yet — use + Add / Manage')}
                        </select>
                        <Palette size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Width (inches)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={fabricWidth}
                        onChange={(e) => setFabricWidth(e.target.value)}
                        className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        placeholder='e.g. 58'
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        GSM
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={fabricGsm}
                        onChange={(e) => setFabricGsm(e.target.value)}
                        className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="e.g. 120"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Units of Measure & Conversion Factors */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Scale size={14} className="text-blue-600" />
                    Units of Measure & Conversion
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewUnitModal(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add New Unit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-medium text-slate-600">
                        Purchase Unit
                      </label>
                      <MasterSourceLink source="uom" />
                    </div>
                    <select
                      value={purchaseUnit}
                      onChange={(e) => setPurchaseUnit(e.target.value)}
                      className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                    >
                      <option value="">Select a unit</option>
                      {purchaseUnit && !activeUnitList.some((u) => u.code === purchaseUnit) && (
                        <option value={purchaseUnit}>{purchaseUnit}</option>
                      )}
                      {activeUnitList.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.label || u.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-medium text-slate-600">
                        Sales Unit
                      </label>
                      <MasterSourceLink source="uom" />
                    </div>
                    <select
                      value={salesUnit}
                      onChange={(e) => {
                        setSalesUnit(e.target.value);
                        setUom(e.target.value);
                      }}
                      className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                    >
                      <option value="">Select a unit</option>
                      {salesUnit && !activeUnitList.some((u) => u.code === salesUnit) && (
                        <option value={salesUnit}>{salesUnit}</option>
                      )}
                      {activeUnitList.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.label || u.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Conversion Factor
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={unitConversionFactor}
                      onChange={(e) => setUnitConversionFactor(e.target.value)}
                      className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                      placeholder="1"
                    />
                  </div>
                </div>

                {isConversionValid && (
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-800">Conversion Rule: </span>
                    1 {purchaseUnit} = <strong>{unitConversionFactor}</strong> {salesUnit}
                  </div>
                )}

                {/* ── [PHASE-2A] Weight-based item toggle (Sweven steel by kg) ──
                      Raw metal (MS angles / chequered plates / HR sheets) is bought & sold by
                      weight. Enabling this makes GRN weigh every intake and flag variance
                      beyond tolerance. */}
                <div className="mt-3 border border-blue-200 rounded-xl p-3 bg-blue-50/40">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isWeightItem}
                      onChange={(e) => setIsWeightItem(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Scale size={13} className="text-blue-600" /> Weight-Based Item (bought / sold by kg)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 ml-6">
                    Steel & raw metal: intake is weighed on the weighbridge; stock & billing follow the received weight.
                  </p>
                  {isWeightItem && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 ml-6">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Theoretical Weight (kg / unit)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={theoreticalWeight}
                          onChange={(e) => setTheoreticalWeight(e.target.value)}
                          className="w-full h-8 border border-slate-300 rounded-lg px-2.5 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                          placeholder="e.g. 2.10"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Weight Tolerance (± %)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={tolerancePct}
                          onChange={(e) => setTolerancePct(e.target.value)}
                          className="w-full h-8 border border-slate-300 rounded-lg px-2.5 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                          placeholder="2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & GST Tax Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost Price (₹ per {salesUnit || 'Unit'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="45.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price (₹ per {salesUnit || 'Unit'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="129.99"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GST Tax Rate (%)
                  </label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Concessional)</option>
                    <option value="12">12% (Standard Low)</option>
                    <option value="18">18% (Standard High)</option>
                    <option value="28">28% (Luxury / High)</option>
                  </select>
                </div>
              </div>

              {/* ── [PHASE-2E.1] GST compliance: HSN code (goods) / SAC code (services) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    HSN Code (Goods) {itemKind === 'Service' && <span className="text-slate-400 font-normal">— n/a for services</span>}
                  </label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder={itemKind === 'Service' ? 'HSN not required' : 'e.g. 7216.32 (MS Angle)'}
                    disabled={itemKind === 'Service'}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Appears as the HSN column on printed tax invoices &amp; proformas.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SAC Code (Services) {itemKind !== 'Service' && <span className="text-slate-400 font-normal">— n/a for goods</span>}
                  </label>
                  <input
                    type="text"
                    value={sacCode}
                    onChange={(e) => setSacCode(e.target.value)}
                    placeholder={itemKind !== 'Service' ? 'SAC not required' : 'e.g. 998715 (fabrication service)'}
                    disabled={itemKind !== 'Service'}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-800 font-mono text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* Tracking Mode & Interactive Serial / Batch Generator */}
              <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Barcode size={15} className="text-amber-700" />
                    Inventory Tracking Mode
                  </span>
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="trackingMode"
                        value="Quantity"
                        checked={trackingMode === 'Quantity'}
                        onChange={() => setTrackingMode('Quantity')}
                        className="text-blue-600"
                      />
                      Quantity-only
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="trackingMode"
                        value="Batch"
                        checked={trackingMode === 'Batch'}
                        onChange={() => {
                          setTrackingMode('Batch');
                        }}
                        className="text-blue-600"
                      />
                      Batch Tracked
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="trackingMode"
                        value="Serial"
                        checked={trackingMode === 'Serial'}
                        onChange={() => setTrackingMode('Serial')}
                        className="text-blue-600"
                      />
                      Serial Tracked
                    </label>
                  </div>
                </div>

                {trackingMode === 'Serial' ? (
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs">
                    {/* Top Action Bar: Count badge, Auto-suggestions, and Mode Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          Serial Numbers Catalog
                        </span>
                        <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 text-[11px]">
                          {parsedSerialNumbers.length} Registered
                        </span>
                      </div>
                      <div className="flex flex-wrap lg:flex-nowrap items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSerialViewMode('chips')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${serialViewMode === 'chips'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                          Tag Chips View
                        </button>
                        <button
                          type="button"
                          onClick={() => setSerialViewMode('raw')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${serialViewMode === 'raw'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                          Bulk Textarea
                        </button>
                      </div>
                    </div>

                    {/* SMART AUTO-SUGGESTION ROW */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" /> Suggestions:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickSuggestBatch(5)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Generate and append 5 sequential serial numbers"
                      >
                        <Plus size={11} /> Suggest 5 Serials
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSuggestBatch(10)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Generate and append 10 sequential serial numbers"
                      >
                        <Plus size={11} /> Suggest 10 Serials
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchPrefix(smartPrefix);
                          setShowBatchModal(true);
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs ml-auto"
                      >
                        <Wand2 size={11} /> Auto-Generate Batch
                      </button>
                    </div>

                    {/* Single Serial Quick Add Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="relative flex-1 min-w-0 lg:min-w-auto">
                        <input
                          type="text"
                          value={singleSerialInput}
                          onChange={(e) => setSingleSerialInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSingleSerial();
                            }
                          }}
                          placeholder={`Suggested: ${nextSuggestedSerial} (press Enter to add)`}
                          className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={handleAddSingleSerial}
                        className="shrink-0"
                      >
                        Add Serial
                      </Button>
                    </div>

                    {duplicateSerialNotice && (
                      <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-1.5 font-medium">
                        <AlertTriangle size={13} className="shrink-0" />
                        {duplicateSerialNotice}
                      </div>
                    )}

                    {/* Display View: Chips or Textarea */}
                    {serialViewMode === 'chips' ? (
                      <div className="space-y-2">
                        {parsedSerialNumbers.length > 8 && (
                          <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Filter registered serials..."
                              value={serialSearchFilter}
                              onChange={(e) => setSerialSearchFilter(e.target.value)}
                              className="w-full pl-7 pr-3 py-1 text-[11px] border border-slate-200 rounded-lg bg-slate-50"
                            />
                          </div>
                        )}

                        {parsedSerialNumbers.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <Barcode className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                            <p className="text-xs font-semibold text-slate-600">No serial numbers registered yet.</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Click <strong>&quot;Suggest 5 Serials&quot;</strong> or type a custom serial number above.
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto p-2 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-wrap gap-1.5">
                            {filteredSerialList.map((sn, idx) => (
                              <span
                                key={sn}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-mono font-bold shadow-2xs hover:border-slate-300 transition"
                              >
                                <span className="text-[10px] text-slate-400 font-sans font-normal">#{idx + 1}</span>
                                <span>{sn}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSerial(sn)}
                                  className="text-slate-400 hover:text-rose-600 transition p-0.5 cursor-pointer"
                                  title="Remove this serial number"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <textarea
                          rows={4}
                          value={serialNumbersText}
                          onChange={(e) => setSerialNumbersText(e.target.value)}
                          placeholder="Enter 1 serial number per line..."
                          className="w-full border border-slate-200 rounded-xl p-2.5 font-mono text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    )}

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex flex-wrap lg:flex-nowrap justify-between items-center gap-x-3 lg:gap-x-0 gap-y-1 lg:gap-y-0">
                      <span className="text-slate-600 font-medium">Available Stock (Derived from Serials):</span>
                      <span className="font-mono font-bold text-blue-700 text-sm">
                        {parsedSerialNumbers.length} {salesUnit || 'Unit'}
                      </span>
                    </div>
                  </div>
                ) : trackingMode === 'Batch' ? (
                  <div className="space-y-4 bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs">
                    <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800">
                        Batch / Lot Tracking Parameters
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Lot numbers are allocated by the server on receipt when left blank.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Batch / Lot Number *
                        </label>
                        <input
                          type="text"
                          value={batchNumber}
                          onChange={(e) => setBatchNumber(e.target.value)}
                          placeholder="e.g. LOT-202609-001"
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Sub-Lot / Release Code (Optional)
                        </label>
                        <input
                          type="text"
                          value={lotNumber}
                          onChange={(e) => setLotNumber(e.target.value)}
                          placeholder="e.g. SUB-A1"
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Manufacturing Date
                        </label>
                        <input
                          type="date"
                          value={manufactureDate}
                          onChange={(e) => setManufactureDate(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Expiry / Recertification Date
                        </label>
                        <input
                          type="date"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Available Stock ({salesUnit || 'Unit'})
                        </label>
                        <input
                          type="number"
                          readOnly
                          value={availableQty}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-600 font-mono text-xs cursor-not-allowed"
                          placeholder="0"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Stock is maintained through documents (GRN, Job Work, Dispatch, etc.).</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Safety Reorder Level ({salesUnit || 'Unit'})
                        </label>
                        <input
                          type="number"
                          value={reorderLevel}
                          onChange={(e) => setReorderLevel(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                          placeholder="15"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Available Stock ({salesUnit || 'Unit'})
                      </label>
                      <input
                        type="number"
                        readOnly
                        value={availableQty}
                        className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-600 font-mono text-xs cursor-not-allowed"
                        placeholder="0"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Stock is maintained through documents (GRN, Job Work, Dispatch, etc.).</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Safety Reorder Level ({salesUnit || 'Unit'})
                      </label>
                      <input
                        type="number"
                        value={reorderLevel}
                        onChange={(e) => setReorderLevel(e.target.value)}
                        className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600"
                        placeholder="15"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Default Warranty Policy Section */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-3.5">
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-2 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2 min-w-0 lg:min-w-auto">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Default Warranty Configuration</h4>
                      <p className="text-[11px] text-slate-500">Standard warranty terms applied to physical serials and tracked internally</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={warrantyApplicable}
                      onChange={(e) => setWarrantyApplicable(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-2 text-xs font-semibold text-slate-700">
                      {warrantyApplicable ? 'Warranty Applicable' : 'No Warranty'}
                    </span>
                  </label>
                </div>

                {warrantyApplicable ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Company Warranty Period *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={warrantyPeriod}
                          onChange={(e) => setWarrantyPeriod(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-600"
                          placeholder="e.g. 5"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Warranty Unit
                        </label>
                        <select
                          value={warrantyUnit}
                          onChange={(e) => setWarrantyUnit(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-emerald-600"
                        >
                          <option value="Years">Years</option>
                          <option value="Months">Months</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Warranty Start Event *
                        </label>
                        <select
                          value={warrantyStartEvent}
                          onChange={(e) => setWarrantyStartEvent(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-emerald-600"
                        >
                          <option value="Delivery">Delivery (Default — Delivery Challan date)</option>
                          <option value="Invoice">Invoice (Final Invoice date)</option>
                          <option value="Manual Date">Manual Date (Custom specified)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-emerald-100">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Manufacturer Warranty Period (Optional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={manufacturerWarrantyPeriod}
                          onChange={(e) => setManufacturerWarrantyPeriod(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-600"
                          placeholder="e.g. 10 (OEM coverage)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Manufacturer Warranty Unit
                        </label>
                        <select
                          value={manufacturerWarrantyUnit}
                          onChange={(e) => setManufacturerWarrantyUnit(e.target.value)}
                          className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-emerald-600"
                        >
                          <option value="Years">Years</option>
                          <option value="Months">Months</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-[11px] text-emerald-800 bg-emerald-100/50 p-2 rounded-lg border border-emerald-200">
                      💡 <strong>Standard Warranty Policy:</strong> Default warranty duration and terms are automatically referenced across delivery dispatches without repetitive data entry.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    No warranty policy configured for this SKU. Toggle above if this item includes standard equipment warranty.
                  </p>
                )}
              </div>

              <div>
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-2 lg:gap-x-0 mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Default Warehouse & Storage Location
                  </label>
                  <Link
                    to="/inventory/locations"
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                  >
                    Manage Locations
                  </Link>
                </div>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer"
                  >
                    <option value="">-- Select Warehouse Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id || loc.code} value={loc.name}>
                        {loc.name} ({loc.code}) {loc.type ? `— ${loc.type}` : ''}
                      </option>
                    ))}
                    {/* Preserve custom legacy location if not matched */}
                    {location && !locations.some((l) => l.name === location) && (
                      <option value={location}>{location} (Custom Location)</option>
                    )}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Right Column: Media & Description */}
            <div className="space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                  <Layers size={18} className="text-blue-600" />
                  <h3 className="text-base font-bold text-slate-800">Description & Schematic Media</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Technical Summary & Specifications
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 resize-none"
                    placeholder="Enter detailed technical narrative and specifications..."
                  />
                </div>

                {/* WORKING PRODUCT SCHEMATIC / IMAGE UPLOAD */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Product Schematic / Image
                    </label>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-[11px] text-rose-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove Image
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    accept="image/*"
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="border border-slate-200 rounded-2xl p-3 sm:p-4 bg-slate-50 flex items-center gap-3 sm:gap-4">
                      <img
                        src={imagePreview}
                        alt="Product Schematic Preview"
                        className="w-24 h-24 rounded-xl object-contain bg-white border border-slate-200 shadow-sm shrink-0"
                      />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                          <Check size={14} className="text-emerald-600 shrink-0" /> Image Attached
                        </p>
                        <p className="text-[11px] text-slate-500">
                          High-resolution product schematic attached and ready for catalog display.
                        </p>
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer shadow-2xs"
                          >
                            Change File
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleDropFile}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer text-center ${isDraggingFile
                          ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                          : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/70 hover:border-blue-400'
                        }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 shadow-2xs">
                        <UploadCloud size={24} className="group-hover:scale-110 transition-transform" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        Drop high-resolution diagram or <span className="text-blue-600 underline">click to browse</span>
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1">
                        Supports PNG, JPG, JPEG, WEBP or SVG up to 10MB
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2 mt-4">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Gross Margin per {salesUnit || 'Unit'}:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    ₹{(parseFloat(sellingPrice || '0') - parseFloat(costPrice || '0')).toFixed(2)} (
                    {(
                      ((parseFloat(sellingPrice || '0') - parseFloat(costPrice || '0')) /
                        (parseFloat(sellingPrice || '1') || 1)) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Estimated Total Asset Value:</span>
                  <span className="font-mono font-bold text-slate-800">
                    ₹
                    {(
                      parseFloat(costPrice || '0') * (parseInt(availableQty, 10) || 0)
                    ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CRITICAL SECTION: REQUIRED PARTS / MACHINE BOM (Visible whenever itemKind === 'Machine') */}
          {itemKind === 'Machine' && (
            <div className="bg-blue-50/30 border-2 border-blue-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-200/80">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-blue-600" />
                    Required Parts / Machine BOM
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                    Select required Stock inventory items to configure the bill of materials for ONE unit of this Machine before saving.
                    When this machine is added to quotes or invoices, these parts will auto-populate as editable line items.
                  </p>
                </div>
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
                  {categoryParts.some((cp) => cp.categoryId === activeCategoryObj?.id || cp.categoryId === activeCategoryObj?.name) && (
                    <button
                      type="button"
                      onClick={() => {
                        const catBoms = getPartsForCategory(category);
                        if (catBoms.length > 0) {
                          setMachineBomParts(catBoms);
                        }
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title={`Reload default BOM parts template from category: ${category}`}
                    >
                      <RefreshCw size={12} /> Sync Category Template
                    </button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    icon={Plus}
                    size="sm"
                    onClick={() => {
                      setSelectedPickerItem(null);
                      setPickerRequiredQty(1);
                      setPartPickerSearch('');
                      setIsAddPartModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
                  >
                    Add Component
                  </Button>
                </div>
              </div>

              {machineBomParts.length === 0 ? (
                <div className="py-10 text-center bg-white rounded-xl border border-dashed border-blue-300">
                  <Boxes className="w-10 h-10 mx-auto text-blue-300 mb-2" />
                  <p className="text-xs font-bold text-slate-800">No BOM parts assigned to this machine yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                    Click <strong className="text-blue-600">&quot;+ Add Component&quot;</strong> above to select existing components from your warehouse stock before registering this Machine.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200/80">
                      <tr>
                        <th className="p-3">Component / Stock Item</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 w-40 text-center">Required Qty (per 1 Machine)</th>
                        <th className="p-3 w-36 text-center">Live Available Stock</th>
                        <th className="p-3 w-20 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {machineBomParts.map((mbp) => {
                        const stockItem = items.find((i) => i.id === mbp.partItemId);
                        const available = stockItem?.availableQty ?? stockItem?.stock ?? 0;
                        const isShortage = available < mbp.requiredQty;

                        return (
                          <tr key={mbp.id || mbp.partItemId} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-800">
                                {stockItem?.name || `Item ID #${mbp.partItemId}`}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                SKU: {stockItem?.sku || '—'}
                              </div>
                            </td>
                            <td className="p-3 text-slate-600 font-medium">
                              {stockItem?.category || 'General Stock'}
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  value={mbp.requiredQty}
                                  onChange={(e) => handleUpdateBomPartQty(mbp.partItemId, e.target.value)}
                                  className="w-20 text-center font-mono font-bold text-xs border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                                />
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {stockItem?.salesUnit || stockItem?.uom || 'Unit'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono">
                              <span
                                className={`font-bold px-2.5 py-1 rounded-full text-[11px] border ${isShortage
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                              >
                                {available} {stockItem?.salesUnit || stockItem?.uom || 'Unit'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveBomPart(mbp.partItemId)}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 flex items-center justify-center transition cursor-pointer mx-auto shadow-2xs"
                                title="Remove Part from BOM"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Technical Specifications Section (Keep button to select/show, otherwise keep hidden) */}
          {!showCustomParameters ? (
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCustomParameters(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition cursor-pointer group shadow-2xs"
              >
                <Sliders size={15} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span>+ Add / Configure Custom Parameters for {category || 'Item'}</span>
                {categoryCustomFields.length > 0 && (
                  <span className="text-[10px] bg-blue-100/80 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    {categoryCustomFields.length} field{categoryCustomFields.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Sliders size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      Custom Technical Parameters: {category}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Optional specialized specifications for this category catalog.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewFieldModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50"
                  >
                    <Plus size={13} /> Add Field
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomParameters(false)}
                    className="text-xs text-slate-500 hover:text-rose-600 font-semibold px-2.5 py-1 bg-white border border-slate-200 hover:border-rose-200 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 transition"
                    title="Hide custom parameters section"
                  >
                    <X size={13} /> Hide Section
                  </button>
                </div>
              </div>

              {categoryCustomFields.length === 0 ? (
                <div className="text-center py-5 bg-white border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500">
                    No custom attributes configured for <strong>{category}</strong> yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewFieldModal(true)}
                    className="text-xs text-blue-600 hover:underline font-semibold inline-block mt-1 cursor-pointer"
                  >
                    Click here to attach a custom field.
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {categoryCustomFields.map((field) => {
                    const fieldKey = field.id || String(field.name ?? '').toLowerCase().replace(/\s+/g, '_');
                    const val = customFieldValues[fieldKey] ?? customFieldValues[field.name] ?? '';

                    if ((field.type === 'dropdown' || field.type === 'select') && field.options && field.options.length > 0) {
                      return (
                        <div key={field.id || field.name}>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {field.name}
                          </label>
                          <select
                            value={val}
                            onChange={(e) => handleCustomFieldChange(fieldKey, e.target.value)}
                            className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                          >
                            <option value="">-- Select {field.name} --</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (field.type === 'boolean') {
                      return (
                        <div key={field.id || field.name} className="flex items-center gap-2 pt-5">
                          <input
                            type="checkbox"
                            id={fieldKey}
                            checked={Boolean(val)}
                            onChange={(e) => handleCustomFieldChange(fieldKey, e.target.checked)}
                            className="rounded text-blue-600 h-4 w-4"
                          >
                          </input>
                          <label htmlFor={fieldKey} className="text-xs font-semibold text-slate-700 cursor-pointer">
                            {field.name}
                          </label>
                        </div>
                      );
                    }

                    if (field.type === 'number') {
                      return (
                        <div key={field.id || field.name}>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {field.name}
                          </label>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => handleCustomFieldChange(fieldKey, e.target.value)}
                            className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                            placeholder={`Enter ${field.name}`}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={field.id || field.name}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {field.name}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleCustomFieldChange(fieldKey, e.target.value)}
                          className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                          placeholder={`Enter ${field.name}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(itemKind === 'Fabric' ? '/inventory/items/fabric' : itemKind === 'Machine' ? '/inventory/items/machines' : '/inventory/items')}
            >
              Cancel
            </Button>
            <Button type="submit" icon={Save}>
              {isEditMode ? `Update ${itemKind} SKU` : `Save & Register ${itemKind}`}
            </Button>
          </div>
        </form>
      </div>
      )}

      {/* ── Fabric-specific creation/edit layout ── */}
      {itemKind === 'Fabric' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Item Classification */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Sliders size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Item Classification</h3>
                <p className="text-xs text-slate-500">Select item type for proper categorying.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'Fabric', label: 'Fabric', icon: Shirt },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <label
                    key={t.value}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs flex items-center gap-1.5 bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20"
                  >
                    <input
                      type="radio"
                      name="itemKind"
                      value={t.value}
                      checked={true}
                      readOnly
                      className="sr-only"
                    />
                    <Icon size={14} /> {t.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Two-column grid: Basic Details + Fabric Image */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ImageIcon size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Basic Details</h3>
                  <p className="text-xs text-slate-500">Enter the main details of the fabric.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fabric Code <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">Auto Generate</span>
                </label>
                <input
                  readOnly
                  value={sku || 'Auto (e.g. FAB-001)'}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-500 text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Code will be generated automatically after save.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Fabric Quality <span className="text-rose-500">*</span></label>
                    <MasterSourceLink source="fabricQualities" />
                  </div>
                  <select
                    required
                    value={fabricQuality}
                    onChange={(e) => setFabricQuality(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select fabric quality</option>
                    {renderMasterOptions(fabricMasters.qualities, fabricQuality, 'No fabric qualities yet — use + Add / Manage')}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Design</label>
                    <MasterSourceLink source="designs" />
                  </div>
                  <select
                    value={fabricDesign}
                    onChange={(e) => setFabricDesign(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select design</option>
                    {renderMasterOptions(fabricMasters.designs, fabricDesign, 'No designs yet — use + Add / Manage')}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Colour</label>
                    <MasterSourceLink source="shades" />
                  </div>
                  <select
                    value={fabricColor}
                    onChange={(e) => setFabricColor(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select colour</option>
                    {renderMasterOptions(fabricMasters.shades, fabricColor, 'No colours / shades yet — use + Add / Manage')}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Width (inches)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={fabricWidth}
                    onChange={(e) => setFabricWidth(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. 58, 60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSM</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={fabricGsm}
                    onChange={(e) => setFabricGsm(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. 120"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <UploadCloud size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Fabric Image</h3>
                  <p className="text-xs text-slate-500">Upload fabric photo(s) (optional).</p>
                </div>
              </div>
              {imagePreview ? (
                <div className="relative border border-slate-200 rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="Fabric" className="w-full h-40 object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center shadow-sm"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDropFile}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDraggingFile ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/70 hover:border-blue-400'}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                    <UploadCloud size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    <span className="text-blue-600">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, JPEG, WEBP up to 15MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
              />
            </div>
          </div>

          {/* Two-column grid: Unit & Pricing + Additional Codes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Scale size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Unit &amp; Pricing</h3>
                  <p className="text-xs text-slate-500">Unit is fixed as Meter. Set the default rate for this fabric.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UOM</label>
                  <div className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-slate-50 text-slate-600 text-xs flex items-center justify-between">
                    <span className="font-semibold">Meter</span>
                    <Lock size={13} className="text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Rate (₹ per Meter) <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => { setCostPrice(e.target.value); setSellingPrice(e.target.value); }}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. 50.00"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 bg-blue-50/70 border border-blue-100 text-blue-700 rounded-xl p-3 text-xs">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>UOM is fixed as <strong>Meter</strong>. All calculations (purchase, production, dying, stock, costing, sales) will be in Meter.</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Barcode size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Additional Codes <span className="text-slate-400 font-normal text-xs">(Optional)</span></h3>
                  <p className="text-xs text-slate-500">Enter standard codes if required.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">HSN Code (Goods)</label>
                <input
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="e.g. 5208"
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SAC Code (Services)</label>
                <input
                  value={sacCode}
                  onChange={(e) => setSacCode(e.target.value)}
                  placeholder="e.g. 998599"
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Two-column grid: Inventory Settings + Stock Tracking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Boxes size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Inventory Settings</h3>
                  <p className="text-xs text-slate-500">Set the fabric's status and stock tracking levels.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Status</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lifecycle"
                      checked={itemLifecycle === 'Active'}
                      onChange={() => setItemLifecycle('Active')}
                      className="text-emerald-600 h-4 w-4"
                    />
                    <span className={`text-xs font-bold ${itemLifecycle === 'Active' ? 'text-emerald-600' : 'text-slate-500'}`}>Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lifecycle"
                      checked={itemLifecycle === 'Inactive'}
                      onChange={() => setItemLifecycle('Inactive')}
                      className="text-slate-400 h-4 w-4"
                    />
                    <span className={`text-xs font-bold ${itemLifecycle === 'Inactive' ? 'text-slate-700' : 'text-slate-500'}`}>Inactive</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Package size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-800">Stock Tracking <span className="text-amber-600 font-normal text-xs">(Optional)</span></h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Available Stock (Meter)</label>
                  <input
                    type="number"
                    min="0"
                    readOnly
                    value={availableQty}
                    className="w-full h-10 border border-amber-200 rounded-xl px-3 bg-amber-50/50 text-slate-600 text-xs cursor-not-allowed"
                    placeholder="0"
                  />
                  <p className="text-[11px] text-amber-700 mt-1">Stock is maintained through documents (GRN, Job Work, Dispatch, etc.).</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Safety Reorder Level (Meter)</label>
                  <input
                    type="number"
                    min="0"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full h-10 border border-amber-200 rounded-xl px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-amber-400"
                    placeholder="e.g. 0.0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Custom Technical Parameters */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Custom Technical Parameters: Fabric</h3>
                  <p className="text-xs text-slate-500">Add additional specifications as per your requirement.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCustomParameters(true); setShowNewFieldModal(true); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 bg-white border border-blue-200 hover:border-blue-300 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 transition"
                >
                  <Plus size={13} /> Add Field
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomParameters(false)}
                  className="text-xs text-slate-500 hover:text-rose-600 font-semibold px-2.5 py-1 bg-white border border-slate-200 hover:border-rose-200 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 transition"
                >
                  <X size={13} /> Hide Section
                </button>
              </div>
            </div>

            {fabricCustomFields.length === 0 ? (
              <div className="text-center py-5 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500">
                  No custom attributes configured for <strong>Fabric</strong> yet.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewFieldModal(true)}
                  className="text-xs text-blue-600 hover:underline font-semibold inline-block mt-1 cursor-pointer"
                >
                  Click here to add a custom field.
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {fabricCustomFields.map((field) => {
                  const fieldKey = field.id || String(field.name ?? '').toLowerCase().replace(/\s+/g, '_');
                  const val = customFieldValues[fieldKey] ?? customFieldValues[field.name] ?? '';
                  return (
                    <div key={field.id || field.name}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">{field.name}</label>
                      {field.type === 'dropdown' || field.type === 'select' ? (
                        <select
                          value={val}
                          onChange={(e) => handleCustomFieldChange(fieldKey, e.target.value)}
                          className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                        >
                          <option value="">-- Select {field.name} --</option>
                          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : field.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleCustomFieldChange(fieldKey, e.target.checked)}
                          className="rounded text-blue-600 h-4 w-4 mt-2"
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={val}
                          onChange={(e) => handleCustomFieldChange(fieldKey, e.target.value)}
                          placeholder={`Enter ${field.name}`}
                          className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description / Remarks */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Description / Remarks <span className="text-slate-400 font-normal text-xs">(Optional)</span></h3>
                <p className="text-xs text-slate-500">Add any additional information about this fabric.</p>
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Fabric composition, GSM, usage, supplier notes, etc."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pb-2">
            <button
              type="button"
              onClick={() => navigate('/inventory/items/fabric')}
              className="px-4 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Check size={15} /> {isEditMode ? 'Update Fabric' : 'Save Fabric'}
            </button>
          </div>
        </form>
      )}

      {/* Component Picker Modal for Machine BOM */}
      {isAddPartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between gap-2 lg:gap-0 border-b border-slate-100 pb-3">
              <div className="min-w-0 lg:min-w-auto">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <Boxes className="text-blue-600" size={18} /> Select Component for Machine BOM
                </h3>
                <p className="text-xs text-slate-500">
                  Pick an existing component or standalone stock item from warehouse inventory.
                </p>
              </div>
              <button
                onClick={() => setIsAddPartModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search component name or SKU..."
                  value={partPickerSearch}
                  onChange={(e) => setPartPickerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <select
                  value={partPickerCategory}
                  onChange={(e) => setPartPickerCategory(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:bg-white focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of items */}
            <div className="overflow-y-auto max-h-64 border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              {availableStockItemsForPicker.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                  <p className="font-semibold text-slate-600">No matching components found.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Only non-machine inventory can be selected.</p>
                </div>
              ) : (
                availableStockItemsForPicker.map((it) => {
                  const isSelected = selectedPickerItem?.id === it.id;
                  const isAlreadyAdded = machineBomParts.some((p) => p.partItemId === it.id);

                  return (
                    <div
                      key={it.id}
                      onClick={() => {
                        setSelectedPickerItem(it);
                        const existingPart = machineBomParts.find((p) => p.partItemId === it.id);
                        if (existingPart) {
                          setPickerRequiredQty(existingPart.requiredQty);
                        } else {
                          setPickerRequiredQty(1);
                        }
                      }}
                      className={`p-3.5 flex items-center justify-between gap-3 lg:gap-0 cursor-pointer transition-colors ${isSelected
                          ? 'bg-blue-50/80 border-l-4 border-blue-600'
                          : 'hover:bg-slate-50'
                        }`}
                    >
                      <div className="min-w-0 lg:min-w-auto">
                        <div className="font-bold text-slate-800 flex flex-wrap lg:flex-nowrap items-center gap-2">
                          <span>{it.name}</span>
                          {isAlreadyAdded && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                              In BOM
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap lg:flex-nowrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="font-mono font-medium">{it.sku}</span>
                          <span>•</span>
                          <span>{it.category}</span>
                          <span>•</span>
                          <span>Cost: ₹{it.costPrice ?? it.unitCost ?? 0}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono shrink-0 lg:shrink">
                        <span className="text-xs font-bold text-slate-800">
                          {it.availableQty ?? it.stock ?? 0} {it.salesUnit || it.uom || 'Unit'}
                        </span>
                        <div className="text-[10px] text-slate-400">Available Stock</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Already in BOM notice */}
            {isSelectedAlreadyInBom && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                <Info size={14} className="shrink-0 text-blue-600" />
                <span>
                  This item is already in the BOM. Modifying quantity below will update the existing BOM row.
                </span>
              </div>
            )}

            {/* Quantity and Submit */}
            <form onSubmit={handleAddPartToBom} className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 text-xs">
                <label className="font-semibold text-slate-700">Required Qty per Machine:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={pickerRequiredQty}
                  onChange={(e) => setPickerRequiredQty(e.target.value)}
                  className="w-20 border border-slate-200 rounded-lg p-1.5 font-mono text-center text-xs font-bold focus:outline-none focus:border-blue-600"
                />
                <span className="text-slate-500 font-medium text-xs">
                  {selectedPickerItem?.salesUnit || selectedPickerItem?.uom || 'Unit'}
                </span>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddPartModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedPickerItem}
                >
                  {isSelectedAlreadyInBom ? 'Update BOM Part' : 'Add Part to BOM'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Serial Batch Generator Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Wand2 size={18} className="text-blue-600" /> Auto-Generate Serial Numbers Batch
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteBatchGenerator} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Serial Prefix (e.g. Model / SKU identifier)
                </label>
                <input
                  type="text"
                  required
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  placeholder="e.g. SN-ENDO-X1- or SN-MACH-2026-"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start #</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchStartNum}
                    onChange={(e) => setBatchStartNum(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Count (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Padding Digits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    required
                    value={batchPadding}
                    onChange={(e) => setBatchPadding(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono text-xs text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Suffix / Batch Tag (Optional)
                </label>
                <input
                  type="text"
                  value={batchSuffix}
                  onChange={(e) => setBatchSuffix(e.target.value)}
                  placeholder="e.g. -2026, -M1, -IN"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono text-xs text-slate-800"
                />
              </div>

              {/* Live Preview */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Generation Sample Preview:
                </span>
                <p className="font-mono text-xs text-slate-800 font-semibold">
                  {batchPrefix || 'SN-ITEM-'}
                  {String(Number(batchStartNum) || 1).padStart(Number(batchPadding) || 3, '0')}
                  {batchSuffix}
                  {' ... '}
                  {batchPrefix || 'SN-ITEM-'}
                  {String((Number(batchStartNum) || 1) + Math.max(1, Number(batchCount) || 1) - 1).padStart(
                    Number(batchPadding) || 3,
                    '0'
                  )}
                  {batchSuffix}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" icon={Sparkles}>
                  Append {batchCount || 5} Serials
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Unit Create Modal */}
      {showNewUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-4 sm:p-5 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Scale size={16} className="text-blue-600" /> Add Unit of Measure
              </h3>
              <button
                onClick={() => setShowNewUnitModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Unit Code / Symbol</label>
                <input
                  required
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  placeholder="e.g. BDL, REEL, CTN"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono uppercase text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Unit Label</label>
                <input
                  required
                  value={newUnitLabel}
                  onChange={(e) => setNewUnitLabel(e.target.value)}
                  placeholder="e.g. Bundle (BDL), Carton (CTN)"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewUnitModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" icon={Plus}>
                  Save Unit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Add Field Modal */}
      {showNewFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-5 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Sliders size={16} className="text-blue-600" /> Add Custom Parameter for {itemKind === 'Fabric' ? (activeFabricCategoryObj?.name || 'Fabric') : category}
              </h3>
              <button
                onClick={() => setShowNewFieldModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomFieldInline} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Parameter Label *</label>
                <input
                  required
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g. Laser Wavelength (nm), Sensor Resolution"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Field Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs"
                >
                  <option value="text">Text (String)</option>
                  <option value="number">Numeric</option>
                  <option value="dropdown">Dropdown Selection</option>
                  <option value="boolean">Checkbox (Yes/No)</option>
                </select>
              </div>

              {newFieldType === 'dropdown' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Options (comma-separated)</label>
                  <input
                    required
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="e.g. 532nm, 1064nm, 2940nm"
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewFieldModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" icon={Plus}>
                  Attach Field
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
