import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuração do App (Firebase, Categorias, Senha)
const config = {
    firebase: {
        apiKey: "AIzaSyDo4HgnZG9To1aeDoAbUd7vbfgSUAHHtSs",
        authDomain: "iconesutil.firebaseapp.com",
        projectId: "iconesutil",
        storageBucket: "iconesutil.appspot.com",
        messagingSenderId: "88285859566",
        appId: "1:88285859566:web:e15fdb0c615b494955edff"
    },
    categories: {
        'servicos-utilidades': { name: 'Serviços & Utilidades' },
        'cursos-concursos': { name: 'Cursos & Concursos' },
        'ferramentas-downloads': { name: 'Ferramentas & Downloads' },
        'compras-produtividade': { name: 'Compras & Produtividade' },
        'design-audio': { name: 'Design & Audio' },
        'midia-entretenimento': { name: 'Mídia & Entretenimento' }
    },
    restricted: { 
        password: "11", 
    }
};

// Estado global da aplicação
const state = { 
    allIcons: [], 
    currentUser: null, 
    searchTerm: '',
    isSearchBarOpen: false, 
    isFabMenuOpen: false, 
    isEditMode: false, 
    
    // NOVO ESTADO PARA ACESSO RESTRITO
    isRestrictedAreaOpen: false,
    restrictedTexts: [],
    isLocked: true, // Começa bloqueado para exigir a senha

    // NOVO ESTADO PARA FIXADOS
    isPinnedCollapsed: false, // Começa não recolhido
};

// Módulo de Serviço do Firebase
const FirebaseService = {
    db: null, auth: null,
    init() {
        const app = initializeApp(config.firebase);
        this.db = getFirestore(app);
        this.auth = getAuth(app);
    },
    authenticate(callback) {
        onAuthStateChanged(this.auth, user => {
            if (user) { state.currentUser = user; }
            else { signInAnonymously(this.auth); }
            callback();
        });
    },
    onIconsUpdate(callback) {
        onSnapshot(collection(this.db, "icones"), snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    },
    async updateIcon(id, data) { await updateDoc(doc(this.db, "icones", id), data); },
    async addIcon(data) { await addDoc(collection(this.db, "icones"), { ...data, createdAt: serverTimestamp() }); },
    async deleteIcon(id) { await deleteDoc(doc(this.db, "icones", id)); },

    // NOVO: Funções CRUD para Textos Restritos
    onRestrictedTextsUpdate(callback) {
         // Busca e ordena por título
        const q = query(collection(this.db, "restrictedTexts"), orderBy("title")); 
        onSnapshot(q, snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    },
    async addRestrictedText(data) { await addDoc(collection(this.db, "restrictedTexts"), { ...data, createdAt: serverTimestamp() }); },
    async updateRestrictedText(id, data) { await updateDoc(doc(this.db, "restrictedTexts", id), data); },
    async deleteRestrictedText(id) { await deleteDoc(doc(this.db, "restrictedTexts", id)); }
};

// Módulo Gerenciador da Interface (UI)
const UIManager = {
    elements: {},
    init() {
        this.elements = {
            body: document.body, mainContent: document.getElementById('main-content'),
            topSearchBarWrapper: document.getElementById('top-search-bar-wrapper'), 
            searchInput: document.getElementById('search-input'), 
            allCategoriesGrid: document.getElementById('all-categories-grid'),
            searchResultsContainer: document.getElementById('search-results-container'), 
            modalOverlay: document.getElementById('generator-modal-overlay'),
            generatorModal: document.getElementById('generate-icon-code-section'), 
            closeModalBtn: document.getElementById('close-generator-modal-btn'),
            iconForm: document.getElementById('icon-form'), formStatusMessage: document.getElementById('form-status-message'),
            modalTitle: document.getElementById('modal-title'), 
            submitIconBtn: document.getElementById('submit-icon-button'),
            
            // ELEMENTOS DO FAB 
            fabActionsContainer: document.getElementById('fab-actions-container'), 
            fabMainButton: null, 
            fabMenu: null, 
            fabEditModeItem: null, // NOVO: Referência ao item do modo edição

            // NOVOS ELEMENTOS DO ACESSO RESTRITO
            restrictedAreaWrapper: document.getElementById('restricted-area-wrapper'),
            closeRestrictedModalBtn: document.getElementById('close-restricted-modal-btn'),
            restrictedTextsList: document.getElementById('restricted-texts-list'),
            loginFormRestricted: document.getElementById('login-form-restricted'),
            restrictedContent: document.getElementById('restricted-content'),
            restrictedPasswordInput: document.getElementById('restricted-password-input'),
            loginStatusMessage: document.getElementById('login-status-message'),
            restrictedTextForm: document.getElementById('restricted-text-form'),
            restrictedTextIdInput: document.getElementById('restricted-text-id-input'),
            restrictedTextTitleInput: document.getElementById('restricted-text-title-input'),
            restrictedTextContentInput: document.getElementById('restricted-text-content-input'),
            saveRestrictedTextBtn: document.getElementById('submit-restricted-text-button'),
            
            // NOVO ELEMENTO DO FIXADOS
            pinnedHeaderClickable: document.getElementById('pinned-header-clickable'), 
        };
        this.populateCategorySelect();
        this.setupNewFabMenu();
        this.toggleRestrictedArea(false); // Garante que começa oculto
    },
    
    setupNewFabMenu() {
        const fabContainer = this.elements.fabActionsContainer;
        
        const fabButton = document.createElement('button');
        fabButton.className = 'fab-round-button';
        // ALTERADO: Trocando o '+' por uma lupa de pesquisa (SVG)
        fabButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
        `;
        fabButton.setAttribute('aria-label', 'Abrir Menu de Ações');
        
        const fabMenu = document.createElement('ul');
        fabMenu.className = 'fab-menu';
        fabMenu.innerHTML = `
            <li class="fab-menu-item" data-action="search">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <span>Pesquisar</span>
            </li>
            <li class="fab-menu-item" data-action="edit-mode">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                <span>Modo Edição</span>
            </li>
            <li class="fab-menu-item" data-action="add">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
                <span>Adicionar Botão</span>
            </li>
            <li class="fab-menu-item" data-action="restricted">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 10V6c0-3.31-2.69-6-6-6s-6 2.69-6 6v4H3v14h18V10h-3zm-2 0h-4V6c0-2.21 1.79-4 4-4s4 1.79 4 4v4H8V6c0-2.21 1.79-4 4-4s4 1.79 4 4v4h-2z"/></svg>
                <span>Acesso Restrito</span>
            </li>
            <li class="fab-menu-item" data-action="theme">
                <svg id="theme-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0 9 9c0 .47-.04.93-.12 1.38-.6-.11-1.2-.18-1.83-.18-3.03 0-5.5 2.47-5.5 5.5 0 .63.07 1.23.18 1.83-.45.08-.91.12-1.38.12A9 9 0 0 1 3 12 9 9 0 0 1 12 3z"/></svg>
                <span>Mudar Tema</span>
            </li>
        `;

        fabContainer.appendChild(fabButton);
        fabContainer.appendChild(fabMenu);
        
        this.elements.fabMainButton = fabButton;
        this.elements.fabMenu = fabMenu;
        this.elements.fabEditModeItem = fabMenu.querySelector('[data-action="edit-mode"]');
    },

    // Gerencia o modo de edição dos ícones
    toggleEditMode(show = !state.isEditMode) {
        state.isEditMode = show;
        localStorage.setItem('isEditMode', state.isEditMode);
        this.elements.body.classList.toggle('edit-mode-active', show);
        this.elements.fabEditModeItem.classList.toggle('active', show);
        // ALTERADO: Apenas mudando o conteúdo do botão e a cor do ícone.
        this.elements.fabMainButton.innerHTML = show 
            ? '✏️' 
            : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
        this.elements.fabMainButton.style.color = show ? 'var(--edit-mode-color)' : 'var(--fab-color)';
        this.elements.fabMainButton.classList.remove('open'); 

        if(show) {
            this.toggleFabMenu(false);
            this.toggleSearchBar(false);
        } else {
            this.render(); 
        }
    },
    
    toggleFabMenu(show = !state.isFabMenuOpen) {
        state.isFabMenuOpen = show;
        // REMOVIDA A LÓGICA DE ROTAÇÃO NO FAB PRINCIPAL (já que não é mais um '+')
        // this.elements.fabMainButton.classList.toggle('open', show); 
        this.elements.fabMenu.classList.toggle('visible', show);
    },

    // NOVOS: Funções para o Modal de Acesso Restrito
    openRestrictedModal() {
        this.toggleFabMenu(false); 
        this.elements.restrictedAreaWrapper.classList.add('visible');
        this.elements.modalOverlay.classList.add('visible');
        document.body.classList.add('modal-open');
        this.toggleRestrictedArea(!state.isLocked);
        this.elements.restrictedPasswordInput.value = '';
        this.elements.loginStatusMessage.style.display = 'none';
    },
    closeRestrictedModal() {
        this.elements.restrictedAreaWrapper.classList.remove('visible');
        this.elements.modalOverlay.classList.remove('visible');
        document.body.classList.remove('modal-open');
        this.clearRestrictedTextForm();
    },
    toggleRestrictedArea(isUnlocked) {
        state.isRestrictedAreaOpen = isUnlocked;
        this.elements.loginFormRestricted.style.display = isUnlocked ? 'none' : 'block';
        this.elements.restrictedContent.style.display = isUnlocked ? 'block' : 'none';
        if (isUnlocked) {
            this.renderRestrictedTexts();
        }
    },
    renderRestrictedTexts() {
        const list = this.elements.restrictedTextsList;
        list.innerHTML = '';
        if (state.restrictedTexts.length === 0) {
            list.innerHTML = `<p style="text-align: center; color: var(--text-color);">Nenhum item restrito disponível.</p>`;
            return;
        }

        state.restrictedTexts.forEach(item => {
            const div = document.createElement('div');
            div.className = 'restricted-text-item';
            div.dataset.id = item.id;
            
            const isLink = item.content.startsWith('http');
            const contentHtml = isLink 
                ? `<a href="${item.content}" target="_blank" rel="noopener noreferrer">${item.content}</a>`
                : `<p>${item.content}</p>`;

            div.innerHTML = `
                <h4>${item.title}</h4>
                <p>${contentHtml}</p>
                <div class="restricted-text-actions">
                    <button data-action="edit" title="Editar">✏️</button>
                    <button data-action="delete" title="Excluir">🗑️</button>
                </div>
            `;
            list.appendChild(div);
        });
    },
    clearRestrictedTextForm() {
        this.elements.restrictedTextForm.reset();
        this.elements.restrictedTextIdInput.value = '';
        this.elements.saveRestrictedTextBtn.textContent = 'Salvar Item';
    },
    loadRestrictedTextForEdit(id) {
        const item = state.restrictedTexts.find(t => t.id === id);
        if (item) {
            this.elements.restrictedTextIdInput.value = item.id;
            this.elements.restrictedTextTitleInput.value = item.title;
            this.elements.restrictedTextContentInput.value = item.content;
            this.elements.saveRestrictedTextBtn.textContent = 'Atualizar Item';
        }
    },
    // Fim de Funções de Acesso Restrito

    toggleSearchBar(show) {
        state.isSearchBarOpen = show;
        this.elements.topSearchBarWrapper.classList.toggle('visible', show);
        this.elements.body.classList.toggle('search-open', show);
        
        if (show) {
            this.elements.searchInput.focus();
            this.toggleFabMenu(false); 
            this.toggleEditMode(false); 
        } else {
            this.elements.searchInput.value = '';
            state.searchTerm = '';
            this.render(); 
        }
    },
    
    // NOVO: Função para recolher/mostrar fixados
    togglePinned(show = !state.isPinnedCollapsed) {
        const pinnedCard = document.getElementById('category-fixados');
        if (pinnedCard) {
            state.isPinnedCollapsed = show;
            pinnedCard.classList.toggle('collapsed', show);
        }
    },

    render() {
        const { allCategoriesGrid, searchResultsContainer } = this.elements;
        allCategoriesGrid.innerHTML = ''; 
        searchResultsContainer.innerHTML = '';

        const term = state.searchTerm;
        const filteredIcons = state.searchTerm
            ? state.allIcons.filter(i => {
                const name = (i.name || '').toLowerCase();
                const description = (i.description || '').toLowerCase();
                return name.includes(term) || description.includes(term);
            })
            : state.allIcons;

        if (state.searchTerm) {
            searchResultsContainer.style.display = 'flex';
            searchResultsContainer.style.flexDirection = 'column';
            allCategoriesGrid.style.display = 'none';
            if (filteredIcons.length) {
                filteredIcons.forEach(i => searchResultsContainer.appendChild(this.createIconElement(i)));
            } else {
                searchResultsContainer.innerHTML = `<p style="color: var(--text-color); grid-column: 1 / -1; text-align: center;">Nenhum ícone encontrado para **"${state.searchTerm}"**.</p>`;
            }
        } else {
            searchResultsContainer.style.display = 'none';
            allCategoriesGrid.style.display = 'block';

            const pinnedIcons = filteredIcons.filter(i => i.isPinned);
            const regularIcons = filteredIcons.filter(i => !i.isPinned);
            
            // Renderiza "Fixados"
            if (pinnedIcons.length > 0) {
                const pinnedCardContainer = document.createElement('section');
                pinnedCardContainer.className = 'category-card';
                pinnedCardContainer.id = 'category-fixados';
                // Adiciona a classe 'collapsed' se o estado for true
                if (state.isPinnedCollapsed) {
                    pinnedCardContainer.classList.add('collapsed');
                }
                pinnedCardContainer.innerHTML = `<div class="icons-grid"></div>`; 
                
                const pinnedGrid = pinnedCardContainer.querySelector('.icons-grid');
                pinnedIcons.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                pinnedIcons.forEach(i => pinnedGrid.appendChild(this.createIconElement(i)));
                allCategoriesGrid.appendChild(pinnedCardContainer);
            }


            // Renderiza outras categorias
            const byCategory = regularIcons.reduce((acc, i) => {
                (acc[i.category] = acc[i.category] || []).push(i);
                return acc;
            }, {});

            Object.keys(config.categories).forEach(id => {
                const icons = byCategory[id] || [];
                if (icons.length > 0) {
                    const card = this.createCategoryCard(id, config.categories[id].name);
                    const grid = card.querySelector('.icons-grid');
                    icons.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    icons.forEach(i => grid.appendChild(this.createIconElement(i)));
                    allCategoriesGrid.appendChild(card);
                }
            });
            
            // Recolhe categorias (exceto a primeira)
            const cards = allCategoriesGrid.querySelectorAll('.category-card');
            cards.forEach((card, index) => {
                // Aplica a lógica de recolher categorias (exceto fixados, que é controlado pelo togglePinned)
                if (card.id !== 'category-fixados' && index > 0) { 
                    card.classList.add('collapsed');
                }
            });
        }
    },
    
    populateCategorySelect() {
        const select = this.elements.iconForm.elements.iconCategorySelect;
        select.innerHTML = '<option value="" disabled selected>Selecione uma categoria</option>';
        for (const id in config.categories) {
            select.innerHTML += `<option value="${id}">${config.categories[id].name}</option>`;
        }
    },
    openModal(data = null) {
        this.toggleFabMenu(false); 
        const { iconForm, modalTitle, generatorModal, modalOverlay, submitIconBtn } = this.elements;
        iconForm.reset();
        iconForm.elements.iconIdInput.value = '';
        if (data) {
            modalTitle.textContent = "Editar Ícone";
            submitIconBtn.textContent = "Atualizar Ícone";
            
            iconForm.elements.iconNameInput.value = data.name || '';
            iconForm.elements.iconDescriptionInput.value = data.description || '';
            iconForm.elements.iconLinkInput.value = data.link || '';
            iconForm.elements.iconImageUrlInput.value = data.imageUrl || '';
            iconForm.elements.iconColorClassInput.value = data.colorClass || '';
            iconForm.elements.iconCustomBgColorInput.value = data.customBgColor || '#cccccc';
            iconForm.elements.iconCategorySelect.value = data.category || '';
            iconForm.elements.iconIdInput.value = data.id || '';
            iconForm.elements.iconFontFamilyInput.value = data.fontFamily || '';

        } else {
            modalTitle.textContent = "Adicionar Novo Ícone";
            submitIconBtn.textContent = "Salvar Ícone";
        }
        generatorModal.classList.add('visible');
        modalOverlay.classList.add('visible');
        document.body.classList.add('modal-open');
    },
    closeModal() {
        this.elements.generatorModal.classList.remove('visible');
        // Se o modal de ícone for fechado, o overlay e o body.modal-open só devem ser removidos se o modal restrito também não estiver aberto.
        if(!state.isRestrictedAreaOpen) {
            this.elements.modalOverlay.classList.remove('visible');
            document.body.classList.remove('modal-open');
        }
        this.elements.formStatusMessage.style.display = 'none';
    },
    toggleTheme(isDark) {
        this.elements.body.classList.toggle('dark-mode', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const iconSvg = document.getElementById('theme-icon');
        if (iconSvg) {
            // SVG do Sol (claro) e Lua (escuro)
            const path = isDark 
                ? "M12 3a9 9 0 0 0 9 9c0 .47-.04.93-.12 1.38-.6-.11-1.2-.18-1.83-.18-3.03 0-5.5 2.47-5.5 5.5 0 .63.07 1.23.18 1.83-.45.08-.91.12-1.38.12A9 9 0 0 1 3 12 9 9 0 0 1 12 3z"
                : "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 7h2v5h-2zm0 6h2v2h-2z";
            iconSvg.querySelector('path').setAttribute('d', path);
        }
    },
     showContextMenu(icon, wrapper) {
         
        document.querySelectorAll('.icon-card-wrapper > .context-menu').forEach(menu => {
            menu.remove();
        });
        
        const menu = document.createElement('ul');
        menu.className = 'context-menu';
        
        menu.innerHTML = `
            <li data-action="edit">Editar Ícone</li>
            <li data-action="pin">${icon.isPinned ? 'Desafixar' : 'Fixar no Topo'}</li>
            <li data-action="delete" class="danger-option">Excluir Ícone</li>`;
        
        menu.style.display = 'block'; 
        wrapper.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) menu.remove();
        };

        menu.addEventListener('click', e => {
            const action = e.target.closest('li')?.dataset.action;
            if (!action) return;
            if (action === 'edit') App.editIcon(icon.id);
            if (action === 'pin') FirebaseService.updateIcon(icon.id, { isPinned: !icon.isPinned });
            if (action === 'delete') {
                const nameForAlert = icon.name && icon.name.trim().length > 0 ? icon.name : 'Sem Título';
                if (confirm(`Tem certeza que deseja excluir o ícone "${nameForAlert}"?`)) {
                    FirebaseService.deleteIcon(icon.id);
                }
            }
            menu.remove();
        });
        // Fecha o menu ao clicar fora
        setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
    },
    createIconElement(icon) {
        const wrapper = document.createElement('div');
        wrapper.className = 'icon-card-wrapper';
        wrapper.dataset.id = icon.id;

        const link = document.createElement('a');
        link.href = icon.link;
        link.className = 'icon-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const visual = document.createElement('div');
        visual.className = 'icon-visual';
        
        wrapper.dataset.title = icon.name ? icon.name.toLowerCase() : '';
        wrapper.dataset.description = icon.description ? icon.description.toLowerCase() : '';

        if (icon.imageUrl) {
            const img = document.createElement('img');
            img.src = icon.imageUrl;
            img.alt = icon.name || "Ícone Personalizado";
            img.style.width = '100%'; 
            img.style.height = '100%';
            img.style.objectFit = 'fill'; 
            visual.appendChild(img);
        } else {
            if (icon.colorClass) visual.classList.add(icon.colorClass);
            else visual.style.backgroundColor = icon.customBgColor || '#ccc';

            const fallbackLetter = document.createElement('span');
            fallbackLetter.className = 'icon-visual-fallback';
            fallbackLetter.textContent = (icon.name && icon.name.length > 0) ? icon.name.charAt(0).toUpperCase() : '?';
            visual.appendChild(fallbackLetter);
        }

        const textContent = document.createElement('div');
        textContent.className = 'icon-text-content';
        const title = document.createElement('span');
        title.className = 'icon-title';
        title.textContent = icon.name || ''; 

        if (icon.fontFamily) {
            title.style.fontFamily = icon.fontFamily;
            if (icon.fontFamily.includes('Bangers') || icon.fontFamily.includes('Pacifico') || icon.fontFamily.includes('Lobster')) {
                title.style.fontSize = '1.2em'; 
            }
            if (icon.fontFamily.includes('Press Start 2P')) {
                title.style.fontSize = '0.7em'; 
            }
        }
        
        textContent.appendChild(title);

        const actionButton = document.createElement('button');
        actionButton.className = 'icon-actions-button';
        actionButton.setAttribute('aria-label', 'Opções do ícone');
        actionButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
        
        actionButton.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            this.showContextMenu(icon, wrapper);
        };
        
        link.appendChild(visual);
        link.appendChild(textContent);
        
        link.appendChild(actionButton); 

        wrapper.appendChild(link);
        return wrapper;
    },
    createCategoryCard(id, name) {
        const card = document.createElement('section');
        card.className = 'category-card';
        card.id = `category-${id}`;
        card.innerHTML = `<div class="category-header"><h2>${name}</h2></div><div class="icons-grid"></div>`;
        return card;
    },
};

// Módulo Principal da Aplicação
const App = {
    init() {
        FirebaseService.init();
        UIManager.init();
        this.bindEvents();
        
        // Carrega o estado de edição salvo localmente
        state.isEditMode = localStorage.getItem('isEditMode') === 'true'; 
        UIManager.toggleEditMode(state.isEditMode);
        
        // Carrega o estado de recolhimento salvo localmente (NOVO)
        state.isPinnedCollapsed = localStorage.getItem('isPinnedCollapsed') === 'true';
        
        FirebaseService.authenticate(() => FirebaseService.onIconsUpdate(icons => {
            state.allIcons = icons;
            UIManager.render();
            // Garante que o estado de recolhimento seja aplicado após a renderização inicial
            UIManager.togglePinned(state.isPinnedCollapsed); 
        }));

        // NOVO: Monitora a coleção de textos restritos
        FirebaseService.onRestrictedTextsUpdate(texts => {
            state.restrictedTexts = texts;
            if (state.isRestrictedAreaOpen && !state.isLocked) {
                UIManager.renderRestrictedTexts();
            }
        });

        this.loadTheme();
    },
    bindEvents() {
        const { 
            searchInput, closeModalBtn, iconForm, allCategoriesGrid, modalOverlay,
            fabMainButton, fabMenu, closeRestrictedModalBtn, restrictedTextsList,
            loginFormRestricted, restrictedTextForm, pinnedHeaderClickable, // NOVO
        } = UIManager.elements;
        
        // Eventos do FAB
        if (fabMainButton) {
            // O clique no FAB agora abre o menu que tem a opção de pesquisa
            fabMainButton.addEventListener('click', () => UIManager.toggleFabMenu());
        }

        if (fabMenu) {
            fabMenu.addEventListener('click', (e) => {
                const action = e.target.closest('.fab-menu-item')?.dataset.action;
                if (!action) return;

                UIManager.toggleFabMenu(false); 

                if (action === 'search') {
                    UIManager.toggleSearchBar(true);
                } else if (action === 'add') {
                    UIManager.openModal();
                } else if (action === 'edit-mode') {
                    UIManager.toggleEditMode();
                    UIManager.render();
                } else if (action === 'theme') {
                     UIManager.toggleTheme(localStorage.getItem('theme') !== 'dark');
                } else if (action === 'restricted') {
                    UIManager.openRestrictedModal();
                }
            });
        }
        
        // NOVO: Evento para recolher/mostrar o balão de Fixados
        if (pinnedHeaderClickable) {
            pinnedHeaderClickable.addEventListener('click', () => {
                UIManager.togglePinned();
                localStorage.setItem('isPinnedCollapsed', state.isPinnedCollapsed);
            });
        }


        let searchTimeout;
        searchInput.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.searchTerm = e.target.value.toLowerCase().trim();
                UIManager.render();
            }, 200); 
        });
        
        allCategoriesGrid.addEventListener('click', e => {
            const header = e.target.closest('.category-header');
            if (header) {
                // A lógica de recolher categorias deve ser mantida para as categorias normais
                header.parentElement.classList.toggle('collapsed');
            }
        });
        
        // Eventos do Modal de Ícones
        closeModalBtn.addEventListener('click', () => UIManager.closeModal());
        // Remover o overlay se o modal de ícone for fechado e o restrito não estiver aberto
        modalOverlay.addEventListener('click', () => {
            if(UIManager.elements.generatorModal.classList.contains('visible')) {
                UIManager.closeModal();
            }
            if(UIManager.elements.restrictedAreaWrapper.classList.contains('visible')) {
                 UIManager.closeRestrictedModal();
            }
        });
        iconForm.addEventListener('submit', this.handleIconFormSubmit);
        
        // NOVOS Eventos do Modal Restrito
        closeRestrictedModalBtn.addEventListener('click', () => UIManager.closeRestrictedModal());
        loginFormRestricted.addEventListener('submit', this.handleLoginAttempt);
        restrictedTextForm.addEventListener('submit', this.handleRestrictedTextFormSubmit);
        restrictedTextsList.addEventListener('click', this.handleRestrictedTextActions);

    },
    
    async handleIconFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const id = form.elements.iconIdInput.value;
        const data = {
            name: form.elements.iconNameInput.value.trim() || '', 
            description: form.elements.iconDescriptionInput.value.trim() || '', 
            link: form.elements.iconLinkInput.value.trim(),
            imageUrl: form.elements.iconImageUrlInput.value.trim(),
            colorClass: form.elements.iconColorClassInput.value.trim(),
            customBgColor: form.elements.iconCustomBgColorInput.value,
            category: form.elements.iconCategorySelect.value,
            fontFamily: form.elements.iconFontFamilyInput.value, 
        };

        if (!data.link || !data.category) {
            UIManager.elements.formStatusMessage.textContent = 'Os campos Link e Categoria são obrigatórios.';
            UIManager.elements.formStatusMessage.style.display = 'block';
            return;
        }

        try {
            if (id) {
                await FirebaseService.updateIcon(id, data);
            }
            else {
                await FirebaseService.addIcon({ ...data, isPinned: false }); 
            }
            UIManager.closeModal();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            UIManager.elements.formStatusMessage.textContent = 'Erro ao salvar o ícone.';
            UIManager.elements.formStatusMessage.style.display = 'block';
        }
    },
    editIcon(id) {
        const iconData = state.allIcons.find(icon => icon.id === id);
        if (iconData) UIManager.openModal(iconData);
    },
    
    // NOVOS: Métodos de Lógica Restrita
    handleLoginAttempt(event) {
        event.preventDefault();
        const passwordInput = UIManager.elements.restrictedPasswordInput;
        const statusMessage = UIManager.elements.loginStatusMessage;

        if (passwordInput.value === config.restricted.password) {
            state.isLocked = false;
            UIManager.toggleRestrictedArea(true);
            statusMessage.style.display = 'none';
        } else {
            statusMessage.textContent = 'Senha incorreta.';
            statusMessage.style.display = 'block';
            passwordInput.value = '';
        }
    },
    async handleRestrictedTextFormSubmit(event) {
        event.preventDefault();
        const id = UIManager.elements.restrictedTextIdInput.value;
        const title = UIManager.elements.restrictedTextTitleInput.value.trim();
        const content = UIManager.elements.restrictedTextContentInput.value.trim();
        
        if (!title || !content) return;

        const data = { title, content };

        try {
            if (id) {
                await FirebaseService.updateRestrictedText(id, data);
            } else {
                await FirebaseService.addRestrictedText(data);
            }
            UIManager.clearRestrictedTextForm();
        } catch (error) {
            console.error("Erro ao salvar texto restrito:", error);
            alert("Erro ao salvar o item restrito.");
        }
    },
    handleRestrictedTextActions(event) {
        const button = event.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const itemId = button.closest('.restricted-text-item')?.dataset.id;
        if (!itemId) return;

        if (action === 'edit') {
            UIManager.loadRestrictedTextForEdit(itemId);
        } else if (action === 'delete') {
            if (confirm('Tem certeza que deseja excluir este item restrito?')) {
                FirebaseService.deleteRestrictedText(itemId);
            }
        }
    },
    // Fim de Métodos de Lógica Restrita

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        let initialTheme = 'light'; 

        if (savedTheme) {
            initialTheme = savedTheme;
        }
        if (!savedTheme) {
           localStorage.setItem('theme', initialTheme);
        }
        UIManager.toggleTheme(initialTheme === 'dark');
    }
};

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', () => App.init());
