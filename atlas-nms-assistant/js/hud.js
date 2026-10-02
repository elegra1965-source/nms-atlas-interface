/* ================= ATLAS — hud.js =================
   Orb state machine + status line controller.
=================================================== */
const HUD = (() => {
  const zone = () => document.getElementById('orb-zone');
  const statusText = () => document.getElementById('status-text');

  const STATUS = {
    idle:      'ATLAS ONLINE',
    listening: 'LISTENING, TRAVELLER',
    thinking:  'THE ATLAS CALCULATES',
    speaking:  'TRANSMITTING',
    error:     'SIGNAL LOST'
  };

  let current = 'idle';

  function setState(state) {
    if (!STATUS[state]) state = 'idle';
    current = state;
    zone().dataset.state = state;
    document.body.dataset.atlas = state; // v4.0: lets CSS react outside the orb (e.g. hide chips while speaking)
    statusText().textContent = STATUS[state];
    const sb = document.getElementById('silence-btn');
    if (sb) sb.classList.toggle('hidden', state !== 'speaking');
  }

  function getState() { return current; }

  return { setState, getState };
})();
