// =================================================================
// JOGO: ECO-LOCALIZADOR (Edição Gemini)
// =================================================================

import { translations } from './languages.js';
import { levelData } from "./scripts/mapData.js";

// --- SISTEMA DE CONFIGURAÇÕES E IDIOMA ---
const defaultSettings = {
    language: 'pt',
    masterVolume: 100,
    musicVolume: 60,
    effectsVolume: 75
};
let gameSettings = { ...defaultSettings };
let currentLanguage = gameSettings.language;

function saveSettings() {
    localStorage.setItem('eco_game_settings', JSON.stringify(gameSettings));
}

function loadSettings() {
    try {
        const savedSettings = JSON.parse(localStorage.getItem('eco_game_settings'));
        if (savedSettings) {
            gameSettings = { ...defaultSettings, ...savedSettings };
        }
    } catch (error) {
        console.error("Could not load settings, using defaults.", error);
        gameSettings = { ...defaultSettings };
    }
    currentLanguage = gameSettings.language;
}

function applyTranslations() {
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        if (translations[currentLanguage] && translations[currentLanguage][key]) {
            const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
            if (textNode) {
                textNode.textContent = translations[currentLanguage][key];
            } else {
                element.textContent = translations[currentLanguage][key];
            }
        }
    });

    if (shopMenu.classList.contains('visible')) renderShop();
    if (saveSlotMenu.classList.contains('visible')) renderSaveSlots();
    if (pauseMenu.classList.contains('visible')) {
        pauseLevelName.textContent = levels[currentLevelIndex]?.name || "";
        pauseTimePlayed.textContent = formatTime(gameStartTime ? Date.now() - gameStartTime : 0);
        pauseTotalCoins.textContent = totalCoins;
    }
    
    updateCurrentSaveIndicator();
    updateHUD();
    
    const newSaveInput = document.getElementById('new-save-name-input');
    if(newSaveInput) newSaveInput.placeholder = translations[currentLanguage].saveNamePlaceholder;
    
    const playerNameInput = document.getElementById('player-name-input');
    if(playerNameInput) playerNameInput.placeholder = translations[currentLanguage].playerNamePlaceholder;
}

function setLanguage(lang) {
    if (!translations[lang]) lang = 'pt';
    gameSettings.language = lang;
    currentLanguage = lang;
    saveSettings();
    
    const selectedDiv = document.getElementById('custom-select-trigger');
    const options = document.querySelectorAll('#custom-select-items div');
    options.forEach(option => {
        if (option.getAttribute('data-value') === lang) {
            selectedDiv.innerHTML = option.innerHTML;
        }
    });

    applyTranslations();
}

// --- SETUP INICIAL ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const cooldownsHud = document.getElementById('cooldowns-hud');
const qCooldownFill = document.getElementById('q-cooldown-fill');
const eCooldownFill = document.getElementById('e-cooldown-fill');
const messageOverlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const loadingIndicator = document.getElementById('loading-indicator');
const mainMenu = document.getElementById('main-menu');
const startGameButton = document.getElementById('start-game-button');
const optionsMenu = document.getElementById('options-menu');
const creditsMenu = document.getElementById('credits-menu');
const optionsButton = document.getElementById('options-button');
const creditsButton = document.getElementById('credits-button');
const backButtons = document.querySelectorAll('.back-button');
const lojaButton = document.getElementById('shop-button');
const shopMenu = document.getElementById('shop-menu');
const pauseMenu = document.getElementById('pause-menu');
const resumeButton = document.getElementById('resume-button');
const pauseOptionsButton = document.getElementById('pause-options-button');
const backToMainMenuButton = document.getElementById('back-to-main-menu-button');
const pauseLevelName = document.getElementById('pause-level-name');
const pauseTimePlayed = document.getElementById('pause-time-played');
const pauseTotalCoins = document.getElementById('pause-total-coins');
const saveSlotMenu = document.getElementById('save-slot-menu');
const saveSlotsContainer = document.getElementById('save-slots-container');
const saveSlotBackButton = document.getElementById('save-slot-back-button');
const currentSaveIndicator = document.getElementById('current-save-indicator');
const changeSaveButton = document.getElementById('change-save-button');
const nameSaveOverlay = document.getElementById('name-save-overlay');
const newSaveNameInput = document.getElementById('new-save-name-input');
const confirmSaveNameButton = document.getElementById('confirm-save-name-button');


// --- SISTEMA DE SAVE SLOTS REFAVORADO ---
let currentSlotId = null;
let pendingSlotId = null;
const TOTAL_SLOTS = 5;
let gameContextLoaded = false;

// Função para verificar se o premium está desbloqueado
function isPremiumUnlocked() {
    return localStorage.getItem('eco_premium_unlocked') === 'true';
}

const getSaveSlotKey = (slotId) => `eco_save_${slotId}`;

function createNewSave(slotId, saveName) {
    currentSlotId = slotId;
    const defaultUpgrades = { speed: 0, jump: 0, shortPing: 0, longPing: 0, health: 0, stealth: 0, vision: 0, luck: 0 };
    const newSaveObject = {
        saveName: saveName,
        lastSaved: new Date().toISOString(),
        currentLevelIndex: 0,
        levelName: levels[0].name,
        totalCoins: 0,
        upgrades: defaultUpgrades,
        collectedCoins: [],
        gameStartTime: null
    };

    localStorage.setItem(getSaveSlotKey(slotId), JSON.stringify(newSaveObject));
    loadGameState(slotId);

    // Envia webhook para criação de save
    const embed = createWebhookEmbed(
        '🎮 Novo Save Criado',
        `Um jogador criou um novo save no jogo!`,
        0x00ff00,
        [
            { name: 'Nome do Save', value: saveName, inline: true },
            { name: 'Slot ID', value: slotId.toString(), inline: true },
            { name: 'Data de Criação', value: new Date().toLocaleString('pt-BR'), inline: false }
        ]
    );
    sendDiscordWebhook(embed);

    gameContextLoaded = true;
    saveSlotMenu.classList.remove('visible');
    nameSaveOverlay.classList.remove('visible');
    mainMenu.classList.add('visible');
    updateCurrentSaveIndicator();
    updateGlitchBgVisibility();
}

function loadGameState(slotId) {
    const savedDataRaw = localStorage.getItem(getSaveSlotKey(slotId));
    if (savedDataRaw) {
        const saveData = JSON.parse(savedDataRaw);
        const defaultUpgrades = { speed: 0, jump: 0, shortPing: 0, longPing: 0, health: 0, stealth: 0, vision: 0, luck: 0 };
        upgradesState = saveData.upgrades || defaultUpgrades;
        totalCoins = saveData.totalCoins || 0;
        collectedCoins = saveData.collectedCoins || [];
        currentLevelIndex = saveData.currentLevelIndex || 0;
        gameStartTime = saveData.gameStartTime || null;
    } else {
        upgradesState = { speed: 0, jump: 0, shortPing: 0, longPing: 0, health: 0, stealth: 0, vision: 0, luck: 0 };
        totalCoins = 0;
        collectedCoins = [];
        currentLevelIndex = 0;
        gameStartTime = null;
    }
}

function saveGameState() {
    if (currentSlotId === null) return;

    const existingDataRaw = localStorage.getItem(getSaveSlotKey(currentSlotId));
    const existingData = existingDataRaw ? JSON.parse(existingDataRaw) : {};

    const saveDataObject = {
        saveName: existingData.saveName || `Jogo Salvo ${currentSlotId}`,
        lastSaved: new Date().toISOString(),
        currentLevelIndex: currentLevelIndex,
        levelName: levels[currentLevelIndex]?.name || "Novo Jogo",
        totalCoins: totalCoins,
        upgrades: upgradesState,
        collectedCoins: collectedCoins,
        gameStartTime: gameStartTime
    };
    
    localStorage.setItem(getSaveSlotKey(currentSlotId), JSON.stringify(saveDataObject));
}

function deleteSaveSlot(slotId) {
    if (!confirm(translations[currentLanguage].deleteSaveConfirm)) {
        return;
    }
    localStorage.removeItem(getSaveSlotKey(slotId));
    renderSaveSlots();
}

function updateCurrentSaveIndicator() {
    if (currentSlotId !== null) {
        const savedDataRaw = localStorage.getItem(getSaveSlotKey(currentSlotId));
        if(!savedDataRaw) return;
        const saveData = JSON.parse(savedDataRaw);
        
        const saveName = saveData.saveName || `Jogo Salvo ${currentSlotId}`;
        const isPremium = currentSlotId > 3;
        currentSaveIndicator.innerHTML = `${translations[currentLanguage].activeSave} ${isPremium ? '★' : ''} ${saveName} ${isPremium ? '★' : ''}`;
        currentSaveIndicator.style.display = 'block';
    } else {
        currentSaveIndicator.style.display = 'none';
    }
}

function renderSaveSlots() {
    saveSlotsContainer.innerHTML = '';
    saveSlotBackButton.style.display = gameContextLoaded ? 'block' : 'none';
    
    setTimeout(() => {
        saveSlotsContainer.classList.add('loaded');
    }, 300);

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
        const isPremiumSlot = i > 3;
        const saveDataRaw = localStorage.getItem(getSaveSlotKey(i));
        const saveData = saveDataRaw ? JSON.parse(saveDataRaw) : null;

        const slotDiv = document.createElement('div');
        slotDiv.className = `save-slot ${isPremiumSlot ? 'premium' : ''}`;
        slotDiv.style.setProperty('--slot-index', i - 1);

        let detailsHTML = `<div class="slot-details">${translations[currentLanguage].saveSlotEmpty}</div>`;
        const saveName = saveData ? saveData.saveName : `Slot ${i}`;

        if (saveData) {
            detailsHTML = `<div class="slot-details">
                        ${translations[currentLanguage].hudLevel}: ${saveData.levelName} | Moedas: ${saveData.totalCoins} 🪙
                    </div>`;
        }

        slotDiv.innerHTML = `
            <div class="save-slot-info">
                <div class="slot-name">${isPremiumSlot ? '★' : ''} ${saveName} ${isPremiumSlot ? '★' : ''}</div>
                ${detailsHTML}
            </div>
            <div class="slot-actions">
                <button class="slot-play-button">${saveData ? translations[currentLanguage].saveSlotLoad : translations[currentLanguage].saveSlotNewGame}</button>
                <button class="slot-delete-button" ${!saveData ? 'disabled' : ''}>${translations[currentLanguage].saveSlotDelete}</button>
            </div>
        `;

        const playButton = slotDiv.querySelector('.slot-play-button');
        if (saveData) {
            playButton.addEventListener('click', () => {
                currentSlotId = i;
                loadGameState(i);
                gameContextLoaded = true;
                saveSlotMenu.classList.remove('visible');
                mainMenu.classList.add('visible');
                updateCurrentSaveIndicator();
                updateGlitchBgVisibility();
            });
        } else {
            playButton.addEventListener('click', () => {
                if (isPremiumSlot && !isPremiumUnlocked()) {
                    alert(translations[currentLanguage].premiumUnlockAlert);
                    return;
                }
                pendingSlotId = i;
                newSaveNameInput.value = `Jogo Salvo ${i}`;
                nameSaveOverlay.classList.add('visible');
                newSaveNameInput.focus();
            });
        }

        slotDiv.querySelector('.slot-delete-button').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSaveSlot(i);
        });

        saveSlotsContainer.appendChild(slotDiv);
    }
}

// --- SISTEMA DA LOJA ---
const upgrades = [
    { key: 'speed', nameKey: 'upgradeSpeedName', descKey: 'upgradeSpeedDesc', price: 5, max: 3, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>' },
    { key: 'jump', nameKey: 'upgradeJumpName', descKey: 'upgradeJumpDesc', price: 7, max: 2, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' },
    { key: 'shortPing', nameKey: 'upgradeShortPingName', descKey: 'upgradeShortPingDesc', price: 8, max: 2, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>' },
    { key: 'longPing', nameKey: 'upgradeLongPingName', descKey: 'upgradeLongPingDesc', price: 10, max: 2, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.01 3.99c0-.05.04-.1.1-.1h15.8c.05 0 .1.04.1.1v15.8c0 .05-.04.1-.1.1H4.1c-.05 0-.1-.04-.1-.1z"></path><path d="M8.5 8.5c0-.06.04-.1.1-.1h6.8c.05 0 .1.04.1.1v6.8c0 .06-.04.1-.1.1H8.6c-.06 0-.1-.04-.1-.1z"></path><path d="M12 12c0-.06.04-.1.1-.1h-.2c.06 0 .1.04.1.1v-.2c0 .06-.04.1-.1.1h.2c-.06 0-.1-.04-.1-.1z"></path></svg>' },
    { key: 'health', nameKey: 'upgradeHealthName', descKey: 'upgradeHealthDesc', price: 15, max: 2, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V12H7v-4h3V6c0-2.21 1.79-4 4-4h4v4h-2.81c-.7 0-1.19.59-1.19 1.19V8h4l-.5 4h-3.5v9.8c4.56-.93 8-4.96 8-9.8z"></path></svg>' },
    { key: 'stealth', nameKey: 'upgradeStealthName', descKey: 'upgradeStealthDesc', price: 12, max: 2, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' },
    { key: 'vision', nameKey: 'upgradeVisionName', descKey: 'upgradeVisionDesc', price: 20, max: 1, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' },
    { key: 'luck', nameKey: 'upgradeLuckName', descKey: 'upgradeLuckDesc', price: 25, max: 1, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>' },
];
let upgradesState = {};

function updateShopHUD() { const shopCoinCount = document.getElementById('shop-coin-count'); if (shopCoinCount) shopCoinCount.textContent = totalCoins; }
function renderShop() {
    const shopItems = document.getElementById('shop-items');
    shopItems.innerHTML = '';
    upgrades.forEach(upg => {
        const level = upgradesState[upg.key] || 0;
        const canBuy = totalCoins >= upg.price && level < upg.max;
        const isMax = level >= upg.max;
        const name = translations[currentLanguage][upg.nameKey] || upg.nameKey;
        const desc = translations[currentLanguage][upg.descKey] || upg.descKey;
        const buyText = translations[currentLanguage].shopBuyButton;
        const maxText = translations[currentLanguage].shopMaxButton;
        const itemDiv = document.createElement('div');
        itemDiv.className = `shop-item ${isMax ? 'maxed' : ''}`;
        itemDiv.innerHTML = `
            <div class="shop-item-content">
                <div class="shop-item-icon">${upg.icon}</div>
                <div class="shop-item-info">
                    <span class="shop-item-name">${name}</span>
                    <span class="shop-item-desc">${desc}</span>
                </div>
            </div>
            <div class="shop-item-actions">
                <span class="shop-item-price">${isMax ? '---' : upg.price} 🪙</span>
                <span class="shop-item-level">${level}/${upg.max}</span>
                <button class="shop-buy-button ${isMax ? 'maxed' : (canBuy ? 'available' : 'unavailable')}" ${!canBuy || isMax ? 'disabled' : ''}>
                    ${isMax ? maxText : buyText}
                </button>
            </div>`;
        const buyBtn = itemDiv.querySelector('.shop-buy-button');
        buyBtn.onclick = () => {
            if (totalCoins >= upg.price && (upgradesState[upg.key] || 0) < upg.max) {
                totalCoins -= upg.price;
                upgradesState[upg.key] = (upgradesState[upg.key] || 0) + 1;
                if (player) player.applyUpgrades();
                updateCoinHUD();
                updateShopHUD();
                renderShop();
                saveGameState();
            }
        };
        shopItems.appendChild(itemDiv);
    });
}

let gameRunning = false;
let isLevelEnding = false;
let isGameEnding = false;
let gameStartTime = null;
let cameFromPauseMenu = false;
let isChased = false;
let chaseVignetteOpacity = 0;

function resizeCanvas() { const container = document.querySelector('.game-container'); canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


const keys = { a: { pressed: false }, d: { pressed: false }, arrowLeft: { pressed: false }, arrowRight: { pressed: false }, w: { pressed: false }, arrowUp: { pressed: false }, space: { pressed: false } };
window.addEventListener('keydown', (e) => {
    if (nameSaveOverlay.classList.contains('visible')) return;
    if (!gameRunning && e.key !== 'Escape') return;
    switch (e.key.toLowerCase()) {
        case 'a': keys.a.pressed = true; break;
        case 'd': keys.d.pressed = true; break;
        case 'arrowleft': keys.arrowLeft.pressed = true; break;
        case 'arrowright': keys.arrowRight.pressed = true; break;
        case 'w': case 'arrowup': case ' ': if (!keys.space.pressed) { player.jump(); keys.space.pressed = true; } break;
        case 'q': player.createPing('short'); break;
        case 'e': player.createPing('long'); break;
        case 'escape': togglePause(); break;
    }
});
window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
        case 'a': keys.a.pressed = false; break;
        case 'd': keys.d.pressed = false; break;
        case 'arrowleft': keys.arrowLeft.pressed = false; break;
        case 'arrowright': keys.arrowRight.pressed = false; break;
        case 'w': case 'arrowup': case ' ': keys.space.pressed = false; break;
    }
});

const GRAVITY = 0.5;
const playerSprite = new window.Image();
playerSprite.src = 'assets/ecoskin.png';
let playerSpriteLoaded = false;
playerSprite.onload = () => { playerSpriteLoaded = true; };

const playerWinSprite = new window.Image();
playerWinSprite.src = 'assets/ecoskin.png';
let playerWinSpriteLoaded = false;
playerWinSprite.onload = () => { playerWinSpriteLoaded = true; };

const enemySprite = new window.Image();
enemySprite.src = 'assets/inimigo1.png';
let enemySpriteLoaded = false;
enemySprite.onload = () => { enemySpriteLoaded = true; };

const deathSprites = [];
const deathSpriteUrls = [
    'assets/morte/ecoskin-morte1.png',
    'assets/morte/ecoskin-morte2.png',
    'assets/morte/ecoskin-morte3.png',
    'assets/morte/ecoskin-morte4.png'
];
let deathSpritesLoaded = 0;
deathSpriteUrls.forEach((url, index) => {
    const sprite = new window.Image();
    sprite.src = url;
    sprite.onload = () => {
        deathSpritesLoaded++;
    };
    deathSprites[index] = sprite;
});

setTimeout(() => { 
    if (!playerSpriteLoaded) { console.log('Atenção: Não foi possível carregar o sprite do personagem.'); } 
    if (!enemySpriteLoaded) { console.log('Atenção: Não foi possível carregar o sprite do inimigo.'); } 
}, 2000);

class Player {
    constructor() {
        this.width = 40; this.height = 50; this.position = { x: 100, y: 100 }; this.velocity = { x: 0, y: 0 };
        this.baseSpeed = 2;
        this.baseJumpForce = 12; this.baseShortPingCooldown = 500; this.baseLongPingCooldown = 3000;
        this.onGround = false; this.lastShortPing = 0; this.lastLongPing = 0; this.stepSoundInterval = 250;
        this.lastStepTime = 0; this.lastY = this.position.y; this.revealTime = 0; this.finalAnimationState = null;
        this.spawnTime = 0; this.breathOffset = 0;
        this.facing = 'right';
        this.deathState = null;
        this.isShaking = false;
        this.shakeIntensity = 2;
        this.applyUpgrades();
    }
    applyUpgrades() {
        this.speed = this.baseSpeed + ((upgradesState.speed || 0) * 1);
        this.jumpForce = this.baseJumpForce + ((upgradesState.jump || 0) * 2);
        this.shortPingCooldown = this.baseShortPingCooldown - ((upgradesState.shortPing || 0) * 100);
        this.longPingCooldown = this.baseLongPingCooldown - ((upgradesState.longPing || 0) * 250);
    }
    reset(x, y) {
        this.position = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.onGround = false;
        this.revealTime = 0;
        this.spawnTime = Date.now();
        this.resetDeathState();
        this.applyUpgrades();
    }
    draw() {
        if (this.finalAnimationState) { this.drawWinAnimation(); return; }
        if (this.deathState) {
            this.drawDeathAnimation();
            if (this.deathState.finished) return;
            return;
        }

        this.breathOffset = Math.sin(Date.now() / 400) * 0.5;
        const alpha = (Date.now() < this.revealTime) ? 1 : 0.6;

        let shakeX = 0;
        let shakeY = 0;
        if (this.isShaking) {
            shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            shakeY = (Math.random() - 0.5) * this.shakeIntensity;
        }

        ctx.save();
        let flip = this.facing === 'left';
        let px = this.position.x + shakeX;
        let py = this.position.y + shakeY;

        let glowX = px + this.width / 2;
        const glowY = py + this.height / 2 + this.breathOffset;
        const glowRadius = Math.max(this.width, this.height) * 0.7;
        ctx.save();
        ctx.globalAlpha = 0.35 * alpha;
        ctx.shadowBlur = 32;
        ctx.shadowColor = '#ffd700';
        if (flip) {
            ctx.translate(px + this.width / 2, 0);
            ctx.scale(-1, 1);
            glowX = 0;
        }
        ctx.beginPath();
        ctx.arc(glowX, glowY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fill();
        ctx.restore();

        if (playerSpriteLoaded) {
            ctx.globalAlpha = alpha;
            if (flip) {
                ctx.save();
                ctx.translate(px + this.width / 2, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(
                    playerSprite,
                    0, 0, playerSprite.width, playerSprite.height,
                    -this.width / 2, py + this.breathOffset, this.width, this.height
                );
                ctx.restore();
            } else {
                ctx.drawImage(
                    playerSprite,
                    0, 0, playerSprite.width, playerSprite.height,
                    px, py + this.breathOffset, this.width, this.height
                );
            }
        } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            if (alpha === 1) { ctx.shadowColor = 'rgba(255, 255, 255, 0.7)'; ctx.shadowBlur = 15; }
            const x = px; const y = py + this.breathOffset; const w = this.width; const h = this.height;
            ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + h); ctx.lineTo(x + w * 0.3, y + h * 0.5); ctx.quadraticCurveTo(x + w * 0.4, y + h * 0.4, x + w * 0.5, y + h * 0.4); ctx.quadraticCurveTo(x + w * 0.6, y + h * 0.4, x + w * 0.7, y + h * 0.5); ctx.lineTo(x + w * 0.7, y + h); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.2, w * 0.4, 0, Math.PI * 2); ctx.fill(); if (alpha === 1) { ctx.shadowBlur = 0; }
        }
        ctx.restore();
        ctx.save();
        const auraX = px + this.width / 2;
        const auraY = py + this.height / 2 + this.breathOffset;
        const auraRadius = Math.max(this.width, this.height) * 0.55;
        const auraGradient = ctx.createRadialGradient(auraX, auraY, auraRadius * 0.2, auraX, auraY, auraRadius);
        auraGradient.addColorStop(0, 'rgba(255,215,0,0.12)');
        auraGradient.addColorStop(0.7, 'rgba(255,215,0,0.04)');
        auraGradient.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(auraX, auraY, auraRadius, 0, Math.PI * 2);
        ctx.fillStyle = auraGradient;
        ctx.fill();
        ctx.restore();
    }
    drawWinAnimation() {
        if (!this.finalAnimationState) return;
        const anim = this.finalAnimationState;
    
        anim.particles.forEach(p => {
            p.update();
            p.draw();
        });
        anim.particles = anim.particles.filter(p => p.life > 0);
    
        if (playerWinSpriteLoaded) {
            ctx.save();
            ctx.globalAlpha = anim.alpha;
            
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 25;
    
            ctx.drawImage(
                playerWinSprite,
                0, 0, playerWinSprite.width, playerWinSprite.height,
                this.position.x,
                anim.y,        
                this.width,    
                this.height    
            );
    
            ctx.restore();
        }
    }

    startDeathAnimation() {
        this.deathState = {
            startTime: Date.now(),
            frameDuration: 100,
            currentFrame: 0,
            totalFrames: 4,
            startY: this.position.y,
            finished: false
        };
    }

    drawDeathAnimation() {
        if (!this.deathState || deathSpritesLoaded < 4) return;

        const elapsed = Date.now() - this.deathState.startTime;
        const totalDuration = this.deathState.frameDuration * this.deathState.totalFrames;

        if (elapsed >= totalDuration) {
            this.deathState.finished = true;
            return;
        }

        const frameIndex = Math.min(Math.floor(elapsed / this.deathState.frameDuration), this.deathState.totalFrames - 1);

        const progress = Math.min(elapsed / totalDuration, 1);
        const riseDistance = 30;
        this.position.y = this.deathState.startY - (riseDistance * progress);

        const sprite = deathSprites[frameIndex];
        if (!sprite) return;

        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, this.position.x, this.position.y, this.width, this.height);
        ctx.restore();
    }

    resetDeathState() { this.deathState = null; }
    update(platforms, waterRects) { this.handleMovement(waterRects); this.applyGravity(); this.checkCollisions(platforms, waterRects); this.lastY = this.position.y; }
    handleMovement(waterRects) {
        this.velocity.x = 0;
        if (keys.a.pressed || keys.arrowLeft.pressed) { this.velocity.x = -this.speed; this.facing = 'left'; }
        if (keys.d.pressed || keys.arrowRight.pressed) { this.velocity.x = this.speed; this.facing = 'right'; }
        const moving = this.velocity.x !== 0;
        const isInWater = waterRects.some(water => this.isCollidingWith(water));
        if (moving && this.onGround && Date.now() - this.lastStepTime > this.stepSoundInterval) {
            this.lastStepTime = Date.now();
            if (!isInWater) { GameAudio.sounds.step.triggerAttack("8n"); createNoise(this.position.x + this.width / 2, this.position.y + this.height, 80, 0.1); }
        }
    }
    applyGravity() { this.onGround = false; this.position.y += this.velocity.y; this.position.x += this.velocity.x; this.velocity.y += GRAVITY; if (this.position.x < 0) { this.position.x = 0; } if (this.position.x + this.width > canvas.width) { this.position.x = canvas.width - this.width; } }
    checkCollisions(platforms, waterRects) { for (const platform of platforms) { if (this.position.y + this.height <= platform.position.y && this.position.y + this.height + this.velocity.y >= platform.position.y && this.position.x + this.width > platform.position.x && this.position.x < platform.position.x + platform.width) { this.velocity.y = 0; this.onGround = true; this.position.y = platform.position.y - this.height; } } for (const platform of platforms) { if (this.isCollidingWith(platform)) { if (this.velocity.x > 0 && this.position.x + this.width - this.velocity.x <= platform.position.x) { this.position.x = platform.position.x - this.width; this.velocity.x = 0; } if (this.velocity.x < 0 && this.position.x - this.velocity.x >= platform.position.x + platform.width) { this.position.x = platform.position.x + platform.width; this.velocity.x = 0; } } } const wasInWater = waterRects.some(water => this.wasCollidingWith(water, this.lastY)); const isInWater = waterRects.some(water => this.isCollidingWith(water)); if (!wasInWater && isInWater && this.velocity.y > 2) { GameAudio.sounds.splash.triggerAttackRelease("C2", "0.5s"); createNoise(this.position.x + this.width / 2, this.position.y + this.height, 300, 0.8); } }
    isCollidingWith(rect) { return this.position.x < rect.position.x + rect.width && this.position.x + this.width > rect.position.x && this.position.y < rect.position.y + rect.height && this.position.y + this.height > rect.position.y; }
    wasCollidingWith(rect, lastY) { return this.position.x < rect.position.x + rect.width && this.position.x + this.width > rect.position.x && lastY < rect.position.y + rect.height && lastY + this.height > rect.position.y; }
    jump() { if (this.onGround) { this.velocity.y = -this.jumpForce; GameAudio.sounds.jump.triggerAttackRelease("C3", "0.1s"); } }
    createPing(type) {
        const now = Date.now(); const center = { x: this.position.x + this.width / 2, y: this.position.y + this.height / 2 }; const isInWater = game.level.water.some(water => this.isCollidingWith(water));
        if (type === 'short' && now - this.lastShortPing > this.shortPingCooldown) {
            this.lastShortPing = now; let radius = isInWater ? 60 : 120; pings.push(new Ping(center.x, center.y, radius, 1500, 'rgba(0, 255, 255, 1)', 4, 15)); createNoise(center.x, center.y, radius * 2, 0.3); GameAudio.sounds.shortPing.triggerAttackRelease("C5", "8n");
        } else if (type === 'long' && now - this.lastLongPing > this.longPingCooldown) { this.lastLongPing = now; let radius = isInWater ? 120 : 300; pings.push(new Ping(center.x, center.y, radius, 4000, 'rgba(255, 255, 255, 1)', 6, 40)); createNoise(center.x, center.y, radius * 2.5, 1.0); GameAudio.sounds.longPing.triggerAttackRelease("C3", "0.5s"); }
    }
}
class Ping { constructor(x, y, maxRadius, duration, color, speed, particleCount) { this.position = { x, y }; this.radius = 0; this.maxRadius = maxRadius; this.duration = duration; this.color = color; this.speed = speed; this.creationTime = Date.now(); this.active = true; this.particles = []; for (let i = 0; i < particleCount; i++) { this.particles.push(new PingParticle(this.position.x, this.position.y, this.color)); } } update() { this.radius += this.speed; this.particles.forEach(p => { if (p.life > 0) p.update(); }); if (this.radius >= this.maxRadius) { this.radius = this.maxRadius; if (Date.now() - this.creationTime > 500) { this.active = false; } } } draw() { const elapsed = Date.now() - this.creationTime; const alpha = Math.max(0, 1 - elapsed / (this.duration * 0.5)); for (let i = 0; i < 3; i++) { ctx.beginPath(); const currentRadius = this.radius - i * 15; if (currentRadius > 0) { ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * (1 - i * 0.3)})`; ctx.lineWidth = 1 + (1 - alpha); ctx.arc(this.position.x, this.position.y, currentRadius, 0, Math.PI * 2); ctx.stroke(); } } this.particles.forEach(p => { if (p.life > 0) p.draw(); }); } }
class PingParticle { constructor(x, y, color) { this.x = x; this.y = y; const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 2 + 1; this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.lifespan = 50 + Math.random() * 50; this.life = this.lifespan; this.color = color; } update() { this.x += this.vx; this.y += this.vy; this.life--; } draw() { ctx.fillStyle = this.color.replace('1)', `${this.life / this.lifespan})`); ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill(); } }
class WinParticle {
    constructor(x, y) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        this.x = x;
        this.y = y;
        this.size = Math.random() * 2 + 1;
        this.speedY = Math.sin(angle) * speed;
        this.speedX = Math.cos(angle) * speed;
        this.lifespan = 80 + Math.random() * 80;
        this.life = this.lifespan;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
    }

    draw() {
        const alpha = (this.life / this.lifespan) * 0.8;
        ctx.fillStyle = `rgba(255, 223, 150, ${alpha})`;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
class Enemy {
    constructor(x, y) {
        this.width = 25;
        this.height = 45;
        this.startPosition = { x, y };
        this.position = { x, y };
        this.velocity = { x: 1, y: 0 };
        this.speed = 1;
        this.state = 'patrol';
        this.target = null;
        this.revealTime = 0;
        this.onGround = false;
        this.facing = 'right';
        this.chaseStartTime = null;
        this.chaseDuration = 5000;
    }

    reset() {
        this.position = { ...this.startPosition };
        this.state = 'patrol';
        this.target = null;
        this.velocity.x = this.speed;
        this.chaseStartTime = null;
    }
    
    draw(player) { 
        const distanceToPlayer = Math.hypot(this.position.x - player.position.x, this.position.y - player.position.y); 
        if (Date.now() < this.revealTime || distanceToPlayer < 150 || window.DEV_MODE_REVEAL_MAP) {
            ctx.save(); 
            
            const glowX = this.position.x + this.width / 2;
            const glowY = this.position.y + this.height / 2;
            const glowRadius = Math.max(this.width, this.height) * 0.6;
            ctx.globalAlpha = 0.1;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0000';
            ctx.beginPath();
            ctx.arc(glowX, glowY, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
            ctx.fill();
            
            if (enemySpriteLoaded) {
                ctx.globalAlpha = 0.9;
                
                const spriteAspectRatio = enemySprite.width / enemySprite.height;
                const enemyAspectRatio = this.width / this.height;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (spriteAspectRatio > enemyAspectRatio) {
                    drawHeight = this.height;
                    drawWidth = this.height * spriteAspectRatio;
                    drawX = this.position.x - (drawWidth - this.width) / 2;
                    drawY = this.position.y;
                } else {
                    drawWidth = this.width;
                    drawHeight = this.width / spriteAspectRatio;
                    drawX = this.position.x;
                    drawY = this.position.y - (drawHeight - this.height) / 2;
                }
                
                const flip = this.facing === 'left';
                
                if (flip) {
                    ctx.drawImage(
                        enemySprite,
                        0, 0, enemySprite.width, enemySprite.height,
                        drawX, drawY, drawWidth, drawHeight
                    );
                } else {
                    ctx.save();
                    ctx.translate(drawX + drawWidth, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(
                        enemySprite,
                        0, 0, enemySprite.width, enemySprite.height,
                        0, drawY, drawWidth, drawHeight
                    );
                    ctx.restore();
                }
            } else {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; 
                ctx.beginPath(); 
                ctx.moveTo(this.position.x, this.position.y + this.height); 
                ctx.lineTo(this.position.x + this.width / 2, this.position.y + this.height * 0.7); 
                ctx.lineTo(this.position.x + this.width, this.position.y + this.height); 
                ctx.lineTo(this.position.x + this.width * 0.8, this.position.y + this.height * 0.5); 
                ctx.arc(this.position.x + this.width / 2, this.position.y + this.height * 0.3, this.width / 2.5, 0, Math.PI, true); 
                ctx.lineTo(this.position.x + this.width * 0.2, this.position.y + this.height * 0.5); 
                ctx.closePath(); 
                ctx.fill(); 
            }
            
            ctx.restore(); 
        
        } 
    }

    reveal() {
        this.revealTime = Date.now() + 2000;
    }

    update(player, platforms, noises) {
        this.onGround = false;
        this.velocity.y += GRAVITY;
        this.position.y += this.velocity.y;
        this.position.x += this.velocity.x;
        for (const platform of platforms) {
            if (this.position.y + this.height <= platform.position.y && this.position.y + this.height + this.velocity.y >= platform.position.y && this.position.x + this.width > platform.position.x && this.position.x < platform.position.x + platform.width) {
                this.velocity.y = 0;
                this.onGround = true;
                this.position.y = platform.position.y - this.height;
            }
            if (this.isCollidingWith(platform)) {
                if (this.velocity.x > 0 && this.position.x + this.width - this.velocity.x <= platform.position.x) {
                    this.position.x = platform.position.x - this.width;
                    this.velocity.x *= -1;
                } else if (this.velocity.x < 0 && this.position.x - this.velocity.x >= platform.position.x + platform.width) {
                    this.position.x = platform.position.x + platform.width;
                    this.velocity.x *= -1;
                }
            }
        }
        for (const platform of platforms) {
            if (Math.abs(this.position.y + this.height - platform.position.y) < 2 && this.position.x + this.width > platform.position.x && this.position.x < platform.position.x + platform.width) {
                this.velocity.y = 0;
                this.onGround = true;
                this.position.y = platform.position.y - this.height;
            }
        }
        this.handleAI(player, platforms, noises);
    }

    isCollidingWith(rect) {
        return this.position.x < rect.position.x + rect.width &&
            this.position.x + this.width > rect.position.x &&
            this.position.y < rect.position.y + rect.height &&
            this.position.y + this.height > rect.position.y;
    }

    handleAI(player, platforms, noises) {
        for (const noise of noises) {
            const distance = Math.hypot(this.position.x - noise.x, this.position.y - noise.y);
            if (distance < noise.radius * noise.intensity) {
                if (this.state === 'patrol') {
                    GameAudio.sounds.enemyAlert.triggerAttackRelease("A4", "0.2s");
                }
                this.state = 'investigating';
                this.target = { x: noise.x, y: noise.y };
                this.revealTime = Date.now() + 500;
            }
        }

        if (Date.now() < player.revealTime) {
            const distanceToPlayer = Math.hypot(this.position.x - player.position.x, this.position.y - player.position.y);
            if (distanceToPlayer < 200) {
                if (this.state !== 'chasing') {
                    this.chaseStartTime = Date.now();
                    GameAudio.increaseTension();
                    isChased = true;
                    if (player) player.isShaking = true;
                }
                this.state = 'chasing';
                this.target = player.position;
            }
        }

        if (this.state === 'patrol' && this.onGround) {
            const lookAheadX = this.velocity.x > 0 ? this.position.x + this.width : this.position.x - 1;
            const groundCheckY = this.position.y + this.height + 5;
            let groundAhead = false;
            for (const platform of platforms) {
                if (lookAheadX >= platform.position.x && lookAheadX <= platform.position.x + platform.width && groundCheckY >= platform.position.y && groundCheckY <= platform.position.y + platform.height) {
                    groundAhead = true;
                    break;
                }
            }
            if (!groundAhead) {
                this.velocity.x *= -1;
            }
        }
        
        switch (this.state) {
            case 'patrol':
                this.velocity.x = this.speed * Math.sign(this.velocity.x || 1);
                if (this.velocity.x > 0) this.facing = 'right';
                else if (this.velocity.x < 0) this.facing = 'left';
                break;

            case 'investigating':
                if (!this.target) { this.state = 'patrol'; return; }
                this.velocity.x = this.speed * 1.5 * Math.sign(this.target.x - this.position.x);
                if (this.velocity.x > 0) this.facing = 'right';
                else if (this.velocity.x < 0) this.facing = 'left';

                if (Math.abs(this.position.x - this.target.x) < 10) {
                    this.state = 'patrol';
                    this.target = null;
                }
                break;

            case 'chasing':
                if (!this.target) {
                    this.state = 'patrol';
                    return;
                }
                this.velocity.x = this.speed * 2 * Math.sign(this.target.x - this.position.x);
                
                if (this.velocity.x > 0) this.facing = 'right';
                else if (this.velocity.x < 0) this.facing = 'left';

                const chaseTimeElapsed = Date.now() - this.chaseStartTime;
                if (chaseTimeElapsed > this.chaseDuration) {
                    this.state = 'patrol';
                    this.target = null;
                    this.chaseStartTime = null;
                    GameAudio.decreaseTension();
                    isChased = false;
                    if (player) player.isShaking = false;
                }
                break;
        }
    }
}
class RevealedObject { constructor(platform, duration) { this.platform = platform; this.revealTime = Date.now(); this.duration = duration; } draw() { const elapsed = Date.now() - this.revealTime; if (elapsed > this.duration) return false; const alpha = 1 - (elapsed / this.duration); this.platform.draw(alpha); return true; } }
class Platform { constructor(x, y, width, height) { this.position = { x, y }; this.width = width; this.height = height; } draw(alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; const grad = ctx.createLinearGradient(this.position.x, this.position.y, this.position.x, this.position.y + this.height); grad.addColorStop(0, '#334'); grad.addColorStop(0.5, '#223'); grad.addColorStop(1, '#112'); ctx.fillStyle = grad; ctx.fillRect(this.position.x, this.position.y, this.width, this.height); ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.7})`; ctx.lineWidth = 1; ctx.strokeRect(this.position.x, this.position.y, this.width, this.height); ctx.restore(); } }
class HeartOfLight {
    constructor(x, y, width, height) {
        this.position = { x, y };
        this.width = width;
        this.height = height;
        this.revealTime = 0;
        this.isAbsorbed = false;
    }

    draw() {
        if ((Date.now() < this.revealTime || window.DEV_MODE_REVEAL_MAP) && !this.isAbsorbed) {
            const timeleft = this.revealTime - Date.now();
            const alpha = window.DEV_MODE_REVEAL_MAP ? 1 : Math.min(1, timeleft / 5000);
            const centerX = this.position.x + this.width / 2;
            const centerY = this.position.y + this.height / 2;
            const pulse = Math.sin(Date.now() / 200) * 5 + (this.width / 2);
            const gradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, pulse);
            gradient.addColorStop(0, `rgba(255, 255, 180, ${alpha})`);
            gradient.addColorStop(0.8, `rgba(255, 255, 0, ${alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(255, 200, 0, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, pulse, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    reveal() {
        this.revealTime = Date.now() + 5000;
    }

    absorb() {
        if (this.isAbsorbed) return;
        this.isAbsorbed = true;
        isLevelEnding = true;
        gameRunning = false;
        GameAudio.sounds.levelWinExplosion.triggerAttackRelease("2n");
        pings.push(new Ping(this.position.x + this.width / 2, this.position.y + this.height / 2, canvas.width * 1.5, 1500, 'rgba(255, 255, 255, 0.9)', 25, 0));
        setTimeout(() => {
            GameAudio.sounds.levelWin.triggerAttackRelease("C5", "0.5s");
            currentLevelIndex++;
            saveGameState();
            showMessage("levelCompleteTitle", "levelCompleteText", "nextLevelButton", () => {
                isLevelEnding = false;
                game.loadLevel(currentLevelIndex);
            });
        }, 1500);
    }
}class Water { constructor(x, y, width, height) { this.position = { x, y }; this.width = width; this.height = height; } draw() { ctx.fillStyle = 'rgba(0, 50, 150, 0.3)'; ctx.fillRect(this.position.x, this.position.y, this.width, this.height); } }
class AcidWater { constructor(x, y, width, height) { this.position = { x, y }; this.width = width; this.height = height; } draw() { const grad = ctx.createLinearGradient(this.position.x, this.position.y, this.position.x, this.position.y + this.height); grad.addColorStop(0, `rgba(100, 255, 100, 0.4)`); grad.addColorStop(1, `rgba(50, 200, 50, 0.7)`); ctx.fillStyle = grad; ctx.fillRect(this.position.x, this.position.y, this.width, this.height); } }
class Coin { constructor(x, y) { this.x = x; this.y = y; this.radius = 14; this.collected = false; this.animation = Math.random() * Math.PI * 2; } draw() { if (this.collected) return; const pulse = Math.sin(Date.now() / 200 + this.animation) * 3; ctx.save(); ctx.beginPath(); ctx.arc(this.x + this.radius, this.y + this.radius + pulse, this.radius, 0, Math.PI * 2); ctx.fillStyle = 'gold'; ctx.shadowColor = '#fff200'; ctx.shadowBlur = 10; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore(); } isCollidingWith(player) { const px = player.position.x + player.width / 2; const py = player.position.y + player.height / 2; const dx = (this.x + this.radius) - px; const dy = (this.y + this.radius) - py; const dist = Math.sqrt(dx * dx + dy * dy); return dist < this.radius + Math.max(player.width, player.height) / 2 - 8; } }

let currentLevelIndex = 0;

const levels = levelData.map(data => ({ ...data, platforms: data.platforms.map(p => new Platform(p.x, p.y, p.w, p.h)), water: data.water.map(w => new Water(w.x, w.y, w.w, w.h)), acid: data.acid.map(a => new AcidWater(a.x, a.y, a.w, a.h)), coins: data.coins ? data.coins.map(c => new Coin(c.x, c.y)) : [] }));

let coins = []; let totalCoins = 0; let collectedCoins = [];
function getCoinId(levelIndex, coin) { return `${levelIndex}-${Math.round(coin.x)}-${Math.round(coin.y)}`; }

function updateCoinHUD() {
    const coinCountCenter = document.getElementById('coin-count-center');
    if (coinCountCenter) coinCountCenter.textContent = totalCoins;
}

let player, pings, enemies, revealedObjects, noises, heartOfLight;
const game = {
    level: null,
    loadLevel: function (levelIndex) {
        if (levelIndex >= levels.length) { this.winGame(); return; }
        
        // Para a música do menu quando um nível for carregado
        if (typeof GameAudio !== 'undefined' && GameAudio.stopMenuMusic) {
            GameAudio.stopMenuMusic();
        }
        
        this.level = { ...levels[levelIndex] };
        player = new Player(); player.reset(this.level.playerStart.x, this.level.playerStart.y);
        enemies = this.level.enemies.map(e => new Enemy(e.x, e.y));
        heartOfLight = new HeartOfLight(this.level.exit.x, this.level.exit.y, this.level.exit.width, this.level.exit.height);
        pings = []; revealedObjects = []; noises = [];
        coins = this.level.coins.map(c => { const coin = Object.assign(Object.create(Object.getPrototypeOf(c)), c); const coinId = getCoinId(levelIndex, coin); if (collectedCoins.includes(coinId)) coin.collected = true; return coin; });
        showLevelIntro(this.level);
        updateCoinHUD();
        updateHUD();
    },
    restartLevel: function () {
        loadGameState(currentSlotId);
        player.reset(this.level.playerStart.x, this.level.playerStart.y);
        enemies.forEach(e => e.reset());
        pings = []; revealedObjects = []; noises = [];
        heartOfLight = new HeartOfLight(this.level.exit.x, this.level.exit.y, this.level.exit.width, this.level.exit.height);
        coins = this.level.coins.map(c => { const coin = Object.assign(Object.create(Object.getPrototypeOf(c)), c); const coinId = getCoinId(currentLevelIndex, coin); if (collectedCoins.includes(coinId)) coin.collected = true; return coin; });
        gameRunning = true;
    },
    winGame: async function () {
        if (isGameEnding) return;

        gameRunning = false;
        isGameEnding = true;
        GameAudio.sounds.gameWin.triggerAttackRelease("C4", "5s");
        localStorage.setItem('eco_premium_unlocked', 'true');

        const endTime = Date.now();
        const timeTaken = gameStartTime ? Math.round((endTime - gameStartTime) / 1000) : 0;

        // Envia webhook para zerar o jogo
        const saveData = currentSlotId ? JSON.parse(localStorage.getItem(getSaveSlotKey(currentSlotId)) || '{}') : {};
        const saveName = saveData.saveName || 'Save Desconhecido';
        const minutes = Math.floor(timeTaken / 60);
        const seconds = timeTaken % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const embed = createWebhookEmbed(
            '🏆 JOGO ZERADO!',
            `Um jogador completou o jogo ECO!`,
            0xffd700,
            [
                { name: 'Nome do Save', value: saveName, inline: true },
                { name: 'Tempo Total', value: timeString, inline: true },
                { name: 'Moedas Coletadas', value: totalCoins.toString(), inline: true },
                { name: 'Data de Conclusão', value: new Date().toLocaleString('pt-BR'), inline: false }
            ]
        );
        sendDiscordWebhook(embed);

        if (!player) {
            player = new Player();
            player.reset(canvas.width / 2, canvas.height / 2);
        }

        player.finalAnimationState = {
            startY: player.position.y,
            y: player.position.y,
            alpha: 1,
            startTime: Date.now(),
            duration: 4000,
            timeTaken: timeTaken,
            particles: [], 
            explosionTriggered: false
        };

        const winAnimationLoop = () => {
            if (!isGameEnding) return;

            const anim = player.finalAnimationState;
            const elapsed = Date.now() - anim.startTime;
            const progress = Math.min(elapsed / anim.duration, 1);

            anim.y = anim.startY - (progress * (canvas.height * 0.4));
            anim.alpha = 1 - Math.max(0, (progress - 0.6) / 0.4);

            if (progress < 0.9 && Math.random() > 0.3) {
                anim.particles.push(new WinParticle(player.position.x + player.width / 2, anim.y + player.height / 2));
            }

            if (progress >= 1 && !anim.explosionTriggered) {
                anim.explosionTriggered = true;
                pings.push(new Ping(canvas.width / 2, canvas.height / 2, canvas.width, 1500, 'rgba(255, 255, 255, 0.9)', 30, 100));

                setTimeout(async () => {
                    isGameEnding = false;
                    player.finalAnimationState = null;
                    showMessage("victoryTitle", "victoryText", "mainMenuButton", async () => {
                        mainMenu.classList.add('visible');
                        hud.classList.remove('visible');
                        cooldownsHud.classList.remove('visible');
                        document.getElementById('coin-hud').classList.remove('visible');
                        GameAudio.stopAmbientMusic();
                        
                        // Inicia a música do menu após vencer
                        if (typeof GameAudio !== 'undefined' && GameAudio.startMenuMusic) {
                            await GameAudio.startMenuMusic();
                        }
                    }, anim.timeTaken);
                }, 1000);
            }

            requestAnimationFrame(winAnimationLoop);
        };

        winAnimationLoop();
        if (window.ecoGame && typeof window.ecoGame.saveScore === 'function') {
            window.ecoGame.saveScore(timeTaken);
        }
    }
};

function createNoise(x, y, radius, intensity) { noises.push({ x, y, radius, intensity, creationTime: Date.now() }); }

function checkCollisionsAndReveal() {
    if (isLevelEnding || isGameEnding || !game.level) return;

    for (const ping of pings) {
        for (const platform of game.level.platforms) { if (isCircleIntersectingRect(ping, platform)) { revealedObjects.push(new RevealedObject(platform, ping.duration)); } }
        for (const enemy of enemies) { if (isCircleIntersectingRect(ping, enemy)) { enemy.reveal(); } }
        if (isCircleIntersectingRect(ping, player)) { player.revealTime = Date.now() + ping.duration; }
        if (isCircleIntersectingRect(ping, heartOfLight)) { heartOfLight.reveal(); }
    }

    if (!window.DEV_MODE_INVINCIBLE) {
        if (Date.now() - player.spawnTime > 1000) {
            for (const enemy of enemies) {
                if (player.isCollidingWith(enemy) && !player.deathState) {
                    gameRunning = false;
                    GameAudio.sounds.gameOver.triggerAttackRelease("C1", "1s");
                    GameAudio.decreaseTension(0.1);
                    isChased = false;
                    player.isShaking = false;
                    player.startDeathAnimation();
                    setTimeout(() => {
                        showMessage("youWereHeardTitle", "youWereHeardText", "tryAgainButton", () => {
                            player.resetDeathState();
                            game.restartLevel();
                        });
                    }, 1000);
                    return;
                }
            }
        }
        for (const acidPool of game.level.acid) {
            if (player.isCollidingWith(acidPool) && !player.deathState) {
                gameRunning = false;
                GameAudio.sounds.gameOver.triggerAttackRelease("C1", "1s");
                GameAudio.decreaseTension(0.1);
                isChased = false;
                player.isShaking = false;
                player.startDeathAnimation();
                setTimeout(() => {
                    showMessage("corrodedTitle", "corrodedText", "tryAgainButton", () => {
                        player.resetDeathState();
                        game.restartLevel();
                    });
                }, 1000);
                return;
            }
        }
    }

    if (player.isCollidingWith(heartOfLight)) { heartOfLight.absorb(); }
    for (const coin of coins) {
        if (!coin.collected && coin.isCollidingWith(player)) {
            coin.collected = true; totalCoins++;
            const coinId = getCoinId(currentLevelIndex, coin);
            if (!collectedCoins.includes(coinId)) collectedCoins.push(coinId);
            updateCoinHUD(); saveGameState();
            if (GameAudio.sounds && GameAudio.sounds.levelWin) GameAudio.sounds.levelWin.triggerAttackRelease("C6", "0.1s");
        }
    }
}

function isCircleIntersectingRect(circle, rect) { const distX = Math.abs(circle.position.x - rect.position.x - rect.width / 2); const distY = Math.abs(circle.position.y - rect.position.y - rect.height / 2); if (distX > (rect.width / 2 + circle.radius) || distY > (rect.height / 2 + circle.radius)) return false; if (distX <= (rect.width / 2) || distY <= (rect.height / 2)) return true; const dx = distX - rect.width / 2; const dy = distY - rect.height / 2; return (dx * dx + dy * dy <= (circle.radius * circle.radius)); }

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isGameEnding && player && player.finalAnimationState) {
        player.draw();
        return;
    }

    if (!game.level) return;

    if (window.DEV_MODE_REVEAL_MAP && game.level && game.level.platforms) {
        game.level.platforms.forEach(p => p.draw(1));
    } else {
        revealedObjects = revealedObjects.filter(ro => ro.draw());
    }
    game.level.water.forEach(w => w.draw());
    game.level.acid.forEach(a => a.draw());
    heartOfLight.draw();
    coins.forEach(c => c.draw());

    if (player) {
        player.draw();
    }

    if (enemies) {
        enemies.forEach(e => e.draw(player));
    }

    if (pings) {
        pings.forEach(p => p.draw());
        pings = pings.filter(p => p.active);
    }

    if (noises) {
        noises = noises.filter(n => Date.now() - n.creationTime < 100);
    }

    if (gameRunning && player) {
        player.update(game.level.platforms, game.level.water);
        enemies.forEach(e => e.update(player, game.level.platforms, noises));
        pings.forEach(p => p.update());
        checkCollisionsAndReveal();
        updateHUD();
    }

    if (isChased) {
        if (chaseVignetteOpacity < 1) chaseVignetteOpacity += 0.05;
    } else {
        if (chaseVignetteOpacity > 0) chaseVignetteOpacity -= 0.05;
    }
    
    if (chaseVignetteOpacity > 0) {
        const pulse = Math.sin(Date.now() / 150) * 0.1 + 0.9;
        const finalOpacity = chaseVignetteOpacity * pulse;
        ctx.save();
        const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 3, canvas.width / 2, canvas.height / 2, canvas.width / 1.5);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(200, 0, 0, ${finalOpacity * 0.5})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

function updateHUD() {
    if (!game.level) return;
    if (hud && hud.firstChild) {
        hud.firstChild.textContent = `${translations[currentLanguage].hudLevel} ${currentLevelIndex + 1}: ${game.level.name}`;
    }
    if (player && qCooldownFill) {
        qCooldownFill.style.width = `${Math.min(100, ((Date.now() - player.lastShortPing) / player.shortPingCooldown) * 100)}%`;
    }
    if (player && eCooldownFill) {
        eCooldownFill.style.width = `${Math.min(100, ((Date.now() - player.lastLongPing) / player.longPingCooldown) * 100)}%`;
    }
    updateCoinHUD();
}

function showMessage(titleKey, textKey, buttonKey, callback, timeTaken) {
    messageTitle.textContent = translations[currentLanguage][titleKey] || titleKey;

    let textContent = translations[currentLanguage][textKey] || textKey;
    if (titleKey === 'victoryTitle' && timeTaken !== undefined) {
        const minutes = Math.floor(timeTaken / 60);
        const seconds = timeTaken % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        textContent += ` ${translations[currentLanguage].victoryTime} ${timeString}`;
    }
    messageText.textContent = textContent;

    messageOverlay.classList.add('visible');
    const oldButton = document.getElementById('message-button');
    const newButton = oldButton.cloneNode(true);
    oldButton.parentNode.replaceChild(newButton, oldButton);
    newButton.textContent = translations[currentLanguage][buttonKey] || buttonKey;
    newButton.addEventListener('click', async () => {
        await GameAudio.initAudio();
        messageOverlay.classList.remove('visible');
        if (callback) {
            await callback();
            // Se o callback resultou no menu principal ficando visível, inicia a música do menu
            setTimeout(async () => {
                if (mainMenu.classList.contains('visible') && typeof GameAudio !== 'undefined' && GameAudio.startMenuMusic) {
                    await GameAudio.startMenuMusic();
                }
            }, 100);
        }
    }, { once: true });
}

function showLevelIntro(level) {
    const staticInstructions = currentLevelIndex === 0 ? translations[currentLanguage].levelIntroInstructions : "";
    showMessage(`${translations[currentLanguage].hudLevel} ${currentLevelIndex + 1}: ${level.name}`, staticInstructions, "levelIntroButton", () => { gameRunning = true; });
}

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function togglePause() {
    if (!gameStartTime || isLevelEnding || isGameEnding) return;
    if (gameRunning) {
        gameRunning = false;
        pauseLevelName.textContent = levels[currentLevelIndex].name;
        pauseTimePlayed.textContent = formatTime(Date.now() - gameStartTime);
        pauseTotalCoins.textContent = totalCoins;
        pauseMenu.classList.add('visible');
        GameAudio.sounds.pauseIn.triggerAttackRelease("C3", "0.1s");
        GameAudio.stopAmbientMusic();
    } else if (pauseMenu.classList.contains('visible')) {
        gameRunning = true;
        pauseMenu.classList.remove('visible');
        GameAudio.sounds.pauseOut.triggerAttackRelease("G3", "0.1s");
        GameAudio.startAmbientMusic();
        if (document.activeElement) document.activeElement.blur();
    }
}

// --- SISTEMA DE WEBHOOKS ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1393437919120986235/LKW8yaMuz94YdpNHJ0er1qyeTKMpGuzYZbhT5QA-9sGrjV7SM1ZkWYPAcYEroEbhE3mr';

async function sendDiscordWebhook(embed) {
    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [embed]
            })
        });
        
        if (!response.ok) {
            console.error('Erro ao enviar webhook:', response.status);
        }
    } catch (error) {
        console.error('Erro ao enviar webhook:', error);
    }
}

function createWebhookEmbed(title, description, color = 0x00ffff, fields = []) {
    return {
        title: title,
        description: description,
        color: color,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: 'ECO - Sistema de Logs'
        }
    };
}

// --- INICIALIZAÇÃO DO ÁUDIO ---
// Inicializa o áudio na primeira interação do usuário
let audioInitialized = false;
function initializeAudioOnFirstInteraction() {
    if (!audioInitialized && typeof GameAudio !== 'undefined') {
        GameAudio.initAudio().then(() => {
            audioInitialized = true;
            console.log('Áudio inicializado na primeira interação');
        });
    }
}

// Adiciona listeners para inicializar o áudio
document.addEventListener('click', initializeAudioOnFirstInteraction, { once: true });
document.addEventListener('keydown', initializeAudioOnFirstInteraction, { once: true });
document.addEventListener('touchstart', initializeAudioOnFirstInteraction, { once: true });

// --- LISTENERS DOS BOTÕES ---

startGameButton.addEventListener('click', async () => {
    console.log('🎮 Botão Iniciar Aventura clicado');
    
    // Para a música do menu antes de iniciar o jogo
    if (typeof GameAudio !== 'undefined' && GameAudio.stopMenuMusic) {
        GameAudio.stopMenuMusic();
    }
    
    // Esconde o menu e mostra os elementos do jogo
    mainMenu.classList.remove('visible');
    hud.classList.add('visible');
    cooldownsHud.classList.add('visible');
    document.getElementById('coin-hud').classList.add('visible');
    
    // Esconde o glitch-bg
    glitchBg.style.display = 'none';
    
    if (!gameStartTime) gameStartTime = Date.now();
    
    // Inicia a música do jogo
    console.log('🎵 Chamando startAmbientMusic...');
    await GameAudio.startAmbientMusic();
    game.loadLevel(currentLevelIndex);
    
    console.log('✅ Jogo iniciado com sucesso');
});

confirmSaveNameButton.addEventListener('click', () => {
    const name = newSaveNameInput.value.trim();
    if (!name) {
        alert(translations[currentLanguage].saveNameAlert);
        return;
    }
    createNewSave(pendingSlotId, name);
});

optionsButton.addEventListener('click', () => { mainMenu.classList.remove('visible'); optionsMenu.classList.add('visible'); cameFromPauseMenu = false; });
creditsButton.addEventListener('click', () => { mainMenu.classList.remove('visible'); creditsMenu.classList.add('visible'); });

saveSlotBackButton.addEventListener('click', () => {
    saveSlotMenu.classList.remove('visible');
    mainMenu.classList.add('visible');
    updateGlitchBgVisibility();
});

backButtons.forEach(button => {
    if (button.id === 'save-slot-back-button') return;
    button.addEventListener('click', () => {
        const parentOverlay = button.closest('.overlay');
        parentOverlay.classList.remove('visible');
        if (cameFromPauseMenu && parentOverlay.id === 'options-menu') {
            pauseMenu.classList.add('visible');
        } else {
            mainMenu.classList.add('visible');
        }
        cameFromPauseMenu = false;
    });
});

resumeButton.addEventListener('click', togglePause);
pauseOptionsButton.addEventListener('click', () => { pauseMenu.classList.remove('visible'); optionsMenu.classList.add('visible'); cameFromPauseMenu = true; });

backToMainMenuButton.addEventListener('click', async () => {
    saveGameState();
    GameAudio.stopAmbientMusic();
    gameRunning = false;
    game.level = null;
    pauseMenu.classList.remove('visible');
    mainMenu.classList.add('visible');
    hud.classList.remove('visible');
    cooldownsHud.classList.remove('visible');
    document.getElementById('coin-hud').classList.remove('visible');
    
    // Inicia a música do menu quando voltar
    if (typeof GameAudio !== 'undefined' && GameAudio.startMenuMusic) {
        await GameAudio.startMenuMusic();
    }
});

changeSaveButton.addEventListener('click', () => {
    mainMenu.classList.remove('visible');
    saveSlotMenu.classList.add('visible');
    saveSlotsContainer.classList.remove('loaded');
    renderSaveSlots();
    updateGlitchBgVisibility();
});


const glitchBg = document.getElementById('glitch-bg'); const glitchCtx = glitchBg.getContext('2d');
function resizeGlitchBg() { glitchBg.width = glitchBg.parentElement.clientWidth; glitchBg.height = glitchBg.parentElement.clientHeight; }
window.addEventListener('resize', resizeGlitchBg); resizeGlitchBg();

let lastMenuState = false;

async function updateGlitchBgVisibility() {
    const showGlitch = mainMenu.classList.contains('visible');
    glitchBg.style.display = showGlitch ? 'block' : 'none';
    
    // Só controla a música se o estado mudou
    if (showGlitch !== lastMenuState) {
        lastMenuState = showGlitch;
        
        // Controla a música do menu apenas quando o menu fica visível
        if (showGlitch) {
            if (typeof GameAudio !== 'undefined' && GameAudio.startMenuMusic) {
                GameAudio.stopAmbientMusic(); // Para a música do jogo se estiver tocando
                await GameAudio.startMenuMusic(); // Inicia a música do menu
            }
        }
        // Não para a música do menu quando ele fica invisível - isso é controlado manualmente
    }
}

const menuObserver = new MutationObserver(() => {
    updateGlitchBgVisibility().catch(console.error);
});
menuObserver.observe(mainMenu, { attributes: true, attributeFilter: ['class'] });
menuObserver.observe(saveSlotMenu, { attributes: true, attributeFilter: ['class'] });

function glitchBgLoop() {
    const showGlitch = mainMenu.classList.contains('visible');
    if (showGlitch) {
        drawGlitchPlayer();
    }
    requestAnimationFrame(glitchBgLoop);
}

function drawGlitchPlayer() {
    glitchCtx.save(); glitchCtx.globalAlpha = 1; glitchCtx.fillStyle = '#000'; glitchCtx.fillRect(0, 0, glitchBg.width, glitchBg.height); glitchCtx.restore();
    for (let i = 0; i < 7; i++) { const y = Math.random() * glitchBg.height; glitchCtx.save(); glitchCtx.globalAlpha = 0.08 + Math.random() * 0.08; glitchCtx.fillStyle = Math.random() > 0.7 ? '#00ffff' : '#fff'; glitchCtx.fillRect(0, y, glitchBg.width, 1 + Math.random() * 2); glitchCtx.restore(); }
    if (playerSpriteLoaded) {
        const w = playerSprite.width; const h = playerSprite.height;
        const scale = Math.min(glitchBg.width, glitchBg.height) / Math.max(w, h) * 0.7;
        const menuWidth = mainMenu.classList.contains('visible') ? mainMenu.offsetWidth : 0;
        const paddingLeft = mainMenu.classList.contains('visible') ? 40 : 0;
        const usableWidth = glitchBg.width - menuWidth - paddingLeft;
        const centerX = menuWidth + paddingLeft + usableWidth / 2;
        const baseY = glitchBg.height;
        glitchCtx.save(); glitchCtx.translate(centerX, baseY); glitchCtx.scale(scale, scale); glitchCtx.drawImage(playerSprite, -w / 2, -h, w, h); glitchCtx.restore();
    }
}

lojaButton.addEventListener('click', () => {
    if (currentSlotId === null) {
        alert(translations[currentLanguage].shopNoSave);
        return;
    }
    mainMenu.classList.remove('visible');
    shopMenu.classList.add('visible');
    updateShopHUD();
    renderShop();
});
shopMenu.querySelector('.back-button').addEventListener('click', () => {
    shopMenu.classList.remove('visible');
    mainMenu.classList.add('visible');
});

window.ecoGame = window.ecoGame || {};

Object.assign(window.ecoGame, {
    get game() { return game; },
    get player() { return player; },
    get enemies() { return enemies; },
    get heartOfLight() { return heartOfLight; },
    get totalCoins() { return totalCoins; },
    get GameAudio() { return GameAudio; },
    setTotalCoins: (value) => { 
        totalCoins = value; 
        if (typeof updateCoinHUD === 'function') updateCoinHUD();
        if (typeof saveGameState === 'function') saveGameState();
    },
    get currentLevelIndex() { return currentLevelIndex; },
    get currentSlotId() { return currentSlotId; },
    get isPremiumUnlocked() { return isPremiumUnlocked; },
    saveGameState,
    updateCoinHUD,
    checkCollisionsAndReveal,
    Platform,
    Enemy,
    HeartOfLight,
    get gameSettings() { return gameSettings; }
});

function setupVolumeSliders() {
    const masterSlider = document.getElementById('master-volume-slider');
    const musicSlider = document.getElementById('music-volume-slider');
    const effectsSlider = document.getElementById('effects-volume-slider');

    masterSlider.value = gameSettings.masterVolume;
    musicSlider.value = gameSettings.musicVolume;
    effectsSlider.value = gameSettings.effectsVolume;

    const sliders = [masterSlider, musicSlider, effectsSlider];

    function updateSliderFill(slider) {
        const min = slider.min || 0;
        const max = slider.max || 100;
        const value = slider.value;
        const percent = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--fill-percent', `${percent}%`);
    }

    sliders.forEach(slider => {
        updateSliderFill(slider);
        slider.addEventListener('input', (e) => {
            const slider = e.target;
            updateSliderFill(slider);
            
            if (slider.id === 'master-volume-slider') gameSettings.masterVolume = slider.value;
            if (slider.id === 'music-volume-slider') gameSettings.musicVolume = slider.value;
            if (slider.id === 'effects-volume-slider') gameSettings.effectsVolume = slider.value;
            
            if (typeof GameAudio !== 'undefined' && GameAudio.updateVolumes) GameAudio.updateVolumes();
            saveSettings();
        });
    });
}

function setupCustomSelect() {
    const container = document.querySelector('.custom-select-container');
    if (!container) return;

    const trigger = container.querySelector('#custom-select-trigger');
    const items = container.querySelector('#custom-select-items');
    const originalParent = items.parentNode; 

    const closeAllSelect = () => {
        if (!items.classList.contains('select-hide')) {
            items.classList.add('select-hide');
            trigger.classList.remove('select-arrow-active');
            originalParent.appendChild(items);
        }
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = items.classList.contains('select-hide');
        
        closeAllSelect();

        if (wasHidden) {
            document.body.appendChild(items);
            const rect = trigger.getBoundingClientRect();
            items.style.position = 'fixed';
            items.style.top = `${rect.bottom + 4}px`;
            items.style.left = `${rect.left}px`;
            items.style.width = `${rect.width}px`;
            items.classList.remove('select-hide');
            trigger.classList.add('select-arrow-active');
        }
    });

    items.querySelectorAll('div[data-value]').forEach(item => {
        item.addEventListener('click', () => {
            setLanguage(item.getAttribute('data-value'));
        });
    });
    
    document.addEventListener('click', closeAllSelect);
    window.addEventListener('scroll', closeAllSelect, true);
}


// --- INICIALIZAÇÃO DO JOGO ---
window.onload = () => {
    loadSettings();
    setupCustomSelect();
    setLanguage(gameSettings.language);

    saveSlotsContainer.classList.remove('loaded');
    renderSaveSlots();
    updateGlitchBgVisibility();
    glitchBgLoop();
    
    if (typeof GameAudio !== 'undefined' && GameAudio.updateVolumes) {
        GameAudio.updateVolumes();
    }
    
    setupVolumeSliders();
    animate();
};