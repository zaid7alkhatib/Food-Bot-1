import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  QrCode, 
  Calendar, 
  Users, 
  Edit2, 
  Check, 
  X, 
  Clock, 
  PlusCircle, 
  Printer, 
  ChevronRight, 
  CheckCircle,
  HelpCircle,
  FileText
} from "lucide-react";
import { Table, Reservation, Order } from "../types";
import { useI18n } from "../i18n";

interface ReservationFloorPlanProps {
  branchId: string;
  tables: Table[];
  reservations: Reservation[];
  orders: Order[];
  authHeaders: () => Record<string, string>;
  branch: any;
}

export default function ReservationFloorPlan({
  branchId,
  tables = [],
  reservations = [],
  orders = [],
  authHeaders,
  branch,
}: ReservationFloorPlanProps) {
  const { t, language } = useI18n();

  // Floor plan modes
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  
  // Modals / Overlays
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showAddReservationModal, setShowAddReservationModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<Table | null>(null);

  // New Table Form State
  const [newTableNum, setNewTableNum] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableShape, setNewTableShape] = useState<"square" | "round" | "rectangle">("square");
  const [newTableSection, setNewTableSection] = useState("Main Hall");

  // New Reservation Form State
  const [newResvName, setNewResvName] = useState("");
  const [newResvPhone, setNewResvPhone] = useState("");
  const [newResvGuests, setNewResvGuests] = useState(2);
  const [newResvDateTime, setNewResvDateTime] = useState("");
  const [newResvNotes, setNewResvNotes] = useState("");
  const [newResvTableId, setNewResvTableId] = useState("");

  // Search/Filters
  const [resvFilter, setResvFilter] = useState<"all" | "pending" | "confirmed" | "seated" | "completed" | "cancelled">("all");
  const [resvSearch, setResvSearch] = useState("");

  // Dragging states
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Error/Success Notification
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const triggerAlert = (type: "error" | "success", msg: string) => {
    if (type === "error") {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // Helper to determine active order at table
  const getActiveOrderForTable = (tableNumber: string) => {
    return orders.find(
      (o) =>
        o.orderType === "dine_in" &&
        o.tableNumber === tableNumber &&
        !["delivered", "cancelled"].includes(o.status)
    );
  };

  // Helper to determine upcoming reservation (next 45 minutes)
  const getUpcomingReservationForTable = (tableId: string) => {
    const now = new Date();
    const fortyFiveMinutesLater = new Date(now.getTime() + 45 * 60 * 1000);

    return reservations.find((r) => {
      if (r.tableId !== tableId || ["cancelled", "completed"].includes(r.status)) return false;
      const resvTime = new Date(r.dateTime);
      return resvTime >= now && resvTime <= fortyFiveMinutesLater;
    });
  };

  // Helper to determine current seated reservation
  const getSeatedReservationForTable = (tableId: string) => {
    return reservations.find(
      (r) => r.tableId === tableId && r.status === "seated"
    );
  };

  // Determine Table Color Status
  const getTableStatus = (table: Table) => {
    const activeOrder = getActiveOrderForTable(table.number);
    const seatedResv = getSeatedReservationForTable(table.id);
    
    // Busy: Red (Active Dine-In Order OR Reservation is seated)
    if (activeOrder || seatedResv) {
      return "busy";
    }

    // Reserved: Amber (Upcoming booking in next 45 mins)
    const upcoming = getUpcomingReservationForTable(table.id);
    if (upcoming) {
      return "reserved";
    }

    // Free: Green
    return "free";
  };

  // Drag and Drop Table Handlers
  const handleTableMouseDown = (e: React.MouseEvent, table: Table) => {
    if (!isEditMode) return;
    e.preventDefault();
    setDraggingTableId(table.id);

    // Calculate mouse click offset relative to table element's top-left corner
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingTableId || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    // Convert pixels to relative percentages (0 to 100)
    let percentX = Math.round(((mouseX - dragOffset.x) / canvasRect.width) * 100);
    let percentY = Math.round(((mouseY - dragOffset.y) / canvasRect.height) * 100);

    // Bound coordinates
    percentX = Math.max(0, Math.min(percentX, 90));
    percentY = Math.max(0, Math.min(percentY, 90));

    // Update in UI state instantly (optimistic update)
    const tableIndex = tables.findIndex((t) => t.id === draggingTableId);
    if (tableIndex > -1) {
      tables[tableIndex].posX = percentX;
      tables[tableIndex].posY = percentY;
    }
  };

  const handleCanvasMouseUp = async () => {
    if (!draggingTableId) return;

    const draggedTable = tables.find((t) => t.id === draggingTableId);
    setDraggingTableId(null);

    if (draggedTable) {
      try {
        const bodyPayload = {
          id: draggedTable.id,
          branchId: branchId,
          number: draggedTable.number,
          capacity: draggedTable.capacity,
          shape: draggedTable.shape,
          posX: draggedTable.posX,
          posY: draggedTable.posY,
          section: draggedTable.section,
          isActive: draggedTable.isActive,
        };

        const res = await fetch("/api/tables", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          throw new Error("Failed to save table drag position");
        }
      } catch (err: any) {
        triggerAlert("error", err.message || "Failed to update table location");
      }
    }
  };

  // Save/Create Table
  const handleAddTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;

    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          branchId,
          number: newTableNum,
          capacity: newTableCapacity,
          shape: newTableShape,
          section: newTableSection,
          posX: 15,
          posY: 15,
        }),
      });

      if (res.ok) {
        triggerAlert("success", "Table created successfully");
        setShowAddTableModal(false);
        setNewTableNum("");
        setNewTableCapacity(4);
        setNewTableShape("square");
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to save table");
      }
    } catch (err: any) {
      triggerAlert("error", err.message);
    }
  };

  // Delete Table
  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm("Are you sure you want to delete this table?")) return;

    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (res.ok) {
        triggerAlert("success", "Table removed");
        setSelectedTable(null);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete table");
      }
    } catch (err: any) {
      triggerAlert("error", err.message);
    }
  };

  // Submit Manual Reservation
  const handleAddReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResvName.trim() || !newResvPhone.trim() || !newResvDateTime) {
      triggerAlert("error", "Name, Phone, and Date/Time are required");
      return;
    }

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          branchId,
          customerName: newResvName,
          whatsAppPhone: newResvPhone,
          guestCount: newResvGuests,
          dateTime: newResvDateTime,
          tableId: newResvTableId || undefined,
          notes: newResvNotes,
        }),
      });

      if (res.ok) {
        triggerAlert("success", "Manual reservation created");
        setShowAddReservationModal(false);
        setNewResvName("");
        setNewResvPhone("");
        setNewResvGuests(2);
        setNewResvDateTime("");
        setNewResvNotes("");
        setNewResvTableId("");
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to confirm booking");
      }
    } catch (err: any) {
      triggerAlert("error", err.message);
    }
  };

  // Update Reservation Status
  const handleUpdateReservationStatus = async (id: string, newStatus: string, tableId?: string) => {
    try {
      const payload: any = { status: newStatus };
      if (tableId !== undefined) {
        payload.tableId = tableId;
      }

      const res = await fetch(`/api/reservations/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        triggerAlert("success", `Reservation status updated to ${newStatus}`);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to update reservation");
      }
    } catch (err: any) {
      triggerAlert("error", err.message);
    }
  };

  // Print QR Code
  const handlePrintQr = (table: Table) => {
    const origin = window.location.origin;
    const dataUrl = `${origin}/menu?branchId=${branchId}&table=${table.number}`;
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dataUrl)}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - Table ${table.number}</title>
          <style>
            body {
              font-family: 'Outfit', 'Inter', sans-serif;
              text-align: center;
              padding: 40px;
              color: #1a1a1a;
            }
            .container {
              border: 3px double #e2e8f0;
              border-radius: 20px;
              padding: 30px;
              max-width: 320px;
              margin: 0 auto;
              background: #fff;
            }
            .logo {
              font-size: 20px;
              font-weight: 800;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 1.5px;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              margin: 10px 0;
            }
            .subtitle {
              font-size: 13px;
              color: #718096;
              margin-bottom: 25px;
            }
            .qr-wrapper {
              margin: 20px 0;
            }
            .qr-image {
              width: 180px;
              height: 180px;
            }
            .footer {
              font-size: 11px;
              color: #a0aec0;
              margin-top: 25px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">${branch?.restaurantName || "Restaurant"}</div>
            <div class="title">Tisch / Table ${table.number}</div>
            <div class="subtitle">Scannen zum Bestellen & Bezahlen<br/>Scan to Order & Pay</div>
            <div class="qr-wrapper">
              <img class="qr-image" src="${qrImage}" alt="QR" />
            </div>
            <div class="footer">Powered by Mr. Tabboush Whatsapp System</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter & Search reservations
  const filteredReservations = reservations.filter((r) => {
    const matchesFilter = resvFilter === "all" || r.status === resvFilter;
    const matchesSearch =
      r.customerName.toLowerCase().includes(resvSearch.toLowerCase()) ||
      r.whatsAppPhone.includes(resvSearch) ||
      (r.notes && r.notes.toLowerCase().includes(resvSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Unique sections list
  const sections = Array.from(new Set(tables.map((t) => t.section || "Main Hall")));

  // Checks if reservation features are enabled
  if (!branch || !branch.reservationEnabled) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-gray-100 rounded-2xl shadow-sm text-center min-h-[400px]">
        <Calendar size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">{t("nav.reservations")}</h3>
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          Table reservations are currently disabled for this branch. Please enable it in the settings toggle to activate the visual layout editor and booking workflows.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Visual Canvas Map Area (3 columns) */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        
        {/* Canvas Toolbar Controls */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-gray-800 tracking-wide uppercase">{t("nav.reservations")} - Live Floor Plan</h3>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
                isEditMode
                  ? "bg-orange-50 text-orange-600 border-orange-200"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <Edit2 size={13} />
              {isEditMode ? "Exit Edit Mode" : "Layout Edit Mode"}
            </button>

            {isEditMode && (
              <button
                onClick={() => setShowAddTableModal(true)}
                className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5"
              >
                <Plus size={13} />
                Add Table
              </button>
            )}
          </div>
        </div>

        {/* The Live Floor Plan Canvas */}
        <div 
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="bg-gray-900 border border-gray-800 rounded-2xl relative overflow-hidden aspect-[16/10] w-full min-h-[450px] shadow-inner select-none"
        >
          {/* Section Names Indicators */}
          <div className="absolute top-3 left-4 text-xs font-bold text-gray-400 opacity-50 uppercase tracking-widest pointer-events-none">
            {sections.join("  |  ") || "Main Dining Area"}
          </div>

          {/* Render Tables */}
          {tables.map((table) => {
            const status = getTableStatus(table);
            const activeOrder = getActiveOrderForTable(table.number);
            const seatedResv = getSeatedReservationForTable(table.id);

            // Shape styles
            let shapeClass = "rounded-lg"; // square default
            if (table.shape === "round") shapeClass = "rounded-full";
            else if (table.shape === "rectangle") shapeClass = "rounded-md";

            // Table capacity size logic
            let sizeStyle = { width: "70px", height: "70px" };
            if (table.shape === "rectangle") {
              sizeStyle = { width: "100px", height: "65px" };
            }

            // Colors based on Status
            let statusBg = "bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/50 hover:bg-emerald-500";
            if (status === "busy") {
              statusBg = "bg-red-600 border-red-400 text-white shadow-red-900/50 hover:bg-red-500 animate-pulse-subtle";
            } else if (status === "reserved") {
              statusBg = "bg-amber-500 border-amber-300 text-white shadow-amber-900/50 hover:bg-amber-400";
            }

            const isSelected = selectedTable?.id === table.id;

            return (
              <div
                key={table.id}
                onMouseDown={(e) => handleTableMouseDown(e, table)}
                onClick={() => !isEditMode && setSelectedTable(table)}
                style={{
                  position: "absolute",
                  left: `${table.posX}%`,
                  top: `${table.posY}%`,
                  ...sizeStyle,
                  cursor: isEditMode ? "move" : "pointer",
                  zIndex: isSelected ? 30 : 10,
                }}
                className={`flex flex-col items-center justify-center border-2 shadow-lg transition duration-200 ${shapeClass} ${statusBg} ${
                  isSelected ? "ring-4 ring-orange-500 scale-105" : ""
                }`}
              >
                <span className="text-xs font-bold font-mono tracking-tighter">
                  {table.number}
                </span>
                
                <span className="text-[10px] opacity-85 flex items-center gap-0.5">
                  <Users size={8} />
                  {table.capacity}
                </span>

                {/* Micro notification indicators */}
                {activeOrder && (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 border border-yellow-300 text-gray-900 text-[8px] font-bold px-1 rounded-full">
                    Order
                  </span>
                )}
              </div>
            );
          })}

          {/* Empty state instruction inside canvas if no tables */}
          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none">
              <p className="text-sm text-gray-400">No tables configured in layout yet.</p>
              {isEditMode && <p className="text-xs text-gray-500 mt-1">Click "Add Table" to start placing tables.</p>}
            </div>
          )}
        </div>

        {/* Selected Table Action Details Bar */}
        {selectedTable && !isEditMode && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-gray-900">Table {selectedTable.number}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                    getTableStatus(selectedTable) === "busy" 
                      ? "bg-red-50 text-red-600" 
                      : getTableStatus(selectedTable) === "reserved" 
                      ? "bg-amber-50 text-amber-600" 
                      : "bg-emerald-50 text-emerald-600"
                  }`}>
                    {getTableStatus(selectedTable) === "busy" 
                      ? "Seated / Occupied" 
                      : getTableStatus(selectedTable) === "reserved" 
                      ? "Reserved Soon" 
                      : "Available"}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500 mt-1">
                  Capacity: {selectedTable.capacity} Seats • Shape: {selectedTable.shape} • Section: {selectedTable.section}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQrModal(selectedTable)}
                  className="text-xs bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 py-1.5 px-3 rounded-lg font-semibold transition flex items-center gap-1.5"
                >
                  <QrCode size={13} />
                  Table QR Link
                </button>
                
                <button
                  onClick={() => handlePrintQr(selectedTable)}
                  className="text-xs bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 py-1.5 px-3 rounded-lg font-semibold transition flex items-center gap-1.5"
                >
                  <Printer size={13} />
                  Print Sign
                </button>

                <button
                  onClick={() => handleDeleteTable(selectedTable.id)}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-1.5 px-3 rounded-lg font-semibold transition flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Remove
                </button>

                <button
                  onClick={() => setSelectedTable(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 ml-2"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Display occupants if Busy */}
            {getTableStatus(selectedTable) === "busy" && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check for active orders */}
                {getActiveOrderForTable(selectedTable.number) && (
                  <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100/50">
                    <h5 className="text-xs font-bold text-orange-800 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <FileText size={12} /> Live POS Order
                    </h5>
                    <p className="text-sm font-bold text-gray-900">
                      Order #{getActiveOrderForTable(selectedTable.number)?.orderNumber}
                    </p>
                    <p className="text-xs text-gray-600">
                      Amount: {getActiveOrderForTable(selectedTable.number)?.total.toFixed(2)}€ • Status: {getActiveOrderForTable(selectedTable.number)?.status}
                    </p>
                  </div>
                )}

                {/* Check for seated reservations */}
                {getSeatedReservationForTable(selectedTable.id) && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                    <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <Calendar size={12} /> Seated Customer Reservation
                    </h5>
                    <p className="text-sm font-bold text-gray-900">
                      {getSeatedReservationForTable(selectedTable.id)?.customerName}
                    </p>
                    <p className="text-xs text-gray-600">
                      Guests: {getSeatedReservationForTable(selectedTable.id)?.guestCount} • WhatsApp: {getSeatedReservationForTable(selectedTable.id)?.whatsAppPhone}
                    </p>
                    <button
                      onClick={() => handleUpdateReservationStatus(getSeatedReservationForTable(selectedTable.id)!.id, "completed")}
                      className="mt-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-semibold transition"
                    >
                      Complete & Free Table
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Timeline Sidebar (1 column) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Bookings list</h4>
          <button
            onClick={() => setShowAddReservationModal(true)}
            className="text-[11px] bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition"
          >
            <PlusCircle size={12} />
            Book
          </button>
        </div>

        {/* Filters and search */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search booking..."
            value={resvSearch}
            onChange={(e) => setResvSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500"
          />

          <select
            value={resvFilter}
            onChange={(e: any) => setResvFilter(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-orange-500"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="seated">Seated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Booking Cards container */}
        <div className="flex-1 overflow-y-auto space-y-3 max-h-[450px] pr-1">
          {filteredReservations.map((resv) => {
            const resvDate = new Date(resv.dateTime);
            const formattedTime = resvDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const formattedDay = resvDate.toLocaleDateString([], { month: "short", day: "numeric" });
            const matchedTable = tables.find((t) => t.id === resv.tableId);

            return (
              <div 
                key={resv.id}
                className={`p-3 rounded-xl border transition text-left relative ${
                  resv.status === "pending"
                    ? "bg-yellow-50/40 border-yellow-100"
                    : resv.status === "confirmed"
                    ? "bg-emerald-50/30 border-emerald-100"
                    : resv.status === "seated"
                    ? "bg-blue-50/30 border-blue-100"
                    : "bg-gray-50/50 border-gray-200/60"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">{resv.customerName}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">{resv.whatsAppPhone}</p>
                  </div>

                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    resv.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : resv.status === "confirmed"
                      ? "bg-emerald-100 text-emerald-800"
                      : resv.status === "seated"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-200 text-gray-700"
                  }`}>
                    {resv.status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-600">
                  <span className="flex items-center gap-1 font-semibold text-gray-700">
                    <Clock size={10} />
                    {formattedDay} @ {formattedTime}
                  </span>
                  
                  <span className="flex items-center gap-0.5">
                    <Users size={10} />
                    {resv.guestCount}
                  </span>

                  {matchedTable && (
                    <span className="bg-gray-100 px-1.5 py-0.2 rounded font-mono text-[9px] text-gray-700">
                      Table {matchedTable.number}
                    </span>
                  )}
                </div>

                {resv.notes && (
                  <p className="text-[10px] text-gray-500 italic mt-1.5 border-t border-gray-100/50 pt-1">
                    "{resv.notes}"
                  </p>
                )}

                {/* Inline Action Controls */}
                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-gray-100/70 pt-2">
                  {resv.status === "pending" && (
                    <button
                      onClick={() => handleUpdateReservationStatus(resv.id, "confirmed")}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-0.5 px-2 rounded transition"
                    >
                      Confirm
                    </button>
                  )}

                  {resv.status === "confirmed" && (
                    <div className="flex items-center gap-1 w-full justify-between">
                      {/* Dropdown to assign/change table on seat */}
                      <select
                        onChange={(e) => handleUpdateReservationStatus(resv.id, "seated", e.target.value)}
                        value={resv.tableId || ""}
                        className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] max-w-[80px]"
                      >
                        <option value="">Assign Table...</option>
                        {tables.map((t) => (
                          <option key={t.id} value={t.id}>T{t.number} ({t.capacity}p)</option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          if (!resv.tableId) {
                            triggerAlert("error", "Please select a table to seat the customer");
                            return;
                          }
                          handleUpdateReservationStatus(resv.id, "seated");
                        }}
                        className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-0.5 px-2 rounded transition"
                      >
                        Seat Guest
                      </button>
                    </div>
                  )}

                  {resv.status === "seated" && (
                    <button
                      onClick={() => handleUpdateReservationStatus(resv.id, "completed")}
                      className="text-[10px] bg-gray-600 hover:bg-gray-700 text-white font-bold py-0.5 px-2 rounded transition"
                    >
                      Finish
                    </button>
                  )}

                  {["pending", "confirmed"].includes(resv.status) && (
                    <button
                      onClick={() => handleUpdateReservationStatus(resv.id, "cancelled")}
                      className="text-[10px] text-red-600 hover:bg-red-50 font-bold py-0.5 px-2 rounded transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredReservations.length === 0 && (
            <div className="p-8 text-center text-xs text-gray-400">
              No reservations found.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD TABLE */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative animate-scale-in text-left">
            <h3 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wide">Add New Layout Table</h3>
            
            <form onSubmit={handleAddTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Table identifier / number</label>
                <input
                  type="text"
                  placeholder="e.g. T1"
                  required
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Capacity (Seats)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shape</label>
                  <select
                    value={newTableShape}
                    onChange={(e: any) => setNewTableShape(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="square">Square</option>
                    <option value="round">Round</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Section Area</label>
                <input
                  type="text"
                  placeholder="e.g. Main Hall"
                  value={newTableSection}
                  onChange={(e) => setNewTableSection(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW RESERVATION */}
      {showAddReservationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative animate-scale-in text-left">
            <h3 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wide font-mono">Create Reservation</h3>
            
            <form onSubmit={handleAddReservationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  required
                  value={newResvName}
                  onChange={(e) => setNewResvName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp Phone Number</label>
                <input
                  type="text"
                  placeholder="+491761234567"
                  required
                  value={newResvPhone}
                  onChange={(e) => setNewResvPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guests Count</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newResvGuests}
                    onChange={(e) => setNewResvGuests(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={newResvDateTime}
                    onChange={(e) => setNewResvDateTime(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign Table (Optional)</label>
                <select
                  value={newResvTableId}
                  onChange={(e) => setNewResvTableId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="">Auto-Assign Later / No Table</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      T{t.number} (Capacity: {t.capacity}p)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Additional Notes</label>
                <textarea
                  placeholder="e.g. allergies, window table preference..."
                  value={newResvNotes}
                  onChange={(e) => setNewResvNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500 h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddReservationModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition"
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SHOW QR CODE */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6 relative animate-scale-in text-center">
            <button
              onClick={() => setShowQrModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-base font-bold text-gray-900 mb-2">Table {showQrModal.number} QR Code</h3>
            <p className="text-xs text-gray-500 mb-6">
              Customers scanning this code will open the Smart Menu pre-assigned to Table {showQrModal.number}.
            </p>

            <div className="bg-gray-50 p-4 rounded-xl inline-block border border-gray-100 mb-6">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}/menu?branchId=${branchId}&table=${showQrModal.number}`
                )}`}
                alt={`Table ${showQrModal.number} QR`}
                className="w-48 h-48 mx-auto"
              />
            </div>

            <p className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-100 text-gray-600 break-all mb-6">
              {window.location.origin}/menu?branchId={branchId}&table={showQrModal.number}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/menu?branchId=${branchId}&table=${showQrModal.number}`
                  );
                  triggerAlert("success", "Link copied to clipboard");
                }}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Copy Link
              </button>
              <button
                onClick={() => {
                  handlePrintQr(showQrModal);
                  setShowQrModal(null);
                }}
                className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer size={13} />
                Print Sign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {errorMsg && (
        <div className="fixed bottom-5 right-5 bg-red-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg border border-red-500 z-50 flex items-center gap-2 animate-bounce-subtle">
          <X size={14} />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg border border-emerald-500 z-50 flex items-center gap-2 animate-scale-in">
          <Check size={14} />
          {successMsg}
        </div>
      )}
    </div>
  );
}
