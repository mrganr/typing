const STORAGE_KEY = 'todo-app-tasks';
const THEME_KEY = 'todo-app-theme';

const fallbackStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};

function createStorage() {
    try {
        const testKey = '__todo-storage-test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return localStorage;
    } catch (error) {
        console.warn('التخزين المحلي غير متاح، لن يتم حفظ المهام تلقائيًا.', error);
        return fallbackStorage;
    }
}

const storage = createStorage();
const isPersistent = storage !== fallbackStorage;

const elements = {
    body: document.body,
    form: document.getElementById('todo-form'),
    input: document.getElementById('todo-input'),
    priority: document.getElementById('priority-select'),
    list: document.getElementById('todo-list'),
    template: document.getElementById('todo-item-template'),
    search: document.getElementById('search-input'),
    statusFilters: document.querySelectorAll('[data-filter]'),
    priorityFilters: document.querySelectorAll('[data-priority]'),
    clearCompleted: document.getElementById('clear-completed'),
    statsText: document.getElementById('stats-text'),
    summaryActive: document.getElementById('summary-active'),
    summaryCompleted: document.getElementById('summary-completed'),
    summaryTotal: document.getElementById('summary-total'),
    summaryProgress: document.getElementById('summary-progress'),
    themeToggle: document.getElementById('theme-toggle'),
    storageWarning: document.getElementById('storage-warning'),
};

const state = {
    tasks: [],
    filter: 'all',
    priority: 'all',
    query: '',
};

const PRIORITY_ORDER = ['high', 'medium', 'low'];

function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadTheme() {
    const savedTheme = storage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    elements.body.setAttribute('data-theme', theme);
    elements.themeToggle.setAttribute('aria-pressed', theme === 'dark');
    if (!savedTheme) {
        storage.setItem(THEME_KEY, theme);
    }
}

function toggleTheme() {
    const isDark = elements.body.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    elements.body.setAttribute('data-theme', nextTheme);
    elements.themeToggle.setAttribute('aria-pressed', nextTheme === 'dark');
    storage.setItem(THEME_KEY, nextTheme);
}

function loadTasks() {
    try {
        const stored = JSON.parse(storage.getItem(STORAGE_KEY));
        if (Array.isArray(stored)) {
            state.tasks = stored;
        }
    } catch (error) {
        console.error('تعذر قراءة المهام المخزّنة', error);
        state.tasks = [];
    }
}

function persistTasks() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function normalize(text) {
    const lower = text.toLocaleLowerCase('ar');
    try {
        return lower
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    } catch (error) {
        return lower
            .normalize('NFD')
            .replace(/[\u064B-\u065F]/g, '');
    }
}

function createTask(text, priority) {
    return {
        id: generateId(),
        text: text.trim(),
        completed: false,
        priority,
        createdAt: new Date().toISOString(),
    };
}

function updateSummary() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(task => task.completed).length;
    const active = total - completed;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    elements.summaryActive.textContent = active;
    elements.summaryCompleted.textContent = completed;
    elements.summaryTotal.textContent = total;
    elements.summaryProgress.textContent = `${progress}%`;
    elements.clearCompleted.disabled = completed === 0;

    elements.statsText.textContent = total === 0
        ? 'لم تُضف أي مهام بعد.'
        : `لديك ${active} مهمة قيد التنفيذ و ${completed} مهمة منجزة.`;
}

function getFilteredTasks() {
    return state.tasks.filter(task => {
        const matchesQuery = state.query
            ? normalize(task.text).includes(state.query)
            : true;

        const matchesStatus =
            state.filter === 'all' ||
            (state.filter === 'active' && !task.completed) ||
            (state.filter === 'completed' && task.completed);

        const matchesPriority =
            state.priority === 'all' || state.priority === task.priority;

        return matchesQuery && matchesStatus && matchesPriority;
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function render() {
    elements.list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const items = getFilteredTasks();

    items.forEach(task => {
        const node = elements.template.content.firstElementChild.cloneNode(true);
        const checkbox = node.querySelector('.todo-item__checkbox');
        const textEl = node.querySelector('.todo-item__text');
        const priorityEl = node.querySelector('.todo-item__priority');
        const timeEl = node.querySelector('.todo-item__date');

        node.dataset.id = task.id;
        checkbox.checked = task.completed;
        textEl.textContent = task.text;
        priorityEl.dataset.priority = task.priority;
        timeEl.textContent = formatDate(task.createdAt);
        timeEl.dateTime = task.createdAt;

        if (task.completed) {
            textEl.classList.add('is-completed');
        }

        fragment.appendChild(node);
    });

    elements.list.appendChild(fragment);

    if (items.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'todo-list__empty';
        empty.textContent = state.tasks.length === 0
            ? 'أضف أول مهمة لك الآن!'
            : 'لا توجد مهام مطابقة للبحث أو التصفية الحالية.';
        elements.list.appendChild(empty);
    }

    updateSummary();
}

function setActiveButton(buttons, pressedButton) {
    buttons.forEach(button => {
        const isActive = button === pressedButton;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-checked', isActive);
    });
}

function handleSubmit(event) {
    event.preventDefault();
    const value = elements.input.value.trim();
    if (!value) return;

    const task = createTask(value, elements.priority.value);
    state.tasks.unshift(task);
    persistTasks();
    elements.form.reset();
    elements.priority.value = 'medium';
    elements.input.focus();
    render();
}

function handleSearch(event) {
    state.query = normalize(event.target.value.trim());
    render();
}

function handleStatusFilter(event) {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    setActiveButton(elements.statusFilters, button);
    render();
}

function handlePriorityFilter(event) {
    const button = event.target.closest('[data-priority]');
    if (!button) return;
    state.priority = button.dataset.priority;
    setActiveButton(elements.priorityFilters, button);
    render();
}

function cyclePriority(current) {
    const index = PRIORITY_ORDER.indexOf(current);
    const nextIndex = (index + 1) % PRIORITY_ORDER.length;
    return PRIORITY_ORDER[nextIndex];
}

function updateTask(id, updates) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    Object.assign(task, updates);
    persistTasks();
    render();
}

function removeTask(id) {
    state.tasks = state.tasks.filter(task => task.id !== id);
    persistTasks();
    render();
}

function clearCompletedTasks() {
    const hasCompleted = state.tasks.some(task => task.completed);
    if (!hasCompleted) return;
    state.tasks = state.tasks.filter(task => !task.completed);
    persistTasks();
    render();
}

function handleListClick(event) {
    const item = event.target.closest('.todo-item');
    if (!item) return;
    const { id } = item.dataset;

    if (event.target.matches('.todo-item__checkbox')) {
        updateTask(id, { completed: event.target.checked });
        return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    if (actionButton.dataset.action === 'priority') {
        const task = state.tasks.find(task => task.id === id);
        if (!task) return;
        updateTask(id, { priority: cyclePriority(task.priority) });
    }

    if (actionButton.dataset.action === 'delete') {
        removeTask(id);
    }

    if (actionButton.dataset.action === 'edit') {
        startInlineEdit(item, id);
    }
}

function handleListDblClick(event) {
    const item = event.target.closest('.todo-item');
    if (!item) return;
    const { id } = item.dataset;
    if (event.target.classList.contains('todo-item__text')) {
        startInlineEdit(item, id);
    }
}

function startInlineEdit(item, id) {
    const task = state.tasks.find(task => task.id === id);
    if (!task) return;

    const textElement = item.querySelector('.todo-item__text');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.text;
    input.className = 'todo-item__edit';
    input.dir = 'auto';
    input.setAttribute('aria-label', 'تحرير المهمة');

    textElement.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
        const value = input.value.trim();
        if (!value) {
            input.focus();
            return;
        }
        updateTask(id, { text: value });
    };

    const cancel = () => {
        render();
    };

    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commit();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
        }
    });
}

function bindEvents() {
    elements.form.addEventListener('submit', handleSubmit);
    elements.search.addEventListener('input', handleSearch);
    elements.list.addEventListener('click', handleListClick);
    elements.list.addEventListener('dblclick', handleListDblClick);
    elements.clearCompleted.addEventListener('click', clearCompletedTasks);
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.statusFilters.forEach(button =>
        button.addEventListener('click', handleStatusFilter)
    );
    elements.priorityFilters.forEach(button =>
        button.addEventListener('click', handlePriorityFilter)
    );
}

function init() {
    loadTheme();
    loadTasks();
    state.query = '';
    if (elements.storageWarning) {
        elements.storageWarning.hidden = isPersistent;
        if (!isPersistent) {
            elements.storageWarning.textContent = 'لن يتم حفظ مهامك بعد إغلاق الصفحة لأن التخزين المحلي غير متاح في هذا المتصفح.';
        }
    }
    bindEvents();
    render();
}

document.addEventListener('DOMContentLoaded', init);
