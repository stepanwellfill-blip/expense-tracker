// ===== Константы =====
const STORAGE_KEY = "expenses_v1";

const CATEGORIES = [
  "Продукты",
  "Транспорт",
  "Кафе",
  "Развлечения",
  "Здоровье",
  "Одежда",
  "Связь",
  "Другое",
];

const CATEGORY_COLORS = {
  "Продукты": "#22c55e",
  "Транспорт": "#3b82f6",
  "Кафе": "#f59e0b",
  "Развлечения": "#a855f7",
  "Здоровье": "#ef4444",
  "Одежда": "#ec4899",
  "Связь": "#06b6d4",
  "Другое": "#64748b",
};

const TRASH_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
  </svg>
`;

// ===== Ссылки на элементы страницы =====
const formEl = document.getElementById("expenseForm");
const amountInput = document.getElementById("amountInput");
const categoryInput = document.getElementById("categoryInput");
const dateInput = document.getElementById("dateInput");
const commentInput = document.getElementById("commentInput");
const addBtn = document.getElementById("addBtn");
const amountError = document.getElementById("amountError");

const totalValueEl = document.getElementById("totalValue");
const totalCountEl = document.getElementById("totalCount");

const chartWrap = document.getElementById("chartWrap");
const chartCanvas = document.getElementById("expenseChart");
const chartEmpty = document.getElementById("chartEmpty");

const filterCategoryEl = document.getElementById("filterCategory");
const filterPeriodEl = document.getElementById("filterPeriod");
const expenseListEl = document.getElementById("expenseList");
const listEmptyEl = document.getElementById("listEmpty");

const clearAllBtn = document.getElementById("clearAllBtn");
const toastEl = document.getElementById("toast");

// ===== Форматтеры =====
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// ===== Состояние приложения =====
let expenses = [];
let chart = null;
let toastTimer = null;

// ===== Утилиты =====
function formatMoney(n) {
  const rounded = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  return moneyFormatter.format(rounded) + " ₽";
}

function formatDate(iso) {
  const date = parseISODate(iso);
  if (!date) return "—";
  return dateFormatter.format(date);
}

// "2024-05-01" -> Date в локальном времени (без сдвига часового пояса)
function parseISODate(iso) {
  if (typeof iso !== "string") return null;
  const parts = iso.split("-").map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// "#22c55e" -> "rgba(34, 197, 94, 0.15)"
function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ===== Работа с localStorage =====
function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidExpense).map(normalizeExpense);
  } catch (error) {
    // Битые данные в localStorage — начинаем с пустого списка
    console.warn("Не удалось загрузить расходы:", error);
    return [];
  }
}

function isValidExpense(item) {
  return (
    item &&
    typeof item === "object" &&
    Number.isFinite(Number(item.amount)) &&
    Number(item.amount) > 0
  );
}

function normalizeExpense(item) {
  return {
    id: String(item.id || createId()),
    amount: Number(item.amount),
    category: CATEGORIES.includes(item.category) ? item.category : "Другое",
    date: typeof item.date === "string" && item.date ? item.date : todayISO(),
    comment: typeof item.comment === "string" ? item.comment : "",
    createdAt: Number(item.createdAt) || Date.now(),
  };
}

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (error) {
    console.warn("Не удалось сохранить расходы:", error);
  }
}

// ===== Действия с расходами =====
function addExpense(expense) {
  expenses.push(expense);
  saveExpenses();
  renderAll();
  showToast("Расход добавлен");
}

function deleteExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  renderAll();
  showToast("Расход удалён");
}

function clearAll() {
  expenses = [];
  saveExpenses();
  renderAll();
  showToast("Все расходы удалены");
}

// ===== Рендер =====
function renderAll() {
  renderTotal();
  renderChart();
  renderList();
}

function renderTotal() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  totalValueEl.textContent = formatMoney(total);
  totalCountEl.textContent = `записей: ${expenses.length}`;
}

function renderChart() {
  // Суммируем расходы по категориям
  const totals = {};
  expenses.forEach((expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
  });

  const labels = CATEGORIES.filter((category) => totals[category] > 0);
  const data = labels.map((category) => totals[category]);
  const colors = labels.map((category) => CATEGORY_COLORS[category]);

  // Нет данных — показываем плейсхолдер вместо диаграммы
  if (labels.length === 0) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    chartWrap.hidden = true;
    chartEmpty.hidden = false;
    return;
  }

  chartWrap.hidden = false;
  chartEmpty.hidden = true;

  // Пересоздаём диаграмму при каждом изменении данных
  if (chart) {
    chart.destroy();
    chart = null;
  }

  const total = data.reduce((sum, value) => sum + value, 0);

  chart = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 10,
            padding: 16,
            color: "#1e293b",
            font: { family: "Inter", size: 13 },
          },
        },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          titleFont: { family: "Inter", size: 13 },
          bodyFont: { family: "Inter", size: 13 },
          padding: 10,
          displayColors: false,
          callbacks: {
            // Убираем заголовок — категория уже есть в строке
            title: () => "",
            label: (context) => {
              const value = context.parsed;
              const percent = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${context.label}: ${formatMoney(value)} (${percent}%)`;
            },
          },
        },
      },
    },
    plugins: [centerTextPlugin],
  });
}

// Кастомный плагин: текст в центре «бублика»
const centerTextPlugin = {
  id: "centerText",
  afterDraw(chartInstance) {
    const meta = chartInstance.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;

    const { x, y } = meta.data[0];
    const total = chartInstance.data.datasets[0].data.reduce((sum, value) => sum + value, 0);
    const ctx = chartInstance.ctx;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("Всего", x, y - 14);

    ctx.fillStyle = "#1e293b";
    ctx.font = "700 20px Inter, sans-serif";
    ctx.fillText(formatMoney(total), x, y + 8);

    ctx.restore();
  },
};

function renderList() {
  const visible = applyFilters();
  expenseListEl.innerHTML = "";

  if (visible.length === 0) {
    listEmptyEl.hidden = false;
    return;
  }

  listEmptyEl.hidden = true;

  const fragment = document.createDocumentFragment();
  visible.forEach((expense) => {
    fragment.appendChild(createExpenseItem(expense));
  });
  expenseListEl.appendChild(fragment);
}

function createExpenseItem(expense) {
  const item = document.createElement("article");
  item.className = "expense";

  // Дата
  const date = document.createElement("span");
  date.className = "expense__date";
  date.textContent = formatDate(expense.date);

  // Бейдж категории
  const color = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS["Другое"];
  const badge = document.createElement("span");
  badge.className = "expense__badge";
  badge.textContent = expense.category;
  badge.style.color = color;
  badge.style.backgroundColor = hexToRgba(color, 0.15);

  // Комментарий
  const comment = document.createElement("span");
  comment.className = "expense__comment";
  const commentText = (expense.comment || "").trim();
  if (commentText) {
    comment.textContent = commentText;
  } else {
    comment.textContent = "—";
    comment.classList.add("expense__comment--empty");
  }

  // Сумма
  const amount = document.createElement("span");
  amount.className = "expense__amount";
  amount.textContent = formatMoney(expense.amount);

  // Кнопка удаления
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "expense__delete";
  deleteBtn.dataset.id = expense.id;
  deleteBtn.setAttribute(
    "aria-label",
    `Удалить расход: ${expense.category}, ${formatMoney(expense.amount)}`
  );
  deleteBtn.innerHTML = TRASH_ICON;

  item.append(date, badge, comment, amount, deleteBtn);
  return item;
}

// Возвращает отфильтрованный и отсортированный массив, не мутируя исходный
function applyFilters() {
  const category = filterCategoryEl.value;
  const period = filterPeriodEl.value;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let fromDate = null;
  if (period === "today") fromDate = startOfToday;
  if (period === "7") fromDate = addDays(startOfToday, -6);
  if (period === "30") fromDate = addDays(startOfToday, -29);

  return expenses
    .filter((expense) => {
      if (category !== "all" && expense.category !== category) return false;

      if (fromDate) {
        const expenseDate = parseISODate(expense.date);
        if (!expenseDate || expenseDate < fromDate) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Сначала более поздние даты, при равенстве — более поздние записи
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
}

// ===== Форма =====
function isAmountValid() {
  const raw = amountInput.value.trim();
  if (raw === "") return false;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0;
}

function updateAddButtonState() {
  const valid = isAmountValid();
  addBtn.disabled = !valid;
  if (valid) amountError.textContent = "";
}

function handleSubmit(event) {
  event.preventDefault();

  if (!isAmountValid()) {
    amountError.textContent = "Введите сумму больше 0";
    amountInput.focus();
    return;
  }

  const amount = Math.round(Number(amountInput.value) * 100) / 100;

  addExpense({
    id: createId(),
    amount,
    category: categoryInput.value,
    date: dateInput.value || todayISO(),
    comment: commentInput.value.trim(),
    createdAt: Date.now(),
  });

  resetForm();
}

function resetForm() {
  formEl.reset();                // очищает сумму, категорию и комментарий
  dateInput.value = todayISO();  // дата всегда остаётся сегодняшней
  amountError.textContent = "";
  updateAddButtonState();
  amountInput.focus();           // фокус обратно в поле суммы
}

// ===== Тост =====
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("toast--visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("toast--visible");
  }, 2500);
}

// ===== Инициализация =====
function init() {
  // Категории в форме
  CATEGORIES.forEach((category) => {
    categoryInput.appendChild(new Option(category, category));
  });

  // Категории в фильтре
  filterCategoryEl.appendChild(new Option("Все категории", "all"));
  CATEGORIES.forEach((category) => {
    filterCategoryEl.appendChild(new Option(category, category));
  });

  // Дата по умолчанию — сегодня
  dateInput.value = todayISO();

  expenses = loadExpenses();
  renderAll();
  updateAddButtonState();

  // Форма
  formEl.addEventListener("submit", handleSubmit);
  amountInput.addEventListener("input", updateAddButtonState);

  // Фильтры
  filterCategoryEl.addEventListener("change", renderList);
  filterPeriodEl.addEventListener("change", renderList);

  // Удаление расхода (делегирование)
  expenseListEl.addEventListener("click", (event) => {
    const button = event.target.closest(".expense__delete");
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (confirm("Удалить этот расход?")) {
      deleteExpense(id);
    }
  });

  // Очистка всего
  clearAllBtn.addEventListener("click", () => {
    if (confirm("Удалить все расходы? Это действие нельзя отменить.")) {
      clearAll();
    }
  });
}

init();