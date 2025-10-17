//######################################## Main Script ########################################
document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('main-content');

  // -------------------- Flash helpers --------------------
  function ensureFlashContainer() {
    let container = document.querySelector('.flash-wrapper');
    if (!container) {
      container = document.createElement('div');
      container.className = 'flash-wrapper';
      container.style.maxWidth = '640px';
      container.style.margin = '20px auto 0';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '12px';
      if (main) {
        main.prepend(container);
      } else {
        document.body.prepend(container);
      }
    }
    return container;
  }

  function pushFlash(type, message) {
    if (!message) return;
    const container = ensureFlashContainer();
    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}`;
    flash.style.background = '#ffffff';
    flash.style.borderRadius = '12px';
    flash.style.padding = '16px 18px';
    flash.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
    flash.style.border = type === 'error' ? '1px solid rgba(180,44,44,0.35)' : '1px solid rgba(1,125,113,0.3)';
    flash.style.color = type === 'error' ? '#742323' : '#013d37';
    flash.setAttribute('role', type === 'error' ? 'alert' : 'status');
    flash.textContent = message;
    container.append(flash);
    setTimeout(() => flash.remove(), 6000);
  }

  // -------------------- Navigation active state --------------------
  const currentPath = window.location.pathname;
  document.querySelectorAll('[data-path]').forEach(link => {
    const targetPath = link.getAttribute('data-path') || link.getAttribute('href');
    if (!targetPath) return;
    const isMatch =
      currentPath === targetPath ||
      (targetPath !== '/' && currentPath.startsWith(targetPath)) ||
      (targetPath !== '/' && currentPath.endsWith(targetPath));
    if (isMatch) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      link.style.borderBottom = '2px solid #ffffff';
    }
  });

  // -------------------- Form validation helpers --------------------
  const forms = document.querySelectorAll('form[data-validate]');
  forms.forEach(form => {
    form.addEventListener('invalid', event => {
      const field = event.target;
      if (!(field instanceof HTMLElement)) return;
      field.setAttribute('aria-invalid', 'true');
      const errorId = `${field.id || field.name}-error`;
      let errorEl = form.querySelector(`#${errorId}`);
      if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.id = errorId;
        errorEl.style.color = '#b02a37';
        errorEl.style.fontSize = '0.8rem';
        errorEl.style.marginTop = '4px';
        errorEl.style.display = 'block';
        field.insertAdjacentElement('afterend', errorEl);
      }
      errorEl.textContent = field.validationMessage;
      field.setAttribute('aria-describedby', errorId);
    }, true);

    form.addEventListener('input', event => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
        return;
      }
      if (field.checkValidity()) {
        field.removeAttribute('aria-invalid');
        const errorId = `${field.id || field.name}-error`;
        const errorEl = form.querySelector(`#${errorId}`);
        if (errorEl) errorEl.remove();
        field.removeAttribute('aria-describedby');
      }
    });
  });

  // -------------------- Login form --------------------
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = {
        email: loginForm.email.value.trim(),
        password: loginForm.password.value.trim()
      };
      try {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          pushFlash('error', data.message || 'Login failed.');
          return;
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        window.location.href = '/dashboard';
      } catch (error) {
        console.error('Login error:', error);
        pushFlash('error', 'Unable to login right now. Please try again.');
      }
    });
  }

  // -------------------- Register form --------------------
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = {
        fullName: registerForm.fullName.value.trim(),
        email: registerForm.email.value.trim(),
        password: registerForm.password.value.trim(),
        role: 'student'
      };
      try {
        const res = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          pushFlash('error', data.message || 'Registration failed.');
          return;
        }
        pushFlash('success', 'Registration successful! You can login now.');
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 800);
      } catch (error) {
        console.error('Register error:', error);
        pushFlash('error', 'Unable to register right now. Please try again.');
      }
    });
  }

  // -------------------- Events page --------------------
  const eventsRoot = document.getElementById('events-page');
  if (eventsRoot) {
    const userId = eventsRoot.getAttribute('data-user-id');
    const listEl = document.getElementById('event-list');
    const emptyState = document.getElementById('event-empty');
    const searchInput = document.getElementById('event-search');
    const dateFromInput = document.getElementById('event-date-from');
    const dateToInput = document.getElementById('event-date-to');
    const locationInput = document.getElementById('event-location');
    const clearFiltersBtn = document.getElementById('event-clear-filters');
    const form = document.getElementById('event-form');
    const formResetBtn = document.getElementById('event-form-reset');

    let eventsData = [];

    function toggleEmptyState(hasItems) {
      if (!emptyState) return;
      emptyState.hidden = hasItems;
    }

    function renderEvents(events) {
      if (!listEl) return;
      listEl.innerHTML = '';
      if (!events.length) {
        toggleEmptyState(false);
        return;
      }
      toggleEmptyState(true);
      events.forEach(eventItem => {
        const li = document.createElement('li');
        li.dataset.eventId = eventItem.id;
        li.style.background = '#ffffff';
        li.style.borderRadius = '14px';
        li.style.border = '1px solid rgba(1,125,113,0.18)';
        li.style.boxShadow = '0 8px 22px rgba(0,0,0,0.08)';
        li.style.padding = '16px 18px';
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '8px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.gap = '12px';
        header.style.flexWrap = 'wrap';

        const title = document.createElement('h3');
        title.textContent = eventItem.title;
        title.style.margin = '0';
        title.style.fontSize = '1.1rem';
        title.style.color = '#013d37';

        const dateTime = document.createElement('time');
        const date = eventItem.event_date ? new Date(eventItem.event_date) : null;
        const formattedDate = date ? date.toLocaleDateString() : '';
        dateTime.textContent = formattedDate + (eventItem.event_time ? ` at ${eventItem.event_time}` : '');
        dateTime.dateTime = eventItem.event_date || '';
        dateTime.style.fontSize = '0.85rem';
        dateTime.style.color = '#4a4a4a';

        header.append(title, dateTime);

        const description = document.createElement('p');
        description.textContent = eventItem.description || 'No description provided.';
        description.style.margin = '0';
        description.style.color = '#4a4a4a';

        const location = document.createElement('p');
        location.textContent = `Location: ${eventItem.location || 'TBA'}`;
        location.style.margin = '0';
        location.style.color = '#013d37';
        location.style.fontWeight = '600';

        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.gap = '12px';

        const bookBtn = document.createElement('button');
        bookBtn.type = 'button';
        bookBtn.textContent = 'Book';
        bookBtn.style.background = '#017d71';
        bookBtn.style.color = '#ffffff';
        bookBtn.style.border = 'none';
        bookBtn.style.padding = '8px 14px';
        bookBtn.style.borderRadius = '16px';
        bookBtn.style.fontWeight = '600';
        bookBtn.addEventListener('click', async event => {
          event.stopPropagation();
          if (!userId) {
            pushFlash('error', 'You must be logged in to book an event.');
            return;
          }
          try {
            const res = await fetch(`/events/book/${eventItem.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              pushFlash('error', data.message || 'Unable to book this event.');
              return;
            }
            pushFlash('success', `Booked ${eventItem.title}`);
          } catch (error) {
            console.error('Book event error:', error);
            pushFlash('error', 'Network error while booking.');
          }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.color = '#b02a37';
        deleteBtn.style.border = '1px solid rgba(176,42,55,0.4)';
        deleteBtn.style.padding = '8px 14px';
        deleteBtn.style.borderRadius = '16px';
        deleteBtn.style.fontWeight = '600';
        deleteBtn.addEventListener('click', async event => {
          event.stopPropagation();
          if (!confirm('Delete this event?')) return;
          try {
            const res = await fetch(`/events/${eventItem.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
              pushFlash('error', 'Unable to delete this event.');
              return;
            }
            eventsData = eventsData.filter(item => item.id !== eventItem.id);
            renderEvents(applyEventFilters());
            pushFlash('success', 'Event removed.');
          } catch (error) {
            console.error('Delete event error:', error);
            pushFlash('error', 'Network error while deleting.');
          }
        });

        if (form) {
          li.addEventListener('click', () => {
            form.querySelector('#event-id').value = eventItem.id || '';
            form.title.value = eventItem.title || '';
            form.evDate.value = eventItem.event_date ? eventItem.event_date.slice(0, 10) : '';
            form.evTime.value = eventItem.event_time || '';
            form.location.value = eventItem.location || '';
            form.type.value = eventItem.type || '';
            form.capacity.value = eventItem.capacity || '';
            form.description.value = eventItem.description || '';
          });
        }

        buttonRow.append(bookBtn, deleteBtn);
        li.append(header, description, location, buttonRow);
        listEl.append(li);
      });
    }

    function applyEventFilters() {
      const query = (searchInput.value || '').toLowerCase();
      const locationFilter = (locationInput.value || '').toLowerCase();
      const fromDate = dateFromInput.value ? new Date(dateFromInput.value) : null;
      const toDate = dateToInput.value ? new Date(dateToInput.value) : null;
      return eventsData.filter(item => {
        const matchesQuery = !query || (item.title && item.title.toLowerCase().includes(query)) || (item.description && item.description.toLowerCase().includes(query));
        const matchesLocation = !locationFilter || (item.location && item.location.toLowerCase().includes(locationFilter));
        const eventDate = item.event_date ? new Date(item.event_date) : null;
        const matchesFrom = !fromDate || (eventDate && eventDate >= fromDate);
        const matchesTo = !toDate || (eventDate && eventDate <= toDate);
        return matchesQuery && matchesLocation && matchesFrom && matchesTo;
      });
    }

    async function fetchEvents() {
      try {
        const res = await fetch('/events', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load events');
        const data = await res.json();
        eventsData = Array.isArray(data) ? data : [];
        renderEvents(applyEventFilters());
      } catch (error) {
        console.error('Fetch events error:', error);
        pushFlash('error', 'Unable to load events.');
      }
    }

    if (form) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = {
          title: form.title.value.trim(),
          description: form.description.value.trim(),
          evDate: form.evDate.value,
          evTime: form.evTime.value,
          location: form.location.value.trim(),
          type: form.type.value.trim(),
          capacity: form.capacity.value ? Number(form.capacity.value) : undefined
        };
        try {
          const method = form.querySelector('#event-id').value ? 'PUT' : 'POST';
          const url = method === 'POST' ? '/events' : `/events/${form.querySelector('#event-id').value}`;
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            pushFlash('error', data.message || 'Unable to save event.');
            return;
          }
          pushFlash('success', method === 'POST' ? 'Event created.' : 'Event updated.');
          form.reset();
          form.querySelector('#event-id').value = '';
          await fetchEvents();
        } catch (error) {
          console.error('Save event error:', error);
          pushFlash('error', 'Unable to save event right now.');
        }
      });
    }

    if (formResetBtn) {
      formResetBtn.addEventListener('click', () => {
        form.reset();
        form.querySelector('#event-id').value = '';
      });
    }

    [searchInput, dateFromInput, dateToInput, locationInput].forEach(input => {
      if (!input) return;
      input.addEventListener('input', () => renderEvents(applyEventFilters()));
    });

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        dateFromInput.value = '';
        dateToInput.value = '';
        locationInput.value = '';
        renderEvents(eventsData);
      });
    }

    fetchEvents();
  }

  // -------------------- Mood tracking page --------------------
  const moodRoot = document.getElementById('mood-tracking');
  if (moodRoot) {
    const userId = moodRoot.getAttribute('data-user-id');
    const scoreInput = document.getElementById('mood-score');
    const notesInput = document.getElementById('mood-notes');
    const form = document.getElementById('mood-form');
    const tableBody = document.querySelector('#mood-table tbody');
    const emptyState = document.getElementById('mood-empty');
    const summaryEntries = document.getElementById('mood-summary-count');
    const summaryStreak = document.getElementById('mood-summary-streak');
    const summaryAverage = document.getElementById('mood-summary-average');
    const chartCanvas = document.getElementById('mood-chart');
    let chartInstance = null;
    let moodData = [];

    function updateSummary() {
      const entriesCount = moodData.length;
      if (summaryEntries) summaryEntries.textContent = `Entries logged: ${entriesCount}`;
      const streak = calculateStreak(moodData);
      if (summaryStreak) summaryStreak.textContent = `Current streak: ${streak} day${streak === 1 ? '' : 's'}`;
      const average = calculateAverage(moodData);
      if (summaryAverage) summaryAverage.textContent = `Average score: ${Number.isFinite(average) ? average.toFixed(1) : '—'}`;
    }

    function calculateAverage(entries) {
      if (!entries.length) return NaN;
      const total = entries.reduce((sum, entry) => sum + Number(entry.score ?? entry.mood_score ?? 0), 0);
      return total / entries.length;
    }

    function calculateStreak(entries) {
      const dateSet = new Set();
      entries.forEach(entry => {
        const raw = entry.created_at || entry.date;
        if (!raw) return;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return;
        const normalized = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
        dateSet.add(normalized.toISOString().split('T')[0]);
      });
      if (!dateSet.size) return 0;
      const today = new Date();
      const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      let streak = 0;
      let cursorKey = cursor.toISOString().split('T')[0];
      while (dateSet.has(cursorKey)) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        cursorKey = cursor.toISOString().split('T')[0];
      }
      return streak;
    }

    function renderMoodTable(entries) {
      if (!tableBody) return;
      tableBody.innerHTML = '';
      if (!entries.length) {
        if (emptyState) emptyState.hidden = false;
        return;
      }
      if (emptyState) emptyState.hidden = true;
      entries.forEach(entry => {
        const tr = document.createElement('tr');
        const created = entry.created_at || entry.date;
        const dateCell = document.createElement('td');
        dateCell.style.padding = '10px 12px';
        dateCell.style.borderBottom = '1px solid rgba(1,125,113,0.15)';
        dateCell.textContent = created ? new Date(created).toLocaleString() : '—';

        const scoreCell = document.createElement('td');
        scoreCell.style.padding = '10px 12px';
        scoreCell.style.borderBottom = '1px solid rgba(1,125,113,0.15)';
        scoreCell.style.fontWeight = '600';
        scoreCell.style.color = '#013d37';
        scoreCell.textContent = entry.score ?? entry.mood_score ?? '—';

        const noteCell = document.createElement('td');
        noteCell.style.padding = '10px 12px';
        noteCell.style.borderBottom = '1px solid rgba(1,125,113,0.15)';
        noteCell.textContent = entry.notes || entry.note || '—';

        tr.append(dateCell, scoreCell, noteCell);
        tableBody.append(tr);
      });
    }

    function renderChart(entries) {
      if (!chartCanvas || typeof window.Chart === 'undefined') return;
      const labels = entries.slice(-10).map(entry => {
        const raw = entry.created_at || entry.date;
        return raw ? new Date(raw).toLocaleDateString() : '';
      });
      const values = entries.slice(-10).map(entry => Number(entry.score ?? entry.mood_score ?? 0));
      if (chartInstance) chartInstance.destroy();
      chartInstance = new window.Chart(chartCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Mood score',
            data: values,
            borderColor: '#017d71',
            backgroundColor: 'rgba(1,125,113,0.15)',
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, suggestedMax: 10 }
          }
        }
      });
    }

    async function fetchMoods() {
      if (!userId) return;
      try {
        const res = await fetch(`/moodTracking?user_id=${encodeURIComponent(userId)}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to load moods');
        const data = await res.json();
        moodData = Array.isArray(data) ? data : [];
        renderMoodTable(moodData);
        updateSummary();
        renderChart(moodData);
      } catch (error) {
        console.error('Fetch moods error:', error);
        pushFlash('error', 'Unable to load mood entries.');
      }
    }

    const scoreButtons = document.querySelectorAll('.mood-score');
    scoreButtons.forEach(button => {
      button.addEventListener('click', () => {
        const value = button.getAttribute('data-score');
        if (scoreInput) {
          scoreInput.value = value || '';
          scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });

    if (form) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!userId) {
          pushFlash('error', 'You must be logged in to log a mood.');
          return;
        }
        const payload = {
          user_id: userId,
          score: scoreInput.value,
          notes: notesInput.value.trim()
        };
        try {
          const res = await fetch('/moodTracking/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            pushFlash('error', data.message || 'Unable to save mood.');
            return;
          }
          pushFlash('success', 'Mood logged.');
          form.reset();
          await fetchMoods();
        } catch (error) {
          console.error('Mood submit error:', error);
          pushFlash('error', 'Unable to log mood right now.');
        }
      });
    }

    const rangeButtons = document.querySelectorAll('.mood-range');
    rangeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const days = Number(button.getAttribute('data-range'));
        if (!Number.isFinite(days) || !moodData.length) return;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const filtered = moodData.filter(entry => {
          const raw = entry.created_at || entry.date;
          if (!raw) return false;
          const time = new Date(raw).getTime();
          return Number.isFinite(time) && time >= cutoff;
        });
        renderMoodTable(filtered);
        renderChart(filtered);
      });
    });

    fetchMoods();
  }

  // -------------------- Social page --------------------
  const socialRoot = document.getElementById('social-page');
  if (socialRoot) {
    const userId = socialRoot.getAttribute('data-user-id');
    const searchInput = document.getElementById('social-search');
    const resultsList = document.getElementById('social-results');
    const incomingList = document.getElementById('social-incoming');
    const outgoingList = document.getElementById('social-outgoing');
    const connectionsList = document.getElementById('social-connections');

    let debounceTimer = null;

    function debounce(fn, delay = 250) {
      return (...args) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fn.apply(null, args), delay);
      };
    }

    async function searchPeople(query) {
      if (!resultsList) return;
      if (!query) {
        resultsList.innerHTML = '<li id="social-results-empty" style="background:rgba(1,125,113,0.06);padding:16px;border-radius:12px;color:#4a4a4a;">Start typing to find people.</li>';
        return;
      }
      try {
        const res = await fetch(`/social/users?search=${encodeURIComponent(query)}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        renderResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Search people error:', error);
        pushFlash('error', 'Unable to search right now.');
      }
    }

    function renderResults(results) {
      if (!resultsList) return;
      resultsList.innerHTML = '';
      if (!results.length) {
        const li = document.createElement('li');
        li.textContent = 'No people found.';
        li.style.background = 'rgba(1,125,113,0.06)';
        li.style.padding = '16px';
        li.style.borderRadius = '12px';
        li.style.color = '#4a4a4a';
        resultsList.append(li);
        return;
      }
      results.forEach(person => {
        const li = document.createElement('li');
        li.dataset.userId = person.id;
        li.style.background = '#ffffff';
        li.style.border = '1px solid rgba(1,125,113,0.18)';
        li.style.boxShadow = '0 8px 22px rgba(0,0,0,0.08)';
        li.style.padding = '16px 18px';
        li.style.borderRadius = '14px';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.gap = '12px';
        li.style.flexWrap = 'wrap';

        const info = document.createElement('div');
        const name = document.createElement('p');
        name.textContent = person.full_name || person.name || 'Unknown user';
        name.style.margin = '0';
        name.style.fontWeight = '600';
        name.style.color = '#013d37';

        const email = document.createElement('p');
        email.textContent = person.email || '';
        email.style.margin = '4px 0 0';
        email.style.color = '#4a4a4a';
        email.style.fontSize = '0.9rem';

        info.append(name, email);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = 'Add';
        addBtn.className = 'social-add';
        addBtn.style.background = '#017d71';
        addBtn.style.color = '#ffffff';
        addBtn.style.border = 'none';
        addBtn.style.padding = '8px 14px';
        addBtn.style.borderRadius = '16px';
        addBtn.style.fontWeight = '600';
        addBtn.addEventListener('click', () => sendConnectionRequest(person.id));

        li.append(info, addBtn);
        resultsList.append(li);
      });
    }

    async function sendConnectionRequest(targetId) {
      if (!userId) {
        pushFlash('error', 'You must be logged in to add connections.');
        return;
      }
      try {
        const res = await fetch('/social/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ requester_id: userId, target_user_id: targetId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          pushFlash('error', data.error || data.message || 'Unable to send request.');
          return;
        }
        pushFlash('success', 'Connection request sent.');
      } catch (error) {
        console.error('Send connection error:', error);
        pushFlash('error', 'Unable to send connection request.');
      }
    }

    async function respondToRequest(connectionId, action) {
      if (!userId) {
        pushFlash('error', 'Login required to manage requests.');
        return;
      }
      try {
        const res = await fetch(`/social/connections/${connectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ user_id: userId, action })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          pushFlash('error', data.error || data.message || 'Unable to update request.');
          return;
        }
        pushFlash('success', action === 'accept' ? 'Connection accepted.' : 'Request declined.');
        const item = document.querySelector(`[data-connection-id="${connectionId}"]`);
        if (item) item.remove();
      } catch (error) {
        console.error('Respond connection error:', error);
        pushFlash('error', 'Unable to update connection request.');
      }
    }

    if (incomingList) {
      incomingList.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.classList.contains('social-accept') || target.classList.contains('social-reject')) {
          const action = target.dataset.action;
          const id = target.dataset.connectionId;
          respondToRequest(id, action);
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', debounce(event => {
        const value = event.target.value.trim();
        searchPeople(value);
      }));
    }
  }
});
