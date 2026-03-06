// Backend URL constant
const BACKEND_URL = "https://main-project-backend-lu62.onrender.com/";

document.addEventListener("DOMContentLoaded", () => {
  // --- Extract Cart ID from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const cartId = urlParams.get('id') || 'ABCD';

  // --- State ---
  let cart = [];
  let isLidOpen = false;
  let currentProcessTotal = 0;
  let itemRefCounter = 1; // Auto-incrementing reference ID
  let ws = null;
  let isConnected = false;

  // --- Elements ---
  const screens = {
    shopping: document.getElementById("shopping-screen"),
    payment: document.getElementById("payment-screen"),
    success: document.getElementById("success-screen"),
  };

  // Shopping / Cart Elements
  const lidStatusBadge = document.getElementById("lid-status");
  const connectionStatus = document.getElementById("connection-status");
  const cartItemsContainer = document.getElementById("cart-items");
  const emptyCartMsg = document.getElementById("empty-cart-msg");

  // Total Displays
  const cartSubtotalEl = document.getElementById("cart-subtotal");
  const cartTotalEl = document.getElementById("cart-total");
  const paymentTotalEl = document.getElementById("payment-total");
  const successAmountEl = document.getElementById("success-amount");

  // Buttons
  const checkoutBtn = document.getElementById("checkout-btn");
  const backToCartBtn = document.getElementById("back-to-cart");
  const newSessionBtn = document.getElementById("new-session-btn");
  const downloadBillBtn = document.getElementById("download-bill-btn"); // Added
  
  // --- WebSocket Connection ---
  function connectWebSocket() {
    connectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    connectionStatus.className = "status-badge connecting";
    
    ws = new WebSocket(`wss://main-project-backend-lu62.onrender.com/frontend/ws/${cartId}`);
    
    ws.onopen = () => {
      console.log("WebSocket Connected");
      isConnected = true;
      connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
      connectionStatus.className = "status-badge connected";
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "payment_success") {
        console.log("PAYMENT RECEIVED:", data.message);
        
        // Show success screen and populate details
        const txnId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
        document.getElementById("trans-id").textContent = txnId;
        successAmountEl.textContent = `₹${currentProcessTotal.toFixed(2)}`;
        generateReceiptQR(currentProcessTotal, txnId);
        
        switchScreen("success");
      } else if (data.item_name) {
        console.log("Item received:", data.item_name, data.price);
        addItemToCart(data.item_name, data.price);
      }
    };
    
    ws.onclose = (event) => {
      console.log("WebSocket Disconnected:", event.code, event.reason);
      isConnected = false;
      connectionStatus.innerHTML = '<i class="fas fa-times-circle"></i> Disconnected';
      connectionStatus.className = "status-badge disconnected";
      // Attempt to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
      connectionStatus.className = "status-badge error";
    };
  }

  // Initialize WebSocket
  connectWebSocket();

  // --- Event Listeners ---

  // 1. Navigation
  checkoutBtn.addEventListener("click", () => {
    // Math.floor to ensure we don't round up (which might look like extra tax)
    currentProcessTotal = Math.floor(calculateTotals().total);
    paymentTotalEl.textContent = `₹${currentProcessTotal}`;
    document.getElementById("invoice-id").textContent =
      `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Render the Payment QR code
    renderPaymentQR(currentProcessTotal);
    
    switchScreen("payment");
  });

  if (downloadBillBtn) {
    downloadBillBtn.addEventListener("click", generatePDFBill);
  }

  backToCartBtn.addEventListener("click", () => {
    switchScreen("shopping");
  });

  // 2. Reset
  newSessionBtn.addEventListener("click", resetSession);

  // 3. Download Bill
  if (downloadBillBtn) {
    downloadBillBtn.addEventListener("click", generatePDFBill);
  }
  
  // --- Logic ---

  function switchScreen(screenName) {
    // Hide all
    Object.values(screens).forEach((s) => {
      s.classList.remove("active");
      s.classList.add("hidden");
    });
    // Show target
    screens[screenName].classList.remove("hidden");
    screens[screenName].classList.add("active");
  }

  function addItemToCart(name, price) {
    // Check if item already exists in cart
    const existingItem = cart.find(item => item.name === name);
    
    if (existingItem) {
      // Increment quantity if item exists
      existingItem.quantity += 1;
    } else {
      // Add new item with auto-incrementing reference ID
      const id = itemRefCounter++;
      cart.push({ id, name, price, quantity: 1 });
    }
    
    updateCartUI();
  }

  function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return {
      subtotal,
      total: subtotal,
    };
  }

  function updateCartUI() {
    // Clear list
    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
      emptyCartMsg.style.display = "block";
      checkoutBtn.disabled = true;
    } else {
      emptyCartMsg.style.display = "none";
      checkoutBtn.disabled = false;

      // Render Items
      cart.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td>
                        <div style="font-weight: 500;">${item.name}</div>
                        <div style="font-size: 0.8rem; color: #94a3b8;">Ref: ${item.id} | Qty: ${item.quantity}</div>
                    </td>
                    <td class="text-right">
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                            <button onclick="removeCartItem(${item.id})" class="remove-item-btn" title="Remove Item">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </td>
                `;
        cartItemsContainer.appendChild(tr);
      });
    }

    // Update Text
    const totals = calculateTotals();
    cartSubtotalEl.textContent = `₹${totals.subtotal.toFixed(2)}`;
    cartTotalEl.textContent = `₹${totals.total.toFixed(2)}`;
  }

  // --- Global functions ---
  window.removeCartItem = function(id) {
    const index = cart.findIndex(item => item.id === id);
    if (index !== -1) {
      if (cart[index].quantity > 1) {
        // Decrease quantity if more than 1
        cart[index].quantity -= 1;
      } else {
        // Remove completely if only 1 left
        cart.splice(index, 1);
      }
      updateCartUI();
    }
  };

  // --- Helper Functions ---
  
  // Clean function to construct URI
  function constructUri(scheme, params) {
    return `${scheme}://pay?${params}`;
  }

  // --- Payment Handling ---
  
  // Function to render the Payment QR Code
  function renderPaymentQR(amount) {
    const qrContainer = document.getElementById("payment-qr");
    if (!qrContainer) return;
    
    qrContainer.innerHTML = ""; // Clear previous

    const upiId = "anuvargheseav123@okicici";
    const payeeName = "Anupama Varghese";
    const transactionNote = cartId; // Use Cart ID as note
    
    // Construct simplified URI for QR code (Standard UPI intent)
    // QR codes work best with the standard 'upi://pay' scheme
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
    
    new QRCode(qrContainer, {
      text: upiUrl,
      width: 180,
      height: 180,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  window.handleAppPayment = function(appName) {
    const amount = Math.floor(calculateTotals().total);
    const upiId = "anuvargheseav123@okicici";
    const payeeName = "Anu Varghese";
    const transactionNote = cartId; // Use Cart ID as note
    
    // Construct simplified URI parameters
    const params = `pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
    
    let upiUrl = "";
    
    switch(appName) {
      case 'gpay':
        // GPay Specific Intent
        upiUrl = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
        break;
      case 'paytm':
        // Paytm Specific Intent
        upiUrl = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
        break;
      case 'phonepe':
        // PhonePe Specific Intent
        upiUrl = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
        break;
      case 'bhim':
        // BHIM Specific Intent
        upiUrl = `bhim://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
        break;
    }
    
    console.log("Opening Payment App:", appName, upiUrl);
    window.location.href = upiUrl;
  };

  /* Deprecated: Old generic handler
  function handlePayment() { ... }
  */
  
  function generatePDFBill() {
    const { jsPDF } = window.jspdf;
    // Create a portrait, receipt-style PDF layout in A5 size for better design
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a5"
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("SmartBasket", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Your Smart Shopping Experience", pageWidth / 2, 26, { align: "center" });
    
    // Divider
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(10, 32, pageWidth - 10, 32);
    
    // Invoice Info
    const date = new Date();
    const invoiceId = document.getElementById("invoice-id").textContent;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`, 10, 40);
    doc.text(`Invoice # ${invoiceId}`, 10, 45);
    doc.text(`Session: #892-BA`, 10, 50);
    
    // Table Columns
    const tableColumn = ["Item", "Qty", "Price", "Total"];
    const tableRows = [];

    cart.forEach(item => {
      const itemTotal = (item.price * item.quantity).toFixed(2);
      const itemData = [
        item.name,
        item.quantity.toString(),
        item.price.toFixed(2),
        itemTotal
      ];
      tableRows.push(itemData);
    });
    
    // Generate Table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      theme: 'plain',
      headStyles: { 
        fillColor: [255, 255, 255], 
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        lineWidth: { bottom: 0.5 },
        lineColor: [200, 200, 200]
      },
      bodyStyles: {
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: 10, right: 10 }
    });
    
    // Grand Total
    const finalY = doc.lastAutoTable.finalY || 60;
    
    // Divider before total
    doc.setLineWidth(0.5);
    doc.line(10, finalY + 5, pageWidth - 10, finalY + 5);
    
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // --primary-color
    doc.setFont("helvetica", "bold");
    doc.text("Total:", 10, finalY + 15);
    doc.text(`₹${currentProcessTotal.toFixed(2)}`, pageWidth - 10, finalY + 15, { align: "right" });
    
    // Footer message
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text("Thank you for shopping with SmartBasket!", pageWidth / 2, finalY + 35, { align: "center" });
    
    // Save PDF
    const fileName = `SmartBasket_Bill_${invoiceId}.pdf`;
    doc.save(fileName);
  }

  function generateReceiptQR(amount, txnId) {
    const qrContainer = document.getElementById("receipt-qr");
    qrContainer.innerHTML = ""; // Clear previous

    const receiptData = JSON.stringify({
      id: txnId,
      amt: amount,
      date: new Date().toISOString(),
      items: cart.length,
    });

    new QRCode(qrContainer, {
      text: receiptData,
      width: 128,
      height: 128,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  function resetSession() {
    cart = [];
    currentProcessTotal = 0;
    itemRefCounter = 1;
    updateCartUI();
    switchScreen("shopping");
  }
});
