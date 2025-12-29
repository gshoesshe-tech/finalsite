/* global supabase */
(() => {
  const SUPABASE_URL = window.__SUPABASE_URL__ || "https://pbtzrqptstpbwligsfjn.supabase.co";
const DEFAULT_ANON_KEY = window.__SUPABASE_ANON_KEY__ || "";
  const LS_KEY = "sb_anon_key_v1";
  const CURRENCY = "₱";

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

  function getAnonKey() {
    return (DEFAULT_ANON_KEY || localStorage.getItem(LS_KEY) || "").trim();
  }

  function setAnonKey(key) {
    localStorage.setItem(LS_KEY, (key || "").trim());
  }

  function hasSupabase() {
    return typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function";
  }

  function createSb() {
    const key = getAnonKey();
    if (!key || !hasSupabase()) return null;
    return window.supabase.createClient(SUPABASE_URL, key);
  }

  function money(n) {
    const num = Number(n || 0);
    if (!Number.isFinite(num)) return `${CURRENCY}0`;
    // keep it clean (no decimals for your pricing like 38)
    const clean = Number.isInteger(num) ? num.toString() : num.toFixed(2);
    return `${CURRENCY}${clean}`;
  }

  // ---------------- LANDING ----------------
  function initLanding() {
    const video = $("#landingVideo");
    const enterBtn = $("#enterBtn");
    const fade = $("#enterFade");
    const soundBtn = $("#soundBtn");
    const soundWaves = $("#soundWaves");

    if (soundBtn && video) {
      soundBtn.addEventListener("click", () => {
        // user gesture -> allowed to unmute
        const nowMuted = !video.muted;
        video.muted = nowMuted;
        if (!nowMuted) {
          // going unmuted -> ensure playback
          video.play().catch(() => {});
        }
        // waves visible only when unmuted
        soundWaves.style.display = video.muted ? "none" : "";
      });

      // start muted, hide waves? (in your reference, speaker indicates tap)
      video.muted = true;
      soundWaves.style.display = "none";
    }

    if (enterBtn) {
      enterBtn.addEventListener("click", () => {
        fade.classList.add("is-on");
        setTimeout(() => {
          window.location.href = "./shop.html";
        }, 320);
      });
    }
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
    const gate = $("#adminKeyGate");
    const keyInput = $("#adminAnonKeyInput");
    const saveBtn = $("#adminSaveAnonKeyBtn");

    const msg = $("#adminMsg");

    if (!getAnonKey()) {
      gate.hidden = false;
      saveBtn.addEventListener("click", () => {
        setAnonKey(keyInput.value);
        gate.hidden = true;
        window.location.reload();
      });
      return;
    }
    gate.hidden = true;

    const sb = createSb();
    if (!sb) return;

    const imgList = $("#imgList");
    let images = [];

    function renderImgList() {
      imgList.innerHTML = "";
      images.forEach((url, idx) => {
        const chip = document.createElement("div");
        chip.className = "imgChip";
        chip.innerHTML = `
          <img src="${escapeHtmlAttr(url)}" alt="" />
          <div class="imgChip__row">
            <span style="color:rgba(255,255,255,.55);font-size:12px;">#${idx+1}</span>
            <button class="imgChip__btn" type="button" data-rm="${idx}">Remove</button>
          </div>
        `;
        chip.querySelector("[data-rm]")?.addEventListener("click", () => {
          images.splice(idx, 1);
          renderImgList();
        });
        imgList.appendChild(chip);
      });
    }

    $("#addUrlBtn")?.addEventListener("click", () => {
      const u = ($("#aImageUrl")?.value || "").trim();
      if (!u) return;
      images.push(u);
      $("#aImageUrl").value = "";
      renderImgList();
    });

    $("#uploadFilesBtn")?.addEventListener("click", async () => {
      const files = $("#aFiles")?.files;
      if (!files || !files.length) return;

      msg.textContent = "Uploading…";
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `public/uploads/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

        const { error: upErr } = await sb.storage.from("product_images").upload(path, file, {
          cacheControl: "3600",
          upsert: false
        });
        if (upErr) {
          console.error(upErr);
          msg.textContent = `Upload failed: ${upErr.message}`;
          return;
        }

        const { data: pub } = sb.storage.from("product_images").getPublicUrl(path);
        if (pub?.publicUrl) images.push(pub.publicUrl);
      }
      renderImgList();
      msg.textContent = "Uploaded ✅";
      $("#aFiles").value = "";
    });

    $("#createProductBtn")?.addEventListener("click", async () => {
      const name = ($("#aName")?.value || "").trim();
      const price = Number(($("#aPrice")?.value || "").trim());
      const code = ($("#aCode")?.value || "").trim();
      const sku = ($("#aSku")?.value || "").trim();
      const category = ($("#aCategory")?.value || "Earrings").trim();
      const status = ($("#aStatus")?.value || "active").trim();
      const sold_out = !!$("#aSoldOut")?.checked;

      if (!name || !Number.isFinite(price)) {
        msg.textContent = "Name + valid price required.";
        return;
      }

      msg.textContent = "Creating…";

      const payload = {
        name,
        price,
        code: code || null,
        sku: sku || null,
        category,
        status,
        sold_out,
        // keep compatibility with old column too
        image_url: images[0] || null,
        images: images.length ? images : null
      };

      const { error } = await sb.from("products").insert(payload);
      if (error) {
        console.error(error);
        msg.textContent = `Error: ${error.message}`;
        return;
      }

      msg.textContent = "Created ✅";
      // reset
      ["#aName","#aPrice","#aCode","#aSku","#aImageUrl"].forEach(s => { const el = $(s); if (el) el.value=""; });
      $("#aCategory").value = "Earrings";
      $("#aStatus").value = "active";
      $("#aSoldOut").checked = false;
      images = [];
      renderImgList();
      await loadAdminProducts();
    });

    async function loadAdminProducts() {
      const wrap = $("#adminProducts");
      wrap.innerHTML = "Loading…";

      const { data, error } = await sb
        .from("products")
        .select("id,name,price,code,sku,category,status,sold_out,image_url,images,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        wrap.innerHTML = `Error: ${escapeHtml(error.message)}`;
        return;
      }

      wrap.innerHTML = "";
      (data || []).forEach(p => {
        const item = document.createElement("div");
        item.className = "adminItem";

        const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
        const imgPreview = (imgs[0] || p.image_url || "");

        item.innerHTML = `
          <div class="adminItem__top">
            <div>
              <div class="adminItem__name">${escapeHtml(p.name || "")}</div>
              <div class="adminItem__meta">
                ${escapeHtml(p.category || "Earrings")} • ${escapeHtml(p.status || "active")} • ${p.sold_out ? "sold_out" : "in_stock"} • ${money(p.price)}
                ${p.sku ? ` • SKU: ${escapeHtml(p.sku)}` : ""} ${p.code ? ` • Code: ${escapeHtml(p.code)}` : ""}
              </div>
            </div>
            <div class="adminItem__btns">
              <button class="btn btn--ghost" type="button" data-edit="${p.id}">Edit</button>
              <button class="btn btn--solid" type="button" data-del="${p.id}">Delete</button>
            </div>
          </div>
          ${imgPreview ? `<div style="margin-top:10px;"><img src="${escapeHtmlAttr(imgPreview)}" style="width:120px;height:120px;object-fit:cover;border:1px solid rgba(255,255,255,.12)"/></div>` : ""}
          <div class="adminEdit" hidden data-panel="${p.id}" style="margin-top:12px;">
            <div class="adminGrid">
              <input class="input" data-f="name" value="${escapeHtmlAttr(p.name || "")}" />
              <input class="input" data-f="price" value="${escapeHtmlAttr(p.price || "")}" />
              <input class="input" data-f="code" value="${escapeHtmlAttr(p.code || "")}" placeholder="Code" />
              <input class="input" data-f="sku" value="${escapeHtmlAttr(p.sku || "")}" placeholder="SKU" />
              <select class="input" data-f="category">
                <option ${String(p.category).toLowerCase()==="earrings"?"selected":""} value="Earrings">Earrings</option>
                <option ${String(p.category).toLowerCase()==="necklaces"?"selected":""} value="Necklaces">Necklaces</option>
                <option ${String(p.category).toLowerCase()==="boxers"?"selected":""} value="Boxers">Boxers</option>
              </select>
              <select class="input" data-f="status">
                <option ${String(p.status).toLowerCase()==="active"?"selected":""} value="active">active</option>
                <option ${String(p.status).toLowerCase()==="inactive"?"selected":""} value="inactive">inactive</option>
              </select>
              <label class="checkRow">
                <input type="checkbox" data-f="sold_out" ${p.sold_out ? "checked":""} />
                <span>Sold out</span>
              </label>
              <input class="input" data-f="images" value="${escapeHtmlAttr((Array.isArray(p.images)&&p.images.length?p.images.join(", "):""))}" placeholder="images[] URLs comma-separated" />
            </div>
            <div style="display:flex;gap:10px;margin-top:10px;">
              <button class="btn btn--solid" type="button" data-save="${p.id}">Save</button>
              <button class="btn btn--ghost" type="button" data-cancel="${p.id}">Cancel</button>
            </div>
          </div>
        `;

        item.querySelector("[data-edit]")?.addEventListener("click", () => {
          item.querySelector(`[data-panel="${p.id}"]`)?.toggleAttribute("hidden");
        });

        item.querySelector("[data-cancel]")?.addEventListener("click", () => {
          item.querySelector(`[data-panel="${p.id}"]`)?.setAttribute("hidden", "");
        });

        item.querySelector("[data-del]")?.addEventListener("click", async () => {
          if (!confirm("Delete this product?")) return;
          const { error: delErr } = await sb.from("products").delete().eq("id", p.id);
          if (delErr) {
            alert(delErr.message);
            return;
          }
          await loadAdminProducts();
        });

        item.querySelector("[data-save]")?.addEventListener("click", async () => {
          const panel = item.querySelector(`[data-panel="${p.id}"]`);
          const fields = {};
          panel.querySelectorAll("[data-f]").forEach(el => {
            const f = el.getAttribute("data-f");
            if (f === "sold_out") fields[f] = !!el.checked;
            else fields[f] = (el.value || "").trim();
          });

          const upd = {
            name: fields.name,
            price: Number(fields.price),
            code: fields.code || null,
            sku: fields.sku || null,
            category: fields.category || "Earrings",
            status: fields.status || "active",
            sold_out: !!fields.sold_out
          };

          // images parsing
          const imgRaw = (fields.images || "").trim();
          const arr = imgRaw ? imgRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
          upd.images = arr.length ? arr : null;
          upd.image_url = arr[0] || null;

          const { error: upErr } = await sb.from("products").update(upd).eq("id", p.id);
          if (upErr) {
            alert(upErr.message);
            return;
          }
          await loadAdminProducts();
        });

        wrap.appendChild(item);
      });
    }

    loadAdminProducts();

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

  // ---------------- Bootstrap ----------------
  function bootstrap() {
    const page = document.body?.dataset?.page;

    if (page === "landing") initLanding();
    if (page === "shop") initShop();
    if (page === "admin") initAdmin();
  }

  // expose these for shop UI usage
  window.__updateCartUI = updateCartUI;
  window.__money = money;

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
