// ====== CONFIGURACIÓN: editá solo esta parte para empezar ======
const CONFIG = {
  // Número con código de país, sin + ni espacios. Ej Argentina móvil: 5491123456789
  whatsapp: "5491178142528",
  claveCarrito: "duque-orate-carrito", // nombre con el que se guarda el pedido en el navegador
  claveModo: "duque-orate-modo", // recuerda si la persona eligió "Casa / Estudio" o "Empresas"
  // Barra de confianza de arriba: sumá, sacá o cambiá frases. En celulares solo se ve la primera. Vacío ([]) = sin barra.
  promo: ["Productos nuevos, en caja original", "Retiro sin costo en San Miguel", "Atención por WhatsApp todos los días"],
  // Mensajes que se cargan solos al tocar WhatsApp, según el modo elegido arriba
  mensajesWhatsapp: {
    casa: "¡Hola! Me interesa un producto de Duque Orate y tengo algunas consultas. ¿Me pasan más información?",
    empresas: "¡Hola! Quiero equipar puestos de trabajo de mi empresa. ¿Me pasan una cotización?",
  },
  // Frases que se alternan en la pestaña del navegador cuando la persona se va a otra pestaña.
  // Sumá, sacá o cambiá las que quieras. Lista vacía ([]) = sin efecto.
  titulosPestana: [
    "El nombre es medio loco. La forma de trabajar, no.",
    "Duque Orate, tecnología con criterio",
    "¿Te ayudamos a elegir? Escribinos",
  ],
  maxPorItem: 99,
};

// Zonas de entrega. costo: número en pesos, 0 = gratis, null = "A coordinar".
const ZONAS = [
  { id: "retiro", nombre: "Retiro / punto de encuentro", costo: 0 },
  { id: "caba", nombre: "CABA", costo: null },
  { id: "gba", nombre: "Gran Buenos Aires", costo: null },
  { id: "interior", nombre: "Resto del país (Andreani / OCA)", costo: null },
];

// PRODUCTS y KITS ahora se cargan desde catalogo.js, que se genera con la planilla de productos.
// ================================================================

// Nombre visible de cada filtro. Solo aparecen los filtros que tienen al menos un producto cargado.
const NOMBRES_FILTRO = { teclado: "Teclados", mouse: "Mouses", auriculares: "Auriculares", webcam: "Webcams", parlante: "Parlantes", pendrive: "Pendrives", impresoras: "Impresoras", otros: "Otros" };
const USOS = { todos: "Todos" };
Object.keys(NOMBRES_FILTRO).forEach((k) => {
  if (PRODUCTS.some((p) => (p.categorias || []).includes(k))) USOS[k] = NOMBRES_FILTRO[k];
});
const CATALOGO = [...PRODUCTS, ...KITS]; // para buscar un ítem por su id
const PRODUCTOS_VISIBLES = 8; // cuántas tarjetas se muestran antes de necesitar "ver más"
const KITS_VISIBLES = 4; // ídem para kits
const BENTO_PRODUCTOS = 4; // productos en la portada: primero los marcados "Destacado"/"En portada", después se completa con el resto
let modo = "casa"; // "casa" o "empresas", lo cambia el selector del header
let filtroActual = "todos";
let productosExpandido = false;
let kitsExpandido = false;
let carrito = {}; // formato: { "id-del-producto": cantidad }. Se carga en DOMContentLoaded

const $ = (sel) => document.querySelector(sel);
const waLink = (texto) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`;
const formatoPrecio = (p) => (p == null ? "Consultar precio" : `$${p.toLocaleString("es-AR")}`);
// Precio que se muestra en tarjetas: en modo Empresas aclara que es por unidad
const precioVisible = (item) => formatoPrecio(item.precio) + (modo === "empresas" && item.precio != null ? " c/u" : "");
const buscar = (id) => CATALOGO.find((x) => x.id === id);
const zonaActual = () => ZONAS.find((z) => z.id === $("#cart-zona").value) || ZONAS[0];
const textoCosto = (z) => (z.costo == null ? "A coordinar" : z.costo === 0 ? "Sin costo" : formatoPrecio(z.costo));

// ---------- Carrito: datos ----------
function cargarCarrito() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CONFIG.claveCarrito)) || {};
    // descarta ids que ya no existen en el catálogo
    return Object.fromEntries(Object.entries(guardado).filter(([id, q]) => buscar(id) && q > 0));
  } catch (err) {
    console.warn("No se pudo leer el carrito guardado:", err);
    return {}; // si el navegador bloquea el almacenamiento, arranca vacío
  }
}

function guardarCarrito() {
  try {
    localStorage.setItem(CONFIG.claveCarrito, JSON.stringify(carrito));
  } catch (err) {
    console.warn("No se pudo guardar el carrito:", err);
  }
}

function cambiarCantidad(id, delta) {
  const nueva = Math.min(CONFIG.maxPorItem, (carrito[id] || 0) + delta);
  if (nueva <= 0) delete carrito[id];
  else carrito[id] = nueva;
  guardarCarrito();
  renderCarrito();
  if (delta > 0) {
    const b = $("#cart-btn");
    b.classList.add("bump");
    setTimeout(() => b.classList.remove("bump"), 250);
  }
}

function totalUnidades() {
  return Object.values(carrito).reduce((a, b) => a + b, 0);
}

// Devuelve el total solo si TODOS los ítems tienen precio; si no, null
function calcularTotal() {
  let total = 0;
  for (const [id, q] of Object.entries(carrito)) {
    const { precio } = buscar(id);
    if (precio == null) return null;
    total += precio * q;
  }
  return total;
}

// ---------- Tarjetas de productos y kits ----------
// Fotos de un ítem: las propias o, si es un kit sin fotos, la primera de cada componente
function fotosDe(item) {
  if (item.fotos && item.fotos.length) return item.fotos;
  return (item.componentes || []).map((c) => (buscar(c.id) || {}).fotos?.[0]).filter(Boolean);
}

function crearMedia(item) {
  const media = document.createElement("div");
  media.className = "media";
  const fotos = fotosDe(item);
  const esCollage = !(item.fotos && item.fotos.length) && fotos.length > 1;
  if (!fotos.length) {
    media.classList.add("sin-foto");
    media.textContent = "Foto próximamente";
    return media;
  }
  if (esCollage) {
    media.classList.add("collage");
    fotos.slice(0, 4).forEach((src) => {
      const img = document.createElement("img");
      img.src = src; img.alt = ""; img.loading = "lazy";
      media.append(img);
    });
    return media;
  }
  const img = document.createElement("img");
  img.src = fotos[0]; img.alt = item.nombre; img.loading = "lazy";
  media.append(img);
  if (fotos.length > 1) {
    const dots = document.createElement("div");
    dots.className = "dots";
    let actual = 0;
    const ir = (i) => {
      actual = (i + fotos.length) % fotos.length;
      img.src = fotos[actual];
      dots.querySelectorAll("button").forEach((d, j) => d.setAttribute("aria-current", j === actual));
    };
    fotos.forEach((_, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.setAttribute("aria-label", `Foto ${i + 1} de ${item.nombre}`);
      d.setAttribute("aria-current", i === 0);
      d.addEventListener("click", (e) => { e.stopPropagation(); ir(i); });
      dots.append(d);
    });
    img.addEventListener("click", () => ir(actual + 1));
    img.style.cursor = "pointer";
    media.append(dots);
  }
  return media;
}

function crearCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const h3 = document.createElement("h3");
  h3.textContent = item.nombre;
  const p = document.createElement("p");
  p.textContent = item.detalle;
  card.append(crearMedia(item), h3, p);

  if (item.componentes && item.componentes.length) {
    const ul = document.createElement("ul");
    ul.className = "incluye";
    item.componentes.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.cantidad} × ${buscar(c.id).nombre}`;
      ul.append(li);
    });
    card.append(ul);
  }

  card.append(crearPie(item, "card-foot"));
  return card;
}

// Botón redondo "+" que suma una unidad al carrito y muestra un ✓ un instante
function crearBotonMas(item) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "add-btn";
  btn.textContent = "+";
  btn.setAttribute("aria-label", `Agregar ${item.nombre} al carrito`);
  btn.addEventListener("click", () => {
    cambiarCantidad(item.id, 1);
    btn.textContent = "✓";
    btn.classList.add("ok");
    setTimeout(() => { btn.textContent = "+"; btn.classList.remove("ok"); }, 1000);
  });
  return btn;
}

// Fila de abajo de cada tarjeta: precio a la izquierda, "+" a la derecha
function crearPie(item, clase) {
  const pie = document.createElement("div");
  pie.className = clase;
  const pr = document.createElement("p");
  pr.className = "price";
  pr.textContent = precioVisible(item);
  pie.append(pr, crearBotonMas(item));
  return pie;
}

function renderProductos() {
  const grid = $("#product-grid");
  grid.replaceChildren();
  const filtrados = PRODUCTS.filter((x) => filtroActual === "todos" || (x.categorias || []).includes(filtroActual));
  const visibles = productosExpandido ? filtrados : filtrados.slice(0, PRODUCTOS_VISIBLES);
  visibles.forEach((x) => grid.append(crearCard(x)));
  const btn = $("#product-ver-mas");
  if (btn) btn.hidden = filtrados.length <= visibles.length;
}

// Aplica un filtro tanto desde los botones de #filters como desde los links de categorías del hero
function aplicarFiltro(clave) {
  if (!USOS[clave]) return;
  filtroActual = clave;
  productosExpandido = false;
  $("#filters").querySelectorAll(".filter").forEach((el) => el.setAttribute("aria-pressed", el.dataset.clave === clave));
  renderProductos();
}

function renderFiltros() {
  const cont = $("#filters");
  Object.entries(USOS).forEach(([clave, texto]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filter";
    b.textContent = texto;
    b.dataset.clave = clave;
    b.setAttribute("aria-pressed", clave === filtroActual);
    b.addEventListener("click", () => aplicarFiltro(clave));
    cont.append(b);
  });
}

// Links de categorías del hero ("Teclados", "Webcams", etc.): además de llevar a #productos, aplican el filtro.
function iniciarCatsHero() {
  const ul = $("#hero-cats");
  if (!ul) return;
  Object.entries(USOS).forEach(([clave, texto]) => {
    if (clave === "todos") return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#productos";
    a.textContent = texto;
    a.addEventListener("click", () => aplicarFiltro(clave));
    li.append(a);
    ul.append(li);
  });
  if (KITS.length) {
    const li = document.createElement("li");
    li.innerHTML = '<a href="#kits">Kits armados</a>';
    ul.append(li);
  }
}

function renderKits() {
  const grid = $("#kit-grid");
  grid.replaceChildren();
  const visibles = kitsExpandido ? KITS : KITS.slice(0, KITS_VISIBLES);
  visibles.forEach((k) => grid.append(crearCard(k)));
  const btn = $("#kit-ver-mas");
  if (btn) btn.hidden = KITS.length <= visibles.length;
}

// ---------- Botones "ver más" ----------
function iniciarVerMas() {
  const btnProductos = $("#product-ver-mas");
  if (btnProductos) {
    btnProductos.addEventListener("click", () => {
      productosExpandido = true;
      renderProductos();
    });
  }
  const btnKits = $("#kit-ver-mas");
  if (btnKits) {
    btnKits.addEventListener("click", () => {
      kitsExpandido = true;
      renderKits();
    });
  }
}

// ---------- Carrito: pantalla ----------
function renderCarrito() {
  const lista = $("#cart-items");
  lista.replaceChildren();

  Object.entries(carrito).forEach(([id, q]) => {
    const item = buscar(id);
    const li = document.createElement("li");
    li.className = "cart-item";

    const info = document.createElement("div");
    const nombre = document.createElement("strong");
    nombre.textContent = item.nombre;
    const sub = document.createElement("small");
    sub.textContent = item.precio == null ? "Precio a confirmar" : formatoPrecio(item.precio * q);
    info.append(nombre, sub);

    const qty = document.createElement("div");
    qty.className = "qty";
    const menos = document.createElement("button");
    menos.type = "button";
    menos.textContent = "−";
    menos.setAttribute("aria-label", `Quitar una unidad de ${item.nombre}`);
    menos.addEventListener("click", () => cambiarCantidad(id, -1));
    const cant = document.createElement("span");
    cant.textContent = q;
    const mas = document.createElement("button");
    mas.type = "button";
    mas.textContent = "+";
    mas.setAttribute("aria-label", `Agregar una unidad de ${item.nombre}`);
    mas.addEventListener("click", () => cambiarCantidad(id, 1));
    qty.append(menos, cant, mas);

    li.append(info, qty);
    lista.append(li);
  });

  const vacio = totalUnidades() === 0;
  $("#cart-empty").hidden = !vacio;
  $("#cart-count").textContent = totalUnidades();
  const total = calcularTotal();
  const z = zonaActual();
  $("#cart-envio").textContent = vacio ? "" : `Envío (${z.nombre}): ${textoCosto(z)}`;
  const totalFinal = total == null || z.costo == null ? null : total + z.costo;
  $("#cart-total").textContent = vacio ? "" : totalFinal == null ? "Total: a confirmar por WhatsApp" : `Total: ${formatoPrecio(totalFinal)}`;
}

// ---------- Zonas de entrega ----------
function renderZonas() {
  const cuerpo = $("#zonas-body");
  const select = $("#cart-zona");
  ZONAS.forEach((z) => {
    const tr = document.createElement("tr");
    [z.nombre, textoCosto(z)].forEach((t) => {
      const td = document.createElement("td");
      td.textContent = t;
      tr.append(td);
    });
    cuerpo.append(tr);
    const op = document.createElement("option");
    op.value = z.id;
    op.textContent = z.nombre;
    select.append(op);
  });
  select.addEventListener("change", renderCarrito);
}

// ---------- Carrito: abrir, cerrar y enviar ----------
function abrirCarrito() {
  $("#cart").hidden = false;
  $("#overlay").hidden = false;
  $("#cart-btn").setAttribute("aria-expanded", "true");
  $("#cart-close").focus();
}

function cerrarCarrito() {
  $("#cart").hidden = true;
  $("#overlay").hidden = true;
  $("#cart-btn").setAttribute("aria-expanded", "false");
  $("#cart-btn").focus();
}

function armarMensaje() {
  const nombre = $("#cart-nombre").value.trim();
  const nota = $("#cart-nota").value.trim();
  const lineas = Object.entries(carrito).map(([id, q]) => {
    const item = buscar(id);
    const precio = item.precio == null ? "" : ` (${formatoPrecio(item.precio)} c/u)`;
    return `- ${q} x ${item.nombre}${precio}`;
  });
  const total = calcularTotal();
  return [
    `Hola, soy ${nombre}. Quiero hacer este pedido:`,
    ...lineas,
    `Entrega: ${zonaActual().nombre} (envío: ${textoCosto(zonaActual())}).`,
    `Medio de pago: ${$("#cart-pago").value}.`,
    total == null ? "Total: a confirmar." : `Total de productos: ${formatoPrecio(total)}.`,
    nota ? `Notas: ${nota}` : "",
  ].filter(Boolean).join("\n");
}

function enviarPedido() {
  const error = $("#cart-error");
  if (totalUnidades() === 0) {
    error.textContent = "Agregá al menos un producto.";
    return;
  }
  if (!$("#cart-nombre").value.trim()) {
    error.textContent = "Ingresá tu nombre.";
    $("#cart-nombre").focus();
    return;
  }
  error.textContent = "";
  window.open(waLink(armarMensaje()), "_blank", "noopener");
}

function iniciarCarrito() {
  $("#cart-btn").addEventListener("click", abrirCarrito);
  $("#cart-close").addEventListener("click", cerrarCarrito);
  $("#overlay").addEventListener("click", cerrarCarrito);
  $("#cart-send").addEventListener("click", enviarPedido);
  $("#cart-clear").addEventListener("click", () => {
    carrito = {};
    guardarCarrito();
    renderCarrito();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#cart").hidden) cerrarCarrito();
  });
  renderCarrito();
}

// ---------- Menú móvil y formulario de contacto ----------
function iniciarMenu() {
  const btn = $("#menu-btn");
  const nav = $("#nav");
  btn.addEventListener("click", () => {
    const abierto = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", abierto);
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    })
  );
}

function iniciarFormulario() {
  const form = $("#contact-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = form.nombre.value.trim();
    const mensaje = form.mensaje.value.trim();
    $("#err-nombre").textContent = nombre ? "" : "Ingresá tu nombre.";
    $("#err-mensaje").textContent = mensaje ? "" : "Contanos qué necesitás.";
    if (!nombre || !mensaje) return;

    const empresa = form.empresa.value.trim();
    const quien = empresa ? `${nombre}, de ${empresa}` : nombre;
    const texto = `Hola, soy ${quien}. Es para: ${form.uso.value}. ${mensaje}`;
    window.open(waLink(texto), "_blank", "noopener");
  });
}

// ---------- Botón flotante de WhatsApp ----------
function iniciarWhatsappFloat() {
  const btn = $("#wa-float");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.open(waLink(CONFIG.mensajesWhatsapp[modo]), "_blank", "noopener");
  });
}

// ---------- Eslóganes en la pestaña cuando la persona se va a otra ----------
function iniciarTituloPestana() {
  if (!CONFIG.titulosPestana.length) return;
  const original = document.title;
  let reloj = null;
  let i = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      const frases = totalUnidades() > 0 ? ["Tenés productos en el carrito", ...CONFIG.titulosPestana] : CONFIG.titulosPestana;
      // El primer cambio es inmediato; después alterna con el título original cada 2,5 s
      const mostrar = () => {
        document.title = i % 2 === 0 ? frases[(i / 2) % frases.length] : original;
        i++;
      };
      mostrar();
      reloj = setInterval(mostrar, 2500);
    } else {
      clearInterval(reloj);
      document.title = original;
      i = 0;
    }
  });
}

// ---------- Portada bento: productos destacados en los casilleros ----------
function elegirDestacados() {
  const conFoto = PRODUCTS.filter((x) => fotosDe(x).length);
  const marcados = conFoto.filter((x) => x.destacado || x.portada).sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));
  const resto = conFoto.filter((x) => !marcados.includes(x));
  return [...marcados, ...resto].slice(0, BENTO_PRODUCTOS);
}

function renderBento() {
  const elegidos = elegirDestacados();
  document.querySelectorAll(".bento [data-slot]").forEach((tile) => {
    const item = elegidos[Number(tile.dataset.slot)];
    tile.replaceChildren();
    tile.hidden = !item;
    if (!item) return;
    const titulo = document.createElement("h3");
    titulo.textContent = item.nombre;
    if (tile.classList.contains("tile-wide")) {
      const info = document.createElement("div");
      info.className = "tile-info";
      const etiqueta = document.createElement("span");
      etiqueta.className = "mono";
      etiqueta.textContent = item.destacado ? "Destacado" : "Recomendado";
      info.append(etiqueta, titulo, crearPie(item, "tile-foot"));
      tile.append(crearMedia(item), info);
    } else {
      tile.append(crearMedia(item), titulo, crearPie(item, "tile-foot"));
    }
  });

  // Casillero de kits: los 2 primeros, cada uno con su "+"
  const lista = $("#tile-kits-list");
  lista.replaceChildren();
  KITS.slice(0, 2).forEach((k) => {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "kit-info";
    const nombre = document.createElement("strong");
    nombre.textContent = k.nombre;
    const detalle = document.createElement("small");
    detalle.textContent = (k.componentes || []).map((c) => (buscar(c.id) || {}).nombre).filter(Boolean).join(" + ");
    const pr = document.createElement("span");
    pr.className = "price";
    pr.textContent = precioVisible(k);
    info.append(nombre, detalle, pr);
    li.append(info, crearBotonMas(k));
    lista.append(li);
  });
  $("#tile-kits").hidden = !KITS.length;
}

// ---------- Selector "Casa / Estudio" – "Empresas" ----------
function aplicarModo(nuevo, guardar = true) {
  modo = nuevo === "empresas" ? "empresas" : "casa";
  document.body.dataset.modo = modo;
  document.querySelectorAll(".modo-btn").forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === modo));
  $("#tile-wa").href = waLink(CONFIG.mensajesWhatsapp[modo]);
  // En el formulario de contacto, deja preseleccionado el uso que corresponde
  const uso = $("#uso");
  if (uso) uso.selectedIndex = modo === "empresas" ? 2 : 0;
  if (guardar) {
    try { localStorage.setItem(CONFIG.claveModo, modo); } catch (err) { /* sin almacenamiento: no pasa nada */ }
  }
  renderBento();
  renderProductos();
  renderKits();
}

function iniciarModo() {
  document.querySelectorAll(".modo-btn").forEach((b) => b.addEventListener("click", () => aplicarModo(b.dataset.modo)));
  let guardado = "casa";
  try { guardado = localStorage.getItem(CONFIG.claveModo) || "casa"; } catch (err) { /* idem */ }
  aplicarModo(guardado, false);
}

// ---------- Cotizador para empresas ----------
function iniciarCotizador() {
  const form = $("#cotizador-form");
  if (!form) return;
  const opciones = form.querySelectorAll(".opcion");
  opciones.forEach((b) => b.addEventListener("click", () => opciones.forEach((o) => o.setAttribute("aria-pressed", o === b))));
  form.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true"))
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const puestos = (form.querySelector('.opcion[aria-pressed="true"]') || {}).dataset?.puestos || "varios puestos";
    const necesidades = [...form.querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.necesidad);
    const error = $("#cot-error");
    if (!necesidades.length) {
      error.textContent = "Elegí al menos una opción de lo que necesitás.";
      return;
    }
    error.textContent = "";
    const empresa = $("#cot-empresa").value.trim();
    const texto = `Hola${empresa ? `, les escribo de ${empresa}` : ""}. Quiero cotizar ${puestos} con: ${necesidades.join(", ")}.`;
    window.open(waLink(texto), "_blank", "noopener");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  carrito = cargarCarrito();
  const promo = $("#promo");
  CONFIG.promo.forEach((frase) => {
    const s = document.createElement("span");
    s.className = "promo-item";
    s.textContent = frase;
    promo.append(s);
  });
  promo.hidden = !CONFIG.promo.length;
  $("#year").textContent = new Date().getFullYear();
  renderFiltros();
  renderZonas();
  iniciarModo(); // dibuja portada, productos y kits según el modo guardado
  iniciarMenu();
  iniciarFormulario();
  iniciarCarrito();
  iniciarWhatsappFloat();
  iniciarTituloPestana();
  iniciarCotizador();
  iniciarCatsHero();
  iniciarVerMas();
});