const moodList = document.getElementById('mood-list');
const form = document.getElementById('moodForm');

// Render moods
function renderMoods(moods) {
  moodList.innerHTML = '';

  moods.forEach(mood => {
    const li = document.createElement('li');
    li.classList.add('mood-item');

    const container = document.createElement('div');
    container.classList.add('mood-container');

    // Score
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = `Mood Score: ${mood.score}`;
    scoreSpan.classList.add('mood-score');

    // Notes
    const notesSpan = document.createElement('span');
    notesSpan.innerHTML = `<strong>Notes:</strong><br> ${mood.notes}`;
    notesSpan.classList.add('mood-notes');
    // Date & Time
    const createdAt = new Date(mood.created_at);

    const dateSpan = document.createElement('span');
    dateSpan.innerHTML = `<Strong>Date:</Strong><br> ${createdAt.toLocaleDateString()}`;
    dateSpan.classList.add('mood-date');

    const timeSpan = document.createElement('span');
    timeSpan.innerHTML = `<Strong>Time:</Strong><br> ${createdAt.toLocaleTimeString()}`;
    timeSpan.classList.add('mood-time');

    const dateTimeContainer = document.createElement('div');
    dateTimeContainer.classList.add('mood-datetime');
    dateTimeContainer.appendChild(dateSpan);
    dateTimeContainer.appendChild(timeSpan);

    // Append elements to container
    container.appendChild(scoreSpan);
    container.appendChild(notesSpan);
    container.appendChild(dateTimeContainer);

    li.appendChild(container);
    moodList.appendChild(li);
  });

  // Auto-scroll to latest mood
  moodList.scrollTop = 0;
}

// Fetch all moods
async function loadMoods() {
  try {
    const res = await fetch('/moodTracking');
    const data = await res.json();
    renderMoods(data);
  } catch (err) {
    console.error('Error loading moods:', err);
  }
}
loadMoods();

// Handle new mood submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);

  const body = {
    user_id: formData.get('user_id'),
    score: formData.get('score'),
    notes: formData.get('notes')
  };

  try {
    const res = await fetch('/moodTracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const newMood = await res.json();
    // add new mood to list
    loadMoods();
    form.reset();/* reset form inputs */
  } catch (err) {
    console.error('Error adding mood:', err);
  }
});
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Fetch graph data from backend
    const res = await fetch("/moodTracking/graph");
    const data = await res.json();

    // Prepare labels (dates) and values (avg scores)
    const labels = data.map(row => new Date(row.day).toLocaleDateString());
    const scores = data.map(row => row.average_score);

    // Create Chart
    const ctx = document.getElementById("moodChart").getContext("2d");
    new Chart(ctx, {
      type: "line", 
      data: {
        labels: labels.reverse(), // oldest first
        datasets: [{
          label: "Average Mood Score",
          data: scores.reverse(),
          borderColor: "#017d71",
          backgroundColor: "rgba(1, 125, 113, 0.2)",
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 10
          }
        }
      }
    });
  } catch (err) {
    console.error("Error loading graph:", err);
  }
});
// Handle help form submission
const helpForm = document.getElementById('helpForm');

helpForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // stops default page reload

  const formData = new FormData(helpForm);
  const body = {
    user_id: formData.get('user_id'),
    message: formData.get('message')
  };

  try {
    const res = await fetch('/moodTracking/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      // background success, just reset
      helpForm.reset();
      console.log("Help request sent successfully");
    } else {
      console.error("Failed to send help request");
    }
  } catch (err) {
    console.error("Error sending help request:", err);
  }
});
