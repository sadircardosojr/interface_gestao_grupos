class TreeNode {
    constructor(id, name, children = []) {
        this.id = id;
        this.name = name;
        this.children = children;
    }
}

class TreeView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.data = null;
        this.selectedNodeId = null;
        this.expandedNodes = new Set();
        this.loadState();
        this.setupModal();
    }

    loadState() {
        // Carregar estado salvo do localStorage
        const savedState = localStorage.getItem('treeState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.selectedNodeId = state.selectedNodeId;
            this.expandedNodes = new Set(state.expandedNodes);
        }
    }

    saveState() {
        // Salvar estado no localStorage
        const state = {
            selectedNodeId: this.selectedNodeId,
            expandedNodes: Array.from(this.expandedNodes)
        };
        localStorage.setItem('treeState', JSON.stringify(state));
    }

    async loadData() {
        try {
            const response = await fetch('/api/tree');
            this.data = await response.json();
            this.render();
            this.restoreState();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    restoreState() {
        // Restaurar nós expandidos
        this.expandedNodes.forEach(nodeId => {
            const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
            if (nodeElement) {
                const childrenContainer = nodeElement.querySelector('.tree-item-children');
                if (childrenContainer) {
                    childrenContainer.classList.add('expanded');
                }
            }
        });

        // Restaurar nó selecionado
        if (this.selectedNodeId) {
            const selectedElement = document.querySelector(`[data-node-id="${this.selectedNodeId}"]`);
            if (selectedElement) {
                const content = selectedElement.querySelector('.tree-item-content');
                content.classList.add('selected');
                this.showContent(this.findNodeById(this.selectedNodeId));
            }
        }
    }

    findNodeById(id, nodes = this.data) {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children && node.children.length > 0) {
                const found = this.findNodeById(id, node.children);
                if (found) return found;
            }
        }
        return null;
    }

    createTreeNode(node, level = 0) {
        const treeItem = document.createElement('div');
        treeItem.className = 'tree-item';
        treeItem.setAttribute('data-node-id', node.id);
        
        const content = document.createElement('div');
        content.className = 'tree-item-content';
        
        const toggleIcon = document.createElement('div');
        toggleIcon.className = 'toggle-icon';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;

        // Adicionar botão de novo nível apenas se o nível for menor que 2 (neto)
        if (level < 2) {
            const addLevelBtn = document.createElement('button');
            addLevelBtn.className = 'add-level-btn';
            addLevelBtn.innerHTML = '+';
            addLevelBtn.title = 'Adicionar novo nível';
            addLevelBtn.onclick = (e) => {
                e.stopPropagation();
                this.currentParentNode = node;
                this.currentLevel = level;
                this.modal.classList.add('visible');
                this.modal.querySelector('.modal-input').focus();
            };
            content.appendChild(addLevelBtn);
        }
        
        content.appendChild(toggleIcon);
        content.appendChild(nameSpan);
        treeItem.appendChild(content);

        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-item-children';
            
            node.children.forEach(child => {
                childrenContainer.appendChild(this.createTreeNode(child, level + 1));
            });

            treeItem.appendChild(childrenContainer);
            
            toggleIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = childrenContainer.classList.contains('expanded');
                childrenContainer.classList.toggle('expanded');
                treeItem.classList.toggle('expanded', !isExpanded);
                
                if (!isExpanded) {
                    this.expandedNodes.add(node.id);
                } else {
                    this.expandedNodes.delete(node.id);
                }
                this.saveState();
            });
        } else {
            treeItem.classList.add('leaf-node');
        }

        content.addEventListener('click', () => {
            // Remover seleção anterior
            document.querySelectorAll('.tree-item-content.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // Adicionar nova seleção
            content.classList.add('selected');
            this.selectedNodeId = node.id;
            this.saveState();
            
            if (node.children && node.children.length > 0) {
                const childrenContainer = treeItem.querySelector('.tree-item-children');
                const isExpanded = childrenContainer.classList.contains('expanded');
                childrenContainer.classList.toggle('expanded');
                treeItem.classList.toggle('expanded', !isExpanded);
                
                if (!isExpanded) {
                    this.expandedNodes.add(node.id);
                } else {
                    this.expandedNodes.delete(node.id);
                }
                this.saveState();
            } else {
                this.showContent(node);
            }
        });

        return treeItem;
    }

    showContent(node) {
        const contentContainer = document.getElementById('content');
        contentContainer.innerHTML = `
            <h2>${node.name}</h2>
            <p>ID: ${node.id}</p>
            <div class="condition-builder">
                <div class="condition-toolbox">
                    <div class="condition-item" draggable="true" data-type="contains">Contém</div>
                    <div class="condition-item" draggable="true" data-type="equals">Igual</div>
                    <div class="condition-item" draggable="true" data-type="notEquals">Diferente</div>
                    <div class="condition-item" draggable="true" data-type="notContains">Não Contém</div>
                    <div class="condition-item" draggable="true" data-type="regex">Regex</div>
                </div>
                <div class="condition-dropzone" id="conditionDropzone">
                    <div class="condition-sequence" id="conditionSequence"></div>
                </div>
                <div class="button-group">
                    <button class="edit-button" id="editConditions">Editar Condições</button>
                    <button class="save-button" id="saveConditions" disabled>Salvar Condições</button>
                </div>
            </div>
        `;

        //this.setupDragAndDrop();
        this.loadSavedConditions(node.id);
        this.setupEditMode();

        // Garantir que o estado inicial esteja correto
        const conditionBuilder = document.querySelector('.condition-builder');
        const editButton = document.getElementById('editConditions');
        const saveButton = document.getElementById('saveConditions');
        
        conditionBuilder.classList.remove('editing');
        editButton.disabled = false;
        saveButton.disabled = true;
        localStorage.setItem('isEditing', 'false');
    }

    setupEditMode() {
        const editButton = document.getElementById('editConditions');
        const saveButton = document.getElementById('saveConditions');
        const conditionBuilder = document.querySelector('.condition-builder');
        const isEditing = localStorage.getItem('isEditing') === 'true';

        // Resetar o estado inicial
        conditionBuilder.classList.remove('editing');
        editButton.disabled = false;
        saveButton.disabled = true;

        // Se estiver em modo de edição, aplicar o estado
        if (isEditing) {
            conditionBuilder.classList.add('editing');
            editButton.disabled = true;
            saveButton.disabled = false;
        }

        editButton.addEventListener('click', () => {
            conditionBuilder.classList.add('editing');
            editButton.disabled = true;
            saveButton.disabled = false;
            localStorage.setItem('isEditing', 'true');

            // Reativar o drag and drop
            this.setupDragAndDrop();
        });

        saveButton.addEventListener('click', async () => {
            const conditions = [];
            const blocks = document.querySelectorAll('.condition-block');
            
            for (const block of blocks) {
                const type = block.querySelector('select').value;
                const value = block.querySelector('.input-row:first-child input').value;
                const result = block.querySelector('.input-row:last-child input').value;
                
                if (!type || !value) {
                    alert('Por favor, preencha todos os campos obrigatórios.');
                    return;
                }
                
                conditions.push({ type, value, result });
            }

            // Salvar no localStorage
            localStorage.setItem(`conditions_${this.selectedNodeId}`, JSON.stringify(conditions));
            
            // Salvar no banco de dados
            const saved = await this.saveConditionsToDatabase(conditions);
            
            if (saved) {
                localStorage.setItem('isEditing', 'false');
                conditionBuilder.classList.remove('editing');
                editButton.disabled = false;
                saveButton.disabled = true;
            }
        });
    }

    loadSavedConditions(nodeId) {
        const savedConditions = localStorage.getItem(`conditions_${nodeId}`);
        if (savedConditions) {
            const conditions = JSON.parse(savedConditions);
            conditions.forEach(condition => {
                this.addConditionBlock(condition.type, condition.value, condition.result);
            });
        }
    }

    addConditionBlock(conditionType, value = '', result = '') {
        const sequence = document.getElementById('conditionSequence');
        const block = document.createElement('div');
        block.className = 'condition-block';
        block.draggable = true;
        block.setAttribute('data-is-condition-block', 'true');
        
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮';
        
        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'condition-inputs';
        
        // Linha do tipo de condição e valor
        const conditionRow = document.createElement('div');
        conditionRow.className = 'input-row';
        
        const select = document.createElement('select');
        select.innerHTML = `
            <option value="contains">Contém</option>
            <option value="equals">Igual</option>
            <option value="notEquals">Diferente</option>
            <option value="notContains">Não Contém</option>
            <option value="regex">Regex</option>
        `;
        select.value = conditionType;
        
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.placeholder = 'Digite o valor...';
        valueInput.value = value;
        
        conditionRow.appendChild(select);
        conditionRow.appendChild(valueInput);
        
        // Linha do resultado
        const resultRow = document.createElement('div');
        resultRow.className = 'input-row';
        
        const resultLabel = document.createElement('label');
        resultLabel.textContent = 'Grupo:';
        
        const resultInput = document.createElement('input');
        resultInput.type = 'text';
        resultInput.className = 'result-input';
        resultInput.placeholder = 'Digite o resultado...';
        resultInput.value = result;
        
        resultRow.appendChild(resultLabel);
        resultRow.appendChild(resultInput);
        
        inputsContainer.appendChild(conditionRow);
        inputsContainer.appendChild(resultRow);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => {
            block.remove();
        });
        
        block.appendChild(dragHandle);
        block.appendChild(inputsContainer);
        block.appendChild(removeBtn);
        
        sequence.appendChild(block);

        // Configurar drag and drop para o novo bloco
        this.setupBlockDragAndDrop(block);
    }

    setupBlockDragAndDrop(block) {
        block.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', 'reorder');
            block.classList.add('dragging');
        });

        block.addEventListener('dragend', () => {
            block.classList.remove('dragging');
            const dropIndicator = document.querySelector('.drop-indicator');
            if (dropIndicator) {
                dropIndicator.classList.remove('visible');
            }
        });
    }

    setupDragAndDrop() {
        const dropzone = document.getElementById('conditionDropzone');
        const sequence = document.getElementById('conditionSequence');
        const saveButton = document.getElementById('saveConditions');
        
        // Criar e adicionar o indicador de drop
        const dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        sequence.appendChild(dropIndicator);

        // Configurar drag and drop para os itens da toolbox
        const conditionItems = document.querySelectorAll('.condition-item');
        conditionItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('type', 'new');
                e.dataTransfer.setData('conditionType', item.dataset.type);
            });
        });

        // Configurar drag and drop para reordenação
        sequence.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingBlock = document.querySelector('.condition-block.dragging');
            if (draggingBlock) {
                const afterElement = this.getDragAfterElement(sequence, e.clientY);
                const sequenceRect = sequence.getBoundingClientRect();
                
                if (afterElement) {
                    const rect = afterElement.getBoundingClientRect();
                    dropIndicator.style.top = `${rect.top - sequenceRect.top}px`;
                } else {
                    const blocks = sequence.querySelectorAll('.condition-block:not(.dragging)');
                    if (blocks.length > 0) {
                        const lastBlock = blocks[blocks.length - 1];
                        const rect = lastBlock.getBoundingClientRect();
                        dropIndicator.style.top = `${rect.bottom - sequenceRect.top}px`;
                    } else {
                        dropIndicator.style.top = '0px';
                    }
                }
                dropIndicator.classList.add('visible');
            }
        });

        sequence.addEventListener('dragleave', (e) => {
            const rect = sequence.getBoundingClientRect();
            const left = rect.left + window.scrollX;
            const right = rect.right + window.scrollX;
            const top = rect.top + window.scrollY;
            const bottom = rect.bottom + window.scrollY;

            if (e.clientX < left || e.clientX >= right || 
                e.clientY < top || e.clientY >= bottom) {
                dropIndicator.classList.remove('visible');
            }
        });

        sequence.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropIndicator.classList.remove('visible');

            const type = e.dataTransfer.getData('type');
            const draggingBlock = document.querySelector('.condition-block.dragging');

            if (type === 'new') {
                const conditionType = e.dataTransfer.getData('conditionType');
                this.addConditionBlock(conditionType);
            } else if (draggingBlock) {
                const afterElement = this.getDragAfterElement(sequence, e.clientY);
                if (afterElement) {
                    sequence.insertBefore(draggingBlock, afterElement);
                } else {
                    sequence.appendChild(draggingBlock);
                }
                draggingBlock.classList.remove('dragging');
            }
        });

        // Configurar drag and drop para os blocos existentes
        const existingBlocks = sequence.querySelectorAll('.condition-block');
        existingBlocks.forEach(block => {
            this.setupBlockDragAndDrop(block);
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.types.includes('type') && e.dataTransfer.getData('type');
            if (type === 'new') {
                dropzone.classList.add('highlight');
            }
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('highlight');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('highlight');

            const type = e.dataTransfer.getData('type');
            if (type === 'new') {
                const conditionType = e.dataTransfer.getData('conditionType');
                this.addConditionBlock(conditionType);
            }
        });

        // Configurar botão de salvar
        if (this.saveButtonClickHandler) {
            saveButton.removeEventListener('click', this.saveButtonClickHandler);
        }

        this.saveButtonClickHandler = () => {
            const conditions = [];
            const blocks = sequence.querySelectorAll('.condition-block');
            blocks.forEach(block => {
                const type = block.querySelector('select').value;
                const value = block.querySelector('.input-row:first-child input').value;
                const result = block.querySelector('.input-row:last-child input').value;
                conditions.push({ type, value, result });
            });

            // Salvar no localStorage
            localStorage.setItem(`conditions_${this.selectedNodeId}`, JSON.stringify(conditions));

            // Salvar no banco de dados
            this.saveConditionsToDatabase(conditions);
        };

        saveButton.addEventListener('click', this.saveButtonClickHandler);
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.condition-block:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async saveConditionsToDatabase(conditions) {
        try {
            console.log('Enviando condições para o servidor:', {
                nodeId: this.selectedNodeId,
                conditions: conditions
            });

            const response = await fetch('/api/save-conditions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    nodeId: this.selectedNodeId,
                    conditions: conditions
                })
            });

            console.log('Status da resposta:', response.status);
            console.log('Headers da resposta:', response.headers);

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.error('Resposta não-JSON do servidor:', text);
                throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao salvar condições');
            }

            if (!data.success) {
                throw new Error(data.error || 'Falha ao salvar condições');
            }

            console.log('Condições salvas com sucesso:', data.message);
            return true;
        } catch (error) {
            console.error('Erro ao salvar condições:', error);
            alert('Erro ao salvar condições: ' + error.message);
            return false;
        }
    }

    render() {
        this.container.innerHTML = '';
        if (this.data) {
            this.data.forEach(node => {
                this.container.appendChild(this.createTreeNode(node));
            });
        }
    }

    setupModal() {
        // Criar o modal
        const modal = document.createElement('div');
        modal.className = 'floating-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">Adicionar Novo Nível</div>
                <input type="text" class="modal-input" placeholder="Digite o nome do novo nível">
                <div class="modal-buttons">
                    <button class="modal-button cancel">Cancelar</button>
                    <button class="modal-button save">Salvar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Configurar eventos dos botões
        const cancelBtn = modal.querySelector('.cancel');
        const saveBtn = modal.querySelector('.save');
        const input = modal.querySelector('.modal-input');

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
            input.value = '';
        });

        saveBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (name && this.currentParentNode) {
                this.addNewLevel(this.currentParentNode, this.currentLevel, name);
                modal.classList.remove('visible');
                input.value = '';
            }
        });

        // Fechar modal ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('visible');
                input.value = '';
            }
        });

        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('visible')) {
                modal.classList.remove('visible');
                input.value = '';
            }
        });

        this.modal = modal;
    }

    saveToLocalStorage() {
        // Salvar a estrutura da árvore
        localStorage.setItem('treeData', JSON.stringify(this.data));
        
        // Salvar o estado atual (nós expandidos e selecionados)
        this.saveState();
    }

    async addNewLevel(parentNode, currentLevel, name = 'Novo Nível') {
        console.log('Iniciando adição de novo nível:', {
            parentNode,
            currentLevel,
            name
        });

        if (currentLevel >= 2) {
            console.log('Nível máximo atingido (2)');
            return;
        }

        const newNode = {
            id: Date.now(),
            name: name,
            children: []
        };

        console.log('Novo nó criado:', newNode);

        // Garantir que o nó pai tenha um array de filhos
        if (!parentNode.children) {
            console.log('Inicializando array de filhos para o nó pai');
            parentNode.children = [];
        }

        // Adicionar o novo nó como filho do nó pai
        parentNode.children.push(newNode);
        console.log('Nó adicionado ao pai. Filhos do pai:', parentNode.children);

        // Expandir automaticamente o nó pai
        this.expandedNodes.add(parentNode.id);
        console.log('Nó pai expandido. Nós expandidos:', Array.from(this.expandedNodes));

        try {
            console.log('Iniciando requisição para salvar no banco de dados');
            const requestBody = {
                parentId: parentNode.id,
                node: newNode
            };
            console.log('Dados da requisição:', requestBody);

            // Salvar no banco de dados
            const response = await fetch('/api/save-node', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Status da resposta:', response.status);
            console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Resposta não-ok:', errorText);
                throw new Error(`Erro ao salvar o novo nível no banco de dados: ${response.status} ${errorText}`);
            }

            let data;
            try {
                data = await response.json();
                console.log('Dados da resposta:', data);
            } catch (parseError) {
                console.error('Erro ao parsear resposta JSON:', parseError);
                throw new Error('Resposta inválida do servidor: não é um JSON válido');
            }

            if (!data.success) {
                console.error('Falha na operação:', data.error);
                throw new Error(data.error || 'Falha ao salvar o novo nível');
            }

            // Atualizar o ID do nó com o ID retornado pelo servidor
            const oldId = newNode.id;
            newNode.id = data.nodeId;
            console.log('ID do nó atualizado:', { oldId, newId: data.nodeId });

            // Salvar no localStorage
            console.log('Salvando no localStorage');
            this.saveToLocalStorage();

            // Reconstruir a árvore
            console.log('Reconstruindo a árvore');
            this.render();
            this.restoreState();

            // Selecionar o novo nó
            this.selectedNodeId = newNode.id;
            this.saveState();
            console.log('Novo nó selecionado:', this.selectedNodeId);

            console.log('Novo nível adicionado com sucesso:', data.message);
        } catch (error) {
            console.error('Erro detalhado ao adicionar novo nível:', {
                error: error.message,
                stack: error.stack,
                parentNode: parentNode.id,
                newNode: newNode.id
            });
            
            alert('Erro ao adicionar novo nível: ' + error.message);
            
            // Remover o nó adicionado em caso de erro
            const index = parentNode.children.indexOf(newNode);
            if (index > -1) {
                console.log('Removendo nó em caso de erro, índice:', index);
                parentNode.children.splice(index, 1);
            }
        }
    }
}

// Inicializar a árvore quando o documento estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    const treeView = new TreeView('tree');
    treeView.loadData();
}); 