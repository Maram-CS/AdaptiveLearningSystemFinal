let allNotifications = [];
let currentFilter = 'all';
let currentPage = 1;
const itemsPerPage = 15;

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* =========================
   FETCH FROM DB
========================= */
async function fetchNotifications() {
    const res = await fetch('/api/notifications', {
        credentials: 'include',
        cache: 'no-store'
    });

    const data = await res.json();
    if (data.success) {
        allNotifications = data.notifications || [];
        currentPage = 1;
        renderFilteredNotifications();
    }
}

/* =========================
   FILTER
========================= */
function getNotificationType(notification) {
    return String(notification?.type || '').trim().toLowerCase();
}

function getFilteredNotifications() {
    if (currentFilter === 'all') return allNotifications;
    if (currentFilter === 'unread') return allNotifications.filter(n => !n.is_read);
    if (currentFilter === 'course') return allNotifications.filter(n => getNotificationType(n) === 'course');
    if (currentFilter === 'quiz') return allNotifications.filter(n => getNotificationType(n) === 'quiz');
    if (currentFilter === 'info') return allNotifications.filter(n => getNotificationType(n) === 'info');
    if (currentFilter === 'ai') return allNotifications.filter(n => getNotificationType(n) === 'ai');
    return allNotifications;
}

/* =========================
   RENDER
========================= */
function renderFilteredNotifications() {
    const filtered = getFilteredNotifications();
    const container = document.getElementById('notificationsListContainer');
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    if (!container) return;

    if (!paginated.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications found</p>
            </div>
        `;
        renderPagination(0);
        return;
    }

    container.innerHTML = paginated.map((n) => {
        const type = getNotificationType(n);
        return `
            <div class="notification-item-page ${!n.is_read ? 'unread' : ''} ${type === 'ai' ? 'ai-notification' : ''}"
                 data-id="${n._id}"
                 data-link="${escapeHtml(n.link || '')}">

                <div class="notification-icon-page ${type}">
                    ${getNotifIcon(type)}
                </div>
                <div class="notification-content-page">
                    <strong>${escapeHtml(n.title || '')}</strong>
                    <p>${escapeHtml(n.message || '')}</p>

                    <div class="notification-time-page">
                        <span>${formatTime(n.created_at || n.createdAt)}</span>
                        ${type === 'ai' ? `<span class="ai-badge" style="margin-left:8px;">🤖 AI Insight</span>` : ''}
                    </div>
                </div>

                <button class="delete-btn" data-id="${n._id}">&#128465;</button>
            </div>
        `;
    }).join('');

    renderPagination(filtered.length);
    attachEvents();
}

/* =========================
   ICON HELPER
========================= */
function getNotifIcon(type) {
    if (type === 'ai') return '🤖';
    if (type === 'course') return '<i class="fas fa-book"></i>';
    if (type === 'quiz') return '<i class="fas fa-question-circle"></i>';
    return '<i class="fas fa-info-circle"></i>';
}

/* =========================
   TIME FORMAT HELPER
========================= */
function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
}

/* =========================
   PAGINATION
========================= */
function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const container = document.getElementById('pagination');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = Array.from({ length: totalPages }, (_, i) => `
        <button class="page-btn ${currentPage === i + 1 ? 'active' : ''}"
                onclick="goToPage(${i + 1})">${i + 1}</button>
    `).join('');
}

function goToPage(page) {
    currentPage = page;
    renderFilteredNotifications();
}

/* =========================
   EVENTS
========================= */
function attachEvents() {
    document.querySelectorAll('.notification-item-page').forEach((item) => {
        item.onclick = async (e) => {
            if (e.target.closest('.delete-btn')) return;
            const id = item.dataset.id;
            const targetLink = item.dataset.link;

            await fetch(`/api/notifications/${id}/read`, {
                method: 'PUT',
                credentials: 'include'
            });

            if (targetLink) {
                window.location.href = targetLink;
                return;
            }

            await fetchNotifications();
            refreshUnreadBadge();
        };
    });

    document.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            await fetch(`/api/notifications/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            await fetchNotifications();
            refreshUnreadBadge();
        };
    });
}

/* =========================
   MARK ALL
========================= */
async function markAllAsRead() {
    await fetch('/api/notifications/read-all', {
        method: 'PUT',
        credentials: 'include'
    });
    await fetchNotifications();
    refreshUnreadBadge();
}

/* =========================
   BADGE
========================= */
async function refreshUnreadBadge() {
    const res = await fetch('/api/notifications/unread-count', {
        credentials: 'include',
        cache: 'no-store'
    });
    const data = await res.json();
    const badge = document.querySelector('.notif-badge');
    if (!badge) return;
    const count = data.unreadCount || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
    fetchNotifications();
    refreshUnreadBadge();
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            renderFilteredNotifications();
        };
    });

    const markBtn = document.getElementById('markAllBtn');
    if (markBtn) markBtn.onclick = markAllAsRead;
});

/* =========================
   FIX BACK BUTTON CACHE
========================= */
window.addEventListener('pageshow', () => {
    fetchNotifications();
    refreshUnreadBadge();
});