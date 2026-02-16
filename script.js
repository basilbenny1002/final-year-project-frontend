document.addEventListener("DOMContentLoaded", () => {
  // --- State ---
  let cart = [];
  let isLidOpen = false;
  let currentProcessTotal = 0; // Holds the total when proceeding to checkout

  // --- Elements ---
  const screens = {
    shopping: document.getElementById("shopping-screen"),
    payment: document.getElementById("payment-screen"),
    success: document.getElementById("success-screen"),
  };

  // Shopping / Cart Elements
  const scanButtons = document.querySelectorAll(".scan-btn");
  const lidStatusBadge = document.getElementById("lid-status");
  const cartItemsContainer = document.getElementById("cart-items");
  const emptyCartMsg = document.getElementById("empty-cart-msg");

  // Total Displays
  const cartSubtotalEl = document.getElementById("cart-subtotal");
  const cartTaxEl = document.getElementById("cart-tax");
  const cartTotalEl = document.getElementById("cart-total");
  const paymentTotalEl = document.getElementById("payment-total");
  const successAmountEl = document.getElementById("success-amount");

  // Buttons
  const checkoutBtn = document.getElementById("checkout-btn");
  const backToCartBtn = document.getElementById("back-to-cart");
  const payNowBtn = document.getElementById("pay-now-btn");
  const newSessionBtn = document.getElementById("new-session-btn");

  // --- Event Listeners ---

  // 1. Scan Simulation
  scanButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.item;
      const price = parseFloat(btn.dataset.price);
      simulateScan(name, price);
    });
  });

  // 2. Navigation
  checkoutBtn.addEventListener("click", () => {
    currentProcessTotal = calculateTotals().total;
    paymentTotalEl.textContent = `$${currentProcessTotal.toFixed(2)}`;
    document.getElementById("invoice-id").textContent =
      `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    switchScreen("payment");
  });

  backToCartBtn.addEventListener("click", () => {
    switchScreen("shopping");
  });

  // 3. Payment
  payNowBtn.addEventListener("click", processPayment);

  // Payment Selection Logic (Added Fix)
  const paymentOptions = document.querySelectorAll(".payment-card");
  paymentOptions.forEach((card) => {
    card.addEventListener("click", () => {
      // Remove selected from all
      paymentOptions.forEach((c) => c.classList.remove("selected"));
      // Add to clicked
      card.classList.add("selected");
      // Check the radio
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // 4. Reset
  newSessionBtn.addEventListener("click", resetSession);
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

  function simulateScan(name, price) {
    if (isLidOpen) {
      alert("System Busy: Lid is open/processing.");
      return;
    }

    toggleLid(true);

    // Simulate Hardware Delay
    setTimeout(() => {
      addItemToCart(name, price);
      toggleLid(false);
    }, 800);
  }

  function toggleLid(open) {
    isLidOpen = open;
    if (open) {
      lidStatusBadge.innerHTML = '<i class="fas fa-lock-open"></i> Unlocked';
      lidStatusBadge.className = "status-badge open";
    } else {
      lidStatusBadge.innerHTML = '<i class="fas fa-lock"></i> Locked';
      lidStatusBadge.className = "status-badge closed";
    }
  }

  function addItemToCart(name, price) {
    const id = Date.now().toString().slice(-4);
    cart.push({ id, name, price });
    updateCartUI();
  }

  function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    const tax = subtotal * 0.05; // 5% tax
    return {
      subtotal,
      tax,
      total: subtotal + tax,
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
                        <div style="font-size: 0.8rem; color: #94a3b8;">Ref: ${item.id}</div>
                    </td>
                    <td class="text-right">$${item.price.toFixed(2)}</td>
                `;
        cartItemsContainer.appendChild(tr);
      });
    }

    // Update Text
    const totals = calculateTotals();
    cartSubtotalEl.textContent = `$${totals.subtotal.toFixed(2)}`;
    cartTaxEl.textContent = `$${totals.tax.toFixed(2)}`;
    cartTotalEl.textContent = `$${totals.total.toFixed(2)}`;
  }

  function processPayment() {
    const originalText = payNowBtn.innerHTML;
    payNowBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';
    payNowBtn.disabled = true;

    setTimeout(() => {
      // Complete
      payNowBtn.innerHTML = originalText;
      payNowBtn.disabled = false;

      // Set Success Data
      const txnId = `TXN-${Date.now().toString().slice(-6)}`;
      document.getElementById("trans-id").textContent = txnId;
      successAmountEl.textContent = `$${currentProcessTotal.toFixed(2)}`;

      // Generate QR
      generateReceiptQR(currentProcessTotal, txnId);

      switchScreen("success");
    }, 1500);
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
    updateCartUI();
    switchScreen("shopping");
  }
});
