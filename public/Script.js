//######################################## Main Script ########################################
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const currentPath = body?.dataset?.currentPath || '';
  const main = document.getElementById('main-content');

  // -------------------- Flash helpers --------------------
  const ensureFlashContainer = () => {
    let container = document.querySelector('[data-flash-wrapper]');
    if (!container) {
      container = document.createElement('div');
      container.className = 'flash-wrapper';
      container.setAttribute('data-flash-wrapper', '');
      if (main) {
        main.prepend(container);
      } else {
        document.body.prepend(container);
      }
    }
    return container;
  };

  const showFlash = (type, message, { duration = 5000 } = {}) => {
    if (!message) return;
    const container = ensureFlashContainer();
    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}`;
    flash.role = type === 'error' ? 'alert' : 'status';
    flash.textContent = message;
    container.appendChild(flash);
    if (duration) {
      window.setTimeout(() => flash.remove(), duration);
    }
  };

  // -------------------- Navigation active state --------------------
  document.querySelectorAll('[data-nav-match]').forEach(link => {
    const match = link.getAttribute('data-nav-match');
    if (!match) return;
    if (currentPath === match || (match !== '/' && currentPath.startsWith(match))) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // -------------------- Form validation helpers --------------------
  document.querySelectorAll('form[data-validate]').forEach(form => {
    form.addEventListener('invalid', event => {
      const field = event.target;
      if (!(field instanceof HTMLElement)) return;
      field.setAttribute('aria-invalid', 'true');
      const errorId = `${field.id || field.name}-error`;
      let errorEl = form.querySelector(`#${errorId}`);
      if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.id = errorId;
        errorEl.className = 'form-error';
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

  // -------------------- Auth forms --------------------
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
          showFlash('error', data.message || 'Login failed.');
          return;
        }
        if (data.user) {
          window.localStorage.setItem('user', JSON.stringify(data.user));
        }
        window.location.href = '/dashboard';
      } catch (error) {
        console.error('Login error:', error);
        showFlash('error', 'Unable to login right now. Please try again.');
      }
    });
  }

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
          showFlash('error', data.message || 'Registration failed.');
          return;
        }
        showFlash('success', 'Registration successful! You can login now.');
        window.setTimeout(() => {
          window.location.href = '/auth/login';
        }, 800);
      } catch (error) {
        console.error('Register error:', error);
        showFlash('error', 'Unable to register right now. Please try again.');
      }
    });
  }

  const resetForm = document.getElementById('resetPasswordForm');
  if (resetForm) {
    resetForm.addEventListener('submit', () => {
      showFlash('info', 'If the account exists you will receive an email shortly.');
    });
  }

  // -------------------- Events page --------------------
  const initEventsPage = () => {
    const page = document.getElementById('events-page');
    if (!page) return;
    const userId = page.getAttribute('data-user-id');
    const listEl = page.querySelector('#event-list');
    const emptyState = page.querySelector('#event-empty');
    const searchInput = document.getElementById('event-search');
    const dateFromInput = document.getElementById('event-date-from');
    const dateToInput = document.getElementById('event-date-to');
    const locationInput = document.getElementById('event-location');
    const clearFiltersBtn = document.getElementById('event-clear-filters');
    const form = document.getElementById('event-form');
    const resetBtn = document.getElementById('event-form-reset');

    let eventsData = [];
    let debounceTimer;

    const toggleEmpty = hasItems => {
      if (emptyState) emptyState.hidden = hasItems;
      if (listEl) listEl.hidden = !hasItems;
    };

    const renderEvents = items => {
      if (!listEl) return;
      listEl.innerHTML = '';
      if (!items.length) {
        toggleEmpty(false);
        return;
      }
      toggleEmpty(true);
      items.forEach(eventItem => {
        const li = document.createElement('li');
        li.className = 'event-card';
        li.dataset.eventId = eventItem.id;

        const header = document.createElement('div');
        header.className = 'event-meta';

        const title = document.createElement('h3');
        title.className = 'card__title';
        title.textContent = eventItem.title || 'Untitled event';

        const timeEl = document.createElement('time');
        timeEl.dateTime = eventItem.event_date || '';
        const date = eventItem.event_date ? new Date(eventItem.event_date) : null;
        const formattedDate = date ? date.toLocaleDateString() : 'TBA';
        timeEl.textContent = eventItem.event_time ? `${formattedDate} at ${eventItem.event_time}` : formattedDate;

        header.append(title, timeEl);

        const description = document.createElement('p');
        description.className = 'card__text';
        description.textContent = eventItem.description || 'No description provided.';

        const location = document.createElement('p');
        location.className = 'card__text card__text--emphasis';
        location.textContent = `Location: ${eventItem.location || 'TBA'}`;

        const actions = document.createElement('div');
        actions.className = 'event-actions';

        const bookBtn = document.createElement('button');
        bookBtn.type = 'button';
        bookBtn.className = 'btn btn-primary';
        bookBtn.textContent = 'Book';
        bookBtn.addEventListener('click', async event => {
          event.stopPropagation();
          if (!userId) {
            showFlash('error', 'You must be logged in to book an event.');
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
              showFlash('error', data.message || 'Unable to book this event.');
              return;
            }
            showFlash('success', `Booked ${eventItem.title || 'event'}.`);
          } catch (error) {
            console.error('Book event error:', error);
            showFlash('error', 'Network error while booking.');
          }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-outline event-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async event => {
          event.stopPropagation();
          if (!confirm('Delete this event?')) return;
          try {
            const res = await fetch(`/events/${eventItem.id}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              showFlash('error', data.message || 'Unable to delete this event.');
              return;
            }
            eventsData = eventsData.filter(item => item.id !== eventItem.id);
            renderEvents(applyFilters(eventsData));
            showFlash('success', 'Event removed.');
          } catch (error) {
            console.error('Delete event error:', error);
            showFlash('error', 'Network error while deleting.');
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

        actions.append(bookBtn, deleteBtn);
        li.append(header, description, location, actions);
        listEl.appendChild(li);
      });
    };

    const applyFilters = baseData => {
      const items = baseData.slice();
      const locationFilter = locationInput?.value.trim().toLowerCase();
      const fromValue = dateFromInput?.value ? new Date(dateFromInput.value) : null;
      const toValue = dateToInput?.value ? new Date(dateToInput.value) : null;
      return items.filter(eventItem => {
        if (locationFilter) {
          const location = (eventItem.location || '').toLowerCase();
          if (!location.includes(locationFilter)) return false;
        }
        if (fromValue) {
          const date = eventItem.event_date ? new Date(eventItem.event_date) : null;
          if (!date || date < fromValue) return false;
        }
        if (toValue) {
          const date = eventItem.event_date ? new Date(eventItem.event_date) : null;
          if (!date || date > toValue) return false;
        }
        return true;
      });
    };

    const fetchEvents = async (searchTerm = '') => {
      try {
        const url = new URL('/events', window.location.origin);
        if (searchTerm) url.searchParams.set('search', searchTerm);
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) throw new Error('Unable to fetch events');
        eventsData = await res.json();
        renderEvents(applyFilters(eventsData));
      } catch (error) {
        console.error('Fetch events error:', error);
        showFlash('error', 'Unable to load events.');
      }
    };

    const handleSearchChange = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        const term = searchInput?.value.trim() || '';
        fetchEvents(term);
      }, 250);
    };

    searchInput?.addEventListener('input', handleSearchChange);
    dateFromInput?.addEventListener('change', () => renderEvents(applyFilters(eventsData)));
    dateToInput?.addEventListener('change', () => renderEvents(applyFilters(eventsData)));
    locationInput?.addEventListener('input', () => renderEvents(applyFilters(eventsData)));

    clearFiltersBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      if (locationInput) locationInput.value = '';
      renderEvents(eventsData);
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const eventId = payload.id;
      const method = eventId ? 'PUT' : 'POST';
      const url = eventId ? `/events/${eventId}` : '/events';
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showFlash('error', data.message || 'Unable to save event.');
          return;
        }
        showFlash('success', eventId ? 'Event updated.' : 'Event created.');
        form.reset();
        form.querySelector('#event-id').value = '';
        fetchEvents(searchInput?.value.trim() || '');
      } catch (error) {
        console.error('Save event error:', error);
        showFlash('error', 'Network error while saving event.');
      }
    });

    resetBtn?.addEventListener('click', () => {
      form?.reset();
      if (form) form.querySelector('#event-id').value = '';
    });

    fetchEvents();
  };

  // -------------------- Mood tracking --------------------
  const initMoodPage = () => {
    const moodRoot = document.getElementById('mood-tracking');
    if (!moodRoot) return;
    const userId = moodRoot.getAttribute('data-user-id');
    const moodsRaw = moodRoot.getAttribute('data-moods');
    let moodData = [];
    if (moodsRaw) {
      try {
        moodData = JSON.parse(moodsRaw);
      } catch (error) {
        console.warn('Failed to parse initial moods:', error);
      }
    }

    const scoreButtons = Array.from(moodRoot.querySelectorAll('.mood-score-button'));
    const form = document.getElementById('mood-form');
    const scoreInput = document.getElementById('mood-score');
    const notesInput = document.getElementById('mood-notes');
    const emptyState = document.getElementById('mood-empty');
    const tableBody = document.querySelector('#mood-table tbody');
    const countEl = document.getElementById('mood-summary-count');
    const streakEl = document.getElementById('mood-summary-streak');
    const averageEl = document.getElementById('mood-summary-average');
    const rangeButtons = Array.from(moodRoot.querySelectorAll('.mood-range'));

    const setSelectedScore = value => {
      scoreButtons.forEach(btn => {
        const isSelected = btn.dataset.score === String(value);
        btn.classList.toggle('is-selected', isSelected);
      });
      if (scoreInput) scoreInput.value = value || '';
    };

    scoreButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setSelectedScore(btn.dataset.score);
      });
    });

    const computeSummary = data => {
      if (!data.length) {
        countEl.textContent = 'Entries logged: 0';
        streakEl.textContent = 'Current streak: 0 days';
        averageEl.textContent = 'Average score: —';
        return;
      }
      let total = 0;
      const dateSet = new Set();
      data.forEach(entry => {
        const scoreValue = Number(entry.score ?? entry.mood_score ?? 0);
        total += Number.isNaN(scoreValue) ? 0 : scoreValue;
        const rawDate = entry.created_at || entry.date;
        if (rawDate) {
          const parsed = new Date(rawDate);
          if (!Number.isNaN(parsed.getTime())) {
            const normalized = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
            dateSet.add(normalized.toISOString().split('T')[0]);
          }
        }
      });
      const average = (total / data.length).toFixed(1);
      let streak = 0;
      if (dateSet.size) {
        const today = new Date();
        const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        let cursorKey = cursor.toISOString().split('T')[0];
        while (dateSet.has(cursorKey)) {
          streak += 1;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
          cursorKey = cursor.toISOString().split('T')[0];
        }
      }
      countEl.textContent = `Entries logged: ${data.length}`;
      streakEl.textContent = `Current streak: ${streak} day${streak === 1 ? '' : 's'}`;
      averageEl.textContent = `Average score: ${average}`;
    };

    const renderTable = data => {
      if (!tableBody) return;
      tableBody.innerHTML = '';
      if (!data.length) {
        emptyState?.removeAttribute('hidden');
        return;
      }
      emptyState?.setAttribute('hidden', '');
      data.forEach(entry => {
        const row = document.createElement('tr');
        const dateCell = document.createElement('td');
        const scoreCell = document.createElement('td');
        const noteCell = document.createElement('td');
        dateCell.textContent = entry.created_at || entry.date
          ? new Date(entry.created_at || entry.date).toLocaleString()
          : '—';
        scoreCell.textContent = entry.score ?? entry.mood_score ?? '—';
        noteCell.textContent = entry.notes || entry.note || '—';
        row.append(dateCell, scoreCell, noteCell);
        tableBody.appendChild(row);
      });
    };

    const applyRangeFilter = days => {
      if (!days) {
        renderTable(moodData);
        computeSummary(moodData);
        return;
      }
      const today = new Date();
      const filtered = moodData.filter(entry => {
        const raw = entry.created_at || entry.date;
        if (!raw) return false;
        const entryDate = new Date(raw);
        if (Number.isNaN(entryDate.getTime())) return false;
        const diff = today.getTime() - entryDate.getTime();
        return diff <= days * 24 * 60 * 60 * 1000;
      });
      renderTable(filtered);
      computeSummary(filtered);
    };

    const fetchMoods = async () => {
      if (!userId) return;
      try {
        const url = new URL('/moodTracking', window.location.origin);
        url.searchParams.set('user_id', userId);
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) throw new Error('Unable to fetch moods');
        moodData = await res.json();
        applyRangeFilter(activeRange());
      } catch (error) {
        console.error('Fetch moods error:', error);
        showFlash('error', 'Unable to load mood history.');
      }
    };

    const clearRangeSelection = () => {
      rangeButtons.forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
        btn.removeAttribute('aria-pressed');
      });
    };

    const activeRange = () => {
      const activeBtn = rangeButtons.find(btn => btn.getAttribute('aria-pressed') === 'true');
      return activeBtn ? Number(activeBtn.dataset.range) : 0;
    };

    rangeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const range = Number(btn.dataset.range);
        const isActive = btn.getAttribute('aria-pressed') === 'true';
        clearRangeSelection();
        if (!isActive) {
          btn.classList.add('btn-primary');
          btn.classList.remove('btn-outline');
          btn.setAttribute('aria-pressed', 'true');
        }
        applyRangeFilter(isActive ? 0 : range);
      });
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const score = Number(scoreInput?.value || 0);
      if (!userId || !score) {
        showFlash('error', 'Please choose a score before saving.');
        return;
      }
      const payload = {
        user_id: userId,
        score,
        notes: notesInput?.value?.trim() || ''
      };
      try {
        const res = await fetch('/moodTracking/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showFlash('error', data.message || 'Unable to log mood.');
          return;
        }
        showFlash('success', 'Mood saved.');
        form.reset();
        scoreButtons.forEach(btn => btn.classList.remove('is-selected'));
        await fetchMoods();
      } catch (error) {
        console.error('Save mood error:', error);
        showFlash('error', 'Network error while saving mood.');
      }
    });

    renderTable(moodData);
    computeSummary(moodData);
  };

  // -------------------- Social page --------------------
  const initSocialPage = () => {
    const socialRoot = document.getElementById('social-page');
    if (!socialRoot) return;
    const userId = socialRoot.getAttribute('data-user-id');
    const searchInput = document.getElementById('social-search');
    const resultsList = document.getElementById('social-results');
    const incomingList = document.getElementById('social-incoming');
    const outgoingList = document.getElementById('social-outgoing');
    const connectionsList = document.getElementById('social-connections');

    let searchTimer;

    const renderList = (listEl, items, renderer, emptyMessage) => {
      if (!listEl) return;
      listEl.innerHTML = '';
      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'social-empty';
        li.textContent = emptyMessage;
        listEl.appendChild(li);
        return;
      }
      items.forEach(item => listEl.appendChild(renderer(item)));
    };

    const fetchJson = async (url, options = {}) => {
      const res = await fetch(url, { credentials: 'include', ...options });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || res.statusText || 'Request failed');
      }
      return res.json();
    };

    const loadConnections = async () => {
      if (!userId) return;
      try {
        const data = await fetchJson(`/social/connections?user_id=${encodeURIComponent(userId)}`);
        renderList(connectionsList, data, connection => {
          const li = document.createElement('li');
          li.className = 'social-item social-item--inline';
          li.dataset.connectionId = connection.connection_id || connection.id;
          const info = document.createElement('div');
          const name = document.createElement('p');
          name.className = 'card__text card__text--emphasis';
          name.textContent = connection.friend_name || connection.full_name || 'Connection';
          const meta = document.createElement('p');
          meta.className = 'social-note';
          meta.textContent = `Connected since: ${connection.connected_at ? new Date(connection.connected_at).toLocaleDateString() : 'Pending'}`;
          info.append(name, meta);
          const messageBtn = document.createElement('button');
          messageBtn.type = 'button';
          messageBtn.className = 'btn btn-primary social-message';
          messageBtn.textContent = 'Message';
          messageBtn.addEventListener('click', () => showFlash('info', 'Messaging coming soon.'));
          li.append(info, messageBtn);
          return li;
        }, 'You have no connections yet.');
      } catch (error) {
        console.error('Connections error:', error);
        showFlash('error', 'Unable to load connections.');
      }
    };

    const loadRequests = async () => {
      if (!userId) return;
      try {
        const data = await fetchJson(`/social/connections/requests?user_id=${encodeURIComponent(userId)}`);
        const incoming = data.filter(item => item.requester_id !== Number(userId));
        const outgoing = data.filter(item => item.requester_id === Number(userId));

        renderList(incomingList, incoming, req => {
          const li = document.createElement('li');
          li.className = 'social-item';
          li.dataset.connectionId = req.connection_id || req.id;
          const info = document.createElement('div');
          const name = document.createElement('p');
          name.className = 'card__text card__text--emphasis';
          name.textContent = req.requester_name || req.full_name || 'Unknown user';
          const email = document.createElement('p');
          email.className = 'social-note';
          email.textContent = req.requester_email || req.email || '';
          info.append(name, email);
          const actions = document.createElement('div');
          actions.className = 'social-actions';
          const acceptBtn = document.createElement('button');
          acceptBtn.type = 'button';
          acceptBtn.className = 'btn btn-primary social-accept';
          acceptBtn.textContent = 'Accept';
          acceptBtn.addEventListener('click', () => respondToRequest(req.connection_id || req.id, 'accept'));
          const rejectBtn = document.createElement('button');
          rejectBtn.type = 'button';
          rejectBtn.className = 'btn btn-outline social-reject';
          rejectBtn.textContent = 'Reject';
          rejectBtn.addEventListener('click', () => respondToRequest(req.connection_id || req.id, 'reject'));
          actions.append(acceptBtn, rejectBtn);
          li.append(info, actions);
          return li;
        }, 'No pending requests.');

        renderList(outgoingList, outgoing, req => {
          const li = document.createElement('li');
          li.className = 'social-item';
          li.dataset.connectionId = req.connection_id || req.id;
          const name = document.createElement('p');
          name.className = 'card__text card__text--emphasis';
          name.textContent = req.recipient_name || req.full_name || req.friend_name || 'Pending user';
          const status = document.createElement('p');
          status.className = 'social-note';
          status.textContent = `Status: ${req.status || 'pending'}`;
          li.append(name, status);
          return li;
        }, 'No outgoing requests.');
      } catch (error) {
        console.error('Requests error:', error);
        showFlash('error', 'Unable to load requests.');
      }
    };

    const searchPeople = async term => {
      if (!resultsList) return;
      if (!term) {
        resultsList.innerHTML = '<li id="social-results-empty" class="social-empty">Start typing to find people.</li>';
        return;
      }
      try {
        const data = await fetchJson(`/social/people?q=${encodeURIComponent(term)}`);
        renderList(resultsList, data, person => {
          const li = document.createElement('li');
          li.className = 'social-item social-item--inline';
          li.dataset.userId = person.id;
          const info = document.createElement('div');
          const name = document.createElement('p');
          name.className = 'card__text card__text--emphasis';
          name.textContent = person.full_name || person.name || 'Unknown user';
          const email = document.createElement('p');
          email.className = 'social-note';
          email.textContent = person.email || '';
          info.append(name, email);
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'btn btn-primary social-add';
          addBtn.textContent = 'Add';
          addBtn.addEventListener('click', () => sendRequest(person.id));
          li.append(info, addBtn);
          return li;
        }, 'No matching people found.');
      } catch (error) {
        console.error('Search people error:', error);
        showFlash('error', 'Unable to search people right now.');
      }
    };

    const sendRequest = async targetId => {
      if (!userId) return;
      try {
        await fetchJson('/social/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requester_id: Number(userId), target_user_id: targetId })
        });
        showFlash('success', 'Request sent.');
        loadRequests();
      } catch (error) {
        console.error('Send request error:', error);
        showFlash('error', error.message || 'Unable to send request.');
      }
    };

    const respondToRequest = async (connectionId, action) => {
      if (!userId) return;
      try {
        await fetchJson(`/social/connections/${connectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: Number(userId), action })
        });
        showFlash('success', action === 'accept' ? 'Request accepted.' : 'Request updated.');
        await Promise.all([loadRequests(), loadConnections()]);
      } catch (error) {
        console.error('Respond request error:', error);
        showFlash('error', error.message || 'Unable to update request.');
      }
    };

    searchInput?.addEventListener('input', () => {
      window.clearTimeout(searchTimer);
      const term = searchInput.value.trim();
      searchTimer = window.setTimeout(() => searchPeople(term), 300);
    });

    loadConnections();
    loadRequests();
  };

  initEventsPage();
  initMoodPage();
  initSocialPage();
});
