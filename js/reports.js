const ReportsModule = (function () {
  let charts = {};

  function render() {
    renderSummaryCards();
    // Charts need Chart.js - load if available
    if (typeof Chart !== 'undefined') {
      renderCharts();
    } else {
      // Fallback static content
      renderStaticCharts();
    }
  }

  function renderSummaryCards() {
    const a = QueueManager.getAnalytics();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('reportServed', a.servedCount);
    set('reportAvgWait', a.servedCount ? QueueManager.formatDuration(a.avgWaitMs) : '0 min');
    set('reportAvgService', a.servedCount ? QueueManager.formatDuration(a.avgServiceMs) : '0 min');
    set('reportNoShow', a.noShowRate + '%');

    const empty = document.getElementById('reportsEmpty');
    if (empty) empty.classList.toggle('hidden', a.hasData);
  }

  function renderCharts() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    const a = QueueManager.getAnalytics();
    const offices = QueueManager.getOffices();
    const gridOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#E5EAF0' } },
        x: { grid: { display: false } }
      }
    };

    const ctx1 = document.getElementById('chartPerOffice');
    if (ctx1) {
      charts.perOffice = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: offices.map(o => o.name),
          datasets: [{
            label: 'Students Served',
            data: offices.map(o => a.perOffice[o.id] || 0),
            backgroundColor: '#2684E8',
            borderRadius: 6,
            maxBarThickness: 40
          }]
        },
        options: gridOpts
      });
    }

    // Peak hours: only show hours 6AM–8PM
    const ctx2 = document.getElementById('chartPeakHours');
    if (ctx2) {
      const hourLabel = h => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? 'AM' : 'PM');
      const range = [];
      for (let h = 6; h <= 20; h++) range.push(h);
      charts.peak = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: range.map(hourLabel),
          datasets: [{
            label: 'Queue Volume',
            data: range.map(h => a.hours[h]),
            borderColor: '#2684E8',
            backgroundColor: 'rgba(38,132,232,0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#2684E8'
          }]
        },
        options: gridOpts
      });
    }

    const ctx3 = document.getElementById('chartStatus');
    if (ctx3) {
      const values = [a.servedCount, a.waitingCount, a.skippedCount, a.canceledCount];
      const total = values.reduce((x, y) => x + y, 0);
      charts.status = new Chart(ctx3, {
        type: 'doughnut',
        data: {
          labels: ['Served', 'Waiting', 'Skipped', 'Canceled'],
          datasets: [{
            data: total ? values : [1],
            backgroundColor: total ? ['#22C55E', '#2684E8', '#F59E0B', '#94A3B8'] : ['#E5EAF0'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
            tooltip: { enabled: total > 0 }
          },
          cutout: '65%'
        }
      });
    }
  }

  function renderStaticCharts() {
    // Placeholder if Chart.js not loaded
    ['chartPerOffice', 'chartPeakHours', 'chartStatus'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement) {
        el.parentElement.innerHTML = `
          <div class="chart-fallback">
            Chart visualization (load Chart.js for interactive charts)
          </div>
        `;
      }
    });
  }

  return { render };
})();