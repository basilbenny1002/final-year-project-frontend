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
  const payNowBtn = document.getElementById("pay-now-btn");

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
      console.log("Item received:", data.item_name, data.price);
      addItemToCart(data.item_name, data.price);
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
    switchScreen("payment");
  });

  backToCartBtn.addEventListener("click", () => {
    switchScreen("shopping");
  });

  // 2. Reset
  newSessionBtn.addEventListener("click", resetSession);

  // 3. Payment - Now handled by individual app buttons directly in HTML via handleAppPayment
  
  // --- Logic ---
  
  // Make function global so inline onclick works
  window.handleAppPayment = function(appName) {
    const amount = Math.floor(calculateTotals().total);
    const upiId = "basilbenny1002@okhdfcbank";
    const payeeName = "Basil Benny";
    const transactionNote = "SmartBasket Payment";
    
    // Construct URI based on app selection
    let upiUrl = "";
    
    // Common parameters
    const params = `pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
    
    switch(appName) {
      case 'gpay':
        upiUrl = `tez://upi/pay?${params}`;
        break;
      case 'paytm':
        upiUrl = `paytmmp://pay?${params}`;
        break;
      case 'phonepe':
        upiUrl = `phonepe://pay?${params}`;
        break;
      case 'bhim':
        upiUrl = `bhim://pay?${params}`; 
        break;
    }
    
    console.log("Opening Payment App:", appName, upiUrl);
    window.location.href = upiUrl;
  };

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
                    <td class="text-right">₹${(item.price * item.quantity).toFixed(2)}</td>
                `;
        cartItemsContainer.appendChild(tr);
      });
    }

    // Update Text
    const totals = calculateTotals();
    cartSubtotalEl.textContent = `₹${totals.subtotal.toFixed(2)}`;
    cartTotalEl.textContent = `₹${totals.total.toFixed(2)}`;
  }

  // --- Helper Functions ---
  
  // Clean function to construct URI
  function constructUri(scheme, params) {
    return `${scheme}://pay?${params}`;
  }

  // --- Payment Handling ---

  window.handleAppPayment = function(appName) {
    const amount = Math.floor(calculateTotals().total);
    const upiId = "basilbenny1002@okhdfcbank";
    const payeeName = "Basil Benny";
    const transactionNote = "SmartBasket Payment";
    
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
