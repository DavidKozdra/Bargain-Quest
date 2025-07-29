function initViews() {
  const stored = localStorage.getItem('viewSettings');
  viewSettings = stored ? JSON.parse(stored) : [
    { name: 'Isometric', type: 'orthographic', rotX: 30, rotY: -45 },
    { name: 'Top-Down', type: 'orthographic', rotX: 270, rotY: -180, callBack: setTopDown }
  ];
  localStorage.setItem('viewSettings', JSON.stringify(viewSettings));

  const list = document.getElementById('viewList');
  list.innerHTML = '';
  viewSettings.forEach((v, i) => addViewButton(v, i));

  // Toggle dropdown
  document.getElementById('viewToggle').onclick = () => {
    list.classList.toggle('expanded');
    const arrow = document.getElementById('toggleArrow');
    arrow.textContent = list.classList.contains('expanded') ? '▲' : '▼';
  };

  document.getElementById('addViewBtn').onclick = () => toggleForm(true);
  document.getElementById('saveViewBtn').onclick = saveNewView;

  setView(0);
}

function addViewButton(view, idx) {
  const list = document.getElementById('viewList');
  const btn = document.createElement('button');
  btn.className = 'view-btn';
  btn.textContent = view.name;
  btn.onclick = () => setView(idx);
  list.appendChild(btn);
}

  function setView(idx){
    currentView = viewSettings[idx];

    if(currentView.callBack) {
        currentView.callBack()
        console.log("callBack")
        toggleForm(false);
        return
    }

    // apply it immediately:
    if(currentView.type === 'orthographic') isOrtho = true;
    else                                    isOrtho = false;

    camRotX = radians(currentView.rotX);
    camRotY = radians(currentView.rotY);

    // hide the form if it’s open
    toggleForm(false);
  }

  function toggleForm(show){
    const f = document.getElementById('viewForm');
    if(typeof show === 'boolean'){
      f.style.display = show ? 'flex' : 'none';
    } else {
      f.style.display = f.style.display==='flex' ? 'none' : 'flex';
    }
  }

  function saveNewView(){
    const name = document.getElementById('viewName').value.trim();
    const type = document.getElementById('viewType').value;
    const rotX = parseFloat(document.getElementById('viewRotX').value);
    const rotY = parseFloat(document.getElementById('viewRotY').value);
    if(!name) return alert('Enter a name for your view');

    const v = {name,type,rotX,rotY};
    viewSettings.push(v);
    localStorage.setItem('viewSettings', JSON.stringify(viewSettings));
    addViewButton(v, viewSettings.length-1);
    toggleForm(false);
  }
