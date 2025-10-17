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

  //####################################### Social Page ########################################

  //########################################Alert Page ########################################
});
