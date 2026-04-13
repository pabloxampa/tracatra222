import { createClient } from '@supabase/supabase-js';

const DEFAULT_BALANCE = 5000;
const REDEEM_PASSWORD = 'gnHFykla8fNmÑmwPo0lant3IckkCk67QmeMhtrovlanuekxk35';
const PAGE_IDS = {
  index: 'index',
  cartera: 'cartera',
  blackjack: 'blackjack',
  ruleta: 'ruleta',
  slots: 'slots'
};

const ROULETTE_WHEEL_ORDER = [
  '0', '32', '15', '19', '4', '21', '2', '25', '17', '34', '6', '27',
  '13', '36', '11', '30', '8', '23', '10', '5', '24', '16', '33', '1',
  '20', '14', '31', '9', '22', '18', '29', '7', '28', '12', '35', '3', '26'
];

const ROULETTE_RED_NUMBERS = new Set([
  '32', '19', '21', '25', '34', '27', '36', '30', '23',
  '5', '16', '1', '14', '9', '18', '7', '12', '3'
]);

const SLOTS_SYMBOL_CONFIG = [
  { symbol: '🍒', weight: 24, payouts: { 3: 2, 4: 4, 5: 8 } },
  { symbol: '🍋', weight: 20, payouts: { 3: 2, 4: 4, 5: 8 } },
  { symbol: '🍊', weight: 14, payouts: { 3: 3, 4: 5, 5: 10 } },
  { symbol: '🍉', weight: 14, payouts: { 3: 4, 4: 6, 5: 12 } },
  { symbol: '⭐', weight: 12, payouts: { 3: 5, 4: 7, 5: 15 } },
  { symbol: '🔔', weight: 9, payouts: { 3: 8, 4: 9, 5: 20 } },
  { symbol: '7️⃣', weight: 7, payouts: { 3: 12, 4: 15, 5: 40 } }
];

const SLOTS_WEIGHTED_SYMBOLS = SLOTS_SYMBOL_CONFIG.flatMap(item =>
  Array.from({ length: item.weight }, () => item.symbol)
);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const FORMATTER = new Intl.NumberFormat('es-ES');

let currentUser = null;

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function toSafeInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

function clampMin(value, min = 0) {
  return Math.max(min, value);
}

function formatCredits(value) {
  return FORMATTER.format(toSafeInt(value, 0));
}

function usernameToEmail(username) {
  const localPart = String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

  if (!localPart) {
    throw new Error('Introduce un usuario válido.');
  }

  return `${localPart}@tracatra.com`;
}

function getBalance() {
  return currentUser ? currentUser.balance : 0;
}

function getCurrentPage() {
  return document.body?.dataset?.page || PAGE_IDS.index;
}

function showGlobalError(message) {
  console.error(message);
  const target = $('#auth-message') || $('#wallet-message') || $('#blackjack-status') || $('#roulette-result') || $('#slots-result');
  if (target) {
    target.textContent = message;
  }
}

function updateWalletUI() {
  const balanceText = currentUser ? formatCredits(currentUser.balance) : '---';

  $all('[data-wallet]').forEach(el => {
    el.textContent = balanceText;
  });

  const topUser = $('#top-user');
  if (topUser) {
    topUser.textContent = currentUser ? currentUser.username : '';
  }
}

function ensureTopBalanceWidget() {
  if (!currentUser || $('.wallet-hud')) return;

  const widget = document.createElement('div');
  widget.className = 'wallet-hud';
  widget.innerHTML = `
    <span class="wallet-copy">Saldo</span>
    <strong data-wallet id="top-balance"></strong>
    <span class="wallet-user" id="top-user"></span>
  `;
  document.body.appendChild(widget);
  updateWalletUI();
}

function removeTopBalanceWidget() {
  $('.wallet-hud')?.remove();
}

function setText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}

function showAuthMessage(text, type = '') {
  const element = $('#auth-message');
  if (!element) return;
  element.textContent = text;
  element.className = `status-text${type ? ' ' + type : ''}`;
}

function toggleAuthForm(showLogin) {
  const loginForm = $('#login-form');
  const registerForm = $('#register-form');
  const loginTab = $('#show-login');
  const registerTab = $('#show-register');

  if (!(loginForm && registerForm && loginTab && registerTab)) return;

  loginForm.classList.toggle('hidden', !showLogin);
  registerForm.classList.toggle('hidden', showLogin);
  loginTab.classList.toggle('active', showLogin);
  registerTab.classList.toggle('active', !showLogin);
  showAuthMessage('');
}

function renderAuthSection() {
  const welcomePanel = $('#welcome-panel');
  const loginForm = $('#login-form');
  const registerForm = $('#register-form');

  if (!(welcomePanel && loginForm && registerForm)) return;

  if (currentUser) {
    welcomePanel.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');

    const welcomeName = $('#welcome-name');
    if (welcomeName) welcomeName.textContent = currentUser.username;

    updateWalletUI();
    ensureTopBalanceWidget();
    return;
  }

  removeTopBalanceWidget();
  welcomePanel.classList.add('hidden');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  $('#show-login')?.classList.add('active');
  $('#show-register')?.classList.remove('active');
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, balance')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el perfil.');
  }

  return {
    id: String(data.id),
    username: String(data.username || ''),
    balance: clampMin(toSafeInt(data.balance, DEFAULT_BALANCE), 0)
  };
}

async function fetchMe() {
  const { data: authData, error } = await supabase.auth.getUser();

  if (error || !authData?.user) {
    currentUser = null;
    return null;
  }

  currentUser = await fetchProfile(authData.user.id);
  return currentUser;
}

async function upsertCurrentProfile(userId, username, balance = DEFAULT_BALANCE) {
  const payload = {
    id: userId,
    username,
    balance: clampMin(toSafeInt(balance, DEFAULT_BALANCE), 0)
  };

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message || 'No se pudo guardar el perfil.');
  }
}

async function updateRemoteBalance(newBalance) {
  if (!currentUser) throw new Error('No has iniciado sesión.');

  const safeBalance = clampMin(toSafeInt(newBalance, 0), 0);
  const { error } = await supabase
    .from('profiles')
    .update({ balance: safeBalance })
    .eq('id', currentUser.id);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el saldo.');
  }

  currentUser.balance = safeBalance;
  updateWalletUI();
  return safeBalance;
}

async function changeRemoteBalance(delta) {
  return updateRemoteBalance(getBalance() + toSafeInt(delta, 0));
}

function getStorageKey(name) {
  return currentUser ? `${name}:${currentUser.id}` : `${name}:guest`;
}

function saveLocalState(name, value) {
  localStorage.setItem(getStorageKey(name), JSON.stringify(value));
}

function readLocalState(name, fallback = null) {
  try {
    const raw = localStorage.getItem(getStorageKey(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function clearLocalState(name) {
  localStorage.removeItem(getStorageKey(name));
}

async function loginUser(username, password) {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error('Usuario o contraseña incorrectos.');
  }

  return fetchMe();
}

async function registerUser(username, password) {
  const email = usernameToEmail(username);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) {
    if (/already registered/i.test(error.message)) {
      throw new Error('Ese usuario ya existe.');
    }
    throw new Error(error.message || 'No se pudo crear la cuenta.');
  }

  let user = data?.user || null;
  let session = data?.session || null;

  if (!session) {
    const loginResult = await supabase.auth.signInWithPassword({ email, password });
    if (loginResult.error) {
      throw new Error('Cuenta creada, pero activa "Confirm email" en Supabase o confírmalo por correo antes de entrar.');
    }
    user = loginResult.data.user;
  }

  if (!user) {
    throw new Error('No se pudo iniciar la sesión tras el registro.');
  }

  await upsertCurrentProfile(user.id, username, DEFAULT_BALANCE);
  return fetchMe();
}

async function logoutUser() {
  await supabase.auth.signOut();
  currentUser = null;
  removeTopBalanceWidget();
  window.location.href = 'index.html';
}

function renderCards(container, hand) {
  if (!container) return;
  container.innerHTML = hand.map(card => {
    const hidden = card.rank === '?' && card.suit === '';
    const hiddenAttr = hidden ? ' data-hidden="true"' : '';
    return `<span class="chip"${hiddenAttr}>${card.rank}${card.suit}</span>`;
  }).join('');
}

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return suits.flatMap(suit => ranks.map(rank => ({ rank, suit })));
}

function shuffleDeck(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return Number(card.rank);
}

function handTotal(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter(card => card.rank === 'A').length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function dealerPublicHand(hand, revealAll) {
  if (revealAll) return hand;
  if (!hand.length) return [];
  return [hand[0], { rank: '?', suit: '' }];
}

function initAuthPage() {
  const loginForm = $('#login-form');
  const registerForm = $('#register-form');
  const loginTab = $('#show-login');
  const registerTab = $('#show-register');
  const logoutButton = $('#logout-button');

  loginTab?.addEventListener('click', () => toggleAuthForm(true));
  registerTab?.addEventListener('click', () => toggleAuthForm(false));

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    console.log('submit login interceptado');

    const username = ($('#login-username')?.value || '').trim().toLowerCase();
    const password = $('#login-password')?.value || '';

    if (!username || !password) {
      showAuthMessage('Completa usuario y contraseña.', 'error');
      return;
    }

    try {
      await loginUser(username, password);
      showAuthMessage(`Bienvenido de nuevo, ${username}.`, 'success');
      renderAuthSection();
    } catch (error) {
      showAuthMessage(error.message, 'error');
    }
  });

  registerForm?.addEventListener('submit', async event => {
    event.preventDefault();
    console.log('submit registro interceptado');
    const username = ($('#register-username')?.value || '').trim().toLowerCase();
    const password = $('#register-password')?.value || '';

    if (!username || !password) {
      showAuthMessage('Completa usuario y contraseña.', 'error');
      return;
    }

    if (password.length < 6) {
      showAuthMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    try {
      await registerUser(username, password);
      showAuthMessage(`Cuenta creada. Tu saldo inicial es ${DEFAULT_BALANCE} créditos.`, 'success');
      renderAuthSection();
    } catch (error) {
      showAuthMessage(error.message, 'error');
    }
  });

  logoutButton?.addEventListener('click', async () => {
    try {
      await logoutUser();
    } catch (error) {
      showAuthMessage(error.message, 'error');
    }
  });

  renderAuthSection();
}

function initWalletPage() {
  updateWalletUI();
  ensureTopBalanceWidget();
  const passwordInput = $('#wallet-password');

  $all('[data-pack]').forEach(button => {
    button.addEventListener('click', async () => {
      const password = passwordInput?.value || '';
      const amount = clampMin(toSafeInt(button.dataset.pack, 0), 0);

      if (password !== REDEEM_PASSWORD) {
        setText('#wallet-message', 'Contraseña de canje incorrecta.');
        return;
      }

      if (amount <= 0) {
        setText('#wallet-message', 'Cantidad inválida.');
        return;
      }

      try {
        await changeRemoteBalance(amount);
        setText('#wallet-message', `Has canjeado ${amount} créditos.`);
        if (passwordInput) passwordInput.value = '';
      } catch (error) {
        setText('#wallet-message', error.message);
      }
    });
  });
}

function getBlackjackState() {
  return readLocalState('blackjack_game', null);
}

function saveBlackjackState(state) {
  saveLocalState('blackjack_game', state);
}

function clearBlackjackState() {
  clearLocalState('blackjack_game');
}

function initBlackjack() {
  updateWalletUI();
  ensureTopBalanceWidget();

  const status = $('#blackjack-status');
  const dealerContainer = $('#dealer-cards');
  const playerContainer = $('#player-cards');
  const dealerTotal = $('#dealer-total');
  const playerTotal = $('#player-total');
  const betInput = $('#blackjack-bet');
  const placeBetButton = $('#blackjack-place-bet');
  const hitButton = $('#blackjack-hit');
  const standButton = $('#blackjack-stand');

  function setButtons({ canStart, canPlay }) {
    if (placeBetButton) placeBetButton.disabled = !canStart;
    if (hitButton) hitButton.disabled = !canPlay;
    if (standButton) standButton.disabled = !canPlay;
    if (betInput) betInput.disabled = canPlay;
  }

  function renderState(game) {
    if (!game) {
      renderCards(playerContainer, []);
      renderCards(dealerContainer, []);
      if (playerTotal) playerTotal.textContent = '0';
      if (dealerTotal) dealerTotal.textContent = '0';
      setButtons({ canStart: true, canPlay: false });
      setText('#blackjack-status', 'Elige tu apuesta y pulsa Apostar.');
      return;
    }

    renderCards(playerContainer, game.playerHand || []);
    renderCards(dealerContainer, dealerPublicHand(game.dealerHand || [], !game.inPlay));
    if (playerTotal) playerTotal.textContent = String(handTotal(game.playerHand || []));
    if (dealerTotal) dealerTotal.textContent = game.inPlay ? '??' : String(handTotal(game.dealerHand || []));
    setText('#blackjack-status', game.message || 'Partida en curso.');
    setButtons({ canStart: !game.inPlay, canPlay: Boolean(game.inPlay) });
  }

  async function settleGame(game, message) {
    game.inPlay = false;
    game.message = message;
    saveBlackjackState(game);
    renderState(game);
  }

  async function startHand() {
    const bet = clampMin(toSafeInt(betInput?.value, 0), 0);
    if (bet < 50) {
      setText('#blackjack-status', 'La apuesta mínima es 50.');
      return;
    }
    if (bet > getBalance()) {
      setText('#blackjack-status', 'No tienes saldo suficiente.');
      return;
    }

    const deck = shuffleDeck(createDeck());
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    try {
      await changeRemoteBalance(-bet);

      const game = {
        deck,
        bet,
        playerHand,
        dealerHand,
        inPlay: true,
        message: 'Tu turno. Pide o plántate.'
      };

      const playerScore = handTotal(playerHand);
      const dealerScore = handTotal(dealerHand);

      if (playerScore === 21 && dealerScore === 21) {
        await changeRemoteBalance(bet);
        game.inPlay = false;
        game.message = 'Empate con blackjack. Recuperas tu apuesta.';
      } else if (playerScore === 21) {
        await changeRemoteBalance(Math.floor(bet * 2.5));
        game.inPlay = false;
        game.message = 'Blackjack. Cobras 3:2.';
      }

      saveBlackjackState(game);
      renderState(game);
    } catch (error) {
      setText('#blackjack-status', error.message);
    }
  }

  async function hit() {
    const game = getBlackjackState();
    if (!game?.inPlay) return;

    game.playerHand.push(game.deck.pop());
    const total = handTotal(game.playerHand);

    if (total > 21) {
      await settleGame(game, 'Te has pasado. Pierdes.');
      return;
    }

    saveBlackjackState(game);
    renderState(game);
  }

  async function stand() {
    const game = getBlackjackState();
    if (!game?.inPlay) return;

    while (handTotal(game.dealerHand) < 17) {
      game.dealerHand.push(game.deck.pop());
    }

    const playerScore = handTotal(game.playerHand);
    const dealerScore = handTotal(game.dealerHand);

    try {
      if (dealerScore > 21 || playerScore > dealerScore) {
        await changeRemoteBalance(game.bet * 2);
        await settleGame(game, 'Ganas la mano.');
      } else if (playerScore === dealerScore) {
        await changeRemoteBalance(game.bet);
        await settleGame(game, 'Empate. Recuperas tu apuesta.');
      } else {
        await settleGame(game, 'La banca gana.');
      }
    } catch (error) {
      setText('#blackjack-status', error.message);
    }
  }

  placeBetButton?.addEventListener('click', startHand);
  hitButton?.addEventListener('click', hit);
  standButton?.addEventListener('click', stand);

  renderState(getBlackjackState());
}

function ensureFireworksLayer() {
  let layer = document.querySelector('#fireworks-layer');
  if (layer) return layer;

  layer = document.createElement('div');
  layer.id = 'fireworks-layer';
  layer.className = 'fireworks-layer';
  document.body.appendChild(layer);
  return layer;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function launchFireworks(count = 4) {
  const layer = ensureFireworksLayer();
  const colors = ['#ff4040', '#ffd447', '#4de1ff', '#7dff7d', '#ffffff', '#ff7af6'];

  for (let burstIndex = 0; burstIndex < count; burstIndex += 1) {
    const burst = document.createElement('div');
    burst.className = 'firework-burst';

    const x = randomBetween(window.innerWidth * 0.15, window.innerWidth * 0.85);
    const y = randomBetween(window.innerHeight * 0.15, window.innerHeight * 0.55);

    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;

    const particles = 18;
    for (let i = 0; i < particles; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'firework-particle';

      const angle = (Math.PI * 2 * i) / particles;
      const distance = randomBetween(45, 95);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      particle.style.setProperty('--dx', `${dx}px`);
      particle.style.setProperty('--dy', `${dy}px`);
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDelay = `${burstIndex * 120}ms`;

      burst.appendChild(particle);
    }

    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 1400);
  }
}

function rouletteColor(numberStr) {
  if (numberStr === '0') return 'green';
  return ROULETTE_RED_NUMBERS.has(numberStr) ? 'red' : 'black';
}

function rouletteSameColumn(number, column) {
  if (column === '1st') return number % 3 === 1;
  if (column === '2nd') return number % 3 === 2;
  if (column === '3rd') return number % 3 === 0;
  return false;
}

function evaluateRouletteBets(resultNumberStr, bets) {
  const resultNumber = toSafeInt(resultNumberStr, 0);
  let totalPayout = 0;

  bets.forEach(({ type, target, amount }) => {
    let payout = 0;
    if (type === 'number' && target === resultNumberStr) payout = amount * 36;
    else if (type === 'dozen') {
      if (target === '1-12' && resultNumber >= 1 && resultNumber <= 12) payout = amount * 3;
      if (target === '13-24' && resultNumber >= 13 && resultNumber <= 24) payout = amount * 3;
      if (target === '25-36' && resultNumber >= 25 && resultNumber <= 36) payout = amount * 3;
    } else if (type === 'column' && resultNumber !== 0 && rouletteSameColumn(resultNumber, target)) {
      payout = amount * 3;
    } else if (type === 'color' && rouletteColor(resultNumberStr) === target) {
      payout = amount * 2;
    } else if (type === 'parity' && resultNumber !== 0) {
      if (target === 'odd' && resultNumber % 2 === 1) payout = amount * 2;
      if (target === 'even' && resultNumber % 2 === 0) payout = amount * 2;
    } else if (type === 'range') {
      if (target === '1-18' && resultNumber >= 1 && resultNumber <= 18) payout = amount * 2;
      if (target === '19-36' && resultNumber >= 19 && resultNumber <= 36) payout = amount * 2;
    }
    totalPayout += payout;
  });

  return totalPayout;
}

function initRoulette() {
  updateWalletUI();
  ensureTopBalanceWidget();

  const resultDisplay = $('#roulette-result');
  const wheelText = $('#roulette-wheel-display');
  const wheelDisc = $('.roulette-wheel');
  const spinButton = $('#roulette-spin');
  const selectedChipDisplay = $('#selected-chip');
  const selectedNumberDisplay = $('#selected-number');
  const selectedTotalDisplay = $('#selected-total');
  const boardGrid = $('#roulette-board-grid');
  const chipButtons = $all('.bet-chip');
  const betAreaButtons = $all('.bet-area');
  const zeroCell = $('.roulette-board-cell[data-number="0"]');

  let selectedChip = 50;
  const bets = new Map();

  function buildWheelLabels() {
    if (!wheelDisc || wheelDisc.querySelector('.wheel-labels')) return;
    const labels = document.createElement('div');
    labels.className = 'wheel-labels';

    ROULETTE_WHEEL_ORDER.forEach((number, index) => {
      const label = document.createElement('span');
      label.className = `wheel-label ${rouletteColor(number)}`;
      label.textContent = number;
      const angle = index * (360 / ROULETTE_WHEEL_ORDER.length);
      label.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-138px) rotate(${-angle}deg)`;
      labels.appendChild(label);
    });

    wheelDisc.appendChild(labels);
  }

  function buildNumberBoard() {
    if (!boardGrid) return;
    boardGrid.innerHTML = '';

    for (let number = 1; number <= 36; number += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `roulette-board-cell ${rouletteColor(String(number))}`;
      button.dataset.type = 'number';
      button.dataset.target = String(number);
      button.innerHTML = `
        <span class="board-number">${number}</span>
        <span class="board-bet"></span>
      `;
      button.addEventListener('click', () => addBet('number', String(number), selectedChip));
      boardGrid.appendChild(button);
    }
  }

  function allBetButtons() {
    return [
      ...$all('.roulette-board-cell'),
      ...$all('.bet-area')
    ];
  }

  function addBet(type, target, amount) {
    const key = `${type}:${target}`;
    const current = bets.get(key) || { type, target, amount: 0 };
    current.amount += amount;
    bets.set(key, current);
    refreshBetUI();
  }

  function clearWinningHighlights() {
    allBetButtons().forEach(button => button.classList.remove('winning'));
  }

  function refreshBetUI() {
    selectedChipDisplay.textContent = String(selectedChip);
    selectedNumberDisplay.textContent = String(bets.size);

    let total = 0;
    allBetButtons().forEach(button => {
      const type = button.dataset.type;
      const target = button.dataset.target || button.dataset.number;
      const key = `${type}:${target}`;
      const bet = bets.get(key);
      const amount = bet?.amount || 0;
      const amountNode = button.querySelector('.board-bet, .bet-area-amount');
      if (amountNode) amountNode.textContent = amount > 0 ? amount : '';
      total += amount;
    });

    if (selectedTotalDisplay) selectedTotalDisplay.textContent = String(total);
  }

  async function spin() {
    const placedBets = Array.from(bets.values());
    const totalBet = placedBets.reduce((sum, item) => sum + item.amount, 0);

    if (!placedBets.length) {
      setText('#roulette-result', 'Haz al menos una apuesta.');
      return;
    }
    if (totalBet > getBalance()) {
      setText('#roulette-result', 'No tienes saldo suficiente.');
      return;
    }

    clearWinningHighlights();
    spinButton.disabled = true;

    try {
      await changeRemoteBalance(-totalBet);

      const resultNumber = ROULETTE_WHEEL_ORDER[Math.floor(Math.random() * ROULETTE_WHEEL_ORDER.length)];
      const spinTurns = 1800 + Math.floor(Math.random() * 1800);
      if (wheelDisc) wheelDisc.style.transform = `rotate(${spinTurns}deg)`;

      await new Promise(resolve => setTimeout(resolve, 1500));

      const payout = evaluateRouletteBets(resultNumber, placedBets);
      if (payout > 0) {
        await changeRemoteBalance(payout);
        launchFireworks(4);
      }

      wheelText.textContent = resultNumber;
      const profit = payout - totalBet;
      setText(
        '#roulette-result',
        profit >= 0
          ? `Ha salido ${resultNumber}. Cobras ${payout} créditos.`
          : `Ha salido ${resultNumber}. Pierdes ${totalBet} créditos.`
      );

      allBetButtons().forEach(button => {
        const type = button.dataset.type;
        const target = button.dataset.target || button.dataset.number;
        if (type === 'number' && target === resultNumber) button.classList.add('winning');
        if (type === 'color' && target === rouletteColor(resultNumber)) button.classList.add('winning');
      });

      bets.clear();
      refreshBetUI();
    } catch (error) {
      setText('#roulette-result', error.message);
    } finally {
      spinButton.disabled = false;
    }
  }

  chipButtons.forEach(button => {
    button.addEventListener('click', () => {
      chipButtons.forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      selectedChip = clampMin(toSafeInt(button.dataset.value, 50), 50);
      refreshBetUI();
    });
  });

  zeroCell?.addEventListener('click', () => addBet('number', '0', selectedChip));
  betAreaButtons.forEach(button => {
    button.addEventListener('click', () => addBet(button.dataset.type, button.dataset.target, selectedChip));
  });
  spinButton?.addEventListener('click', spin);

  buildWheelLabels();
  buildNumberBoard();
  refreshBetUI();
}

function randomSlotSymbol() {
  return SLOTS_WEIGHTED_SYMBOLS[Math.floor(Math.random() * SLOTS_WEIGHTED_SYMBOLS.length)];
}

function randomSlotReel() {
  return [randomSlotSymbol(), randomSlotSymbol(), randomSlotSymbol()];
}

function calculateSlotsPayout(middleSymbols, bet) {
  const first = middleSymbols[0];
  let streak = 1;

  for (const symbol of middleSymbols.slice(1)) {
    if (symbol === first) streak += 1;
    else break;
  }

  if (streak < 3) return 0;
  const config = SLOTS_SYMBOL_CONFIG.find(item => item.symbol === first);
  if (!config) return 0;
  return bet * (config.payouts[streak] || 0);
}

function initSlots() {
  updateWalletUI();
  ensureTopBalanceWidget();

  const reelsContainer = $('#slots-reels');
  const betInput = $('#slots-bet');
  const resultNode = $('#slots-result');
  const spinButton = $('#slots-spin');

  function renderReels(reels) {
    if (!reelsContainer) return;
    reelsContainer.innerHTML = reels.map((reel, index) => `
      <div class="slot-reel" data-reel="${index}">
        ${reel.map(symbol => `<span class="slot-symbol">${symbol}</span>`).join('')}
      </div>
    `).join('');
  }

  async function spin() {
    const bet = clampMin(toSafeInt(betInput?.value, 0), 0);
    if (bet <= 0) {
      resultNode.textContent = 'Introduce una apuesta válida.';
      return;
    }
    if (bet > getBalance()) {
      resultNode.textContent = 'No tienes saldo suficiente.';
      return;
    }

    spinButton.disabled = true;

    try {
      await changeRemoteBalance(-bet);

      const reels = Array.from({ length: 5 }, () => randomSlotReel());
      renderReels(reels);
      const middleSymbols = reels.map(reel => reel[1]);
      const payout = calculateSlotsPayout(middleSymbols, bet);

      if (payout > 0) {
        await changeRemoteBalance(payout);
        resultNode.textContent = `Centro: ${middleSymbols.join(' ')}. Cobras ${payout} créditos.`;
      } else {
        resultNode.textContent = `Centro: ${middleSymbols.join(' ')}. No hay premio.`;
      }
    } catch (error) {
      resultNode.textContent = error.message;
    } finally {
      spinButton.disabled = false;
    }
  }

  renderReels(Array.from({ length: 5 }, () => ['❔', '❔', '❔']));
  spinButton?.addEventListener('click', spin);
}

function redirectIfLoggedOut() {
  if (currentUser) return;
  window.location.href = 'index.html';
}

async function initPage() {
  console.log('initPage arrancando');

  try {
    await fetchMe();
    console.log('fetchMe ok', currentUser);
  } catch (error) {
    currentUser = null;
    console.error('fetchMe error', error);
  }

  updateWalletUI();

  const page = getCurrentPage();
  console.log('page actual', page);

  if (page === PAGE_IDS.index) {
    console.log('iniciando auth page');
    initAuthPage();
  } else {
    if (!currentUser) {
      redirectIfLoggedOut();
      return;
    }
    ensureTopBalanceWidget();
  }

  if (page === PAGE_IDS.cartera) initWalletPage();
  if (page === PAGE_IDS.blackjack) initBlackjack();
  if (page === PAGE_IDS.ruleta) initRoulette();
  if (page === PAGE_IDS.slots) initSlots();
}

document.addEventListener('DOMContentLoaded', initPage);

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (!session) {
    currentUser = null;
    removeTopBalanceWidget();
    updateWalletUI();
    return;
  }

  try {
    currentUser = await fetchProfile(session.user.id);
    updateWalletUI();
    if (getCurrentPage() !== PAGE_IDS.index) ensureTopBalanceWidget();
  } catch (error) {
    console.error(error);
  }
});
