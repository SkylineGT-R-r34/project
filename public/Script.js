//######################################## Main Script ########################################
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.getAttribute('data-page');

  // Utility: read cookie
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  //######################################## Mood Tracking Page ########################################
  //if (page === 'MoodTracking') {}
  //######################################## Event Page ########################################
  if (page === 'Events') {
    const eventList = document.getElementById('eventList');
    const searchInput = document.getElementById('search');
    const searchBtn = document.getElementById('searchBtn');
    const typeSelect = document.getElementById('type');
    const locationSelect = document.getElementById('location');
    const dateInput = document.getElementById('date');

    let allEvents = [];

    async function fetchAllEvents() {
      try {
        const res = await fetch('/events', { credentials: 'include' });
        if (res.status === 401) {
          alert('Session expired. Redirecting to login.');
          window.location.href = '/auth/login';
          return [];
        }
        return await res.json();
      } catch (err) {
        console.error(err);
        return [];
      }
    }

    function filterEvents() {
      const search = searchInput.value.toLowerCase().trim();
      const type = typeSelect.value.toLowerCase().trim();
      const location = locationSelect.value.toLowerCase().trim();
      const date = dateInput.value;

      return allEvents.filter(ev => {
        const eventDate = ev.event_date.slice(0, 10);
        return (
          (!search || ev.title.toLowerCase().includes(search)) &&
          (!type || ev.type.toLowerCase().includes(type)) &&
          (!location || ev.location.toLowerCase().includes(location)) &&
          (!date || eventDate === date)
        );
      });
    }

    function renderEvents(events) {
      eventList.innerHTML = '';
      if (!events.length) {
        eventList.innerHTML = '<li>No events found</li>';
        return;
      }

      events.forEach(ev => {
        const li = document.createElement('li');
        const info = document.createElement('span');
        const formattedDate = ev.event_date.slice(0, 10);
        info.innerHTML = `
          <strong>${ev.title}</strong><br>
          Type: ${ev.type}<br>
          Location: ${ev.location}<br>
          Date: ${formattedDate}<br>
          Time: ${ev.event_time}
        `;
        li.append(info);

        const btn = document.createElement('button');
        btn.textContent = 'Book';
        btn.addEventListener('click', async () => {
          try {
            const user_id = getCookie('user_id'); // assumes user_id cookie set at login
            const res = await fetch(`/events/book/${ev.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ user_id })
            });

            const data = await res.json();
            if (!res.ok) alert(data.message || 'Error booking event');
            else alert(`Successfully booked: ${ev.title}`);
          } catch (err) {
            console.error(err);
            alert('Network error');
          }
        });

        li.append(btn);
        eventList.append(li);
      });
    }

    async function init() {
      allEvents = await fetchAllEvents();
      renderEvents(allEvents);
      searchBtn.addEventListener('click', () => renderEvents(filterEvents()));
    }

    init();
  }
  //######################################## Dashboard Page ########################################
  if (page === 'Dashboard') {
    // Elements
    const q         = document.getElementById('dashSearch');
    const btn       = document.getElementById('dashBtn');
    const rangeSel  = document.getElementById('dashRange');
    const jumpSel   = document.getElementById('dashJump');

    const statsList = document.getElementById('statsList');
    const evUL      = document.getElementById('dashboardEventList');
    const moodUL    = document.getElementById('dashboardMoodList');

    // ---- Data fetch (optional; page works even if endpoint not present) ----
    async function fetchDashboard(range = '7') {
      try {
        const res = await fetch(`/dashboard/data?range=${encodeURIComponent(range)}`, { credentials: 'include' });
        if (res.status === 401) {
          alert('Session expired. Redirecting to login.');
          window.location.href = '/auth/login';
          return null;
        }
        if (!res.ok) return null; // endpoint might not exist; we keep server-rendered HTML
        return await res.json();  // { stats, recentEvents, recentMoods }
      } catch (err) {
        console.error('[dashboard] fetch error:', err);
        return null;
      }
    }

    // ---- Render helpers ----
    function renderStats(stats) {
      if (!statsList || !stats) return;
      const upcoming   = Number.isFinite(stats.upcomingEventsCount) ? stats.upcomingEventsCount : 0;
      const streak     = Number.isFinite(stats.moodStreakDays) ? stats.moodStreakDays : 0;
      const connections= Number.isFinite(stats.connectionsCount) ? stats.connectionsCount : 0;

      statsList.innerHTML = `
        <li class="tile">
          <div class="tile-title">🗓️ Upcoming events</div>
          <div class="tile-subtitle">${upcoming} scheduled</div>
          <a class="tile-link" href="/events">Open Events</a>
        </li>
        <li class="tile">
          <div class="tile-title">🙂 Mood streak</div>
          <div class="tile-subtitle">${streak} days</div>
          <a class="tile-link" href="/mood">Open Mood</a>
        </li>
        <li class="tile">
          <div class="tile-title">🤝 Connections</div>
          <div class="tile-subtitle">${connections} people</div>
          <a class="tile-link" href="/social">Open Social</a>
        </li>
      `;
    }

    function renderEvents(events = []) {
      if (!evUL) return;
      evUL.innerHTML = '';
      if (!events.length) {
        evUL.innerHTML = `<li class="event-item empty">No upcoming events. <a href="/events">Create one</a>.</li>`;
        return;
      }
      const frag = document.createDocumentFragment();
      events.forEach(ev => {
        const li = document.createElement('li');
        li.className = 'event-item';
        const title = document.createElement('div');
        title.className = 'event-title';
        title.textContent = ev.title;

        const meta = document.createElement('div');
        meta.className = 'event-meta';
        const dt = new Date(ev.date || ev.event_date);
        meta.innerHTML = `
          <span>${ev.location || 'TBA'}</span>
          <span>•</span>
          <span>${isNaN(dt) ? '' : dt.toLocaleDateString()}</span>
        `;

        const link = document.createElement('a');
        link.className = 'event-link';
        link.href = '/events';
        link.textContent = 'Details';

        li.append(title, meta, link);
        frag.appendChild(li);
      });
      evUL.appendChild(frag);
    }

    function renderMoods(moods = []) {
      if (!moodUL) return;
      moodUL.innerHTML = '';
      if (!moods.length) {
        moodUL.innerHTML = `<li class="mood-item empty">No mood logs yet. <a href="/mood">Log today’s mood</a>.</li>`;
        return;
      }
      const frag = document.createDocumentFragment();
      moods.forEach(m => {
        const li = document.createElement('li');
        li.className = 'mood-item';
        const emoji = (m.score >= 4 ? '😄' : m.score >= 2 ? '😐' : '😔');
        const date  = new Date(m.created_at || m.date);
        li.innerHTML = `
          <span class="mood-emoji" aria-hidden="true">${emoji}</span>
          <span class="mood-score">Score: ${m.score}</span>
          <span class="mood-date">${isNaN(date) ? '' : date.toLocaleDateString()}</span>
          ${m.notes ? `<span class="mood-notes">• ${m.notes}</span>` : ''}
        `;
        frag.appendChild(li);
      });
      moodUL.appendChild(frag);
    }

    // ---- Client-side filter (like Events page style) ----
    function filterLists() {
      const term = (q?.value || '').toLowerCase().trim();
      [evUL, moodUL].forEach(ul => {
        if (!ul) return;
        [...ul.querySelectorAll('li')].forEach(li => {
          const text = li.textContent.toLowerCase();
          li.style.display = term && !text.includes(term) ? 'none' : '';
        });
      });
    }

    // ---- Init ----
    async function init() {
      // Try to hydrate with live data (if endpoint exists); otherwise keep server-rendered HTML
      const initialRange = rangeSel?.value || '7';
      const payload = await fetchDashboard(initialRange);
      if (payload) {
        if (payload.stats) renderStats(payload.stats);
        if (payload.recentEvents) renderEvents(payload.recentEvents);
        if (payload.recentMoods) renderMoods(payload.recentMoods);
      }

      // Wire UI
      btn && btn.addEventListener('click', filterLists);
      q && q.addEventListener('keyup', e => { if (e.key === 'Enter') filterLists(); });
      jumpSel && jumpSel.addEventListener('change', function () { if (this.value) location.hash = this.value; });
      rangeSel && rangeSel.addEventListener('change', async function () {
        const data = await fetchDashboard(this.value);
        if (data) {
          renderStats(data.stats || {});
          renderEvents(data.recentEvents || []);
          renderMoods(data.recentMoods || []);
          filterLists(); // re-apply local filter if user typed something
        }
      });
    }

    init();
  }

  //####################################### Social Page ########################################

  //########################################Alert Page ########################################
});
