document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        config: {
            eventTime: 10,
            transitionTime: 5,
            minBreak: 30,
            startTime: '10:00',
            breakStart: '11:10',
            breakEnd: '11:30',
            schoolLimit: 3,
            preventBackToBack: true
        },
        schools: [],  // { id, name, color, isFar }
        rooms: [],    // { id, name, category, type } 'interview'|'speech', 'H'|'S'|'V'
        students: [], // { id, name, category, schoolId }
        judges: []    // { id, name, schoolId, roomId }
    };

    const generateBtn = document.getElementById('generateBtn');
    const scheduleOutput = document.getElementById('scheduleOutput');
    const finishStatus = document.getElementById('finishStatus');
    const viewToggles = document.querySelectorAll('.view-toggles .toggle-btn');
    const tabs = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const scheduleActions = document.getElementById('scheduleActions');

    let currentView = 'room'; // 'room' or 'student'
    let lastResult = null;

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById(target + 'Tab').classList.add('active');

            // Show/hide schedule specific actions
            if (target === 'schedule') {
                scheduleActions.classList.remove('hidden-reflow');
            } else {
                scheduleActions.classList.add('hidden-reflow');
            }
        });
    });

    // --- Persistence ---
    function saveState() {
        // Sync config inputs back to state before saving
        state.config = {
            eventTime: parseInt(document.getElementById('eventTime').value),
            transitionTime: parseInt(document.getElementById('transitionTime').value),
            minBreak: parseInt(document.getElementById('minBreak').value),
            startTime: document.getElementById('startTime').value,
            breakStart: document.getElementById('breakStart').value,
            breakEnd: document.getElementById('breakEnd').value,
            schoolLimit: parseInt(document.getElementById('schoolLimit').value),
            preventBackToBack: document.getElementById('noBackToBack').checked
        };
        localStorage.setItem('ad_sched_v2_state', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('ad_sched_v2_state');
        if (saved) {
            state = JSON.parse(saved);
            // Update config inputs
            document.getElementById('eventTime').value = state.config.eventTime;
            document.getElementById('transitionTime').value = state.config.transitionTime;
            document.getElementById('minBreak').value = state.config.minBreak;
            document.getElementById('startTime').value = state.config.startTime;
            document.getElementById('breakStart').value = state.config.breakStart || '11:10';
            document.getElementById('breakEnd').value = state.config.breakEnd || '11:30';
            if (state.config.schoolLimit) document.getElementById('schoolLimit').value = state.config.schoolLimit;
            if (state.config.preventBackToBack !== undefined) document.getElementById('noBackToBack').checked = state.config.preventBackToBack;
        } else {
            // Defaults for a demo
            state.schools = [{ id: 's1', name: 'Lincoln High', color: '#6366f1', isFar: false }];
            state.rooms = [
                { id: '1001', name: '1001', category: 'H', type: 'interview' },
                { id: '2001', name: '2001', category: 'H', type: 'speech' }
            ];
            state.students = [{ id: '101', name: 'John Doe', category: 'H', schoolId: 's1' }];
        }
        renderAllLists();
    }

    // --- List Management ---
    function renderAllLists() {
        renderSchoolList();
        renderRoomList();
        renderStudentList();
        renderJudgeList();
    }

    function renderSchoolList() {
        const list = document.getElementById('schoolList');
        list.innerHTML = '';
        state.schools.forEach(school => {
            const el = document.createElement('div');
            el.className = 'data-item';
            el.innerHTML = `
                <div class="data-item-header">
                    <span class="item-title"><span class="color-dot" style="background: ${school.color}"></span>${school.name || 'New School'}</span>
                    <button class="remove-btn" onclick="removeSchool('${school.id}')">&times;</button>
                </div>
                <div class="data-item-fields">
                    <div class="field-group">
                        <label>Name</label>
                        <input type="text" value="${school.name}" onchange="updateSchool('${school.id}', 'name', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Color</label>
                        <input type="color" value="${school.color}" onchange="updateSchool('${school.id}', 'color', this.value)">
                    </div>
                </div>
                <div style="margin-top: 0.5rem">
                    <label style="font-size: 0.65rem; display: flex; align-items: center; gap: 0.5rem">
                        <input type="checkbox" ${school.isFar ? 'checked' : ''} onchange="updateSchool('${school.id}', 'isFar', this.checked)" style="width: auto">
                        Far Distance (30m delay)
                    </label>
                </div>
            `;
            list.appendChild(el);
        });
    }

    function renderRoomList() {
        const list = document.getElementById('roomList');
        list.innerHTML = '';
        state.rooms.forEach(room => {
            const el = document.createElement('div');
            el.className = 'data-item';
            el.innerHTML = `
                <div class="data-item-header">
                    <span class="item-title">Room ${room.name}</span>
                    <button class="remove-btn" onclick="removeRoom('${room.id}')">&times;</button>
                </div>
                <div class="data-item-fields">
                    <div class="field-group">
                        <label>Name/No</label>
                        <input type="text" value="${room.name}" onchange="updateRoom('${room.id}', 'name', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Categories</label>
                        <div style="display: flex; gap: 0.75rem; align-items: center; padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; background: white">
                            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; margin: 0">
                                <input type="checkbox" style="width: auto" ${room.category.includes('H') ? 'checked' : ''} onchange="toggleRoomCategory('${room.id}', 'H')"> H
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; margin: 0">
                                <input type="checkbox" style="width: auto" ${room.category.includes('S') ? 'checked' : ''} onchange="toggleRoomCategory('${room.id}', 'S')"> S
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; margin: 0">
                                <input type="checkbox" style="width: auto" ${room.category.includes('V') ? 'checked' : ''} onchange="toggleRoomCategory('${room.id}', 'V')"> V
                            </label>
                        </div>
                    </div>
                    <div class="field-group">
                        <label>Type</label>
                        <select onchange="updateRoom('${room.id}', 'type', this.value)">
                            <option value="interview" ${room.type === 'interview' ? 'selected' : ''}>Interview</option>
                            <option value="speech" ${room.type === 'speech' ? 'selected' : ''}>Speech</option>
                        </select>
                    </div>
                </div>
                <div class="data-item-fields" style="margin-top: 0.75rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
                    <div class="field-group">
                        <label>Early Stop Time</label>
                        <input type="time" value="${room.stopTime || ''}" onchange="updateRoom('${room.id}', 'stopTime', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Private Break (Start-End)</label>
                        <div style="display:flex; gap: 0.25rem;">
                            <input type="time" value="${room.breakStart || ''}" onchange="updateRoom('${room.id}', 'breakStart', this.value)" style="padding: 0.25rem;">
                            <input type="time" value="${room.breakEnd || ''}" onchange="updateRoom('${room.id}', 'breakEnd', this.value)" style="padding: 0.25rem;">
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(el);
        });
    }

    function renderStudentList() {
        const list = document.getElementById('studentList');
        list.innerHTML = '';
        state.students.forEach(student => {
            const el = document.createElement('div');
            el.className = 'data-item';
            el.innerHTML = `
                <div class="data-item-header">
                    <span class="item-title">${student.name || 'New Student' || student.id}</span>
                    <button class="remove-btn" onclick="removeStudent('${student.id}')">&times;</button>
                </div>
                <div class="data-item-fields">
                    <div class="field-group">
                        <label>ID / Name</label>
                        <input type="text" value="${student.name}" onchange="updateStudent('${student.id}', 'name', this.value)">
                    </div>
                    <div class="field-group">
                        <label>School</label>
                        <select onchange="updateStudent('${student.id}', 'schoolId', this.value)">
                            <option value="">Select School</option>
                            ${state.schools.map(s => `<option value="${s.id}" ${student.schoolId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field-group">
                        <label>Category</label>
                        <select onchange="updateStudent('${student.id}', 'category', this.value)">
                            <option value="H" ${student.category === 'H' ? 'selected' : ''}>Honor (H)</option>
                            <option value="S" ${student.category === 'S' ? 'selected' : ''}>Scholastic (S)</option>
                            <option value="V" ${student.category === 'V' ? 'selected' : ''}>Varsity (V)</option>
                        </select>
                    </div>
                </div>
            `;
            list.appendChild(el);
        });
    }

    function renderJudgeList() {
        const list = document.getElementById('judgeList');
        list.innerHTML = '';
        state.judges.forEach(judge => {
            const el = document.createElement('div');
            el.className = 'data-item';
            el.innerHTML = `
                <div class="data-item-header">
                    <span class="item-title">${judge.name || 'New Judge'}</span>
                    <button class="remove-btn" onclick="removeJudge('${judge.id}')">&times;</button>
                </div>
                <div class="data-item-fields">
                    <div class="field-group">
                        <label>Name</label>
                        <input type="text" value="${judge.name}" onchange="updateJudge('${judge.id}', 'name', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Affiliation (School)</label>
                        <select onchange="updateJudge('${judge.id}', 'schoolId', this.value)">
                            <option value="">None</option>
                            ${state.schools.map(s => `<option value="${s.id}" ${judge.schoolId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field-group">
                        <label>Assigned Room</label>
                        <select onchange="updateJudge('${judge.id}', 'roomId', this.value)">
                            <option value="">Select Room</option>
                            ${state.rooms.map(r => `<option value="${r.id}" ${judge.roomId === r.id ? 'selected' : ''}>${r.name} (${r.type})</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
            list.appendChild(el);
        });
    }

    // --- Import System ---
    const importModal = document.getElementById('importModal');
    const importTitle = document.getElementById('importTitle');
    const importInstructions = document.getElementById('importInstructions');
    const importTextarea = document.getElementById('importTextarea');
    const processImportBtn = document.getElementById('processImportBtn');
    const csvFileInput = document.getElementById('csvFileInput');
    let currentImportCategory = '';

    window.openImport = (category) => {
        currentImportCategory = category;
        const info = {
            schools: 'Expected: Name, Color [optional], IsFar [optional]',
            rooms: 'Expected: Name, Category (eg. H or HS), Type (interview/speech)',
            students: 'Expected: ID/Name, Category (H/S/V), SchoolName',
            judges: 'Expected: Name, AffiliationSchoolName [optional], AssignedRoomName [optional]'
        };
        importTitle.innerText = `Import ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        importInstructions.innerText = info[category] + '. Use comma or tab separation. Use headers if possible, or just raw lines.';
        importTextarea.value = '';
        csvFileInput.value = '';
        importModal.classList.add('active');
    };

    window.closeImport = () => {
        importModal.classList.remove('active');
    };

    function parseInput(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length === 0) return [];

        // Simple auto-detector for separators
        const firstLine = lines[0];
        const sep = firstLine.includes('\t') ? '\t' : (firstLine.includes(',') ? ',' : '|');

        return lines.map(line => line.split(sep).map(s => s.trim().replace(/^["']|["']$/g, '')));
    }

    processImportBtn.addEventListener('click', () => {
        const text = importTextarea.value.trim();
        if (!text) {
            alert('Please paste some data first.');
            return;
        }

        const data = parseInput(text);
        if (data.length === 0) return;

        const mode = document.querySelector('input[name="importMode"]:checked').value;
        if (mode === 'overwrite') {
            state[currentImportCategory] = [];
        }

        // Processing Logic
        data.forEach((row, index) => {
            // Skip header if it looks like one
            if (index === 0 && row.some(cell => cell.toLowerCase().includes('name') || cell.toLowerCase().includes('id'))) return;
            if (row.length < 1) return;

            if (currentImportCategory === 'schools') {
                const [name, color, isFar] = row;
                state.schools.push({
                    id: 's' + Date.now() + index,
                    name: name || 'School',
                    color: color || '#6366f1',
                    isFar: (isFar || '').toLowerCase() === 'true'
                });
            } else if (currentImportCategory === 'rooms') {
                const [name, catStr, type] = row;
                const cats = (catStr || 'H').toUpperCase().split('').filter(c => ['H', 'S', 'V'].includes(c));
                state.rooms.push({
                    id: 'r' + Date.now() + index,
                    name: name || 'Room',
                    category: cats.length ? cats : ['H'],
                    type: (type || 'interview').toLowerCase()
                });
            } else if (currentImportCategory === 'students') {
                const [name, cat, schoolName] = row;
                const school = state.schools.find(s => s.name.toLowerCase() === (schoolName || '').toLowerCase());
                state.students.push({
                    id: 'st' + Date.now() + index,
                    name: name || 'Student',
                    category: (cat || 'H').toUpperCase(),
                    schoolId: school ? school.id : ''
                });
            } else if (currentImportCategory === 'judges') {
                const [name, schoolAff, roomName] = row;
                const school = state.schools.find(s => s.name.toLowerCase() === (schoolAff || '').toLowerCase());
                const room = state.rooms.find(r => r.name.toLowerCase() === (roomName || '').toLowerCase());
                state.judges.push({
                    id: 'j' + Date.now() + index,
                    name: name || 'Judge',
                    schoolId: school ? school.id : '',
                    roomId: room ? room.id : ''
                });
            }
        });

        renderAllLists();
        saveState();
        closeImport();
    });

    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            importTextarea.value = e.target.result;
        };
        reader.readAsText(file);
    });

    // --- Update Actions (Global for the onchange handlers) ---
    window.addSchool = () => {
        const id = 's' + Date.now();
        const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
        state.schools.push({ id, name: 'New School', color: colors[state.schools.length % colors.length], isFar: false });
        renderSchoolList(); renderStudentList(); renderJudgeList(); saveState();
    };
    window.removeSchool = (id) => { state.schools = state.schools.filter(s => s.id !== id); renderAllLists(); saveState(); };
    window.updateSchool = (id, key, val) => { const s = state.schools.find(s => s.id === id); s[key] = val; renderSchoolList(); renderStudentList(); renderJudgeList(); saveState(); };

    window.addRoom = () => {
        const id = 'r' + Date.now();
        state.rooms.push({ id, name: '99', category: ['H'], type: 'interview' });
        renderRoomList(); renderJudgeList(); saveState();
    };
    window.removeRoom = (id) => { state.rooms = state.rooms.filter(r => r.id !== id); renderRoomList(); renderJudgeList(); saveState(); };
    window.updateRoom = (id, key, val) => { const r = state.rooms.find(r => r.id === id); r[key] = val; renderRoomList(); renderJudgeList(); saveState(); };
    window.toggleRoomCategory = (id, cat) => {
        const r = state.rooms.find(r => r.id === id);
        if (!Array.isArray(r.category)) r.category = [r.category]; // Migration
        if (r.category.includes(cat)) {
            if (r.category.length > 1) r.category = r.category.filter(c => c !== cat);
        } else {
            r.category.push(cat);
        }
        renderRoomList(); saveState();
    };

    window.addStudent = () => {
        const id = 'st' + Date.now();
        state.students.push({ id, name: '101', category: 'H', schoolId: '' });
        renderStudentList(); saveState();
    };
    window.removeStudent = (id) => { state.students = state.students.filter(s => s.id !== id); renderStudentList(); saveState(); };
    window.updateStudent = (id, key, val) => { const s = state.students.find(s => s.id === id); s[key] = val; renderStudentList(); saveState(); };

    window.addJudge = () => {
        const id = 'j' + Date.now();
        state.judges.push({ id, name: 'Judge X', schoolId: '', roomId: '' });
        renderJudgeList(); saveState();
    };
    window.removeJudge = (id) => { state.judges = state.judges.filter(j => j.id !== id); renderJudgeList(); saveState(); };
    window.updateJudge = (id, key, val) => { const j = state.judges.find(j => j.id === id); j[key] = val; renderJudgeList(); saveState(); };

    // --- Backup & Restore ---
    const exportStateBtn = document.getElementById('exportStateBtn');
    const importStateBtn = document.getElementById('importStateBtn');
    const stateFileInput = document.getElementById('stateFileInput');

    window.exportEverything = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `ad_sched_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    window.importEverything = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedState = JSON.parse(event.target.result);
                // Basic validation
                if (!importedState.config || !importedState.schools || !importedState.rooms) {
                    throw new Error("Invalid backup file format.");
                }
                state = importedState;
                renderAllLists();
                loadConfigInputs(); // Helper to refresh inputs
                saveState();
                alert("Data imported successfully!");
                if (lastResult) generateBtn.click(); // Optional: auto-generate if we had a result
            } catch (err) {
                alert("Error importing file: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    function loadConfigInputs() {
        document.getElementById('eventTime').value = state.config.eventTime;
        document.getElementById('transitionTime').value = state.config.transitionTime;
        document.getElementById('minBreak').value = state.config.minBreak;
        document.getElementById('startTime').value = state.config.startTime;
        document.getElementById('breakStart').value = state.config.breakStart || '11:10';
        document.getElementById('breakEnd').value = state.config.breakEnd || '11:30';
        if (state.config.schoolLimit) document.getElementById('schoolLimit').value = state.config.schoolLimit;
        if (state.config.preventBackToBack !== undefined) document.getElementById('noBackToBack').checked = state.config.preventBackToBack;
    }

    exportStateBtn.addEventListener('click', () => window.exportEverything());
    importStateBtn.addEventListener('click', () => stateFileInput.click());
    stateFileInput.addEventListener('change', window.importEverything);

    // Bind add buttons
    document.getElementById('addSchoolBtn').addEventListener('click', () => window.addSchool());
    document.getElementById('addRoomBtn').addEventListener('click', () => window.addRoom());
    document.getElementById('addStudentBtn').addEventListener('click', () => window.addStudent());
    document.getElementById('addJudgeBtn').addEventListener('click', () => window.addJudge());

    // --- Core Logic ---

    function solveScheduling(state) {
        const { eventTime, transitionTime, minBreak, startTime, breakStart, breakEnd, schoolLimit, preventBackToBack } = state.config;
        const students = state.students;
        const rooms = state.rooms;
        const judges = state.judges;
        const schools = state.schools;

        const studentSchedule = {};
        students.forEach(s => studentSchedule[s.id] = { interview: null, speech: null });
        const roomOccupancy = {};
        const schoolSlotCounts = {}; // { slotIndex: { schoolId: count } }
        const slotMinutes = eventTime + transitionTime;

        // Times
        const slotTimes = [];
        const [lsH, lsM] = breakStart.split(':').map(Number);
        const [leH, leM] = breakEnd.split(':').map(Number);
        const [sH, sM] = startTime.split(':').map(Number);
        const breakStartDate = new Date(); breakStartDate.setHours(lsH, lsM, 0, 0);
        const breakEndDate = new Date(); breakEndDate.setHours(leH, leM, 0, 0);
        let iterTime = new Date(); iterTime.setHours(sH, sM, 0, 0);

        function ensureSlots(count) {
            while (slotTimes.length < count) {
                const nextSlotEnd = new Date(iterTime.getTime() + eventTime * 60000);
                if (iterTime < breakEndDate && nextSlotEnd > breakStartDate) {
                    iterTime = new Date(breakEndDate.getTime()); continue;
                }
                slotTimes.push(new Date(iterTime.getTime()));
                iterTime = new Date(iterTime.getTime() + slotMinutes * 60000);
            }
        }

        // Logic Helpers
        function getJudgeForRoom(roomId) {
            return judges.find(j => j.roomId === roomId);
        }

        function canStudentUseRoom(student, room, slot) {
            // Category match (check if student category is allowed in this room)
            const allowedCats = Array.isArray(room.category) ? room.category : [room.category];
            if (!allowedCats.includes(student.category)) return false;

            // Room specific stop time
            if (room.stopTime) {
                const [stopH, stopM] = room.stopTime.split(':').map(Number);
                const stopDate = new Date(); stopDate.setHours(stopH, stopM, 0, 0);
                if (slotTimes[slot] >= stopDate) return false;
            }

            // Room specific break
            if (room.breakStart && room.breakEnd) {
                const [bsH, bsM] = room.breakStart.split(':').map(Number);
                const [beH, beM] = room.breakEnd.split(':').map(Number);
                const bsDate = new Date(); bsDate.setHours(bsH, bsM, 0, 0);
                const beDate = new Date(); beDate.setHours(beH, beM, 0, 0);
                const nextSlotEnd = new Date(slotTimes[slot].getTime() + eventTime * 60000);
                if (slotTimes[slot] < beDate && nextSlotEnd > bsDate) return false;
            }

            // School concurrency limit
            if (student.schoolId) {
                const count = (schoolSlotCounts[slot] && schoolSlotCounts[slot][student.schoolId]) || 0;
                if (count >= schoolLimit) return false;
            }

            // Back-to-back school check
            if (preventBackToBack && slot > 0 && roomOccupancy[slot - 1]) {
                const prevStudentId = roomOccupancy[slot - 1][room.id];
                if (prevStudentId) {
                    const prevStudent = students.find(s => s.id === prevStudentId);
                    if (prevStudent && prevStudent.schoolId === student.schoolId) return false;
                }
            }

            // Judge conflict
            const judge = getJudgeForRoom(room.id);
            if (judge && judge.schoolId && judge.schoolId === student.schoolId) return false;

            // Late start for far schools
            const school = schools.find(s => s.id === student.schoolId);
            if (school && school.isFar) {
                const dayStart = slotTimes[0];
                const diff = (slotTimes[slot] - dayStart) / 60000;
                if (diff < 30) return false;
            }

            return true;
        }

        let studentsNotStarted = [...students];
        let studentsInBreak = []; // { id, data, typeDone, readyTime }

        let currentSlot = 0;
        while (studentsNotStarted.length > 0 || studentsInBreak.length > 0) {
            ensureSlots(currentSlot + 1);
            const slotStart = slotTimes[currentSlot];
            if (!roomOccupancy[currentSlot]) roomOccupancy[currentSlot] = {};

            // 1. Prioritize STARTING new students
            for (let i = studentsNotStarted.length - 1; i >= 0; i--) {
                const student = studentsNotStarted[i];

                // Find any free room that fits this student
                const freeRooms = rooms.filter(r => !roomOccupancy[currentSlot][r.id]);
                // Balanced picking: prefer the type that moves slowest? 
                // Let's just pick the first valid one
                const validRoom = freeRooms.find(r => canStudentUseRoom(student, r, currentSlot));

                if (validRoom) {
                    const type = validRoom.type;
                    studentSchedule[student.id][type] = [currentSlot, validRoom.id];
                    roomOccupancy[currentSlot][validRoom.id] = student.id;

                    // Track school count
                    if (student.schoolId) {
                        if (!schoolSlotCounts[currentSlot]) schoolSlotCounts[currentSlot] = {};
                        schoolSlotCounts[currentSlot][student.schoolId] = (schoolSlotCounts[currentSlot][student.schoolId] || 0) + 1;
                    }

                    studentsInBreak.push({
                        id: student.id,
                        data: student,
                        typeDone: type,
                        readyTime: new Date(slotStart.getTime() + (eventTime + minBreak) * 60000)
                    });
                    studentsNotStarted.splice(i, 1);
                }
            }

            // 2. Fill remaining with finishing students
            const readyToFinish = studentsInBreak.filter(s => slotStart >= s.readyTime);
            for (let sInfo of readyToFinish) {
                const typeNeeded = sInfo.typeDone === 'interview' ? 'speech' : 'interview';
                const freeRooms = rooms.filter(r => !roomOccupancy[currentSlot][r.id] && r.type === typeNeeded);
                const validRoom = freeRooms.find(r => canStudentUseRoom(sInfo.data, r, currentSlot));

                if (validRoom) {
                    studentSchedule[sInfo.id][typeNeeded] = [currentSlot, validRoom.id];
                    roomOccupancy[currentSlot][validRoom.id] = sInfo.id;

                    // Track school count
                    if (sInfo.data.schoolId) {
                        if (!schoolSlotCounts[currentSlot]) schoolSlotCounts[currentSlot] = {};
                        schoolSlotCounts[currentSlot][sInfo.data.schoolId] = (schoolSlotCounts[currentSlot][sInfo.data.schoolId] || 0) + 1;
                    }

                    studentsInBreak = studentsInBreak.filter(si => si.id !== sInfo.id);
                }
            }

            currentSlot++;
            if (currentSlot > 3000) break;
        }

        const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { studentSchedule, roomOccupancy, slotTimes, formatTime, config: state.config, schools, students, rooms, judges };
    }

    // --- UI Rendering ---

    function renderRoomView(result) {
        const { roomOccupancy, rooms, slotTimes, formatTime, config, schools, judges } = result;
        scheduleOutput.innerHTML = '';
        const interviewRooms = rooms.filter(r => r.type === 'interview');
        const speechRooms = rooms.filter(r => r.type === 'speech');

        const createTable = (title, typeRooms) => {
            const section = document.createElement('div');
            section.className = 'matrix-section animate-in';
            section.innerHTML = `
                <h2 style="margin-bottom:1rem; font-size:1.25rem; color:var(--text-muted)">${title}</h2>
                <div class="matrix-container">
                    <table class="matrix-table">
                        <thead>
                            <tr>
                                <th>Time Slot</th>
                                ${typeRooms.map(r => {
                const judge = judges.find(j => j.roomId === r.id);
                const cats = Array.isArray(r.category) ? r.category.join(', ') : r.category;
                return `<th>Room ${r.name}<br><small style="font-weight:400">${judge ? judge.name : 'No Judge'}</small><br><small style="color:var(--primary); font-weight:700">${cats}</small></th>`;
            }).join('')}
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            const tbody = section.querySelector('tbody');
            const sortedSlots = Object.keys(roomOccupancy).map(Number).sort((a, b) => a - b);
            let breakInserted = false;
            const [bsH, bsM] = config.breakStart.split(':').map(Number);
            const [beH, beM] = config.breakEnd.split(':').map(Number);
            const breakStartD = new Date(); breakStartD.setHours(bsH, bsM, 0, 0);
            const breakEndD = new Date(); breakEndD.setHours(beH, beM, 0, 0);

            sortedSlots.forEach(slot => {
                const start = slotTimes[slot];
                if (!breakInserted && start >= breakStartD) {
                    tbody.innerHTML += `<tr class="break-row"><td colspan="${typeRooms.length + 1}">BREAK PERIOD (${formatTime(breakStartD)} - ${formatTime(breakEndD)})</td></tr>`;
                    breakInserted = true;
                }
                const end = new Date(start.getTime() + config.eventTime * 60000);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="time-cell">${formatTime(start)} - ${formatTime(end)}</td>`;
                typeRooms.forEach(room => {
                    const studentId = roomOccupancy[slot][room.id];
                    if (studentId) {
                        const student = result.students.find(s => s.id === studentId);
                        const school = schools.find(s => s.id === student.schoolId);
                        const color = school ? school.color : 'var(--primary)';
                        const typeClass = room.type;
                        tr.innerHTML += `<td><span class="student-pill ${typeClass}" style="--pill-bg: ${color}">${student.name || studentId} <span class="student-cat">${student.category}</span></span></td>`;
                    } else {
                        tr.innerHTML += `<td></td>`;
                    }
                });
                tbody.appendChild(tr);
            });
            return section;
        };

        if (interviewRooms.length) scheduleOutput.appendChild(createTable('Interview Rooms', interviewRooms));
        if (speechRooms.length) scheduleOutput.appendChild(createTable('Speech Rooms', speechRooms));
    }

    function renderStudentView(result) {
        const { studentSchedule, slotTimes, formatTime, students, schools, rooms } = result;
        scheduleOutput.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'schedule-table-wrapper animate-in';
        wrapper.innerHTML = `
            <table class="schedule-table">
                <thead><tr><th>Student</th><th>Category</th><th>School</th><th>Interview</th><th>Speech</th></tr></thead>
                <tbody></tbody>
            </table>
        `;
        const tbody = wrapper.querySelector('tbody');
        students.sort((a, b) => a.id.localeCompare(b.id)).forEach(s => {
            const sched = studentSchedule[s.id];
            const school = schools.find(sch => sch.id === s.schoolId);
            const iSlot = (sched && sched.interview) ? `${formatTime(slotTimes[sched.interview[0]])} (Rm ${result.rooms.find(r => r.id === sched.interview[1]).name})` : 'N/A';
            const sSlot = (sched && sched.speech) ? `${formatTime(slotTimes[sched.speech[0]])} (Rm ${result.rooms.find(r => r.id === sched.speech[1]).name})` : 'N/A';
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:700">${s.name || s.id}</td>
                    <td>${s.category}</td>
                    <td><span class="color-dot" style="background:${school?.color}"></span>${school?.name || 'Unknown'}</td>
                    <td>${iSlot}</td>
                    <td>${sSlot}</td>
                </tr>
            `;
        });
        scheduleOutput.appendChild(wrapper);
    }

    function updateUI() {
        if (!lastResult) return;
        if (currentView === 'room') renderRoomView(lastResult);
        else renderStudentView(lastResult);
        const maxSlot = Math.max(...Object.keys(lastResult.roomOccupancy).map(Number));
        const finalSlotEnd = new Date(lastResult.slotTimes[maxSlot].getTime() + lastResult.config.eventTime * 60000);
        finishStatus.innerText = `Finishes at ${lastResult.formatTime(finalSlotEnd)}`;
        finishStatus.className = 'status-badge success';
    }

    // --- Handlers ---
    document.getElementById('printBtn').addEventListener('click', () => window.print());

    document.getElementById('generateBtn').addEventListener('click', () => {
        if (lastResult && !confirm("Generating a new schedule will overwrite the current one. Continue?")) {
            return;
        }
        saveState();
        lastResult = solveScheduling(state);
        updateUI();
    });

    viewToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            viewToggles.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            updateUI();
        });
    });

    loadState();
    document.getElementById('generateBtn').click();
});
