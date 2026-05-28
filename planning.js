(function () {
    'use strict';

    LuxorAuth.requireAuth('login.html');
    const s = LuxorAuth.getSession();
    const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
    const client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

    let currentOperator = null;
    let availabilityData = [];
    let dates = [];
    let selectedDay = null; // For the editor
    let currentEditSlots = new Array(48).fill(false);

    // ── INITIALIZATION ──────────────────────────────────────────────

    async function init() {
        if (!s) return;
        
        // Calculate 14-day range immediately for initial render
        calculateDates();
        
        // Initial skeleton render
        renderGrid();

        // Fetch operator and cleanup in background
        client.query("operators:getByCallsign", { callsign: s.username }).then(op => {
            currentOperator = op;
        });

        const todayStr = dates[0].iso;
        client.mutation("planning:cleanupOldAvailability", { beforeDate: todayStr }).catch(e => {
            console.warn("Background cleanup failed:", e);
        });

        // Fetch data and replace skeletons
        fetchAvailability().then(() => {
            const loader = document.getElementById('mini-loader');
            if (loader) loader.classList.add('ml-out');
        });
        setupEventListeners();
    }

    function calculateDates() {
        dates = [];
        const now = new Date();
        for (let i = 0; i < 14; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            const display = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
            dates.push({ iso, display });
        }
        document.getElementById('date-range').textContent = `${dates[0].display} — ${dates[13].display}`;
    }

    // ── DATA FETCHING ───────────────────────────────────────────────

    async function fetchAvailability() {
        try {
            availabilityData = await client.query("planning:getAvailability", {
                startDate: dates[0].iso,
                endDate: dates[13].iso
            });
            updateGrid();
        } catch (e) {
            console.error("Error fetching availability:", e);
        }
    }

    async function quickSetAvailability(day, fromSlot) {
        if (!currentOperator) return;

        // Reset the window (10:00 - 22:00) and set from fromSlot to end
        const slots = new Array(48).fill(false);
        
        for (let i = fromSlot; i <= 44; i++) {
            slots[i] = true;
        }

        try {
            await client.mutation("planning:updateAvailability", {
                operatorId: currentOperator._id,
                date: day.iso,
                slots: slots
            });
            fetchAvailability(); // Background refresh
        } catch (e) {
            console.error("Quick set failed:", e);
        }
    }

    async function clearDayAvailability(day) {
        if (!currentOperator) return;

        try {
            await client.mutation("planning:updateAvailability", {
                operatorId: currentOperator._id,
                date: day.iso,
                slots: new Array(48).fill(false)
            });
            fetchAvailability(); // Background refresh
        } catch (e) {
            console.error("Clear day failed:", e);
        }
    }

    // ── GRID RENDERING ──────────────────────────────────────────────

    function renderGrid() {
        const grid = document.getElementById('availability-grid');
        grid.innerHTML = '';

        // Header Row
        const timeHeader = document.createElement('div');
        timeHeader.className = 'grid-cell header-cell time-cell';
        timeHeader.textContent = 'TIME (Z)';
        grid.appendChild(timeHeader);

        dates.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell header-cell';
            cell.innerHTML = `<span style="font-size:0.6rem; opacity:0.7;">${day.display.split(' ')[0]}</span><span>${day.display.split(' ').slice(1).join(' ')}</span>`;
            grid.appendChild(cell);
        });

        // Time Rows (Restricted to 10:00 - 22:00)
        for (let slot = 20; slot <= 44; slot++) {
            const hour = Math.floor(slot / 2);
            const min = slot % 2 === 0 ? "00" : "30";
            const timeStr = `${hour.toString().padStart(2, '0')}:${min}`;

            const timeCell = document.createElement('div');
            timeCell.className = 'grid-cell time-cell';
            timeCell.textContent = timeStr;
            grid.appendChild(timeCell);

            dates.forEach(day => {
                const cell = document.createElement('div');
                cell.className = 'grid-cell slot-active intensity-0 skeleton-cell';
                cell.id = `slot-${day.iso}-${slot}`;
                cell.style.cursor = 'pointer';
                cell.title = `Click to mark available from ${timeStr} onwards`;
                
                cell.onmouseenter = (e) => showTooltip(e, day.iso, slot);
                cell.onmouseleave = hideTooltip;
                cell.onclick = () => quickSetAvailability(day, slot);
                
                grid.appendChild(cell);
            });
        }

        // Trash Row (Clear Day)
        const trashLabel = document.createElement('div');
        trashLabel.className = 'grid-cell time-cell';
        trashLabel.style.fontSize = '0.5rem';
        trashLabel.textContent = 'CLEAR DAY';
        grid.appendChild(trashLabel);

        dates.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell trash-cell';
            cell.id = `trash-${day.iso}`;
            cell.innerHTML = '⊠';
            cell.title = "Clear your availability for this day";
            cell.onclick = () => clearDayAvailability(day);
            grid.appendChild(cell);
        });
    }

    function updateGrid() {
        // Clear all slots and trash buttons first
        document.querySelectorAll('.slot-active').forEach(el => {
            el.className = 'grid-cell slot-active intensity-0';
            el.textContent = '';
        });
        document.querySelectorAll('.trash-cell').forEach(el => {
            el.classList.remove('active');
        });

        // Group data by date and slot
        const map = {}; // date_slot -> [callsigns]
        const userHasAvailability = {}; // date -> boolean (for current user)
        
        availabilityData.forEach(entry => {
            const isMe = currentOperator && entry.operatorId === currentOperator._id;
            
            entry.slots.forEach((isActive, slotIdx) => {
                if (isActive) {
                    const key = `${entry.date}_${slotIdx}`;
                    if (!map[key]) map[key] = [];
                    map[key].push(entry.callsign);
                    
                    if (isMe) userHasAvailability[entry.date] = true;
                }
            });
        });

        // Apply to grid
        Object.keys(map).forEach(key => {
            const [date, slot] = key.split('_');
            const cell = document.getElementById(`slot-${date}-${slot}`);
            if (cell) {
                const operators = map[key];
                const count = operators.length;
                
                let intensity = 'intensity-0';
                if (count >= 5) intensity = 'intensity-high';
                else if (count > 0) intensity = `intensity-${count}`;
                
                cell.className = `grid-cell slot-active ${intensity}`;
                cell.textContent = count;
                cell.dataset.operators = JSON.stringify(operators);
            }
        });

        // Update trash icons
        Object.keys(userHasAvailability).forEach(date => {
            if (userHasAvailability[date]) {
                const trash = document.getElementById(`trash-${date}`);
                if (trash) trash.classList.add('active');
            }
        });
    }

    // ── TOOLTIP ─────────────────────────────────────────────────────

    const tooltip = document.getElementById('tooltip');
    const tooltipList = document.getElementById('tooltip-operators');

    function showTooltip(e, date, slot) {
        const operatorsJson = e.target.dataset.operators;
        if (!operatorsJson) return;

        const operators = JSON.parse(operatorsJson);
        if (operators.length === 0) return;

        tooltipList.innerHTML = '';
        operators.forEach(op => {
            const li = document.createElement('li');
            li.textContent = op;
            tooltipList.appendChild(li);
        });

        tooltip.style.display = 'block';
        
        // Position tooltip
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = (rect.left + window.scrollX + 40) + 'px';
        tooltip.style.top = (rect.top + window.scrollY - 10) + 'px';
    }

    function hideTooltip() {
        tooltip.style.display = 'none';
    }

    // ── EDITOR ──────────────────────────────────────────────────────

    const modal = document.getElementById('editor-modal');
    const editorGrid = document.getElementById('editor-grid');
    const dateLabel = document.getElementById('editor-date-label');

    function openEditor(day) {
        selectedDay = day;
        dateLabel.textContent = day.display.toUpperCase();
        
        // Load current availability for this day
        const existing = availabilityData.find(d => d.date === day.iso && d.operatorId === currentOperator._id);
        currentEditSlots = existing ? [...existing.slots] : new Array(48).fill(false);
        
        renderEditorSlots();
        modal.style.display = 'flex';
    }

    function renderEditorSlots() {
        editorGrid.innerHTML = '';
        for (let slot = 20; slot <= 44; slot++) {
            const hour = Math.floor(slot / 2);
            const min = slot % 2 === 0 ? "00" : "30";
            const timeStr = `${hour.toString().padStart(2, '0')}:${min}`;

            const btn = document.createElement('div');
            btn.className = `slot-btn ${currentEditSlots[slot] ? 'selected' : ''}`;
            btn.textContent = timeStr;
            btn.onclick = () => {
                currentEditSlots[slot] = !currentEditSlots[slot];
                btn.classList.toggle('selected');
            };
            editorGrid.appendChild(btn);
        }
    }

    async function saveAvailability() {
        if (!selectedDay || !currentOperator) return;
        
        try {
            await client.mutation("planning:updateAvailability", {
                operatorId: currentOperator._id,
                date: selectedDay.iso,
                slots: currentEditSlots
            });
            modal.style.display = 'none';
            fetchAvailability(); // Refresh
        } catch (e) {
            alert("ERROR SAVING AVAILABILITY: " + e.message);
        }
    }

    // ── EVENT LISTENERS ─────────────────────────────────────────────

    function setupEventListeners() {
        document.getElementById('btn-refresh').onclick = fetchAvailability;
    }

    // Kick off
    init();

})();
