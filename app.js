/* 2FLY Wholesale System (static site)
   - Uses Supabase for products and image storage
   - Uses config.js to set your project URL + anon key
*/

const SUPABASE_URL = (window.__SUPABASE_URL__ || '').trim();
const SUPABASE_ANON_KEY = (window.__SUPABASE_ANON_KEY__ || '').trim();

let __sb = null;

function hasSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && typeof window.supabase.createClient === 'function');
}

function getSupabase() {
  if (!hasSupabase()) return null;
  if (!__sb) __sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return __sb;
}

// ---------------- SHOP ----------------
  const cart = {
    items: [],
    // item: {id, name, price, code, sku, category, image, qty}
  };

  function loadCart() {
    try {
      cart.items = JSON.parse(localStorage.getItem("cart_v1") || "[]") || [];
    } catch {
      cart.items = [];
    }
  }

  function saveCart() {
    localStorage.setItem("cart_v1", JSON.stringify(cart.items));
  }

  function cartTotalQty() {
    return cart.items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
  }

  function cartSubtotal() {
    return cart.items.reduce((a, it) => a + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  }

  function findCartItem(id) {
    return cart.items.find(x => String(x.id) === String(id));
  }

  function addToCart(prod, qty) {
    const q = clampInt(qty, 1);
    const existing = findCartItem(prod.id);
    if (existing) existing.qty = clampInt((existing.qty || 0) + q, 1);
    else {
      cart.items.push({
        id: prod.id,
        name: prod.name,
        price: Number(prod.price) || 0,
        code: prod.code || "",
        sku: prod.sku || "",
        category: prod.category || "",
        image: (prod.images && prod.images[0]) || prod.image_url || "",
        qty: q
      });
    }
    saveCart();
  }

  function clampInt(v, min = 1) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || isNaN(n)) return min;
    return Math.max(min, n);
  }

  function initKeyGateShop() {
    const gate = $("#keyGate");
    const input = $("#anonKeyInput");
    const btn = $("#saveAnonKeyBtn");

    const key = getAnonKey();
    if (!key) {
      gate.hidden = false;
      btn.addEventListener("click", () => {
        setAnonKey(input.value);
        window.location.reload();
      });
      return false;
    }
    gate.hidden = true;
    return true;
  }

  function initShop() {
    if (!initKeyGateShop()) {
      // still allow UI to load, but no products
    }

    loadCart();
    wireCartUI();

    const sb = createSb();
    const grid = $("#productsGrid");
    const empty = $("#emptyState");

    const pills = $$(".pill");
    let activeFilter = "Earrings";
    pills.forEach(p => {
      p.addEventListener("click", () => {
        pills.forEach(x => x.classList.remove("is-active"));
        p.classList.add("is-active");
        activeFilter = p.dataset.filter;
        renderProducts(currentProducts, activeFilter);
      });
    });

    let currentProducts = [];

    async function fetchProducts() {
      if (!sb) {
        // fallback demo (only if key missing)
        currentProducts = [];
        renderProducts(currentProducts, activeFilter);
        empty.hidden = false;
        return;
      }

      const { data, error } = await sb
        .from("products")
        .select("id,name,price,code,sku,category,status,sold_out,image_url,images,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        empty.hidden = false;
        empty.textContent = "Error loading products (check Supabase key).";
        return;
      }

      currentProducts = (data || [])
        .filter(p => (p.status || "active") === "active")
        .filter(p => p.sold_out !== true);

      renderProducts(currentProducts, activeFilter);
    }

    function renderProducts(list, filter) {
      const filtered = (filter === "ALL")
        ? list
        : list.filter(p => String(p.category || "Earrings").toLowerCase() === String(filter).toLowerCase());

      grid.innerHTML = "";
      empty.hidden = filtered.length !== 0;

      filtered.forEach(prod => {
        const img = (prod.images && prod.images[0]) || prod.image_url || "";
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <img class="card__img" src="${escapeHtmlAttr(img)}" alt="${escapeHtmlAttr(prod.name || "")}" onerror="this.style.opacity=.2" />
          <div class="card__body">
            <div class="card__name">${escapeHtml(prod.name || "")}</div>
            <div class="card__price">${money(prod.price)}</div>
          </div>
        `;
        card.addEventListener("click", () => openProductModal(prod));
        grid.appendChild(card);
      });
    }

    // Product modal
    const modal = $("#productModal");
    const modalCloseEls = $$("[data-close='1']", modal);
    const pMain = $("#pMainImg");
    const pThumbs = $("#pThumbs");
    const pName = $("#pName");
    const pPrice = $("#pPrice");
    const pCategory = $("#pCategory");
    const pSku = $("#pSku");
    const pCode = $("#pCode");
    const pMinus = $("#pMinus");
    const pPlus = $("#pPlus");
    const pQty = $("#pQty");
    const pAddBtn = $("#pAddBtn");

    let currentProd = null;

    function openProductModal(prod) {
      currentProd = normalizeProduct(prod);

      // images
      const imgs = currentProd.images.length ? currentProd.images : [currentProd.image_url].filter(Boolean);
      const main = imgs[0] || "";
      pMain.src = main;
      pMain.alt = currentProd.name;

      pThumbs.innerHTML = "";
      imgs.forEach((u, idx) => {
        const b = document.createElement("button");
        b.className = "thumb";
        b.type = "button";
        b.innerHTML = `<img src="${escapeHtmlAttr(u)}" alt="" />`;
        b.addEventListener("click", () => {
          pMain.src = u;
        });
        pThumbs.appendChild(b);
      });

      pName.textContent = currentProd.name;
      pPrice.textContent = money(currentProd.price);
      pCategory.textContent = currentProd.category || "";
      pSku.textContent = currentProd.sku || "";
      pCode.textContent = currentProd.code || "";

      pQty.value = "1";
      syncAddBtn();

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeProductModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      currentProd = null;
    }

    modalCloseEls.forEach(el => el.addEventListener("click", closeProductModal));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeProductModal();
    });

    function syncAddBtn() {
      const q = clampInt(pQty.value, 1);
      pAddBtn.textContent = `ADD ${q} TO CART`;
    }

    pQty.addEventListener("input", () => {
      if (!pQty.value) return syncAddBtn();
      const q = clampInt(pQty.value, 1);
      pQty.value = String(q);
      syncAddBtn();
    });

    pMinus.addEventListener("click", () => {
      const q = clampInt(pQty.value, 1);
      pQty.value = String(Math.max(1, q - 1));
      syncAddBtn();
    });

    pPlus.addEventListener("click", () => {
      const q = clampInt(pQty.value, 1);
      pQty.value = String(q + 1);
      syncAddBtn();
    });

    pAddBtn.addEventListener("click", () => {
      if (!currentProd) return;
      const q = clampInt(pQty.value, 1);
      addToCart(currentProd, q);
      updateCartUI();
      closeProductModal();
      openCart();
    });

    // Join btn already in HTML

    fetchProducts();
    updateCartUI();

    // helpers
    function normalizeProduct(p) {
      return {
        id: p.id,
        name: p.name || "",
        price: Number(p.price) || 0,
        code: p.code || "",
        sku: p.sku || "",
        category: p.category || "Earrings",
        image_url: p.image_url || "",
        images: Array.isArray(p.images) ? p.images.filter(Boolean) : []
      };
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
    function escapeHtmlAttr(s) {
      return escapeHtml(s || "");
    }
  }

  // Cart UI + Checkout
  function wireCartUI() {
    const cartBtn = $("#cartBtn");
    const overlay = $("#cartOverlay");
    const drawer = $("#cartDrawer");
    const closeBtn = $("#closeCartBtn");

    cartBtn?.addEventListener("click", openCart);
    overlay?.addEventListener("click", closeCart);
    closeBtn?.addEventListener("click", closeCart);

    function openCart() {
      overlay.hidden = false;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
    }
    function closeCart() {
      overlay.hidden = true;
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }

    window.openCart = openCart;
    window.closeCart = closeCart;

    // Checkout modal
    const checkoutBtn = $("#checkoutBtn");
    const checkoutModal = $("#checkoutModal");
    const checkoutCloseEls = $$("[data-close-checkout='1']", checkoutModal);
    const copyBtn = $("#copyOrderBtn");

    checkoutBtn?.addEventListener("click", () => {
      if (!cart.items.length) return;
      refreshOrderText();
      checkoutModal.classList.add("is-open");
      checkoutModal.setAttribute("aria-hidden", "false");
    });

    checkoutCloseEls.forEach(el => el.addEventListener("click", () => {
      checkoutModal.classList.remove("is-open");
      checkoutModal.setAttribute("aria-hidden", "true");
    }));

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && checkoutModal?.classList.contains("is-open")) {
        checkoutModal.classList.remove("is-open");
        checkoutModal.setAttribute("aria-hidden", "true");
      }
    });

    copyBtn?.addEventListener("click", async () => {
      const t = $("#orderText")?.value || "";
      try {
        await navigator.clipboard.writeText(t);
        copyBtn.textContent = "COPIED ✅";
        setTimeout(() => (copyBtn.textContent = "COPY ORDER FORM"), 900);
      } catch {
        // fallback
        const ta = $("#orderText");
        ta?.select();
        document.execCommand("copy");
      }
    });

    // When user types in checkout fields -> update order
    ["#cName", "#cPhone", "#cAddress", "#cNotes"].forEach(sel => {
      const el = $(sel);
      el?.addEventListener("input", refreshOrderText);
    });

    function refreshOrderText() {
      const name = ($("#cName")?.value || "").trim();
      const phone = ($("#cPhone")?.value || "").trim();
      const address = ($("#cAddress")?.value || "").trim();
      const notes = ($("#cNotes")?.value || "").trim();

      const lines = [];
      lines.push("🛒 ORDER FORM – 2FLY.GALLERIA");
      lines.push("");
      lines.push(`Name: ${name}`);
      lines.push(`Phone: ${phone}`);
      lines.push(`Address: ${address}`);
      if (notes) lines.push(`Notes: ${notes}`);
      lines.push("");
      lines.push("Order List:");

      cart.items.forEach(it => {
        const price = Number(it.price) || 0;
        const qty = Number(it.qty) || 0;
        const codePart = it.code ? ` – ${it.code}` : "";
        lines.push(`• ${it.name}${codePart} – x${qty} (${money(price)} each)`);
      });

      lines.push("");
      lines.push(`Total Amount: ${money(cartSubtotal())}`);
      lines.push(`Total Quantity: ${cartTotalQty()}`);

      const out = lines.join("\n");
      const ta = $("#orderText");
      if (ta) ta.value = out;
    }
  }

  function updateCartUI() {
    const count = $("#cartCount");
    const itemsWrap = $("#cartItems");
    const subtotalEl = $("#cartSubtotal");
    const totalQtyEl = $("#cartTotalQty");

    if (count) count.textContent = String(cartTotalQty());
    if (subtotalEl) subtotalEl.textContent = money(cartSubtotal());
    if (totalQtyEl) totalQtyEl.textContent = String(cartTotalQty());

    if (!itemsWrap) return;

    itemsWrap.innerHTML = "";
    if (!cart.items.length) {
      const d = document.createElement("div");
      d.style.color = "rgba(255,255,255,.55)";
      d.style.padding = "14px 0";
      d.textContent = "Your cart is empty.";
      itemsWrap.appendChild(d);
      return;
    }

    cart.items.forEach(it => {
      const row = document.createElement("div");
      row.className = "cartItem";
      row.innerHTML = `
        <img class="cartItem__img" src="${escapeHtmlAttr(it.image || "")}" alt="" onerror="this.style.opacity=.2" />
        <div>
          <div class="cartItem__name">${escapeHtml(it.name || "")}</div>
          <div class="cartItem__meta">${it.code ? `Code: ${escapeHtml(it.code)}` : ""}</div>
          <div class="cartItem__row">
            <div class="cartQty">
              <button type="button" data-dec="${it.id}">−</button>
              <input type="number" min="1" step="1" value="${Number(it.qty) || 1}" data-qty="${it.id}" />
              <button type="button" data-inc="${it.id}">+</button>
            </div>
            <div style="color:rgba(255,255,255,.75);font-weight:700;">${money((Number(it.price)||0) * (Number(it.qty)||0))}</div>
          </div>
        </div>
        <button class="trashBtn" type="button" data-del="${it.id}" aria-label="Remove item">🗑</button>
      `;
      itemsWrap.appendChild(row);
    });

    // events (delegated-ish)
    itemsWrap.querySelectorAll("[data-dec]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-dec");
        const item = findCartItem(id);
        if (!item) return;
        item.qty = Math.max(1, clampInt(item.qty, 1) - 1);
        saveCart(); updateCartUI();
      });
    });

    itemsWrap.querySelectorAll("[data-inc]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-inc");
        const item = findCartItem(id);
        if (!item) return;
        item.qty = clampInt(item.qty, 1) + 1;
        saveCart(); updateCartUI();
      });
    });

    itemsWrap.querySelectorAll("[data-qty]").forEach(inp => {
      inp.addEventListener("input", () => {
        const id = inp.getAttribute("data-qty");
        const item = findCartItem(id);
        if (!item) return;
        item.qty = clampInt(inp.value, 1);
        inp.value = String(item.qty);
        saveCart(); updateCartUI();
      });
    });

    itemsWrap.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        cart.items = cart.items.filter(x => String(x.id) !== String(id));
        saveCart(); updateCartUI();
      });
    });

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
    function escapeHtmlAttr(s) { return escapeHtml(s || ""); }
  }

  // ---------------- ADMIN ----------------
function initAdmin() {
  const root = document.querySelector('[data-page="admin"]');
  if (!root) return;

  const sb = getSupabase();
  const msgEl = document.getElementById('adminMsg');

  const setMsg = (text, isErr = false) => {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isErr ? 'rgba(255,90,90,.95)' : 'rgba(255,255,255,.70)';
  };

  // If config.js isn't filled, do NOT show popups. Just show a clear message.
  if (!sb) {
    setMsg('Supabase not configured. Edit config.js and set your project URL + anon key.', true);

    // Disable actions
    const btn = document.getElementById('createProductBtn');
    if (btn) btn.disabled = true;
    const up = document.getElementById('uploadFilesBtn');
    if (up) up.disabled = true;
    const addUrl = document.getElementById('addUrlBtn');
    if (addUrl) addUrl.disabled = true;
    return;
  }

  // Elements
  const aName = document.getElementById('aName');
  const aPrice = document.getElementById('aPrice');
  const aCode = document.getElementById('aCode');
  const aSku = document.getElementById('aSku');
  const aCategory = document.getElementById('aCategory');
  const aStatus = document.getElementById('aStatus');
  const aSoldOut = document.getElementById('aSoldOut');

  const aImageUrl = document.getElementById('aImageUrl');
  const addUrlBtn = document.getElementById('addUrlBtn');
  const aFiles = document.getElementById('aFiles');
  const uploadFilesBtn = document.getElementById('uploadFilesBtn');
  const imgList = document.getElementById('imgList');

  const createProductBtn = document.getElementById('createProductBtn');
  const adminProducts = document.getElementById('adminProducts');

  // Hide (or remove) setup gate if it exists
  const gate = document.getElementById('adminKeyGate');
  if (gate) gate.hidden = true;

  // Image staging
  let stagedImages = [];

  const esc = (s) => String(s || '').replace(/[&<>\"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function renderStaged() {
    if (!imgList) return;
    imgList.innerHTML = stagedImages.map((url, idx) => `
      <div class="imgChip">
        <img src="${esc(url)}" alt="" loading="lazy" />
        <div class="imgChip__row">
          <button class="imgChip__btn" type="button" data-rm="${idx}">Remove</button>
          <span style="color:rgba(255,255,255,.45); font-size:11px;">${idx + 1}</span>
        </div>
      </div>
    `).join('');

    imgList.querySelectorAll('button[data-rm]').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.getAttribute('data-rm'));
        stagedImages.splice(i, 1);
        renderStaged();
      });
    });
  }

  addUrlBtn?.addEventListener('click', () => {
    const u = (aImageUrl?.value || '').trim();
    if (!u) return;
    stagedImages.push(u);
    if (aImageUrl) aImageUrl.value = '';
    renderStaged();
  });

  async function uploadOne(file) {
    const safeName = String(file.name || 'image').replace(/[^a-z0-9_.-]/gi, '_');
    const path = `public/products/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;

    const { error } = await sb.storage.from('product_images').upload(path, file, { upsert: false });
    if (error) throw error;

    const { data } = sb.storage.from('product_images').getPublicUrl(path);
    return data?.publicUrl || '';
  }

  uploadFilesBtn?.addEventListener('click', async () => {
    const files = Array.from(aFiles?.files || []);
    if (!files.length) return;

    uploadFilesBtn.disabled = true;
    setMsg('Uploading images…');

    try {
      for (const f of files) {
        const url = await uploadOne(f);
        if (url) stagedImages.push(url);
      }
      if (aFiles) aFiles.value = '';
      renderStaged();
      setMsg('Images uploaded ✅');
    } catch (e) {
      console.error(e);
      setMsg(`Upload failed: ${e?.message || e}`, true);
    } finally {
      uploadFilesBtn.disabled = false;
    }
  });

  // Admin products list
  async function loadAdminProducts() {
    if (!adminProducts) return;
    setMsg('Loading products…');

    // Try to select sku/images; fallback if columns don't exist.
    let query = sb.from('products')
      .select('id, created_at, name, price, image_url, images, code, category, status, sold_out, sku')
      .order('created_at', { ascending: false });

    let { data, error } = await query;
    if (error) {
      ({ data, error } = await sb.from('products')
        .select('id, created_at, name, price, image_url, code, category, status, sold_out')
        .order('created_at', { ascending: false }));
    }

    if (error) {
      console.error(error);
      setMsg(`Load failed: ${error.message}`, true);
      return;
    }

    setMsg('');

    const list = data || [];
    adminProducts.innerHTML = list.map((p) => {
      const img = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.image_url || '');
      const meta = [
        p.code ? `Code: ${p.code}` : null,
        p.sku ? `SKU: ${p.sku}` : null,
        p.category ? `Category: ${p.category}` : null,
        `₱${Number(p.price || 0)}`,
        p.status ? `Status: ${p.status}` : null,
        p.sold_out ? 'SOLD OUT' : null,
      ].filter(Boolean).join(' • ');

      return `
        <div class="adminItem">
          <div class="adminItem__top">
            <div>
              <div class="adminItem__name">${esc(p.name || '')}</div>
              <div class="adminItem__meta">${esc(meta)}</div>
              ${img ? `<div style="margin-top:10px;"><img src="${esc(img)}" alt="" style="width:120px;height:84px;object-fit:cover;border:1px solid rgba(255,255,255,.12);"/></div>` : ''}
            </div>
            <div class="adminItem__btns">
              <button class="btn btn--ghost" type="button" data-del="${p.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    adminProducts.querySelectorAll('button[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del');
        if (!id) return;

        setMsg('Deleting…');
        const { error: delErr } = await sb.from('products').delete().eq('id', id);
        if (delErr) {
          console.error(delErr);
          setMsg(`Delete failed: ${delErr.message}`, true);
          return;
        }
        setMsg('Deleted ✅');
        loadAdminProducts();
      });
    });
  }

  // Create product
  createProductBtn?.addEventListener('click', async () => {
    const name = (aName?.value || '').trim();
    const price = Number((aPrice?.value || '').trim());
    const code = (aCode?.value || '').trim();
    const sku = (aSku?.value || '').trim();
    const category = (aCategory?.value || 'Earrings');
    const status = (aStatus?.value || 'active');
    const sold_out = Boolean(aSoldOut?.checked);

    if (!name) return setMsg('Name is required.', true);
    if (!Number.isFinite(price) || price <= 0) return setMsg('Price must be a number (e.g. 38).', true);

    const images = stagedImages.slice();
    const image_url = images[0] || null;

    createProductBtn.disabled = true;
    setMsg('Creating product…');

    // Try with sku/images; fallback if table doesn't have those columns.
    let payload = { name, price, code, category, status, sold_out, image_url, images, sku };

    let { error } = await sb.from('products').insert(payload);

    if (error && /column .*sku/i.test(error.message || '')) {
      delete payload.sku;
      ({ error } = await sb.from('products').insert(payload));
    }
    if (error && /column .*images/i.test(error.message || '')) {
      delete payload.images;
      ({ error } = await sb.from('products').insert(payload));
    }

    if (error) {
      console.error(error);
      setMsg(`Create failed: ${error.message}`, true);
      createProductBtn.disabled = false;
      return;
    }

    setMsg('Created ✅');

    // Reset
    if (aName) aName.value = '';
    if (aPrice) aPrice.value = '';
    if (aCode) aCode.value = '';
    if (aSku) aSku.value = '';
    if (aCategory) aCategory.value = 'Earrings';
    if (aStatus) aStatus.value = 'active';
    if (aSoldOut) aSoldOut.checked = false;
    stagedImages = [];
    renderStaged();

    createProductBtn.disabled = false;
    loadAdminProducts();
  });

  // First load
  loadAdminProducts();
}

function bootstrap() {
  const page = document.body?.dataset?.page;
  if (page === 'shop') initShop();
  if (page === 'admin') initAdmin();
}

document.addEventListener('DOMContentLoaded', bootstrap);
